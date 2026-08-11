import { pathToFileURL } from 'node:url'

import {
  SkillHostCallSchema,
  SkillHostCancelSchema,
  SkillHostConfigureSchema,
  SkillHostReadySchema,
  SkillHostResultSchema,
  type SkillHostCall,
  type SkillRuntimeDescriptor
} from '../shared/schemas/extensions'

// ========= 类型 =========

/** Skill JavaScript 入口允许导出的单个工具处理器。 */
type SkillToolHandler = (
  input: Readonly<Record<string, unknown>>,
  context: { readonly signal: AbortSignal }
) => unknown | Promise<unknown>

/** Skill JavaScript 入口的有限导出形状。 */
interface SkillModuleShape {
  /** 推荐的具名 tools 导出。 */
  readonly tools?: Readonly<Record<string, SkillToolHandler>>
  /** CommonJS/default 兼容导出。 */
  readonly default?: { readonly tools?: Readonly<Record<string, SkillToolHandler>> }
}

// ========= 变量 =========

/** 当前 Host 唯一 Skill 描述。 */
let descriptor: SkillRuntimeDescriptor | undefined

/** 当前 Skill 导出的工具处理器。 */
let handlers: Readonly<Record<string, SkillToolHandler>> = {}

/** 正在运行调用的取消器。 */
const activeCalls = new Map<string, AbortController>()

// ========= 函数 =========

/** 向 Utility 发送经过共享 Schema 校验的消息。 */
function post(message: unknown): void {
  if (typeof process.send !== 'function') return
  process.send(message)
}

/** 加载唯一 Skill 入口，且不执行安装或 lifecycle。 */
async function configure(rawDescriptor: SkillRuntimeDescriptor): Promise<void> {
  descriptor = rawDescriptor
  if (!rawDescriptor.entryPath) {
    handlers = {}
    post(SkillHostReadySchema.parse({
      kind: 'skill-host.ready',
      skillName: rawDescriptor.name,
      ok: true,
      message: 'Prompt-only Skill 已载入。'
    }))
    return
  }

  try {
    /** 直接从已验证绝对路径加载且不解析运行时依赖。 */
    const imported = await import(pathToFileURL(rawDescriptor.entryPath).href) as SkillModuleShape
    /** 推荐导出优先，其次兼容 default.tools。 */
    const exportedHandlers = imported.tools ?? imported.default?.tools ?? {}
    /** 只接受 manifest 已声明且实际为函数的工具。 */
    handlers = Object.fromEntries(rawDescriptor.tools.map((tool) => {
      /** 入口导出的同名处理器。 */
      const handler = exportedHandlers[tool.name]
      if (typeof handler !== 'function') throw new Error(`入口未导出工具 ${tool.name}。`)
      return [tool.name, handler]
    }))
    post(SkillHostReadySchema.parse({
      kind: 'skill-host.ready',
      skillName: rawDescriptor.name,
      ok: true,
      message: `已隔离载入 ${rawDescriptor.tools.length} 个工具。`
    }))
  } catch (error) {
    post(SkillHostReadySchema.parse({
      kind: 'skill-host.ready',
      skillName: rawDescriptor.name,
      ok: false,
      message: safeMessage(error)
    }))
  }
}

/** 执行单次 Utility 已批准调用。 */
async function call(input: SkillHostCall): Promise<void> {
  /** 已载入工具处理器。 */
  const handler = handlers[input.toolName]
  if (!handler) {
    post(SkillHostResultSchema.parse({
      kind: 'skill-host.result',
      requestId: input.requestId,
      ok: false,
      code: 'CAPABILITY_UNAVAILABLE',
      message: 'Skill 工具未导出。'
    }))
    return
  }
  /** 单次调用取消器。 */
  const controller = new AbortController()
  activeCalls.set(input.requestId, controller)
  try {
    /** Skill 返回值仅经结构化克隆 IPC 传输，不提供任何宿主对象。 */
    const data = await handler(input.arguments, { signal: controller.signal })
    post(SkillHostResultSchema.parse({
      kind: 'skill-host.result',
      requestId: input.requestId,
      ok: true,
      code: 'OK',
      message: 'Skill 工具调用完成。',
      ...(data === undefined ? {} : { data })
    }))
  } catch (error) {
    post(SkillHostResultSchema.parse({
      kind: 'skill-host.result',
      requestId: input.requestId,
      ok: false,
      code: controller.signal.aborted ? 'CANCELLED' : 'SKILL_EXECUTION_FAILED',
      message: safeMessage(error)
    }))
  } finally {
    activeCalls.delete(input.requestId)
  }
}

/** 将未知错误转换成有限消息。 */
function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : 'Skill Host 操作失败。').slice(0, 500)
}

process.on('message', (rawMessage: unknown) => {
  /** 首次配置消息。 */
  const configuration = SkillHostConfigureSchema.safeParse(rawMessage)
  if (configuration.success && !descriptor) {
    void configure(configuration.data.descriptor)
    return
  }
  /** 工具调用消息。 */
  const invocation = SkillHostCallSchema.safeParse(rawMessage)
  if (invocation.success && descriptor) {
    void call(invocation.data)
    return
  }
  /** 调用取消消息。 */
  const cancellation = SkillHostCancelSchema.safeParse(rawMessage)
  if (cancellation.success) activeCalls.get(cancellation.data.requestId)?.abort('utility-cancelled')
})

process.once('disconnect', () => {
  for (const controller of activeCalls.values()) controller.abort('utility-disconnected')
  activeCalls.clear()
  process.exit(0)
})
