import { z } from 'zod'

import type { TrackSummary } from '../player/types'
import { AgentToolRegistry } from './tool-registry'
import { ApprovalCoordinator } from './approval-coordinator'
import { EntityResolver } from './entity-resolver'
import { SelectionCoordinator, type SelectionRequestOption } from './selection-coordinator'
import { ToolScheduler } from './tool-scheduler'
import { evaluateMusicPolicy } from '../security/agent-policy'
import {
  AgentSnapshotSchema,
  type AgentCommand,
  type AgentMessage,
  type AgentPlayerState,
  type AgentRuntimeEvent,
  type AgentSnapshot,
  type AgentTurnEndReason,
  type AgentTurnStatus,
  type ApprovalSnapshot,
  type CommandSafetyLevel,
  type MusicSafetyLevel,
  type SelectionSnapshot,
  type ToolExecutionCardSnapshot
} from '../../shared/schemas/agent'
import {
  MusicMutationResultSchema,
  MusicReadResultSchema,
  type MusicMutationPayload,
  type MusicReadPayload,
  type StandardMusicEntity,
  type StandardSong
} from '../../shared/schemas/music'
import type { PlayerCommandAction } from '../../shared/schemas/player-command'
import type { ProviderProtocol } from '../../shared/schemas/provider-profile'

// ========= 类型 =========

/** Agent Runtime 可消费的 Provider Profile。 */
export interface AgentProviderProfile {
  /** 稳定 Profile ID。 */
  readonly profileId: string
  /** Provider 协议。 */
  readonly protocol: ProviderProtocol
  /** 模型 ID。 */
  readonly model: string
  /** 服务根地址。 */
  readonly baseUrl: string
  /** 只在 Utility 内存存在的认证与自定义 Header。 */
  readonly headers?: Readonly<Record<string, string>>
  /** 不可逆凭据指纹。 */
  readonly credentialFingerprint?: string
}

/** Provider 对话消息。 */
export interface AgentProviderMessage {
  /** 标准对话角色。 */
  readonly role: 'system' | 'user' | 'assistant' | 'tool'
  /** 文本内容或 JSON Tool Result。 */
  readonly content: string
  /** Tool Result 对应 ID。 */
  readonly toolCallId?: string
  /** Tool Result 对应工具名。 */
  readonly toolName?: string
  /** Assistant 完整 Tool Call。 */
  readonly toolCalls?: readonly CompletedAgentToolCall[]
}

/** Provider 流式事件。 */
export type AgentProviderStreamEvent =
  | { readonly type: 'text-delta'; readonly text: string }
  | { readonly type: 'tool-call-delta'; readonly id: string; readonly index?: number; readonly name?: string; readonly argumentsDelta?: string }
  | { readonly type: 'completed'; readonly finishReason?: string }

/** Provider 端口。 */
export interface AgentProviderPort {
  /** 请求一次流式模型响应。 */
  stream(input: {
    readonly profile: AgentProviderProfile
    readonly messages: readonly AgentProviderMessage[]
    readonly tools: readonly {
      readonly name: string
      readonly description: string
      readonly parameters: Readonly<Record<string, unknown>>
    }[]
    readonly signal: AbortSignal
  }): AsyncIterable<AgentProviderStreamEvent>
}

/** Music Service 端口。 */
export interface AgentMusicPort {
  /** 读取标准音乐实体。 */
  read(requestId: string, payload: MusicReadPayload): Promise<unknown>
  /** 执行不可透明重试的音乐写入。 */
  mutate(requestId: string, payload: MusicMutationPayload): Promise<unknown>
  /** 取消 Music Service 请求。 */
  cancel(requestId: string): void
}

/** Agent Runtime 构造参数。 */
export interface AgentRuntimeOptions {
  /** 三协议统一 Provider 端口。 */
  readonly provider: AgentProviderPort
  /** 复用页面同一 Music Service 的端口。 */
  readonly music: AgentMusicPort
  /** 向 Renderer 推送快照和播放器请求。 */
  readonly emit: (event: AgentRuntimeEvent) => void
  /** 初始音乐安全等级。 */
  readonly musicSafetyLevel?: MusicSafetyLevel
  /** 初始命令安全等级。 */
  readonly commandSafetyLevel?: CommandSafetyLevel
  /** 初始 Shell Tool 开关。 */
  readonly shellToolEnabled?: boolean
}

/** Provider 已完成 Tool Call。 */
interface CompletedAgentToolCall {
  /** 稳定 Tool Call ID。 */
  readonly id: string
  /** 注册工具名。 */
  readonly name: string
  /** 完整 JSON 参数文本。 */
  readonly arguments: string
}

/** Tool 执行结果。 */
interface AgentToolResult {
  /** Tool 是否成功进入业务终态。 */
  readonly ok: boolean
  /** 稳定状态或错误码。 */
  readonly code: string
  /** 面向模型与用户的脱敏摘要。 */
  readonly summary: string
  /** 额外结构化结果。 */
  readonly data?: unknown
}

/** 等待 Renderer 真实播放器回执的请求。 */
interface PendingPlayerCommand {
  /** 完成回执。 */
  readonly resolve: (result: AgentToolResult) => void
  /** 十秒超时计时器。 */
  readonly timer: ReturnType<typeof setTimeout>
}

/** 等待 Renderer 读取真实播放器状态的请求。 */
interface PendingPlayerState {
  /** 状态读取范围。 */
  readonly scope: 'player' | 'queue'
  /** 完成回执。 */
  readonly resolve: (result: AgentToolResult) => void
  /** 五秒超时计时器。 */
  readonly timer: ReturnType<typeof setTimeout>
}

/** Provider Tool Call 增量聚合器。 */
interface ToolCallAccumulator {
  /** 稳定 Tool Call ID。 */
  id: string
  /** 注册工具名。 */
  name: string
  /** 参数 JSON 增量。 */
  arguments: string
}

// ========= 变量 =========

/** 单 Turn 最大 Tool Round。 */
export const MAX_TOOL_ROUNDS_PER_TURN = 12

/** 单 Turn 最大 Tool Call。 */
export const MAX_TOOL_CALLS_PER_TURN = 24

/** 单 Turn 主动运行时间上限。 */
export const ACTIVE_TURN_BUDGET_MS = 10 * 60 * 1_000

/** Provider 无有效增量超时。 */
export const PROVIDER_IDLE_TIMEOUT_MS = 90_000

/** Provider 超时最大重试次数，不含初始请求。 */
export const MAX_PROVIDER_TIMEOUT_RETRIES = 5

/** 播放器命令回执超时。 */
const PLAYER_COMMAND_TIMEOUT_MS = 10_000

/** 播放器状态读取超时。 */
const PLAYER_STATE_TIMEOUT_MS = 5_000

/** 小云固定系统规则；安全边界仍由代码策略执行。 */
const XIAOYUN_SYSTEM_PROMPT = [
  '你是 NcxMusic 的音乐助手“小云”。默认使用简体中文，友好、自然、简洁并优先给出结果。',
  '所有播放、歌单、收藏、评论和账户操作必须通过已注册工具，不能声称尚未收到真实回执的操作已经成功。',
  '当工具返回 needs_selection 时，调用 request_user_selection；选择结果只表示用户答案，后续业务操作必须重新调用对应工具。',
  '不要猜测网易云实体 ID，不要请求或输出 Cookie、API Key、认证 Header、权限内部判断或未注册能力。',
  '支付、购买、订阅、下单和代购不在可用能力范围。'
].join('\n')

