import { Buffer } from 'node:buffer'
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

import { redactSensitiveText } from '../../shared/errors/redact-sensitive-text'
import {
  SkillHostReadySchema,
  SkillHostResultSchema,
  SkillRuntimeDescriptorSchema,
  type SkillHostResult,
  type SkillRuntimeDescriptor
} from '../../shared/schemas/extensions'

// ========= 类型 =========

/** 模型可见的动态 Skill 工具定义。 */
export interface SkillProviderToolDefinition {
  /** 强制命名空间后的名称。 */
  readonly name: string
  /** Skill 声明说明。 */
  readonly description: string
  /** Skill 声明 JSON Schema。 */
  readonly parameters: Readonly<Record<string, unknown>>
}

/** Skill 工具执行结果。 */
export interface SkillCallResult {
  /** 调用是否成功。 */
  readonly ok: boolean
  /** 稳定结果码。 */
  readonly code: string
  /** 脱敏摘要。 */
  readonly summary: string
  /** 有限结构化结果。 */
  readonly data?: unknown
}

/** 单个隔离 SkillHost。 */
interface ManagedSkillHost {
  /** 当前已验证描述。 */
  readonly descriptor: SkillRuntimeDescriptor
  /** 独立 Node 子进程。 */
  readonly child: ChildProcess
  /** 模块载入完成任务。 */
  ready: Promise<void>
  /** 是否由 Utility 主动停止。 */
  deliberateStop: boolean
}

/** 等待 SkillHost 工具结果。 */
interface PendingSkillCall {
  /** 所属 Skill。 */
  readonly skillName: string
  /** 完成调用。 */
  readonly resolve: (result: SkillCallResult) => void
  /** 超时计时器。 */
  readonly timer: ReturnType<typeof setTimeout>
  /** 取消监听清理。 */
  readonly removeAbortListener: () => void
}

/** Skill Runtime Manager 构造参数。 */
export interface SkillRuntimeManagerOptions {
  /** SkillHost 构建入口；测试可注入。 */
  readonly hostEntryPath?: string
  /** Skill 进入错误态回调。 */
  readonly onError?: (skillName: string, message: string) => void
}

// ========= 变量 =========

/** SkillHost 启动握手上限。 */
const SKILL_HOST_STARTUP_TIMEOUT_MS = 10_000

/** 单个 Skill Tool 调用上限。 */
const SKILL_CALL_TIMEOUT_MS = 120_000

/** 返回模型的 Skill 数据上限。 */
const SKILL_MODEL_RESULT_LIMIT_BYTES = 64 * 1_024

// ========= 类 =========

/** Utility 内动态 Skill 调度器：每个 JavaScript Skill 使用一个独立受限进程。 */
export class SkillRuntimeManager {
  /** 当前启用的已验证描述。 */
  private readonly descriptors = new Map<string, SkillRuntimeDescriptor>()

  /** 当前 JavaScript Host。 */
  private readonly hosts = new Map<string, ManagedSkillHost>()

  /** 动态工具名到 Skill/原始工具名索引。 */
  private readonly toolIndex = new Map<string, { readonly skillName: string; readonly toolName: string }>()

  /** 等待中的 Tool Call。 */
  private readonly pending = new Map<string, PendingSkillCall>()

  /** SkillHost 构建入口。 */
  private readonly hostEntryPath: string

  constructor(private readonly options: SkillRuntimeManagerOptions = {}) {
    this.hostEntryPath = options.hostEntryPath ?? join(__dirname, 'skillHost.js')
  }

  /** 应用 Main 下发的已验证 Skill 列表并隔离启动/停止 Host。 */
  async sync(rawDescriptors: readonly SkillRuntimeDescriptor[]): Promise<void> {
    /** 新描述索引。 */
    const next = new Map(rawDescriptors.map((item) => {
      /** 单项已验证描述。 */
      const descriptor = SkillRuntimeDescriptorSchema.parse(item)
      return [descriptor.name, descriptor] as const
    }))

    for (const [skillName, host] of this.hosts) {
      /** 最新同名描述。 */
      const descriptor = next.get(skillName)
      if (!descriptor || descriptor.contentHash !== host.descriptor.contentHash || !descriptor.entryPath) {
        this.stopHost(skillName, 'skill-updated-or-disabled')
      }
    }

    this.descriptors.clear()
    for (const [skillName, descriptor] of next) this.descriptors.set(skillName, descriptor)
    this.rebuildToolIndex()

    /** JavaScript Skill 启用后立即加载到独立 Host；失败不影响其他 Skill。 */
    await Promise.allSettled([...next.values()]
      .filter((descriptor) => Boolean(descriptor.entryPath))
      .map((descriptor) => this.ensureHost(descriptor)))
  }

  /** 返回所有 Prompt-only 与 JavaScript Skill 的系统提示正文。 */
  systemPrompts(): string[] {
    return [...this.descriptors.values()]
      .filter((descriptor) => descriptor.enabled && descriptor.prompt.trim().length > 0)
      .map((descriptor) => `[Skill: ${descriptor.name}@${descriptor.version}]\n${descriptor.prompt}`)
  }

