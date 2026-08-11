import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  ExtensionJsonSchema,
  McpRuntimeConfigSchema,
  McpServerEditableSchema,
  McpServerSnapshotSchema,
  McpToolSnapshotSchema,
  type McpRuntimeConfig,
  type McpServerEditable,
  type McpServerSnapshot,
  type McpToolSnapshot
} from '../../shared/schemas/extensions'

// ========= 类型 =========

/** Main safeStorage 的最小加解密接口。 */
export interface McpSecretProtector {
  /** 是否可安全持久化 Secret。 */
  isAvailable(): boolean
  /** 加密 UTF-8 文本。 */
  encrypt(value: string): Buffer
  /** 解密 UTF-8 文本。 */
  decrypt(value: Buffer): string
}

/** 单版 MCP 私有配置记录。 */
interface StoredMcpVersion {
  /** 无秘密可编辑配置。 */
  readonly config: McpServerEditable
  /** safeStorage 加密后的环境变量值。 */
  readonly encryptedEnvironment: Readonly<Record<string, string>>
  /** safeStorage 加密后的 HTTP Header 值。 */
  readonly encryptedHeaders: Readonly<Record<string, string>>
  /** 当前完整不可逆配置指纹。 */
  readonly configurationFingerprint: string
  /** 最近一次明确确认的指纹。 */
  readonly approvedFingerprint?: string
  /** SDK 首次连接取得的能力。 */
  readonly lastKnownCapabilities: Readonly<Record<string, unknown>>
  /** SDK 首次连接取得的工具。 */
  readonly lastKnownTools: readonly McpToolSnapshot[]
  /** 最近更新时间。 */
  readonly updatedAt: number
}

/** MCP Server 当前与单版回滚记录。 */
interface StoredMcpServer {
  /** 当前版本。 */
  readonly current: StoredMcpVersion
  /** 唯一上一版本。 */
  readonly previous?: StoredMcpVersion
}

/** MCP 配置文件顶层结构。 */
interface StoredMcpDocument {
  /** 配置 Schema 版本。 */
  readonly schemaVersion: 1
  /** 按 serverId 索引的私有记录。 */
  readonly servers: Readonly<Record<string, StoredMcpServer>>
}

/** MCP 运行时连接状态覆盖。 */
export interface McpRuntimeObservation {
  /** 当前连接状态。 */
  readonly connectionState: 'disconnected' | 'connecting' | 'ready' | 'failed_disabled'
  /** 当前崩溃重启计数。 */
  readonly restartCount: number
  /** 最近错误。 */
  readonly lastError?: string
}

// ========= 变量 =========

/** 空 MCP 配置文件。 */
const EMPTY_MCP_DOCUMENT: StoredMcpDocument = { schemaVersion: 1, servers: {} }

// ========= 类 =========

/** Main 独占的 MCP 配置、safeStorage Secret、回滚与脱敏导出仓库。 */
export class McpConfigStore {
  /** MCP 配置文件路径。 */
  private readonly configPath: string

  /** 当前内存文档。 */
  private document: StoredMcpDocument = EMPTY_MCP_DOCUMENT

  constructor(dataRoot: string, private readonly protector: McpSecretProtector) {
    this.configPath = join(dataRoot, 'extensions', 'mcp-servers.json')
  }

  // ========= 函数 =========

  /** 读取持久配置；损坏内容回退空仓库，不把 Secret 写日志。 */
  load(): void {
    try {
      /** 未信任磁盘对象。 */
      const decoded = JSON.parse(readFileSync(this.configPath, 'utf8')) as StoredMcpDocument
      if (decoded.schemaVersion !== 1 || !decoded.servers || typeof decoded.servers !== 'object') {
        this.document = EMPTY_MCP_DOCUMENT
        return
      }
      this.document = decoded
    } catch {
      this.document = EMPTY_MCP_DOCUMENT
    }
  }