/** 相似歌手能力参数，只接受本轮事实池引用。 */
const SimilarArtistsCapabilityParamsSchema = z.strictObject({
  artistRef: z.string().regex(/^artist:\d{1,20}$/u)
})

/** 评论读取能力参数，只接受本轮事实池引用。 */
const CommentsCapabilityParamsSchema = z.strictObject({
  resourceRef: z.string().regex(/^(song|album|playlist):\d{1,20}$/u)
})

/** 每日签到能力无参数。 */
const DailySigninCapabilityParamsSchema = z.strictObject({})

/** Capability Catalog 中 Phase 5 已接通的少量兜底能力。 */
const CAPABILITY_CATALOG = [
  {
    capabilityId: 'music.similar-artists',
    description: '读取本轮事实池中指定歌手的相似歌手',
    parameters: { type: 'object', required: ['artistRef'], properties: { artistRef: { type: 'string', pattern: '^artist:' } } }
  },
  {
    capabilityId: 'music.daily-signin',
    description: '执行网易云每日签到；按音乐库写入动作审批',
    parameters: { type: 'object', additionalProperties: false }
  },
  {
    capabilityId: 'music.comments',
    description: '读取本轮事实池中歌曲、专辑或歌单的评论',
    parameters: { type: 'object', required: ['resourceRef'], properties: { resourceRef: { type: 'string' } } }
  }
] as const

// ========= 类 =========

/** Utility Process 内的单会话、单 Active Turn 手写 Agent Runtime。 */
export class AgentRuntime {
  /** 正向 Tool Registry。 */
  private readonly registry = new AgentToolRegistry()

  /** 本轮统一实体事实池。 */
  private readonly entities = new Map<string, StandardMusicEntity>()

  /** 只从本轮事实池消解名称、ID 与当前实体。 */
  private readonly entityResolver = new EntityResolver(() => ({ entities: [...this.entities.values()] }))

  /** Tool 卡历史。 */
  private readonly tools: ToolExecutionCardSnapshot[] = []

  /** 审批卡历史。 */
  private readonly approvals: ApprovalSnapshot[] = []

  /** 选择卡历史。 */
  private readonly selections: SelectionSnapshot[] = []

  /** 对话消息。 */
  private readonly messages: AgentMessage[] = []

  /** 等待 Renderer 的播放器命令。 */
  private readonly pendingPlayerCommands = new Map<string, PendingPlayerCommand>()

  /** 等待 Renderer 的播放器状态读取。 */
  private readonly pendingPlayerStates = new Map<string, PendingPlayerState>()

  /** 当前 Turn 尚未完成的 Music Service 请求。 */
  private readonly activeMusicRequests = new Set<string>()

  /** 当前 Turn 已由真实播放器快照证明存在的队列项。 */
  private readonly knownQueueItemIds = new Set<string>()

  /** 审批协调器。 */
  private readonly approvalCoordinator: ApprovalCoordinator

  /** 选择协调器。 */
  private readonly selectionCoordinator: SelectionCoordinator

  /** 当前默认 Provider Profile。 */
  private profile: AgentProviderProfile | undefined

  /** 当前 Turn 冻结的 Provider，避免中途切换数据接收方。 */
  private turnProfile: AgentProviderProfile | undefined

  /** 当前 Turn ID。 */
  private turnId: string | undefined

  /** 当前 Turn 状态。 */
  private turnStatus: AgentTurnStatus = 'idle'

  /** 最近终止原因。 */
  private endReason: AgentTurnEndReason | undefined

  /** 当前 Tool Round 数。 */
  private toolRounds = 0

  /** 当前 Tool Call 数。 */
  private toolCalls = 0

  /** 当前主动运行片段的开始时间。 */
  private activeSegmentStartedAt = 0

  /** 当前 Turn 已累计的主动运行时长。 */
  private activeElapsedMs = 0

  /** 主动预算是否因等待用户审批或选择而暂停。 */
  private activeBudgetPaused = false

  /** 当前 Turn 取消控制器。 */
  private turnController: AbortController | undefined

  /** 当前音乐安全等级。 */
  private musicSafetyLevel: MusicSafetyLevel

  /** 当前命令安全等级。 */
  private commandSafetyLevel: CommandSafetyLevel

  /** Shell Tool 开关。 */
  private shellToolEnabled: boolean

  constructor(private readonly options: AgentRuntimeOptions) {
    this.musicSafetyLevel = options.musicSafetyLevel ?? 'M1'
    this.commandSafetyLevel = options.commandSafetyLevel ?? 'S1'
    this.shellToolEnabled = options.shellToolEnabled ?? false
    this.approvalCoordinator = new ApprovalCoordinator({
      onChange: (snapshot) => {
        upsertSnapshot(this.approvals, snapshot, (item) => item.approvalId)
        this.publish()
      }
    })
    this.selectionCoordinator = new SelectionCoordinator({
      resolveEntity: (entityRef) => this.entities.get(entityRef),
      onChange: (snapshot) => {
        upsertSnapshot(this.selections, snapshot, (item) => item.selectionId)
        this.publish()
      }
    })
  }

  /** Main 私有配置通道注入或清除当前 Provider。 */
  configureProvider(profile: AgentProviderProfile | undefined): void {
    this.profile = profile
    this.publish()
  }

  /** 处理 Renderer Agent 命令并返回最新快照。 */
  async command(command: AgentCommand): Promise<AgentSnapshot> {
    if (command.operation === 'sendMessage') {
      void this.startTurn(command.content, command.context)
    } else if (command.operation === 'stop') {
      this.cancelActiveTurn('user_stopped')
    } else if (command.operation === 'respondApproval') {
      this.approvalCoordinator.respond(command.approvalId, command.decision)
    } else if (command.operation === 'respondSelection') {
      this.selectionCoordinator.respond(command.selectionId, command.selectedOptionKeys)
    } else if (command.operation === 'cancelSelection') {
      this.selectionCoordinator.cancel(command.selectionId)
    } else if (command.operation === 'setSafety') {
      if (command.musicSafetyLevel) this.musicSafetyLevel = command.musicSafetyLevel
      if (command.commandSafetyLevel) this.commandSafetyLevel = command.commandSafetyLevel
      if (command.shellToolEnabled !== undefined) this.shellToolEnabled = command.shellToolEnabled
      this.publish()
    } else if (command.operation === 'playerCommandResult') {
      this.resolvePlayerCommand(command.toolCallId, command.ok, command.summary, command.latestRevision)
    } else if (command.operation === 'playerStateResult') {
      this.resolvePlayerState(command.toolCallId, command.state)
    }
    return this.snapshot()
  }

  /** 账户切换、应用退出或 Utility 生命周期故障时终止旧 Turn。 */
  terminate(reason: Extract<AgentTurnEndReason, 'account_switch' | 'app_exit' | 'runtime_failure'>): void {
    this.cancelActiveTurn(reason)
  }