  /** 返回已启用动态 Skill 的工具定义。 */
  providerDefinitions(): SkillProviderToolDefinition[] {
    /** 当前定义。 */
    const definitions: SkillProviderToolDefinition[] = []
    for (const descriptor of this.descriptors.values()) {
      for (const tool of descriptor.tools) {
        definitions.push({
          name: this.publicToolName(descriptor.name, tool.name),
          description: tool.description,
          parameters: tool.inputSchema ?? { type: 'object', additionalProperties: false }
        })
      }
    }
    return definitions
  }

  /** 判断动态 Skill Tool 是否存在。 */
  has(toolName: string): boolean {
    return this.toolIndex.has(toolName)
  }

  /** 执行已经通过 Agent ApprovalCard 的单次 Skill 工具调用。 */
  async call(toolName: string, rawArguments: unknown, signal: AbortSignal): Promise<SkillCallResult> {
    /** 动态工具索引。 */
    const target = this.toolIndex.get(toolName)
    if (!target) return { ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: 'Skill 工具未注册。' }
    /** 当前 Skill 描述。 */
    const descriptor = this.descriptors.get(target.skillName)
    if (!descriptor?.entryPath) return { ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: 'Skill Host 不可用。' }
    /** 工具参数必须为对象。 */
    const argumentsObject = isRecord(rawArguments) ? rawArguments : undefined
    if (!argumentsObject) return { ok: false, code: 'TOOL_ARGUMENTS_INVALID', summary: 'Skill 工具参数必须是对象。' }

    try {
      /** 已完成握手的隔离 Host。 */
      const host = await this.ensureHost(descriptor)
      /** 当前调用 ID。 */
      const requestId = crypto.randomUUID()
      return await new Promise<SkillCallResult>((resolve) => {
        /** 取消时只取消本次调用。 */
        const abort = (): void => {
          host.child.send?.({ kind: 'skill-host.cancel', requestId })
        }
        signal.addEventListener('abort', abort, { once: true })
        /** 有限调用计时器。 */
        const timer = setTimeout(() => {
          host.child.send?.({ kind: 'skill-host.cancel', requestId })
          this.finish(requestId, { ok: false, code: 'TIMEOUT', summary: 'Skill 工具调用超时。' })
        }, SKILL_CALL_TIMEOUT_MS)
        this.pending.set(requestId, {
          skillName: target.skillName,
          resolve,
          timer,
          removeAbortListener: () => signal.removeEventListener('abort', abort)
        })
        host.child.send?.({
          kind: 'skill-host.call',
          requestId,
          toolName: target.toolName,
          arguments: argumentsObject
        })
      })
    } catch (error) {
      return { ok: false, code: 'SKILL_HOST_UNAVAILABLE', summary: safeMessage(error) }
    }
  }

  /** Utility 退出时回收全部独立 Host。 */
  shutdown(): void {
    for (const skillName of [...this.hosts.keys()]) this.stopHost(skillName, 'utility-shutdown')
    for (const requestId of [...this.pending.keys()]) {
      this.finish(requestId, { ok: false, code: 'CANCELLED', summary: 'Utility 已关闭。' })
    }
    this.descriptors.clear()
    this.toolIndex.clear()
  }