  /** 保存/更新配置和 Secret；调用方必须已执行普通确认或 ApprovalCard。 */
  upsert(
    rawConfig: unknown,
    environment: Readonly<Record<string, string>>,
    headers: Readonly<Record<string, string>>,
    approved: boolean
  ): McpServerSnapshot {
    /** 经共享 Schema 校验的无秘密配置。 */
    const config = McpServerEditableSchema.parse(rawConfig)
    assertSupportedMcpConfig(config)
    /** 已存在配置。 */
    const existing = this.document.servers[config.serverId]
    /** 合并已有 Secret 后的环境变量。 */
    const mergedEnvironment = mergeSecrets(
      existing ? this.decryptMap(existing.current.encryptedEnvironment) : {},
      environment,
      config.environmentNames
    )
    /** 合并已有 Secret 后的 Header。 */
    const mergedHeaders = mergeSecrets(
      existing ? this.decryptMap(existing.current.encryptedHeaders) : {},
      headers,
      config.headerNames
    )
    /** 初始版本尚未发现实际工具。 */
    const lastKnownTools = existing?.current.lastKnownTools ?? []
    /** 初始版本尚未发现能力。 */
    const lastKnownCapabilities = existing?.current.lastKnownCapabilities ?? {}
    /** 包含 Secret 值哈希与工具范围的不可逆指纹。 */
    const fingerprint = fingerprintMcpConfig(config, mergedEnvironment, mergedHeaders, lastKnownTools)
    /** 当前新版本。 */
    const next: StoredMcpVersion = {
      config,
      encryptedEnvironment: this.encryptMap(mergedEnvironment),
      encryptedHeaders: this.encryptMap(mergedHeaders),
      configurationFingerprint: fingerprint,
      ...(approved ? { approvedFingerprint: fingerprint } : {}),
      lastKnownCapabilities,
      lastKnownTools,
      updatedAt: Date.now()
    }
    this.document = {
      schemaVersion: 1,
      servers: {
        ...this.document.servers,
        [config.serverId]: {
          current: next,
          ...(existing ? { previous: existing.current } : {})
        }
      }
    }
    this.persist()
    return this.snapshot(config.serverId)
  }

  /** 启用/禁用并明确确认当前不可变配置指纹。 */
  setEnabled(serverId: string, enabled: boolean): McpServerSnapshot {
    /** 当前 Server 记录。 */
    const stored = this.required(serverId)
    /** 只改变启用状态的公开配置。 */
    const config = { ...stored.current.config, enabled }
    /** 解密后仅在 Main 内存使用的环境变量。 */
    const environment = this.decryptMap(stored.current.encryptedEnvironment)
    /** 解密后仅在 Main 内存使用的 Header。 */
    const headers = this.decryptMap(stored.current.encryptedHeaders)
    /** 启停变化后的完整指纹。 */
    const fingerprint = fingerprintMcpConfig(config, environment, headers, stored.current.lastKnownTools)
    /** 明确设置操作视为对当前配置的普通确认。 */
    const next: StoredMcpVersion = {
      ...stored.current,
      config,
      configurationFingerprint: fingerprint,
      approvedFingerprint: fingerprint,
      updatedAt: Date.now()
    }
    this.replaceCurrent(serverId, next, false)
    return this.snapshot(serverId)
  }