  /** 导出 Renderer 重载可恢复快照。 */
  snapshot(): AgentSnapshot {
    return AgentSnapshotSchema.parse({
      configured: Boolean(this.profile),
      ...(this.profile ? { activeProfileId: this.profile.profileId } : {}),
      ...(this.turnId ? { turnId: this.turnId } : {}),
      turnStatus: this.turnStatus,
      ...(this.endReason ? { endReason: this.endReason } : {}),
      messages: this.messages,
      tools: this.tools,
      approvals: this.approvals,
      selections: this.selections,
      toolRounds: this.toolRounds,
      toolCalls: this.toolCalls,
      musicSafetyLevel: this.musicSafetyLevel,
      commandSafetyLevel: this.commandSafetyLevel,
      shellToolEnabled: this.shellToolEnabled,
      updatedAt: Date.now()
    })
  }

  /** 创建新 Turn；新消息先取消旧 Turn 和未决交互。 */
  private async startTurn(
    content: string,
    context?: {
      readonly routeName?: string | undefined
      readonly entityKind?: string | undefined
      readonly entityId?: string | undefined
      readonly entityName?: string | undefined
    }
  ): Promise<void> {
    if (!this.profile) {
      this.messages.push(createMessage('system', '尚未配置模型，请先前往模型设置。'))
      this.publish()
      return
    }
    if (this.turnController) this.cancelActiveTurn('superseded_by_user_message')
    /** 新 Turn 控制器。 */
    const controller = new AbortController()
    this.turnController = controller
    this.turnProfile = this.profile
    this.turnId = crypto.randomUUID()
    this.turnStatus = 'building_context'
    this.endReason = undefined
    this.toolRounds = 0
    this.toolCalls = 0
    this.activeElapsedMs = 0
    this.activeSegmentStartedAt = Date.now()
    this.activeBudgetPaused = false
    this.entities.clear()
    this.knownQueueItemIds.clear()
    this.tools.splice(0)
    this.approvals.splice(0)
    this.selections.splice(0)
    /** 带页面实体上下文的用户消息。 */
    const contextSuffix = context?.entityId
      ? `\n\n[当前页面上下文：${context.entityKind ?? 'entity'} ${context.entityName ?? ''} (${context.entityId})]`
      : ''
    this.messages.push(createMessage('user', `${content}${contextSuffix}`))
    this.publish()
    try {
      await this.runLoop(controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      this.turnStatus = 'failed'
      this.endReason = 'provider_error'
      this.messages.push(createMessage('system', readableError(error)))
      this.publish()
    } finally {
      if (this.turnController === controller) {
        this.turnController = undefined
        this.turnProfile = undefined
      }
    }
  }

  /** 执行多轮 Provider → Tool → Provider 主循环。 */
  private async runLoop(signal: AbortSignal): Promise<void> {
    /** 发给 Provider 的当前连续会话上下文。 */
    const providerMessages: AgentProviderMessage[] = [
      { role: 'system', content: XIAOYUN_SYSTEM_PROMPT },
      ...this.messages
        .filter((message) => message.role !== 'system')
        .slice(-24)
        .map((message) => ({ role: message.role, content: message.content }))
    ]
    while (!signal.aborted) {
      if (this.limitReached()) {
        await this.requestLimitSummary(providerMessages, signal)
        if (signal.aborted) return
        this.turnStatus = 'completed'
        this.endReason = 'limit_reached'
        this.publish()
        return
      }
      /** 当前 Assistant 输出消息。 */
      const assistant = createMessage('assistant', '', true)
      this.messages.push(assistant)
      this.turnStatus = 'requesting_model'
      this.publish()
      /** 当前模型响应。 */
      const response = await this.requestModel(providerMessages, assistant, signal)
      assistant.streaming = false
      if (signal.aborted) return
      if (response.toolCalls.length === 0) {
        this.turnStatus = 'completed'
        this.endReason = 'completed'
        this.publish()
        return
      }
      this.toolRounds += 1
      providerMessages.push({
        role: 'assistant',
        content: assistant.content,
        toolCalls: response.toolCalls
      })
      this.turnStatus = 'scheduling_tools'
      this.publish()
      /** 当前批次按原始顺序回填的 Tool Result。 */
      const results = await this.executeToolBatch(response.toolCalls, signal)
      for (let index = 0; index < response.toolCalls.length; index += 1) {
        /** 当前 Tool Call。 */
        const toolCall = response.toolCalls[index]
        /** 对应 Tool Result。 */
        const result = results[index]
        if (!toolCall || !result) continue
        providerMessages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
          toolName: toolCall.name
        })
      }
    }
  }

  /** 达到硬限额后执行唯一一次不暴露 Tool 的收尾总结。 */
  private async requestLimitSummary(
    providerMessages: AgentProviderMessage[],
    signal: AbortSignal
  ): Promise<void> {
    providerMessages.push({
      role: 'system',
      content: '本轮已达到安全运行限额。请只总结已完成内容、未完成原因和用户下一步，不得调用工具。'
    })
    /** 收尾 Assistant 消息。 */
    const assistant = createMessage('assistant', '', true)
    this.messages.push(assistant)
    this.turnStatus = 'requesting_model'
    this.publish()
    await this.requestModel(providerMessages, assistant, signal, false)
    assistant.streaming = false
    if (!assistant.content) assistant.content = '本轮已达到安全运行限额，已停止继续调用工具。'
  }

  /** 请求模型并聚合文本与 Tool Call 增量，只对超时重试最多五次。 */
  private async requestModel(
    messages: readonly AgentProviderMessage[],
    assistant: AgentMessage,
    signal: AbortSignal,
    exposeTools = true
  ): Promise<{ readonly toolCalls: CompletedAgentToolCall[] }> {
    /** 当前配置快照。 */
    const profile = this.turnProfile ?? this.profile
    if (!profile) throw new Error('Provider Profile 已不可用。')
    for (let attempt = 0; attempt <= MAX_PROVIDER_TIMEOUT_RETRIES; attempt += 1) {
      /** 当前尝试的 Tool Call 聚合器。 */
      const calls: ToolCallAccumulator[] = []
      /** 最近命名的 Tool Call，用于兼容协议增量缺少稳定 ID 的片段。 */
      let currentCall: ToolCallAccumulator | undefined
      try {
        this.turnStatus = 'streaming_model'
        for await (const event of this.streamWithIdleTimeout(profile, messages, signal, exposeTools)) {
          if (event.type === 'text-delta') {
            assistant.content += event.text
            this.publish()
          } else if (event.type === 'tool-call-delta') {
            /** 当前事件的稳定 Tool Call ID。 */
            const eventId = normalizeToolCallId(event.id)
            /** 由 ID 精确关联的 Tool Call。 */
            let targetCall = calls.find((call) => call.id === eventId)
            if (!targetCall && event.name) {
              targetCall = { id: eventId, name: event.name, arguments: '' }
              calls.push(targetCall)
            }
            if (targetCall) currentCall = targetCall
            /** 接收当前参数片段的调用。 */
            const argumentTarget = targetCall ?? currentCall
            if (event.argumentsDelta && argumentTarget) argumentTarget.arguments += event.argumentsDelta
          }
        }
        return {
          toolCalls: calls
            .filter((call) => call.name.length > 0)
            .map((call) => ({ id: call.id, name: call.name, arguments: call.arguments || '{}' }))
        }
      } catch (error) {
        if (signal.aborted) throw error
        if (!isProviderTimeout(error) || attempt >= MAX_PROVIDER_TIMEOUT_RETRIES) throw error
      }
    }
    return { toolCalls: [] }
  }

  /** 对 Provider 的最近有效增量实施 90 秒空闲超时。 */
  private async *streamWithIdleTimeout(
    profile: AgentProviderProfile,
    messages: readonly AgentProviderMessage[],
    turnSignal: AbortSignal,
    exposeTools = true
  ): AsyncGenerator<AgentProviderStreamEvent> {
    /** 当前请求独立取消器。 */
    const attemptController = new AbortController()
    /** Turn 取消向当前请求传播。 */
    const abortAttempt = (): void => attemptController.abort(turnSignal.reason)
    turnSignal.addEventListener('abort', abortAttempt, { once: true })
    /** Provider 事件迭代器。 */
    const iterator = this.options.provider.stream({
      profile,
      messages,
      tools: exposeTools ? this.registry.providerDefinitions() : [],
      signal: attemptController.signal
    })[Symbol.asyncIterator]()
    try {
      while (true) {
        /** 当前空闲超时计时器。 */
        let timer: ReturnType<typeof setTimeout> | undefined
        /** 当前增量或空闲超时。 */
        const next = await Promise.race([
          iterator.next(),
          new Promise<'idle-timeout'>((resolve) => {
            timer = setTimeout(() => resolve('idle-timeout'), PROVIDER_IDLE_TIMEOUT_MS)
          })
        ])
        if (timer) clearTimeout(timer)
        if (next === 'idle-timeout') {
          attemptController.abort('provider-idle-timeout')
          throw Object.assign(new Error('模型 90 秒未返回有效增量。'), { code: 'PROVIDER_TIMEOUT' })
        }
        if (next.done) return
        yield next.value
      }
    } finally {
      turnSignal.removeEventListener('abort', abortAttempt)
      await iterator.return?.()
    }
  }

  /** 并行执行安全只读任务，并保持 Tool Result 原始顺序。 */
  private async executeToolBatch(
    calls: readonly CompletedAgentToolCall[],
    signal: AbortSignal
  ): Promise<AgentToolResult[]> {
    /** 当前批次调度器。 */
    const scheduler = new ToolScheduler()
    /** Turn 取消时停止尚未开始的调度任务。 */
    const cancelScheduler = (): void => scheduler.cancelQueued()
    signal.addEventListener('abort', cancelScheduler, { once: true })
    try {
      return await Promise.all(calls.map(async (call) => {
      if (this.toolCalls >= MAX_TOOL_CALLS_PER_TURN) {
        return { ok: false, code: 'TOOL_CALL_LIMIT', summary: '本轮 Tool Call 已达到 24 次上限。' }
      }
      this.toolCalls += 1
      /** 解析后的原始参数。 */
      let rawInput: unknown
      try {
        rawInput = JSON.parse(call.arguments) as unknown
      } catch {
        return this.invalidToolCall(call, 'TOOL_ARGUMENTS_INVALID', '工具参数不是合法 JSON。')
      }
      /** Registry 解析结果。 */
      const resolved = this.registry.resolve(call.name, rawInput)
      if (!resolved) return this.invalidToolCall(call, 'CAPABILITY_UNAVAILABLE', '工具或参数未注册。')
      /** 初始 Tool 卡。 */
      const card: ToolExecutionCardSnapshot = {
        toolCallId: normalizeUuid(call.id),
        toolName: call.name,
        title: resolved.operation.title,
        category: toolCategory(call.name),
        status: 'queued',
        parameterSummary: summarizeParameters(resolved.input)
      }
      this.tools.push(card)
      this.publish()

      if (resolved.operation.riskAction) {
        /** 当前音乐策略结果。 */
        const policy = evaluateMusicPolicy({
          registered: true,
          action: resolved.operation.riskAction,
          level: this.musicSafetyLevel
        })
        if (policy.decision === 'deny') return this.finishTool(card, false, 'POLICY_DENIED', policy.reason)
        if (policy.decision === 'ask') {
          card.status = 'awaiting_approval'
          this.turnStatus = 'awaiting_approval'
          /** 当前 Tool Call 的一次性审批请求。 */
          const approval = this.approvalCoordinator.request({
            toolCallId: card.toolCallId,
            title: resolved.operation.title,
            impact: card.parameterSummary,
            riskReason: policy.reason
          })
          this.publish()
          /** 审批等待不执行任何底层逻辑。 */
          const outcome = await this.waitForUser(approval.outcome)
          if (outcome !== 'approved') {
            /** 审批终态到稳定 Tool 错误码映射。 */
            const code = outcome === 'rejected'
              ? 'USER_REJECTED'
              : outcome === 'expired'
                ? 'APPROVAL_EXPIRED'
                : 'APPROVAL_CANCELLED'
            return this.finishTool(card, false, code, '操作未执行。')
          }
        }
      }
      card.status = 'running'
      card.startedAt = Date.now()
      this.turnStatus = 'executing_tools'
      this.publish()
      try {
        return await scheduler.schedule({
          toolCallId: card.toolCallId,
          effect: resolved.operation.effect,
          conflictKeys: resolved.operation.conflictKeys,
          run: () => this.executeRegisteredTool(call.name, resolved.input, card.toolCallId)
        }).then((result) => this.finishTool(card, result.ok, result.code, result.summary, result.data))
      } catch (error) {
        return this.finishTool(card, false, errorCode(error), readableError(error))
      }
      }))
    } finally {
      signal.removeEventListener('abort', cancelScheduler)
    }
  }

  /** 执行已经通过 Schema、Registry、Policy 与 Scheduler 的 Tool。 */
  private async executeRegisteredTool(
    toolName: string,
    input: Record<string, unknown>,
    toolCallId: string
  ): Promise<AgentToolResult> {
    if (toolName === 'smart_search_and_play') return this.smartSearchAndPlay(input, toolCallId)
    if (toolName === 'control_player') return this.controlPlayer(input, toolCallId)
    if (toolName === 'queue_manager') return this.manageQueue(input, toolCallId)
    if (toolName === 'playlist_manager') return this.managePlaylist(input)
    if (toolName === 'library_manager') return this.manageLibrary(input)
    if (toolName === 'music_explorer') return this.exploreMusic(input)
    if (toolName === 'comments_and_social') return this.commentsAndSocial(input)
    if (toolName === 'account_manager') return input['action'] === 'daily_signin'
      ? this.mutateMusic({ operation: 'dailySignin' })
      : { ok: true, code: 'OK', summary: '账户状态由当前 NcxMusic 会话管理。' }
    if (toolName === 'user_profile_memory') {
      return { ok: true, code: 'PHASE_6_PENDING', summary: '音乐画像与长期记忆将在 Phase 6 启用。' }
    }
    if (toolName === 'request_user_selection') return this.requestSelection(input, toolCallId)
    if (toolName === 'find_music_api_capabilities') return this.findCapabilities(String(input['query']))
    if (toolName === 'call_music_api') return this.callCapability(String(input['capabilityId']), input['params'])
    return { ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: '能力未注册。' }
  }

  /** 搜索歌曲，并在唯一候选时请求 Renderer 真实播放。 */
  private async smartSearchAndPlay(input: Record<string, unknown>, toolCallId: string): Promise<AgentToolResult> {
    /** Music Service 请求 ID。 */
    const requestId = crypto.randomUUID()
    this.activeMusicRequests.add(requestId)
    /** 搜索歌曲候选。 */
    let songs: StandardSong[]
    try {
      /** 标准搜索结果。 */
      const result = MusicReadResultSchema.parse(await this.options.music.read(requestId, {
        operation: 'search',
        query: String(input['query']),
        limit: 5,
        offset: 0
      }))
      if (result.kind !== 'search') {
        return { ok: false, code: 'UPSTREAM_ERROR', summary: '音乐搜索返回了不匹配的结果类型。' }
      }
      songs = result.songs
    } catch (error) {
      return { ok: false, code: errorCode(error), summary: readableError(error) }
    } finally {
      this.activeMusicRequests.delete(requestId)
    }
    this.collectEntities(songs)
    if (songs.length === 0) return { ok: false, code: 'NOT_FOUND', summary: '没有找到匹配歌曲。' }
    /** 基于本轮实体事实池的确定性歌曲消解结果。 */
    const resolution = this.entityResolver.resolve({
      kind: 'song',
      reference: String(input['query'])
    })
    if (resolution.status === 'needs_selection') {
      return {
        ok: true,
        code: 'NEEDS_SELECTION',
        summary: '找到多个接近候选，需要用户选择。',
        data: { candidates: resolution.candidates.map(entityReference) }
      }
    }
    if (resolution.status === 'not_found' || resolution.entity.kind !== 'song') {
      return { ok: false, code: 'NOT_FOUND', summary: '没有找到匹配歌曲。' }
    }
    /** 唯一明确候选。 */
    const song = resolution.entity
    if (input['action'] === 'search') {
      return { ok: true, code: 'OK', summary: `找到了《${song.name}》。`, data: entityReference(song) }
    }
    return this.requestPlayerCommand(toolCallId, {
      type: 'player.play-track',
      track: songToTrackSummary(song),
      source: { kind: 'agent' }
    })
  }

  /** 映射播放器控制 Tool 到统一 PlayerCommand。 */
  private controlPlayer(input: Record<string, unknown>, toolCallId: string): Promise<AgentToolResult> | AgentToolResult {
    /** 播放器动作。 */
    const action = input['action']
    if (action === 'get_state') {
      return this.requestPlayerState(toolCallId, 'player')
    }
    /** 类型化播放器命令。 */
    let command: PlayerCommandAction
    if (action === 'play') command = { type: 'player.play' }
    else if (action === 'pause') command = { type: 'player.pause' }
    else if (action === 'next') command = { type: 'player.next' }
    else if (action === 'previous') command = { type: 'player.previous' }
    else if (action === 'toggle') command = { type: 'player.toggle' }
    else if (action === 'set_volume') command = { type: 'player.set-volume', volume: Number(input['volume'] ?? 1) }
    else command = { type: 'player.set-mode', mode: input['mode'] as 'loop' | 'loop-one' | 'shuffle' }
    return this.requestPlayerCommand(toolCallId, command)
  }

  /** 执行完整队列读取与类型化写入。 */
  private manageQueue(
    input: Record<string, unknown>,
    toolCallId: string
  ): Promise<AgentToolResult> | AgentToolResult {
    /** 队列动作。 */
    const action = input['action']
    if (action === 'get') return this.requestPlayerState(toolCallId, 'queue')
    if (action === 'clear') return this.requestPlayerCommand(toolCallId, { type: 'player.clear' })
    /** 只允许刚由真实队列快照提供的队列项 ID。 */
    const queueItemId = String(input['queueItemId'] ?? '')
    if (action === 'remove' || action === 'reorder') {
      if (!this.knownQueueItemIds.has(queueItemId)) {
        return { ok: false, code: 'QUEUE_ITEM_NOT_IN_CONTEXT', summary: '队列项不在本轮真实播放器快照中。' }
      }
      return action === 'remove'
        ? this.requestPlayerCommand(toolCallId, { type: 'player.remove', queueItemId })
        : this.requestPlayerCommand(toolCallId, {
            type: 'player.reorder',
            queueItemId,
            toIndex: Number(input['toIndex'])
          })
    }
    /** 从本轮事实池解析的歌曲列表。 */
    const tracks = (input['entityRefs'] as string[] | undefined)?.map((reference) => this.entities.get(reference))
    if (!tracks?.length || tracks.some((entity) => entity?.kind !== 'song')) {
      return entityReferenceUnavailable()
    }
    /** 不含播放 URL 的播放器曲目摘要。 */
    const summaries = tracks.map((entity) => songToTrackSummary(entity as StandardSong))
    if (action === 'enqueue') {
      return this.requestPlayerCommand(toolCallId, { type: 'player.enqueue', tracks: summaries, source: { kind: 'agent' } })
    }
    if (action === 'play_next') {
      return this.requestPlayerCommand(toolCallId, { type: 'player.play-next', tracks: summaries, source: { kind: 'agent' } })
    }
    return this.requestPlayerCommand(toolCallId, {
      type: 'player.play-context',
      tracks: summaries,
      source: { kind: 'agent' },
      startIndex: 0
    })
  }

  /** 执行歌单读取或写入。 */
  private managePlaylist(input: Record<string, unknown>): Promise<AgentToolResult> {
    /** 歌单动作。 */
    const action = input['action']
    if (action === 'get') return this.readMusic({ operation: 'getPlaylist', id: String(input['playlistId']) })
    if (action === 'create') return this.mutateMusic({ operation: 'createPlaylist', name: String(input['name']), privacy: 'public' })
    if (action === 'rename') return this.mutateMusic({ operation: 'renamePlaylist', playlistId: String(input['playlistId']), name: String(input['name']) })
    if (action === 'delete') return this.mutateMusic({ operation: 'deletePlaylist', playlistId: String(input['playlistId']) })
    if (action === 'reorder_tracks') {
      return this.mutateMusic({
        operation: 'reorderPlaylistTracks',
        playlistId: String(input['playlistId']),
        trackIds: input['trackIds'] as string[]
      })
    }
    return this.mutateMusic({
      operation: 'updatePlaylistTracks',
      playlistId: String(input['playlistId']),
      trackIds: input['trackIds'] as string[],
      action: action === 'add_tracks' ? 'add' : 'remove'
    })
  }

  /** 执行收藏/喜欢写入。 */
  private manageLibrary(input: Record<string, unknown>): Promise<AgentToolResult> {
    /** 收藏动作。 */
    const action = input['action']
    if (action === 'like_track') return this.mutateMusic({ operation: 'likeTrack', trackId: String(input['entityId']), liked: Boolean(input['enabled']) })
    if (action === 'subscribe_playlist') return this.mutateMusic({ operation: 'subscribePlaylist', playlistId: String(input['entityId']), subscribed: Boolean(input['enabled']) })
    return this.mutateMusic({ operation: 'subscribeAlbum', albumId: String(input['entityId']), subscribed: Boolean(input['enabled']) })
  }

  /** 执行标准音乐只读探索。 */
  private exploreMusic(input: Record<string, unknown>): Promise<AgentToolResult> {
    /** 只读动作。 */
    const action = input['action']
    if (action === 'search') return this.readMusic({ operation: 'search', query: String(input['query']), limit: 10, offset: 0 })
    /** 推荐或集合读取上限。 */
    const limit = Number(input['limit'] ?? 20)
    if (action === 'get_featured_playlists') return this.readMusic({ operation: 'getFeaturedPlaylists', limit })
    if (action === 'get_new_songs') return this.readMusic({ operation: 'getNewSongs', limit })
    if (action === 'get_daily_songs') return this.readMusic({ operation: 'getDailySongs', limit })
    /** 实体 ID。 */
    const id = String(input['entityId'])
    if (action === 'get_song') return this.readMusic({ operation: 'getSong', id })
    if (action === 'get_artist') return this.readMusic({ operation: 'getArtist', id })
    if (action === 'get_album') return this.readMusic({ operation: 'getAlbum', id })
    if (action === 'get_playlist') return this.readMusic({ operation: 'getPlaylist', id })
    if (action === 'get_lyrics') return this.readMusic({ operation: 'getLyrics', id })
    if (action === 'get_artist_albums') {
      return this.readMusic({ operation: 'getArtistAlbums', artistId: id, limit, offset: 0 })
    }
    return this.readMusic({ operation: 'getSimilarArtists', artistId: id })
  }

  /** 执行评论读写。 */
  private commentsAndSocial(input: Record<string, unknown>): Promise<AgentToolResult> {
    /** 评论动作。 */
    const action = input['action']
    /** 评论资源类型。 */
    const resourceType = input['resourceType'] as 'song' | 'album' | 'playlist'
    /** 评论资源 ID。 */
    const resourceId = String(input['resourceId'])
    if (action === 'get_comments') return this.readMusic({ operation: 'getComments', resourceType, resourceId, limit: 20, offset: 0 })
    if (action === 'add_comment') return this.mutateMusic({ operation: 'addComment', resourceType, resourceId, content: String(input['content']) })
    if (action === 'delete_comment') return this.mutateMusic({ operation: 'deleteComment', resourceType, resourceId, commentId: String(input['commentId']) })
    return this.mutateMusic({ operation: 'likeComment', resourceType, resourceId, commentId: String(input['commentId']), liked: Boolean(input['enabled']) })
  }

  /** 创建并等待 SelectionCard；选择本身不执行后续业务动作。 */
  private async requestSelection(input: Record<string, unknown>, toolCallId: string): Promise<AgentToolResult> {
    /** 模型提供且已经 Registry 校验的选择项。 */
    const options = input['options'] as SelectionRequestOption[]
    /** 当前唯一无副作用选择请求。 */
    const selection = this.selectionCoordinator.request({
      toolCallId,
      prompt: String(input['prompt']),
      mode: input['mode'] as 'single' | 'multiple',
      options
    })
    this.turnStatus = 'awaiting_selection'
    this.publish()
    /** 无副作用用户选择结果。 */
    const outcome = await this.waitForUser(selection.outcome)
    if (outcome.status === 'selected') {
      return {
        ok: true,
        code: 'SELECTED',
        summary: '用户已完成选择。',
        data: {
          selectedOptionKeys: outcome.selectedOptionKeys,
          selectedRefs: outcome.selectedRefs
        }
      }
    }
    return { ok: false, code: outcome.status === 'expired' ? 'SELECTION_EXPIRED' : 'SELECTION_CANCELLED', summary: '用户未完成选择。' }
  }

  /** 检索少量相关 Capability，不向 Prompt 注入完整目录。 */
  private findCapabilities(query: string): AgentToolResult {
    /** 归一化检索词。 */
    const normalized = normalizeName(query)
    /** 简单稳定相关性过滤。 */
    const matches = CAPABILITY_CATALOG.filter((item) =>
      normalizeName(`${item.capabilityId}${item.description}`).includes(normalized)
      || normalized.includes(normalizeName(item.description))
    ).slice(0, 5)
    return { ok: true, code: 'OK', summary: `找到 ${matches.length} 个已注册能力。`, data: matches }
  }

  /** 调用明确白名单中的冷门能力，拒绝任意 path。 */
  private callCapability(capabilityId: string, rawParams: unknown): Promise<AgentToolResult> {
    /** 参数普通对象。 */
    const params = isRecord(rawParams) ? rawParams : {}
    if (capabilityId === 'music.similar-artists') {
      /** 经目录 Schema 校验的相似歌手参数。 */
      const parsed = SimilarArtistsCapabilityParamsSchema.safeParse(params)
      if (!parsed.success) return Promise.resolve(invalidCapabilityParameters())
      /** 本轮事实池中的目标歌手。 */
      const artist = this.entities.get(parsed.data.artistRef)
      if (!artist || artist.kind !== 'artist') return Promise.resolve(entityReferenceUnavailable())
      return this.readMusic({ operation: 'getSimilarArtists', artistId: artist.id })
    }
    if (capabilityId === 'music.daily-signin') {
      /** 经目录 Schema 校验的签到参数。 */
      const parsed = DailySigninCapabilityParamsSchema.safeParse(params)
      return parsed.success
        ? this.mutateMusic({ operation: 'dailySignin' })
        : Promise.resolve(invalidCapabilityParameters())
    }
    if (capabilityId === 'music.comments') {
      /** 经目录 Schema 校验的评论参数。 */
      const parsed = CommentsCapabilityParamsSchema.safeParse(params)
      if (!parsed.success) return Promise.resolve(invalidCapabilityParameters())
      /** 本轮事实池中的目标评论资源。 */
      const entity = this.entities.get(parsed.data.resourceRef)
      if (!entity || !['song', 'album', 'playlist'].includes(entity.kind)) {
        return Promise.resolve(entityReferenceUnavailable())
      }
      return this.readMusic({
        operation: 'getComments',
        resourceType: entity.kind as 'song' | 'album' | 'playlist',
        resourceId: entity.id,
        limit: 20,
        offset: 0
      })
    }
    return Promise.resolve({ ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: 'Capability ID 未注册。' })
  }

  /** 通过 Music Service 读取并收集标准实体。 */
  private async readMusic(payload: MusicReadPayload): Promise<AgentToolResult> {
    /** Music Service 请求 ID。 */
    const requestId = crypto.randomUUID()
    this.activeMusicRequests.add(requestId)
    try {
      /** 标准结果。 */
      const data = MusicReadResultSchema.parse(await this.options.music.read(requestId, payload))
      this.collectResultEntities(data)
      return { ok: true, code: 'OK', summary: summarizeMusicResult(data), data: compactMusicResult(data) }
    } catch (error) {
      return { ok: false, code: errorCode(error), summary: readableError(error) }
    } finally {
      this.activeMusicRequests.delete(requestId)
    }
  }

  /** 通过 Music Service 执行一次不重试写入。 */
  private async mutateMusic(payload: MusicMutationPayload): Promise<AgentToolResult> {
    /** Music Service 请求 ID。 */
    const requestId = crypto.randomUUID()
    this.activeMusicRequests.add(requestId)
    try {
      /** 标准写入结果。 */
      const data = MusicMutationResultSchema.parse(await this.options.music.mutate(requestId, payload))
      return { ok: true, code: 'OK', summary: `已完成 ${data.operation}。`, data }
    } catch (error) {
      return { ok: false, code: errorCode(error), summary: readableError(error) }
    } finally {
      this.activeMusicRequests.delete(requestId)
    }
  }

  /** 请求 Renderer 唯一 PlayerCommandGateway 并等待真实回执。 */
  private requestPlayerCommand(toolCallId: string, action: PlayerCommandAction): Promise<AgentToolResult> {
    return new Promise((resolve) => {
      /** 十秒播放命令超时。 */
      const timer = setTimeout(() => {
        this.pendingPlayerCommands.delete(toolCallId)
        resolve({ ok: false, code: 'PLAYER_COMMAND_TIMEOUT', summary: '播放器命令 10 秒内未返回真实回执。' })
      }, PLAYER_COMMAND_TIMEOUT_MS)
      this.pendingPlayerCommands.set(toolCallId, { resolve, timer })
      this.options.emit({ type: 'player-command', request: { toolCallId, action } })
    })
  }

  /** 用 Renderer 的真实 PlayerCommandGateway 回执完成等待。 */
  private resolvePlayerCommand(
    toolCallId: string,
    ok: boolean,
    summary: string,
    latestRevision?: number
  ): void {
    /** 当前待决播放命令。 */
    const pending = this.pendingPlayerCommands.get(toolCallId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingPlayerCommands.delete(toolCallId)
    pending.resolve({
      ok,
      code: ok ? 'OK' : 'PLAYER_COMMAND_FAILED',
      summary,
      ...(latestRevision !== undefined ? { data: { latestRevision } } : {})
    })
  }

  /** 请求 Renderer 返回唯一 PlaybackCoordinator 的脱敏状态。 */
  private requestPlayerState(
    toolCallId: string,
    scope: 'player' | 'queue'
  ): Promise<AgentToolResult> {
    return new Promise((resolve) => {
      /** 五秒播放器状态读取超时。 */
      const timer = setTimeout(() => {
        this.pendingPlayerStates.delete(toolCallId)
        resolve({ ok: false, code: 'PLAYER_STATE_TIMEOUT', summary: '播放器状态 5 秒内未返回。' })
      }, PLAYER_STATE_TIMEOUT_MS)
      this.pendingPlayerStates.set(toolCallId, { scope, resolve, timer })
      this.options.emit({ type: 'player-state-request', request: { toolCallId, scope } })
    })
  }

  /** 用 Renderer 的真实 PlaybackCoordinator 快照完成状态读取。 */
  private resolvePlayerState(toolCallId: string, state: AgentPlayerState): void {
    /** 当前待决播放器状态请求。 */
    const pending = this.pendingPlayerStates.get(toolCallId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingPlayerStates.delete(toolCallId)
    for (const item of state.queue) this.knownQueueItemIds.add(item.queueItemId)
    /** 面向模型的短状态摘要。 */
    const summary = pending.scope === 'queue'
      ? `当前队列 ${state.queue.length} 首，模式 ${state.mode}，修订号 ${state.revision}。`
      : state.currentTrack
        ? `当前${state.playbackStatus}：《${state.currentTrack.name}》，音量 ${Math.round(state.volume * 100)}%。`
        : `当前播放器状态为 ${state.playbackStatus}，没有选中歌曲。`
    pending.resolve({ ok: true, code: 'OK', summary, data: state })
  }

  /** 参数/能力无效时创建明确失败卡。 */
  private invalidToolCall(call: CompletedAgentToolCall, code: string, summary: string): AgentToolResult {
    /** 失败 Tool 卡。 */
    const card: ToolExecutionCardSnapshot = {
      toolCallId: normalizeUuid(call.id),
      toolName: call.name,
      title: '无法执行工具',
      category: 'gateway',
      status: 'failed',
      parameterSummary: '参数未通过校验',
      resultSummary: summary,
      errorCode: code,
      endedAt: Date.now()
    }
    this.tools.push(card)
    this.publish()
    return { ok: false, code, summary }
  }

  /** 更新 Tool 卡到唯一终态并返回模型结果。 */
  private finishTool(
    card: ToolExecutionCardSnapshot,
    ok: boolean,
    code: string,
    summary: string,
    data?: unknown
  ): AgentToolResult {
    card.status = ok ? 'succeeded' : toolFailureStatus(code)
    card.resultSummary = summary
    if (!ok) card.errorCode = code
    card.endedAt = Date.now()
    if (card.startedAt !== undefined) card.durationMs = card.endedAt - card.startedAt
    this.publish()
    return { ok, code, summary, ...(data !== undefined ? { data } : {}) }
  }

  /** 收集标准响应中的实体。 */
  private collectResultEntities(result: ReturnType<typeof MusicReadResultSchema.parse>): void {
    if (result.kind === 'search') {
      this.collectEntities([...result.songs, ...result.artists, ...result.albums, ...result.playlists])
    } else if (result.kind === 'songCollection') this.collectEntities(result.songs)
    else if (result.kind === 'artistCollection') this.collectEntities(result.artists)
    else if (result.kind === 'albumCollection') this.collectEntities(result.albums)
    else if (result.kind === 'playlistCollection') this.collectEntities(result.playlists)
    else if ('entity' in result && result.entity && result.entity.kind !== 'lyrics') {
      this.collectEntities([result.entity])
    }
  }

  /** 将实体加入本轮安全引用池。 */
  private collectEntities(entities: readonly StandardMusicEntity[]): void {
    for (const entity of entities) this.entities.set(`${entity.kind}:${entity.id}`, entity)
  }

  /** 是否达到任一硬限额。 */
  private limitReached(): boolean {
    return this.toolRounds >= MAX_TOOL_ROUNDS_PER_TURN
      || this.toolCalls >= MAX_TOOL_CALLS_PER_TURN
      || this.activeTimeUsed() >= ACTIVE_TURN_BUDGET_MS
  }

  /** 等待用户交互期间暂停主动运行预算。 */
  private async waitForUser<T>(pending: Promise<T>): Promise<T> {
    this.pauseActiveBudget()
    try {
      return await pending
    } finally {
      this.resumeActiveBudget()
    }
  }

  /** 将当前主动片段计入预算并进入暂停。 */
  private pauseActiveBudget(): void {
    if (this.activeBudgetPaused) return
    this.activeElapsedMs += Math.max(0, Date.now() - this.activeSegmentStartedAt)
    this.activeBudgetPaused = true
  }

  /** 从用户等待恢复主动预算计时。 */
  private resumeActiveBudget(): void {
    if (!this.activeBudgetPaused) return
    this.activeSegmentStartedAt = Date.now()
    this.activeBudgetPaused = false
  }

  /** 返回当前 Turn 已用主动运行时间。 */
  private activeTimeUsed(): number {
    return this.activeElapsedMs + (this.activeBudgetPaused
      ? 0
      : Math.max(0, Date.now() - this.activeSegmentStartedAt))
  }

  /** 取消当前流、排队任务、审批、选择和播放器等待。 */
  private cancelActiveTurn(reason: AgentTurnEndReason): void {
    this.turnController?.abort(reason)
    this.turnController = undefined
    this.approvalCoordinator.cancelAll()
    this.selectionCoordinator.cancelActive()
    for (const [toolCallId, pending] of this.pendingPlayerCommands) {
      clearTimeout(pending.timer)
      pending.resolve({ ok: false, code: 'REQUEST_CANCELLED', summary: 'Turn 已取消。' })
      this.pendingPlayerCommands.delete(toolCallId)
    }
    for (const [toolCallId, pending] of this.pendingPlayerStates) {
      clearTimeout(pending.timer)
      pending.resolve({ ok: false, code: 'REQUEST_CANCELLED', summary: 'Turn 已取消。' })
      this.pendingPlayerStates.delete(toolCallId)
    }
    for (const requestId of this.activeMusicRequests) this.options.music.cancel(requestId)
    this.activeMusicRequests.clear()
    for (const message of this.messages) {
      if (message.streaming) {
        message.streaming = false
        message.interrupted = true
      }
    }
    if (this.turnStatus !== 'idle' && this.turnStatus !== 'completed') {
      this.turnStatus = 'cancelled'
      this.endReason = reason
    }
    this.publish()
  }

  /** 发布完整快照；Renderer 重载不依赖重放增量。 */
  private publish(): void {
    this.options.emit({ type: 'snapshot', snapshot: this.snapshot() })
  }
}

// ========= 函数 =========

/** 创建 Agent 消息。 */
function createMessage(
  role: AgentMessage['role'],
  content: string,
  streaming = false
): AgentMessage {
  return {
    messageId: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    streaming,
    interrupted: false
  }
}

/** 将非 UUID Provider Tool ID 映射成本地稳定 UUID。 */
function normalizeToolCallId(value: string): string {
  return normalizeUuid(value)
}

/** 保留合法 UUID，否则生成本地关联 ID。 */
function normalizeUuid(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
    ? value
    : deterministicUuid(value)
}

/** 由 Provider 文本 ID 生成进程内确定性 UUID 形态。 */
function deterministicUuid(value: string): string {
  /** FNV 派生整数。 */
  let hash = 0x811c9dc5
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  /** 重复哈希填满 UUID 字符。 */
  const hex = (hash >>> 0).toString(16).padStart(8, '0').repeat(4)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** 从 StandardSong 生成播放器共享摘要。 */
function songToTrackSummary(song: StandardSong): TrackSummary {
  /** 可选封面地址。 */
  const artworkUrl = song.album?.artworkUrl
  return {
    trackId: song.id,
    name: song.name,
    artists: song.artists.map((artist) => artist.name),
    album: song.album?.name ?? '',
    ...(artworkUrl ? { artwork: [{ src: artworkUrl }] } : {}),
    durationMs: song.durationMs ?? null
  }
}

/** 标准实体的模型安全引用。 */
function entityReference(entity: StandardMusicEntity): Readonly<Record<string, unknown>> {
  return {
    ref: `${entity.kind}:${entity.id}`,
    kind: entity.kind,
    id: entity.id,
    name: 'name' in entity ? entity.name : 'nickname' in entity ? entity.nickname : ''
  }
}

/** 裁剪 Music Service 结果，避免把大响应完整写入模型上下文。 */
function compactMusicResult(result: ReturnType<typeof MusicReadResultSchema.parse>): unknown {
  if (result.kind === 'search') {
    return {
      kind: result.kind,
      songs: result.songs.slice(0, 10).map(entityReference),
      artists: result.artists.slice(0, 10).map(entityReference),
      albums: result.albums.slice(0, 10).map(entityReference),
      playlists: result.playlists.slice(0, 10).map(entityReference)
    }
  }
  if (result.kind === 'songCollection') return { kind: result.kind, songs: result.songs.slice(0, 20).map(entityReference) }
  if (result.kind === 'artistCollection') return { kind: result.kind, artists: result.artists.slice(0, 20).map(entityReference) }
  if (result.kind === 'albumCollection') return { kind: result.kind, albums: result.albums.slice(0, 20).map(entityReference) }
  if (result.kind === 'playlistCollection') return { kind: result.kind, playlists: result.playlists.slice(0, 20).map(entityReference) }
  if ('entity' in result && result.entity && result.entity.kind !== 'lyrics') {
    return { kind: result.kind, entity: entityReference(result.entity) }
  }
  return result
}

/** 生成 Music Service 结果摘要。 */
function summarizeMusicResult(result: ReturnType<typeof MusicReadResultSchema.parse>): string {
  if (result.kind === 'search') return `找到 ${result.songs.length} 首歌曲、${result.artists.length} 位歌手。`
  if (result.kind === 'songCollection') return `读取到 ${result.songs.length} 首歌曲。`
  if (result.kind === 'artistCollection') return `读取到 ${result.artists.length} 位歌手。`
  if (result.kind === 'albumCollection') return `读取到 ${result.albums.length} 张专辑。`
  if (result.kind === 'playlistCollection') return `读取到 ${result.playlists.length} 个歌单。`
  if (result.kind === 'commentCollection') return `读取到 ${result.comments.length} 条评论。`
  return `已读取 ${result.kind}。`
}

/** 脱敏参数摘要；只展示键与非秘密短值。 */
function summarizeParameters(input: Record<string, unknown>): string {
  /** 明确不展示的秘密键。 */
  const secretPattern = /key|token|authorization|cookie|credential|secret/iu
  return Object.entries(input)
    .filter(([key]) => !secretPattern.test(key))
    .map(([key, value]) => `${key}: ${summarizeValue(value)}`)
    .join(' · ')
    .slice(0, 500)
}

/** 将参数值裁剪为短文本。 */
function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} 项]`
  if (typeof value === 'object' && value !== null) return '{…}'
  return String(value).slice(0, 120)
}

/** Tool 名映射到卡片类别。 */
function toolCategory(name: string): ToolExecutionCardSnapshot['category'] {
  if (name === 'control_player' || name === 'queue_manager' || name === 'smart_search_and_play') return 'player'
  if (name === 'account_manager' || name === 'user_profile_memory') return 'account'
  if (name === 'request_user_selection') return 'interaction'
  if (name === 'find_music_api_capabilities' || name === 'call_music_api') return 'gateway'
  return 'music'
}

/** Tool 失败码映射到卡片终态。 */
function toolFailureStatus(code: string): ToolExecutionCardSnapshot['status'] {
  if (code === 'USER_REJECTED') return 'rejected'
  if (code === 'APPROVAL_EXPIRED' || code === 'SELECTION_EXPIRED') return 'expired'
  if (code.includes('CANCEL')) return 'cancelled'
  return 'failed'
}

/** 更新按 ID 唯一的交互快照。 */
function upsertSnapshot<T>(target: T[], snapshot: T, key: (item: T) => string): void {
  /** 已有快照索引。 */
  const index = target.findIndex((item) => key(item) === key(snapshot))
  if (index >= 0) target.splice(index, 1, snapshot)
  else target.push(snapshot)
}

/** 判断未知值是否普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 构造 Capability Catalog 参数失败结果。 */
function invalidCapabilityParameters(): AgentToolResult {
  return {
    ok: false,
    code: 'TOOL_ARGUMENTS_INVALID',
    summary: 'Capability 参数未通过已登记 Schema。'
  }
}

/** 构造不在本轮事实池中的实体引用失败结果。 */
function entityReferenceUnavailable(): AgentToolResult {
  return {
    ok: false,
    code: 'ENTITY_NOT_IN_CONTEXT',
    summary: '实体引用不在本轮已验证事实池中。'
  }
}

/** 错误转稳定码。 */
function errorCode(error: unknown): string {
  if (isRecord(error) && typeof error['code'] === 'string') return error['code']
  return 'TOOL_EXECUTION_FAILED'
}

/** 错误转不包含堆栈和凭据的短消息。 */
function readableError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/(Bearer\s+|api[_-]?key[=:]\s*)\S+/giu, '$1[REDACTED]').slice(0, 500)
  return '操作执行失败。'
}

/** 识别 Provider 空闲超时。 */
function isProviderTimeout(error: unknown): boolean {
  return isRecord(error) && (error['code'] === 'PROVIDER_TIMEOUT'
    || (isRecord(error['normalized']) && error['normalized']['code'] === 'timeout'))
}

/** 归一化名称用于实体精确比较。 */
function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}