  /** 返回已存在 Host，或以 Node 权限模型启动独立进程。 */
  private async ensureHost(descriptor: SkillRuntimeDescriptor): Promise<ManagedSkillHost> {
    /** 可复用同内容 Host。 */
    const current = this.hosts.get(descriptor.name)
    if (current && current.descriptor.contentHash === descriptor.contentHash) {
      await current.ready
      return current
    }
    if (!descriptor.entryPath) throw new Error('Prompt-only Skill 不需要 Host。')
    if (current) this.stopHost(descriptor.name, 'skill-replaced')

    /** Node 权限模型只允许读取 Host bundle 与当前 Skill 包；网络、写文件、子进程默认拒绝。 */
    const child = spawn(process.execPath, [
      '--experimental-permission',
      `--allow-fs-read=${this.hostEntryPath}`,
      `--allow-fs-read=${descriptor.rootPath}`,
      this.hostEntryPath
    ], {
      env: {
        ELECTRON_RUN_AS_NODE: '1',
        NODE_NO_WARNINGS: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true
    })
    /** 独立 Host 记录；ready 随后替换为模块载入握手。 */
    const host: ManagedSkillHost = {
      descriptor,
      child,
      ready: Promise.resolve(),
      deliberateStop: false
    }
    /** 模块载入握手任务。 */
    host.ready = new Promise<void>((resolve, reject) => {
      /** 启动超时。 */
      const timer = setTimeout(() => reject(new Error('Skill Host 启动超时。')), SKILL_HOST_STARTUP_TIMEOUT_MS)
      /** 等待同名 Ready。 */
      const onMessage = (rawMessage: unknown): void => {
        /** 严格 Ready 消息。 */
        const message = SkillHostReadySchema.safeParse(rawMessage)
        if (!message.success || message.data.skillName !== descriptor.name) return
        clearTimeout(timer)
        child.off('message', onMessage)
        if (message.data.ok) resolve()
        else reject(new Error(message.data.message))
      }
      child.on('message', onMessage)
    }).catch((error: unknown) => {
      this.options.onError?.(descriptor.name, safeMessage(error))
      if (this.hosts.get(descriptor.name) === host) this.stopHost(descriptor.name, 'startup-failed')
      throw error
    })
    this.hosts.set(descriptor.name, host)
    child.on('message', (message: unknown) => this.handleHostMessage(descriptor.name, message))
    child.stderr?.on('data', (chunk: Buffer | string) => {
      /** 有限且脱敏的隔离 Host 错误输出。 */
      const message = redactSensitiveText(String(chunk)).slice(0, 4_096).trim()
      if (message) console.warn(`[skill:${descriptor.name}:stderr] ${message}`)
    })
    child.once('exit', () => this.handleHostExit(descriptor.name, host))
    child.send({ kind: 'skill-host.configure', descriptor })
    await host.ready
    return host
  }

  /** 处理 SkillHost 工具终态。 */
  private handleHostMessage(skillName: string, rawMessage: unknown): void {
    /** 严格结果消息。 */
    const message = SkillHostResultSchema.safeParse(rawMessage)
    if (!message.success) return
    /** 只接受属于该 Host 的待决调用。 */
    const pending = this.pending.get(message.data.requestId)
    if (!pending || pending.skillName !== skillName) return
    this.finish(message.data.requestId, resultFromHost(message.data))
  }

  /** SkillHost 意外退出只隔离当前 Skill，不牵连 Agent/其他扩展。 */
  private handleHostExit(skillName: string, host: ManagedSkillHost): void {
    if (this.hosts.get(skillName) !== host) return
    this.hosts.delete(skillName)
    for (const [requestId, pending] of this.pending) {
      if (pending.skillName === skillName) {
        this.finish(requestId, { ok: false, code: 'SKILL_HOST_EXITED', summary: 'Skill Host 意外退出。' })
      }
    }
    if (!host.deliberateStop) this.options.onError?.(skillName, 'Skill Host 意外退出。')
  }

  /** 主动停止单个 Host 及其待决调用。 */
  private stopHost(skillName: string, reason: string): void {
    /** 当前 Host。 */
    const host = this.hosts.get(skillName)
    if (!host) return
    this.hosts.delete(skillName)
    host.deliberateStop = true
    for (const [requestId, pending] of this.pending) {
      if (pending.skillName === skillName) {
        this.finish(requestId, { ok: false, code: 'CANCELLED', summary: `Skill Host 已停止：${reason}` })
      }
    }
    host.child.disconnect()
    host.child.kill()
  }

  /** 完成单次待决调用并清理计时器/取消监听。 */
  private finish(requestId: string, result: SkillCallResult): void {
    /** 待决调用。 */
    const pending = this.pending.get(requestId)
    if (!pending) return
    this.pending.delete(requestId)
    clearTimeout(pending.timer)
    pending.removeAbortListener()
    pending.resolve(result)
  }

  /** 重建 `skill.<name>.<tool>` 索引。 */
  private rebuildToolIndex(): void {
    this.toolIndex.clear()
    for (const descriptor of this.descriptors.values()) {
      for (const tool of descriptor.tools) {
        this.toolIndex.set(this.publicToolName(descriptor.name, tool.name), {
          skillName: descriptor.name,
          toolName: tool.name
        })
      }
    }
  }

  /** 生成强制 Skill 命名空间。 */
  private publicToolName(skillName: string, toolName: string): string {
    return `skill.${skillName}.${toolName}`
  }
}

// ========= 函数 =========

/** 判断未知参数是否为普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 将 Host 结果脱敏并限制为模型可承受大小。 */
function resultFromHost(result: SkillHostResult): SkillCallResult {
  /** Host 数据的有限副本。 */
  const data = result.data === undefined ? undefined : limitResult(result.data)
  return {
    ok: result.ok,
    code: result.code,
    summary: redactSensitiveText(result.message).slice(0, 500),
    ...(data === undefined ? {} : { data })
  }
}

/** 将未知错误转换成有限脱敏摘要。 */
function safeMessage(error: unknown): string {
  return redactSensitiveText(error instanceof Error ? error.message : 'Skill Host 操作失败。').slice(0, 500)
}

/** 按 64 KiB 限制 Skill 结构化结果。 */
function limitResult(value: unknown): unknown {
  try {
    /** 脱敏序列化文本。 */
    const serialized = redactSensitiveText(JSON.stringify(value))
    /** UTF-8 字节。 */
    const bytes = Buffer.from(serialized, 'utf8')
    if (bytes.byteLength <= SKILL_MODEL_RESULT_LIMIT_BYTES) return JSON.parse(serialized) as unknown
    return {
      truncated: true,
      content: bytes.subarray(0, SKILL_MODEL_RESULT_LIMIT_BYTES).toString('utf8')
    }
  } catch {
    return { unavailable: true, reason: 'Skill 返回值不能安全序列化。' }
  }
}
