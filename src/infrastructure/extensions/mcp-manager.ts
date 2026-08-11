import { Buffer } from 'node:buffer'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'

import { redactSensitiveText } from '../../shared/errors/redact-sensitive-text'
import {
  ExtensionRuntimeStatusEventSchema,
  ExtensionToolScopeChangedEventSchema,
  McpRuntimeConfigSchema,
  McpToolSnapshotSchema,
  type ExtensionRuntimeStatusEvent,
  type McpRuntimeConfig,
  type McpToolSnapshot
} from '../../shared/schemas/extensions'

// ========= 类型 =========

/** MCP Client 可用的首版稳定传输。 */
type ManagedMcpTransport = StdioClientTransport | StreamableHTTPClientTransport

/** 已建立或正在建立的单 Server 连接。 */
interface ManagedMcpConnection {
  /** 当前 SDK Client。 */
  readonly client: Client
  /** 当前 SDK Transport。 */
  readonly transport: ManagedMcpTransport
  /** 建连完成任务。 */
  ready: Promise<void>
  /** 当前配置指纹。 */
  readonly fingerprint: string
  /** 正在执行的工具数。 */
  pendingCalls: number
  /** 是否为 NcxMusic 主动关闭。 */
  deliberateClose: boolean
  /** 十分钟空闲关闭计时器。 */
  idleTimer?: ReturnType<typeof setTimeout>
  /** 连续稳定运行后清零崩溃计数的计时器。 */
  stableTimer?: ReturnType<typeof setTimeout>
}

/** 模型可见的动态 MCP 工具定义。 */
export interface McpProviderToolDefinition {
  /** 强制命名空间后的唯一工具名。 */
  readonly name: string
  /** Server 提供的说明。 */
  readonly description: string
  /** Server 实际上报的输入 JSON Schema。 */
  readonly parameters: Readonly<Record<string, unknown>>
}

/** MCP 测试连接结果。 */
export interface McpProbeResult {
  /** initialize 是否成功。 */
  readonly ok: boolean
  /** 实际 Server capabilities。 */
  readonly capabilities: Readonly<Record<string, unknown>>
  /** 分页枚举得到的实际工具。 */
  readonly tools: readonly McpToolSnapshot[]
  /** 脱敏结果摘要。 */
  readonly message: string
}

/** 动态 MCP 工具执行结果。 */
export interface McpCallResult {
  /** Server 是否返回 Tool 错误。 */
  readonly ok: boolean
  /** 稳定结果码。 */
  readonly code: string
  /** 适合交给模型的有限文本。 */
  readonly summary: string
  /** 经过截断与脱敏的结构化结果。 */
  readonly data?: unknown
}

/** MCP Manager 构造参数。 */
export interface McpManagerOptions {
  /** 连接状态回调。 */
  readonly onStatus?: (event: ExtensionRuntimeStatusEvent) => void
  /** 调用前实际 Tool diff 回调。 */
  readonly onToolScopeChanged?: (event: ReturnType<typeof ExtensionToolScopeChangedEventSchema.parse>) => void
  /** 空闲自动关闭时长，测试可缩短。 */
  readonly idleTimeoutMs?: number
}

// ========= 变量 =========

/** MCP Server 意外退出后的固定退避。 */
const MCP_RESTART_DELAYS_MS = [1_000, 2_000, 5_000] as const

/** 无活动 Tool Call 时自动关闭连接。 */
const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1_000

/** 连续运行达到该时长才视为新一轮稳定会话。 */
const MCP_STABLE_CONNECTION_MS = 5 * 60 * 1_000

/** 单次提供给模型的 MCP 结果上限。 */
const MCP_MODEL_RESULT_LIMIT_BYTES = 64 * 1_024

/** 单次 MCP 列表最大分页数，防止恶意 Cursor 无限循环。 */
const MCP_MAX_TOOL_PAGES = 32

// ========= 类 =========

/** Utility 内唯一 MCP 生命周期管理器，只实现官方 stdio 与 Streamable HTTP。 */
export class McpManager {
  /** Main 最新同步的私有运行配置。 */
  private readonly configs = new Map<string, McpRuntimeConfig>()

  /** 当前按需连接。 */
  private readonly connections = new Map<string, ManagedMcpConnection>()

  /** 每个 Server 当前连续崩溃重启次数。 */
  private readonly restartCounts = new Map<string, number>()

  /** 等待重启的计时器。 */
  private readonly restartTimers = new Map<string, ReturnType<typeof setTimeout>>()