  /** 记录 SDK 实际能力与工具；工具范围变化强制重新确认并禁用。 */
  recordProbe(
    serverId: string,
    capabilities: Readonly<Record<string, unknown>>,
    tools: readonly McpToolSnapshot[]
  ): McpServerSnapshot {
    /** 当前 Server 记录。 */
    const stored = this.required(serverId)
    /** 经共享 Schema 校验的实际工具。 */
    const validatedTools = tools.map((tool) => McpToolSnapshotSchema.parse(tool))
    /** 工具名称与 Schema 是否发生变化。 */
    const toolsChanged = stableJson(stored.current.lastKnownTools) !== stableJson(validatedTools)
    /** 变化后先禁用，等待用户查看并显式重新启用。 */
    const config = toolsChanged ? { ...stored.current.config, enabled: false } : stored.current.config
    /** Main 内存中的环境变量。 */
    const environment = this.decryptMap(stored.current.encryptedEnvironment)
    /** Main 内存中的 Header。 */
    const headers = this.decryptMap(stored.current.encryptedHeaders)
    /** 将真实工具范围纳入配置指纹。 */
    const fingerprint = fingerprintMcpConfig(config, environment, headers, validatedTools)
    /** 移除旧批准指纹后的基础版本，避免工具变化沿用旧授权。 */
    const { approvedFingerprint: _approvedFingerprint, ...currentWithoutApproval } = stored.current
    void _approvedFingerprint
    /** 带最新能力快照的当前版本。 */
    const next: StoredMcpVersion = {
      ...currentWithoutApproval,
      config,
      configurationFingerprint: fingerprint,
      ...(!toolsChanged && stored.current.approvedFingerprint === fingerprint
        ? { approvedFingerprint: fingerprint }
        : {}),
      lastKnownCapabilities: ExtensionJsonSchema.parse(capabilities),
      lastKnownTools: validatedTools,
      updatedAt: Date.now()
    }
    this.replaceCurrent(serverId, next, false)
    return this.snapshot(serverId)
  }

  /** 原子切回唯一上一配置，并保留当前配置作为新的回滚目标。 */
  rollback(serverId: string): McpServerSnapshot {
    /** 当前 Server 记录。 */
    const stored = this.required(serverId)
    if (!stored.previous) throw new Error('没有可回滚的 MCP 配置。')
    this.document = {
      schemaVersion: 1,
      servers: {
        ...this.document.servers,
        [serverId]: { current: stored.previous, previous: stored.current }
      }
    }
    this.persist()
    return this.snapshot(serverId)
  }

  /** 删除 NcxMusic 配置与 Secret，不触碰 Server 外部数据。 */
  delete(serverId: string): void {
    this.required(serverId)
    /** 不含待删除项的新索引。 */
    const servers = { ...this.document.servers }
    delete servers[serverId]
    this.document = { schemaVersion: 1, servers }
    this.persist()
  }

  /** 返回全部 Renderer 安全快照。 */
  snapshots(observations: Readonly<Record<string, McpRuntimeObservation>> = {}): McpServerSnapshot[] {
    return Object.keys(this.document.servers)
      .sort()
      .map((serverId) => this.snapshot(serverId, observations[serverId]))
  }

  /** 返回 Utility 私有运行配置；Secret 只在 Main→Utility 控制面出现。 */
  runtimeConfigs(): McpRuntimeConfig[] {
    return Object.keys(this.document.servers).sort().map((serverId) => {
      /** 当前 Server 版本。 */
      const version = this.required(serverId).current
      return McpRuntimeConfigSchema.parse({
        ...version.config,
        configurationFingerprint: version.configurationFingerprint,
        ...(version.approvedFingerprint ? { approvedFingerprint: version.approvedFingerprint } : {}),
        environment: this.decryptMap(version.encryptedEnvironment),
        headers: this.decryptMap(version.encryptedHeaders),
        lastKnownCapabilities: version.lastKnownCapabilities,
        lastKnownTools: version.lastKnownTools
      })
    })
  }

  /** 导出带 Schema 版本的无秘密配置。 */
  exportDocument(): string {
    /** 导出项不含 Secret、密文或内部 Credential Reference。 */
    const mcpServers = Object.fromEntries(this.snapshots().map((server) => [server.serverId, {
      displayName: server.displayName,
      transport: server.transport,
      ...(server.command ? { command: server.command } : {}),
      args: server.args,
      ...(server.cwd ? { cwd: server.cwd } : {}),
      ...(server.url ? { url: server.url } : {}),
      requiredEnvironment: server.environmentNames,
      requiredHeaders: server.headerNames,
      enabled: false
    }]))
    return `${JSON.stringify({ schemaVersion: 1, mcpServers }, null, 2)}\n`
  }