  /** Tool 全名到 Server/原始工具名的只读索引。 */
  private readonly toolIndex = new Map<string, { readonly serverId: string; readonly toolName: string }>()

  /** 空闲关闭阈值。 */
  private readonly idleTimeoutMs: number

  constructor(private readonly options: McpManagerOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
  }

  /** 原子应用 Main 下发配置；删除、禁用或指纹变化会显式关闭旧连接。 */
  async sync(rawConfigs: readonly McpRuntimeConfig[]): Promise<void> {
    /** 经共享 Schema 校验的新配置索引。 */
    const next = new Map(rawConfigs.map((item) => {
      /** 单项已验证配置。 */
      const config = McpRuntimeConfigSchema.parse(item)
      return [config.serverId, config] as const
    }))

    for (const [serverId, connection] of this.connections) {
      /** 与当前连接对应的新配置。 */
      const config = next.get(serverId)
      if (!config || !config.enabled || config.configurationFingerprint !== connection.fingerprint) {
        await this.close(serverId)
      }
    }

    for (const serverId of this.configs.keys()) {
      if (next.has(serverId)) continue
      this.clearRestartTimer(serverId)
      this.restartCounts.delete(serverId)
    }
    for (const [serverId, config] of next) {
      /** 指纹变化代表用户显式更新配置，允许重新开始一次重启预算。 */
      const previous = this.configs.get(serverId)
      if (!previous || previous.configurationFingerprint !== config.configurationFingerprint) {
        this.clearRestartTimer(serverId)
        this.restartCounts.set(serverId, 0)
      }
    }

    this.configs.clear()
    for (const [serverId, config] of next) this.configs.set(serverId, config)
    this.rebuildToolIndex()
  }

  /** 返回已启用且已批准的动态 MCP 工具。 */
  providerDefinitions(): McpProviderToolDefinition[] {
    /** 当前可见定义。 */
    const definitions: McpProviderToolDefinition[] = []
    for (const config of this.configs.values()) {
      if (!this.isApproved(config)) continue
      for (const tool of config.lastKnownTools) {
        definitions.push({
          name: this.publicToolName(config.serverId, tool.name),
          description: tool.description ?? `${config.displayName} 提供的 MCP 工具 ${tool.name}`,
          parameters: tool.inputSchema
        })
      }
    }
    return definitions
  }

  /** 判断当前动态工具是否已注册并获准。 */
  has(toolName: string): boolean {
    return this.toolIndex.has(toolName)
  }

  /** 建连并返回 initialize 与完整 tools/list 实际结果，调用结束显式关闭测试连接。 */
  async probe(serverId: string): Promise<McpProbeResult> {
    /** 待测试配置。 */
    const config = this.requiredConfig(serverId)
    try {
      /** 测试允许连接尚未启用或尚未批准的配置。 */
      const connection = await this.ensureConnected(config, true)
      /** initialize 返回的能力。 */
      const capabilities = connection.client.getServerCapabilities() ?? {}
      /** 分页工具清单。 */
      const tools = await this.listAllTools(connection.client)
      return { ok: true, capabilities, tools, message: `连接成功，发现 ${tools.length} 个工具。` }
    } catch (error) {
      return { ok: false, capabilities: {}, tools: [], message: safeError(error) }
    } finally {
      await this.close(serverId)
    }
  }

  /** 调用已经过 Agent ApprovalCard 逐次批准的外部工具。 */
  async call(toolName: string, rawArguments: unknown, signal: AbortSignal): Promise<McpCallResult> {
    /** 已批准工具索引。 */
    const target = this.toolIndex.get(toolName)
    if (!target) return { ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: 'MCP 工具未注册或需要重新批准。' }
    /** Server 私有配置。 */
    const config = this.requiredConfig(target.serverId)
    if (!this.isApproved(config)) {
      return { ok: false, code: 'POLICY_DENIED', summary: 'MCP Server 已禁用或工具范围需要重新批准。' }
    }
    /** Tool 参数必须为普通对象。 */
    const argumentsObject = isRecord(rawArguments) ? rawArguments : undefined
    if (!argumentsObject) return { ok: false, code: 'TOOL_ARGUMENTS_INVALID', summary: 'MCP 工具参数必须是对象。' }

    try {
      /** 按需建立的当前 Server 连接。 */
      const connection = await this.ensureConnected(config, false)
      /** 建连后复核真实工具范围，防止 Server 静默替换工具。 */
      const actualTools = await this.listAllTools(connection.client)
      if (!sameTools(actualTools, config.lastKnownTools)) {
        this.options.onToolScopeChanged?.(ExtensionToolScopeChangedEventSchema.parse({
          kind: 'extension.tool-scope.changed',
          serverId: config.serverId,
          capabilities: connection.client.getServerCapabilities() ?? {},
          tools: actualTools,
          message: 'MCP 实际工具范围已变化，调用前已阻断并要求重新批准。'
        }))
        await this.close(config.serverId)
        return { ok: false, code: 'MCP_REAPPROVAL_REQUIRED', summary: 'MCP 工具范围已变化，已停止调用；请在设置中重新测试并批准。' }
      }
      connection.pendingCalls += 1
      this.clearIdleTimer(connection)
      try {
        /** SDK 校验后的标准 Tool Result。 */
        const result = await connection.client.callTool(
          { name: target.toolName, arguments: argumentsObject },
          CallToolResultSchema,
          { signal, timeout: 120_000, maxTotalTimeout: 120_000 }
        )
        /** 限长且脱敏的模型结果。 */
        const safeResult = limitModelResult(result)
        return {
          ok: !('isError' in result && result.isError === true),
          code: 'isError' in result && result.isError === true ? 'MCP_TOOL_ERROR' : 'OK',
          summary: 'isError' in result && result.isError === true ? 'MCP 工具返回错误。' : 'MCP 工具调用完成。',
          data: safeResult
        }
      } finally {
        connection.pendingCalls -= 1
        this.scheduleIdleClose(config.serverId, connection)
      }
    } catch (error) {
      return { ok: false, code: signal.aborted ? 'CANCELLED' : 'MCP_CALL_FAILED', summary: safeError(error) }
    }
  }

  /** 显式关闭单个 Server 会话及其子进程/HTTP Session。 */
  async close(serverId: string): Promise<void> {
    /** 当前连接。 */
    const connection = this.connections.get(serverId)
    this.clearRestartTimer(serverId)
    if (!connection) {
      this.publishStatus(serverId, 'disconnected')
      return
    }
    this.connections.delete(serverId)
    connection.deliberateClose = true
    this.clearIdleTimer(connection)
    this.clearStableTimer(connection)
    if (connection.transport instanceof StreamableHTTPClientTransport) {
      await connection.transport.terminateSession().catch(() => undefined)
    }
    await connection.client.close().catch(() => connection.transport.close().catch(() => undefined))
    this.publishStatus(serverId, 'disconnected')
  }

  /** Utility 退出时关闭全部会话且不再重启。 */
  async shutdown(): Promise<void> {
    for (const timer of this.restartTimers.values()) clearTimeout(timer)
    this.restartTimers.clear()
    await Promise.allSettled([...this.connections.keys()].map((serverId) => this.close(serverId)))
    this.configs.clear()
    this.toolIndex.clear()
  }

  /** 按需建立连接，并隔离同 Server 并发建连。 */
  private async ensureConnected(config: McpRuntimeConfig, forProbe: boolean): Promise<ManagedMcpConnection> {
    /** 可复用的同指纹连接。 */
    const current = this.connections.get(config.serverId)
    if (current && current.fingerprint === config.configurationFingerprint) {
      await current.ready
      return current
    }
    if (!forProbe && !this.isApproved(config)) throw new Error('MCP Server 未启用或未经批准。')
    if (current) await this.close(config.serverId)

    this.publishStatus(config.serverId, 'connecting')
    /** 官方 SDK Client。 */
    const client = new Client({ name: 'ncxmusic', version: '0.1.0' })
    /** 仅 stdio/Streamable HTTP 的官方 SDK Transport。 */
    const transport = this.createTransport(config)
    /** SDK 的可选 sessionId 与项目 exactOptionalPropertyTypes 存在声明差异。 */
    const sdkTransport = transport as unknown as Transport
    /** 新连接记录；ready 随后替换为真实 initialize 任务。 */
    const connection: ManagedMcpConnection = {
      client,
      transport,
      ready: Promise.resolve(),
      fingerprint: config.configurationFingerprint,
      pendingCalls: 0,
      deliberateClose: false
    }
    /** 完成官方 initialize 握手。 */
    connection.ready = client.connect(sdkTransport, { timeout: 15_000 }).then(() => {
      this.publishStatus(config.serverId, 'ready')
      this.scheduleIdleClose(config.serverId, connection)
      this.scheduleStableReset(config.serverId, connection)
    }).catch((error: unknown) => {
      if (this.connections.get(config.serverId) === connection) this.connections.delete(config.serverId)
      this.publishStatus(config.serverId, 'failed_disabled', safeError(error))
      throw error
    })
    this.connections.set(config.serverId, connection)
    client.onclose = (): void => this.handleUnexpectedClose(config.serverId, connection)
    await connection.ready
    return connection
  }