  /** 解析 NcxMusic 或常见 `.mcp.json`，不写入。 */
  previewImport(document: string): Array<{
    readonly config: McpServerEditable
    readonly environment: Readonly<Record<string, string>>
    readonly headers: Readonly<Record<string, string>>
  }> {
    /** 未信任导入文档。 */
    const decoded = JSON.parse(document) as { mcpServers?: unknown }
    if (!decoded.mcpServers || typeof decoded.mcpServers !== 'object' || Array.isArray(decoded.mcpServers)) {
      throw new Error('导入文件缺少 mcpServers 对象。')
    }
    /** 归一化后的导入项。 */
    const imported: Array<{
      config: McpServerEditable
      environment: Readonly<Record<string, string>>
      headers: Readonly<Record<string, string>>
    }> = []
    for (const [serverId, rawValue] of Object.entries(decoded.mcpServers)) {
      if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) throw new Error(`${serverId} 配置无效。`)
      /** 常见 `.mcp.json` Server 配置。 */
      const raw = rawValue as Record<string, unknown>
      if (raw['type'] === 'sse' || raw['transport'] === 'sse') throw new Error('首版不支持旧 HTTP+SSE MCP 配置。')
      /** 明文 env 只在导入确认前驻留 Main 内存，确认后进入 safeStorage。 */
      const environment = stringRecord(raw['env'])
      /** 可选 HTTP Header。 */
      const headers = stringRecord(raw['headers'])
      /** 是否具有 HTTP URL。 */
      const hasUrl = typeof raw['url'] === 'string'
      /** 归一化无秘密配置。 */
      const config = McpServerEditableSchema.parse({
        serverId,
        displayName: typeof raw['displayName'] === 'string' ? raw['displayName'] : serverId,
        transport: hasUrl ? 'streamable_http' : 'stdio',
        ...(typeof raw['command'] === 'string' ? { command: raw['command'] } : {}),
        args: Array.isArray(raw['args']) ? raw['args'] : [],
        ...(typeof raw['cwd'] === 'string' ? { cwd: raw['cwd'] } : {}),
        ...(hasUrl ? { url: raw['url'] } : {}),
        environmentNames: Object.keys(environment),
        headerNames: Object.keys(headers),
        enabled: false
      })
      assertSupportedMcpConfig(config)
      imported.push({ config, environment, headers })
    }
    return imported
  }

  /** 返回单个公开快照。 */
  private snapshot(serverId: string, observation?: McpRuntimeObservation): McpServerSnapshot {
    /** 当前 Server 记录。 */
    const stored = this.required(serverId)
    /** 当前配置版本。 */
    const current = stored.current
    return McpServerSnapshotSchema.parse({
      ...current.config,
      configurationFingerprint: current.configurationFingerprint,
      approvalState: current.approvedFingerprint === current.configurationFingerprint
        ? 'approved'
        : 'reapproval_required',
      connectionState: observation?.connectionState ?? 'disconnected',
      restartCount: observation?.restartCount ?? 0,
      lastKnownCapabilities: current.lastKnownCapabilities,
      lastKnownTools: current.lastKnownTools,
      previousConfigAvailable: Boolean(stored.previous),
      ...(observation?.lastError ? { lastError: observation.lastError } : {}),
      updatedAt: current.updatedAt
    })
  }

  /** 读取必需 Server 记录。 */
  private required(serverId: string): StoredMcpServer {
    /** 当前记录。 */
    const stored = this.document.servers[serverId]
    if (!stored) throw new Error('MCP Server 不存在。')
    return stored
  }

  /** 替换当前版本，可选择是否保留当前版本作为上一版。 */
  private replaceCurrent(serverId: string, current: StoredMcpVersion, keepPrevious: boolean): void {
    /** 当前记录。 */
    const stored = this.required(serverId)
    this.document = {
      schemaVersion: 1,
      servers: {
        ...this.document.servers,
        [serverId]: {
          current,
          ...(keepPrevious ? { previous: stored.current } : stored.previous ? { previous: stored.previous } : {})
        }
      }
    }
    this.persist()
  }

  /** 加密 Secret 字典。 */
  private encryptMap(values: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
    if (Object.keys(values).length > 0 && !this.protector.isAvailable()) {
      throw new Error('系统安全存储不可用，无法保存 MCP 凭据。')
    }
    return Object.fromEntries(Object.entries(values).map(([name, value]) => [
      name,
      this.protector.encrypt(value).toString('base64')
    ]))
  }

  /** 只在 Main 内存解密 Secret 字典。 */
  private decryptMap(values: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
    return Object.fromEntries(Object.entries(values).map(([name, value]) => [
      name,
      this.protector.decrypt(Buffer.from(value, 'base64'))
    ]))
  }

  /** 原子持久化 MCP 私有文档。 */
  private persist(): void {
    /** 配置目录。 */
    const directory = dirname(this.configPath)
    /** 同目录临时文件。 */
    const temporary = `${this.configPath}.tmp`
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporary, `${JSON.stringify(this.document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    renameSync(temporary, this.configPath)
  }
}

// ========= 函数 =========

/** 确保 stdio 启动入口不使用浮动 latest，且不接受旧 SSE。 */
function assertSupportedMcpConfig(config: McpServerEditable): void {
  if (config.transport === 'stdio') {
    /** 命令与参数用于识别浮动安装入口。 */
    const invocation = `${config.command ?? ''} ${config.args.join(' ')}`
    if (/(?:@latest\b|\blatest\b)/iu.test(invocation)) throw new Error('stdio MCP 启动配置必须锁定版本，不能使用 latest。')
  }
  if (config.transport === 'streamable_http' && config.url && /\/sse(?:[/?#]|$)/iu.test(config.url)) {
    throw new Error('首版不实现旧 HTTP+SSE Transport。')
  }
}

/** 合并新旧 Secret，并只保留当前声明名称。 */
function mergeSecrets(
  previous: Readonly<Record<string, string>>,
  incoming: Readonly<Record<string, string>>,
  allowedNames: readonly string[]
): Readonly<Record<string, string>> {
  /** 当前声明范围内的 Secret。 */
  const result: Record<string, string> = {}
  for (const name of allowedNames) {
    /** 新值优先，空字符串表示沿用已有值。 */
    const value = incoming[name] || previous[name]
    if (value) result[name] = value
  }
  return result
}

/** 计算包含 Secret 哈希与实际工具范围的不可逆配置指纹。 */
function fingerprintMcpConfig(
  config: McpServerEditable,
  environment: Readonly<Record<string, string>>,
  headers: Readonly<Record<string, string>>,
  tools: readonly McpToolSnapshot[]
): string {
  /** Secret 仅以 SHA-256 进入指纹。 */
  const secretHashes = {
    environment: hashSecretMap(environment),
    headers: hashSecretMap(headers)
  }
  return createHash('sha256').update(stableJson({ config, secretHashes, tools })).digest('hex')
}

/** 将 Secret 字典转换为不可逆哈希字典。 */
function hashSecretMap(values: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.keys(values).sort().map((name) => [
    name,
    createHash('sha256').update(values[name] ?? '').digest('hex')
  ]))
}

/** 对 JSON 对象递归排序，用于稳定指纹与工具变化比较。 */
function stableJson(value: unknown): string {
  /** 递归排序后的 JSON 安全值。 */
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize)
    if (!item || typeof item !== 'object') return item
    return Object.fromEntries(Object.entries(item as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalize(child)]))
  }
  return JSON.stringify(normalize(value))
}

/** 从未知导入字段提取纯字符串字典。 */
function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}