  /** 依据配置创建唯一允许的两类官方 SDK Transport。 */
  private createTransport(config: McpRuntimeConfig): ManagedMcpTransport {
    if (config.transport === 'stdio') {
      /** SDK 默认安全环境与用户显式 MCP 环境的合并结果。 */
      const environment = { ...getDefaultEnvironment(), ...config.environment }
      /** stdio Transport；stderr 单独管道且不继承 Provider 凭据。 */
      const transport = new StdioClientTransport({
        command: requiredText(config.command, 'stdio command'),
        args: [...config.args],
        env: environment,
        ...(config.cwd ? { cwd: config.cwd } : {}),
        stderr: 'pipe',
        maxBufferSize: 10 * 1_024 * 1_024
      })
      transport.stderr?.on('data', (chunk: Buffer | string) => {
        /** 只记录脱敏且有限的 Server stderr。 */
        const message = redactSensitiveText(String(chunk)).slice(0, 4_096).trim()
        if (message) console.warn(`[mcp:${config.serverId}:stderr] ${message}`)
      })
      return transport
    }

    /** Streamable HTTP Header，秘密只存在 Utility 内存。 */
    const headers = new Headers(config.headers)
    return new StreamableHTTPClientTransport(new URL(requiredText(config.url, 'MCP URL')), {
      requestInit: { headers },
      reconnectionOptions: {
        initialReconnectionDelay: 1_000,
        maxReconnectionDelay: 5_000,
        reconnectionDelayGrowFactor: 2,
        maxRetries: 0
      }
    })
  }

  /** 分页读取实际工具列表并转换成持久化安全快照。 */
  private async listAllTools(client: Client): Promise<McpToolSnapshot[]> {
    /** 已发现工具。 */
    const tools: McpToolSnapshot[] = []
    /** 下一页 Cursor。 */
    let cursor: string | undefined
    for (let page = 0; page < MCP_MAX_TOOL_PAGES; page += 1) {
      /** SDK 校验后的 tools/list 响应。 */
      const result = await client.listTools(cursor ? { cursor } : undefined, { timeout: 15_000 })
      for (const tool of result.tools) {
        tools.push(McpToolSnapshotSchema.parse({
          name: tool.name,
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: tool.inputSchema,
          ...(tool.annotations ? { annotations: tool.annotations } : {})
        }))
      }
      cursor = result.nextCursor
      if (!cursor) return tools
    }
    throw new Error('MCP tools/list 分页超过安全上限。')
  }

  /** 处理非主动断开，并最多退避重启三次。 */
  private handleUnexpectedClose(serverId: string, connection: ManagedMcpConnection): void {
    if (connection.deliberateClose || this.connections.get(serverId) !== connection) return
    this.connections.delete(serverId)
    this.clearIdleTimer(connection)
    this.clearStableTimer(connection)
    /** 当前连续重启次数。 */
    const count = this.restartCounts.get(serverId) ?? 0
    /** 仍应运行的最新配置。 */
    const config = this.configs.get(serverId)
    if (!config || !this.isApproved(config) || count >= MCP_RESTART_DELAYS_MS.length) {
      this.publishStatus(serverId, 'failed_disabled', 'MCP Server 意外退出，已达到三次重启上限。')
      return
    }
    /** 当前固定退避。 */
    const delay = MCP_RESTART_DELAYS_MS[count]
    this.restartCounts.set(serverId, count + 1)
    this.publishStatus(serverId, 'disconnected', `MCP Server 意外退出，${delay}ms 后重启。`)
    this.restartTimers.set(serverId, setTimeout(() => {
      this.restartTimers.delete(serverId)
      /** 只恢复连接，不重放任何中断中的工具调用。 */
      void this.ensureConnected(config, false).catch(() => undefined)
    }, delay))
  }

  /** 重建获准工具索引。 */
  private rebuildToolIndex(): void {
    this.toolIndex.clear()
    for (const config of this.configs.values()) {
      if (!this.isApproved(config)) continue
      for (const tool of config.lastKnownTools) {
        this.toolIndex.set(this.publicToolName(config.serverId, tool.name), {
          serverId: config.serverId,
          toolName: tool.name
        })
      }
    }
  }

  /** 判断配置是否启用且当前指纹已经明确批准。 */
  private isApproved(config: McpRuntimeConfig): boolean {
    return config.enabled && config.approvedFingerprint === config.configurationFingerprint
  }

  /** 生成规范要求的 `mcp.<serverId>.<toolName>` 名称。 */
  private publicToolName(serverId: string, toolName: string): string {
    return `mcp.${serverId}.${toolName}`
  }

  /** 获取存在的 Server 配置。 */
  private requiredConfig(serverId: string): McpRuntimeConfig {
    /** 查找到的配置。 */
    const config = this.configs.get(serverId)
    if (!config) throw new Error('MCP Server 不存在。')
    return config
  }

  /** 无活动调用时安排十分钟空闲关闭。 */
  private scheduleIdleClose(serverId: string, connection: ManagedMcpConnection): void {
    this.clearIdleTimer(connection)
    if (connection.pendingCalls > 0 || this.connections.get(serverId) !== connection) return
    connection.idleTimer = setTimeout(() => void this.close(serverId), this.idleTimeoutMs)
  }

  /** 清除单连接空闲计时器。 */
  private clearIdleTimer(connection: ManagedMcpConnection): void {
    if (connection.idleTimer) clearTimeout(connection.idleTimer)
    delete connection.idleTimer
  }

  /** 稳定运行五分钟后才清零连续崩溃预算，防止快速 ready/exit 无限循环。 */
  private scheduleStableReset(serverId: string, connection: ManagedMcpConnection): void {
    this.clearStableTimer(connection)
    connection.stableTimer = setTimeout(() => {
      if (this.connections.get(serverId) !== connection) return
      this.restartCounts.set(serverId, 0)
      delete connection.stableTimer
      this.publishStatus(serverId, 'ready')
    }, MCP_STABLE_CONNECTION_MS)
  }

  /** 清除单连接稳定运行计时器。 */
  private clearStableTimer(connection: ManagedMcpConnection): void {
    if (connection.stableTimer) clearTimeout(connection.stableTimer)
    delete connection.stableTimer
  }

  /** 清除单 Server 重启任务。 */
  private clearRestartTimer(serverId: string): void {
    /** 当前重启计时器。 */
    const timer = this.restartTimers.get(serverId)
    if (timer) clearTimeout(timer)
    this.restartTimers.delete(serverId)
  }

  /** 发布严格且不含 Secret 的运行状态。 */
  private publishStatus(
    serverId: string,
    connectionState: ExtensionRuntimeStatusEvent['connectionState'],
    lastError?: string
  ): void {
    this.options.onStatus?.(ExtensionRuntimeStatusEventSchema.parse({
      kind: 'extension.runtime.status',
      serverId,
      connectionState,
      restartCount: Math.min(this.restartCounts.get(serverId) ?? 0, 3),
      ...(lastError ? { lastError: redactSensitiveText(lastError).slice(0, 500) } : {})
    }))
  }
}

// ========= 函数 =========

/** 读取配置中的必填非空文本。 */
function requiredText(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} 缺失。`)
  return value
}

/** 判断未知值是否为普通参数对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 比较 Server 实际工具名、描述与输入 Schema。 */
function sameTools(left: readonly McpToolSnapshot[], right: readonly McpToolSnapshot[]): boolean {
  return stableJson(left) === stableJson(right)
}

/** 递归稳定化 JSON 后序列化。 */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** 将未知错误转换成有限、脱敏的用户摘要。 */
function safeError(error: unknown): string {
  return redactSensitiveText(error instanceof Error ? error.message : 'MCP 操作失败。').slice(0, 500)
}

/** 将 SDK 结果脱敏并按 UTF-8 字节截断。 */
function limitModelResult(result: unknown): unknown {
  /** 脱敏 JSON 文本。 */
  const serialized = redactSensitiveText(JSON.stringify(result))
  /** UTF-8 字节。 */
  const bytes = Buffer.from(serialized, 'utf8')
  if (bytes.byteLength <= MCP_MODEL_RESULT_LIMIT_BYTES) return JSON.parse(serialized) as unknown
  /** 有限前缀，末端字符损坏由重新编码替换。 */
  const prefix = bytes.subarray(0, MCP_MODEL_RESULT_LIMIT_BYTES).toString('utf8')
  return { truncated: true, content: prefix }
}
