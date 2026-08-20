import { z } from 'zod'

import type { TrackSummary } from '../player/types'
import { AgentToolRegistry, type ClassifiedToolOperation } from './tool-registry'
import { ApprovalCoordinator } from './approval-coordinator'
import { EntityResolver } from './entity-resolver'
import { parseMusicProfileAnalysis } from './music-profile-analysis-parser'
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
  type AgentShellTerminalSnapshot,
  type AgentTurnEndReason,
  type AgentTurnStatus,
  type ApprovalSnapshot,
  type CommandSafetyLevel,
  type MusicSafetyLevel,
  type SelectionSnapshot,
  type ToolExecutionCardSnapshot
} from '../../shared/schemas/agent'
import type { ShellOutputEvent } from '../../shared/schemas/shell'
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
import {
  PersistedAgentConversationSchema,
  type PersistedAgentConversation
} from '../../shared/schemas/agent-persistence'
import type { AgentSafetyPreferences } from '../../shared/schemas/agent-settings'
import type { MusicProfileAnalysis } from '../../shared/schemas/personalization'
import type { AgentMemoryPort } from './memory-port'
import type {
  AgentPersonalizationPort,
  AgentPreparedProfileAnalysis
} from './personalization-port'

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

/** 当前账户连续会话持久化端口。 */
export interface AgentConversationPersistencePort {
  /** 读取当前账户最近一次完整会话。 */
  load(): Promise<PersistedAgentConversation | undefined>
  /** 覆盖保存当前账户完整会话。 */
  save(snapshot: PersistedAgentConversation): Promise<void>
}

/** Shell、Dynamic Skill 与 MCP 的统一外部工具端口。 */
export interface AgentExternalToolPort {
  /** 返回当前配置下模型可见的动态定义。 */
  providerDefinitions(input: {
    readonly commandSafetyLevel: CommandSafetyLevel
    readonly shellToolEnabled: boolean
  }): readonly {
    readonly name: string
    readonly description: string
    readonly parameters: Readonly<Record<string, unknown>>
  }[]
  /** 返回启用 Skill 的附加系统提示。 */
  systemPrompts(): readonly string[]
  /** 判断名称是否由外部工具网关管理。 */
  has(name: string): boolean
  /** 校验参数并执行确定性策略分类。 */
  resolve(
    name: string,
    rawInput: unknown,
    input: { readonly commandSafetyLevel: CommandSafetyLevel; readonly shellToolEnabled: boolean }
  ): Promise<{
    readonly input: Record<string, unknown>
    readonly operation: ClassifiedToolOperation & {
      readonly requiresApproval?: string
      readonly deniedReason?: string
    }
  } | undefined>
  /** 执行已经通过 Registry、策略与必要审批的外部工具。 */
  execute(
    name: string,
    input: Record<string, unknown>,
    toolCallId: string,
    signal: AbortSignal
  ): Promise<AgentToolResult>
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
  /** 当前账户连续会话持久化端口。 */
  readonly conversationPersistence?: AgentConversationPersistencePort
  /** 当前账户会话分块、FTS5 与 Working Memory 端口。 */
  readonly memory?: AgentMemoryPort
  /** 当前账户音乐人格画像端口。 */
  readonly personalization?: AgentPersonalizationPort
  /** Shell、Dynamic Skill 与 MCP 的正向扩展网关。 */
  readonly externalTools?: AgentExternalToolPort
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

/** 点播候选的确定性消解结果。 */
type PlaybackSongResolution =
  | { readonly status: 'resolved'; readonly song: StandardSong }
  | { readonly status: 'needs_selection'; readonly candidates: readonly StandardSong[] }

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

/** 连续会话流式写入防抖时间。 */
const CONVERSATION_PERSIST_DEBOUNCE_MS = 250

/** 会话块关闭规则：十分钟无新用户消息。 */
const CONVERSATION_BLOCK_IDLE_MS = 10 * 60 * 1_000

/** 画像模型结构化输出最大字符数。 */
const PROFILE_MODEL_OUTPUT_MAX_CHARS = 200_000

/** 画像子流程最多请求的证据页数。 */
const MAX_PROFILE_EVIDENCE_PAGE_CALLS = 6

/** 画像内部代表证据分页参数。 */
const ProfileEvidencePageInputSchema = z.strictObject({
  cursor: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(50).default(20)
})

/** 仅对当前画像 Job 可见的内部只读工具。 */
const PROFILE_INTERNAL_TOOLS = [{
  name: 'get_profile_evidence_page',
  description: '仅当聚合特征与默认代表样本不足以支撑某项画像结论时，按游标读取当前画像 Job 的下一页归一化音乐证据。',
  parameters: {
    type: 'object',
    properties: {
      cursor: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 50 }
    },
    additionalProperties: false
  }
}] as const

/** 原版优先时识别的版本标记；用户明确点名标记时不降权。 */
const NON_ORIGINAL_VERSION_PATTERN = /翻唱|cover|伴奏|instrumental|live|现场|remix|混音|dj|片段|铃声/iu

/** 同名候选低于该领先分时进入代码级用户消歧。 */
const PLAYBACK_CLEAR_LEAD_MARGIN = 0.18

/** 模型常生成但不适合作为歌曲关键词的随机推荐查询。 */
const GENERIC_PLAYBACK_QUERY_PATTERN = /^(?:随机(?:推荐|播放)?|随便(?:放|播|来|听)?(?:一|几|点|首)?(?:些)?(?:歌|音乐)?|适合(?:现在|此刻|今天).*(?:歌|音乐)|现在听什么|来点音乐)$/iu

/** 明确要求播放器产生副作用的用户表达。 */
const PLAYBACK_REQUEST_PATTERN = /(?:播放|播一|播首|放一|放首|放点|放些|听一|听首|听点|来一首|来首|来点).*(?:歌|音乐)?|(?:下一首|上一首|继续播放)/iu

/** 模型声称播放器已经成功执行的自然语言模式。 */
const PLAYBACK_SUCCESS_CLAIM_PATTERN = /(?:已|已经|成功|正在)(?:经)?(?:为你)?(?:开始)?(?:播放|播出|放上|切换到)/u

/** 连续会话内保留的真实音乐实体上限。 */
const VERIFIED_ENTITY_LIMIT = 200

/** 小云固定系统规则；安全边界仍由代码策略执行。 */
const XIAOYUN_SYSTEM_PROMPT = [
  '你是 Ncxmusic 的音乐助手“小云”。默认使用简体中文，友好、自然、简洁并优先给出结果。',
  '所有播放、歌单、收藏、评论和账户操作必须通过已注册工具，不能声称尚未收到真实回执的操作已经成功。',
  '用户表达播放意图时必须调用 smart_search_and_play 的 play 动作；该工具会自行完成候选消歧、等待选择并继续播放，不要手工列出 song:ID，也不要为歌曲候选再调用 request_user_selection。',
  '只有与搜播无关的通用选择才调用 request_user_selection；收到 TOOL_ARGUMENTS_INVALID 时应按工具 Schema 修正参数重试，不能把它描述为工具不可用。',
  '不要猜测网易云实体 ID，不要请求或输出 Cookie、API Key、认证 Header、权限内部判断或未注册能力。',
  '支付、购买、订阅、下单和代购不在可用能力范围。',
  '当需要调用工具时，直接生成 tool_calls，不要在同一轮输出多余的过渡闲聊；当收到工具执行结果后，必须在最终回复中向用户完整总结并呈现结果。'
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

/** Capability Catalog 中已登记的兜底能力。 */
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

  /** 当前账户连续会话中由真实 Music Service 验证过的有限实体池。 */
  private readonly verifiedEntities = new Map<string, StandardMusicEntity>()

  /** 只从本轮事实池消解名称、ID 与当前实体。 */
  private readonly entityResolver = new EntityResolver(() => ({ entities: [...this.entities.values()] }))

  /** Tool 卡历史。 */
  private readonly tools: ToolExecutionCardSnapshot[] = []

  /** 最近 24 条 Shell Tool 的实时 stdout/stderr。 */
  private readonly shellTerminals: AgentShellTerminalSnapshot[] = []

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

  /** 当前 Turn 开始时的工具历史下标。 */
  private turnToolStartIndex = 0

  /** 当前 Turn 是否要求真实播放器副作用。 */
  private turnRequiresPlayback = false

  /** 当前 Turn 是否已经收到播放器成功回执。 */
  private turnPlayerCommandSucceeded = false

  /** 连续多轮澄清期间是否仍有未完成点播目标。 */
  private playbackGoalPending = false

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

  /** 当前账户会话是否已经从 SQLite 恢复。 */
  private conversationRestored: boolean

  /** 正在执行的会话恢复任务。 */
  private conversationRestore: Promise<void> | undefined

  /** 连续会话防抖写入计时器。 */
  private conversationPersistTimer: ReturnType<typeof setTimeout> | undefined

  /** 会话写入串行尾链。 */
  private conversationPersistTail: Promise<void> = Promise.resolve()

  /** 当前会话块的十分钟空闲计时器。 */
  private conversationBlockTimer: ReturnType<typeof setTimeout> | undefined

  /** 当前后台画像模型请求的取消控制器。 */
  private profileAnalysisController: AbortController | undefined

  /** 画像状态订阅取消函数。 */
  private readonly unsubscribePersonalization: (() => void) | undefined

  constructor(private readonly options: AgentRuntimeOptions) {
    this.musicSafetyLevel = options.musicSafetyLevel ?? 'M1'
    this.commandSafetyLevel = options.commandSafetyLevel ?? 'S1'
    this.shellToolEnabled = options.shellToolEnabled ?? false
    this.conversationRestored = !options.conversationPersistence
    this.approvalCoordinator = new ApprovalCoordinator({
      onChange: (snapshot) => {
        upsertSnapshot(this.approvals, snapshot, (item) => item.approvalId)
        this.publish()
      }
    })
    this.selectionCoordinator = new SelectionCoordinator({
      resolveEntity: (entityRef) => this.resolveVerifiedEntity(entityRef),
      onChange: (snapshot) => {
        upsertSnapshot(this.selections, snapshot, (item) => item.selectionId)
        this.publish()
      }
    })
    this.unsubscribePersonalization = options.personalization?.subscribe(() => {
      if (this.conversationRestored) this.publish(false)
    })
  }

  /** Main 私有配置通道注入或清除当前 Provider。 */
  configureProvider(profile: AgentProviderProfile | undefined): void {
    this.profile = profile
    this.publish()
  }

  /** Main 应用配置变更后同步当前安全等级与 Shell Tool 可见性。 */
  configureSafety(preferences: AgentSafetyPreferences): void {
    this.musicSafetyLevel = preferences.musicSafetyLevel
    this.commandSafetyLevel = preferences.commandSafetyLevel
    this.shellToolEnabled = preferences.shellToolEnabled
    this.publish()
  }

  /** 接收 Shell Supervisor 的有限流式输出并发布给 Agent 页面。 */
  publishShellOutput(event: ShellOutputEvent): void {
    /** 当前命令已有终端。 */
    const existing = this.shellTerminals.find((item) => item.commandId === event.commandId)
    /** 基于序号丢弃重复或迟到 Chunk。 */
    if (existing && event.sequence <= existing.lastSequence) return
    if (existing) {
      /** 当前流拼接后的有限文本。 */
      const nextText = `${event.stream === 'stdout' ? existing.stdout : existing.stderr}${event.chunk}`
        .slice(0, 1_048_576)
      /** 原位替换不可变快照。 */
      const index = this.shellTerminals.indexOf(existing)
      this.shellTerminals.splice(index, 1, {
        ...existing,
        ...(event.stream === 'stdout'
          ? { stdout: nextText, stdoutTruncated: existing.stdoutTruncated || event.truncated }
          : { stderr: nextText, stderrTruncated: existing.stderrTruncated || event.truncated }),
        lastSequence: event.sequence,
        updatedAt: Date.now()
      })
    } else {
      this.shellTerminals.push({
        commandId: event.commandId,
        stdout: event.stream === 'stdout' ? event.chunk.slice(0, 1_048_576) : '',
        stderr: event.stream === 'stderr' ? event.chunk.slice(0, 1_048_576) : '',
        stdoutTruncated: event.stream === 'stdout' && event.truncated,
        stderrTruncated: event.stream === 'stderr' && event.truncated,
        lastSequence: event.sequence,
        updatedAt: Date.now()
      })
      if (this.shellTerminals.length > 24) this.shellTerminals.splice(0, this.shellTerminals.length - 24)
    }
    this.publish(false)
  }

  /** 处理 Renderer Agent 命令并返回最新快照。 */
  async command(command: AgentCommand): Promise<AgentSnapshot> {
    await this.ensureConversationRestored()
    if (command.operation === 'sendMessage') {
      void this.startTurn(command.content, command.context)
    } else if (command.operation === 'stop') {
      this.cancelActiveTurn('user_stopped')
    } else if (command.operation === 'flushConversation') {
      await this.flushConversation()
    } else if (command.operation === 'respondApproval') {
      this.approvalCoordinator.respond(command.approvalId, command.decision)
    } else if (command.operation === 'respondSelection') {
      this.selectionCoordinator.respond(command.selectionId, command.selectedOptionKeys)
    } else if (command.operation === 'cancelSelection') {
      this.selectionCoordinator.cancel(command.selectionId)
    } else if (command.operation === 'startProfileAnalysis') {
      void this.startProfileAnalysis(command.mode)
    } else if (command.operation === 'dismissProfilePrompt') {
      await this.options.personalization?.dismissPrompt()
    } else if (command.operation === 'pauseProfile') {
      this.cancelProfileAnalysis()
      await this.options.personalization?.pause()
    } else if (command.operation === 'resumeProfile') {
      await this.options.personalization?.resume()
    } else if (command.operation === 'deleteProfile') {
      this.cancelProfileAnalysis()
      await this.options.personalization?.deleteProfile()
    } else if (command.operation === 'setProfileOverride') {
      await this.options.personalization?.saveOverride({
        kind: command.kind,
        ...(command.insightId ? { insightId: command.insightId } : {}),
        ...(command.value ? { value: command.value } : {})
      })
    } else if (command.operation === 'removeProfileOverride') {
      await this.options.personalization?.removeOverride(command.overrideId)
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

  /** 账户打开或切换后恢复对应连续会话，绝不沿用上一账户内存。 */
  async restoreConversation(): Promise<void> {
    this.conversationRestored = false
    if (this.conversationPersistTimer) clearTimeout(this.conversationPersistTimer)
    this.conversationPersistTimer = undefined
    if (this.conversationBlockTimer) clearTimeout(this.conversationBlockTimer)
    this.conversationBlockTimer = undefined
    this.conversationRestore ??= this.loadConversation().finally(() => {
      this.conversationRestore = undefined
    })
    await this.conversationRestore
  }

  /** 立即等待当前连续会话写入 SQLite，用于退出与换号边界。 */
  async flushConversation(): Promise<void> {
    if (this.conversationPersistTimer) clearTimeout(this.conversationPersistTimer)
    this.conversationPersistTimer = undefined
    await this.options.memory?.archiveIfInactive(this.messages, Date.now()).catch(() => false)
    /** 当前账户持久化端口。 */
    const persistence = this.options.conversationPersistence
    if (!persistence || !this.conversationRestored) return
    /** 本次不可变会话快照。 */
    const snapshot = PersistedAgentConversationSchema.parse({
      schemaVersion: 1,
      savedAt: Date.now(),
      messages: this.messages,
      tools: this.tools,
      approvals: this.approvals,
      selections: this.selections
    })
    /** 排在此前写入之后的保存任务。 */
    const write = this.conversationPersistTail.then(() => persistence.save(snapshot))
    this.conversationPersistTail = write.catch(() => undefined)
    await write
  }

  /** 账户切换、应用退出或 Utility 生命周期故障时终止旧 Turn。 */
  terminate(reason: Extract<AgentTurnEndReason, 'account_switch' | 'app_exit' | 'runtime_failure'>): void {
    this.cancelActiveTurn(reason)
    this.cancelProfileAnalysis()
    if (this.conversationPersistTimer) clearTimeout(this.conversationPersistTimer)
    this.conversationPersistTimer = undefined
    if (this.conversationBlockTimer) clearTimeout(this.conversationBlockTimer)
    this.conversationBlockTimer = undefined
    if (reason === 'app_exit') this.unsubscribePersonalization?.()
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
      shellTerminals: this.shellTerminals,
      approvals: this.approvals,
      selections: this.selections,
      toolRounds: this.toolRounds,
      toolCalls: this.toolCalls,
      musicSafetyLevel: this.musicSafetyLevel,
      commandSafetyLevel: this.commandSafetyLevel,
      shellToolEnabled: this.shellToolEnabled,
      personalization: this.options.personalization?.snapshot(Boolean(this.profile)),
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
    /** Working Memory 准备使用的新消息进入会话前历史快照。 */
    const priorMessages = [...this.messages]
    /** 新 Turn 控制器。 */
    const controller = new AbortController()
    this.turnController = controller
    this.turnProfile = this.profile
    this.turnId = crypto.randomUUID()
    this.turnStatus = 'building_context'
    this.endReason = undefined
    this.toolRounds = 0
    this.toolCalls = 0
    this.turnToolStartIndex = this.tools.length
    /** 本条消息是否延续上一轮尚未完成的短点播澄清。 */
    const continuesPlaybackGoal = this.playbackGoalPending && isPlaybackClarification(content)
    this.turnRequiresPlayback = PLAYBACK_REQUEST_PATTERN.test(content) || continuesPlaybackGoal
    this.playbackGoalPending = this.turnRequiresPlayback
    this.turnPlayerCommandSucceeded = false
    this.activeElapsedMs = 0
    this.activeSegmentStartedAt = Date.now()
    this.activeBudgetPaused = false
    this.entities.clear()
    this.knownQueueItemIds.clear()
    /** 带页面实体上下文的用户消息。 */
    const contextSuffix = context?.entityId
      ? `\n\n[当前页面上下文：${context.entityKind ?? 'entity'} ${context.entityName ?? ''} (${context.entityId})]`
      : ''
    this.messages.push(createMessage('user', `${content}${contextSuffix}`))
    this.publish()
    try {
      await this.options.memory?.prepareForTurn(priorMessages, content, Date.now()).catch(() => undefined)
      await this.runLoop(controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      this.turnStatus = 'failed'
      this.endReason = 'provider_error'
      /** 清理未输出任何内容且未发起 Tool Call 的空 Assistant 消息 */
      const lastMsg = this.messages.at(-1)
      if (lastMsg?.role === 'assistant' && !lastMsg.content.trim() && lastMsg.toolCallIds.length === 0) {
        this.messages.pop()
      } else if (lastMsg?.role === 'assistant') {
        lastMsg.streaming = false
      }
      this.messages.push(createMessage('system', readableError(error)))
      this.publish()
    } finally {
      if (this.turnController === controller) {
        this.turnController = undefined
        this.turnProfile = undefined
      }
      this.scheduleConversationBlockArchive()
    }
  }

  /** 执行多轮 Provider → Tool → Provider 主循环。 */
  private async runLoop(signal: AbortSignal): Promise<void> {
    /** 仅选择当前目标必要的 Working Memory。 */
    const memoryContext = this.options.memory?.contextText() ?? ''
    /** 当前账户可使用的画像片段。 */
    const personalizationContext = this.options.personalization?.contextText() ?? ''
    /** 当前 Turn 完整系统 Prompt。 */
    const systemPrompt = [
      XIAOYUN_SYSTEM_PROMPT,
      memoryContext ? `[Working Memory]\n${memoryContext}` : '',
      personalizationContext ? `[音乐人格画像]\n${personalizationContext}` : '',
      ...(this.options.externalTools?.systemPrompts() ?? [])
    ].filter(Boolean).join('\n\n')
    /** 发给 Provider 的当前连续会话上下文。 */
    const providerMessages: AgentProviderMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.messages
        .filter((message) => message.role !== 'system' && (message.role !== 'assistant' || message.content.trim().length > 0))
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
        this.enforceGroundedPlaybackResponse(assistant)
        this.enforceTurnCompletionFallback(assistant)
        this.turnStatus = 'completed'
        this.endReason = 'completed'
        this.publish()
        return
      }
      assistant.toolCallIds = response.toolCalls.map((toolCall) => toolCall.id)
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
    this.enforceGroundedPlaybackResponse(assistant)
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
            const eventId = normalizeToolCallId(event.id, this.turnId)
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
    exposeTools = true,
    toolsOverride?: readonly {
      readonly name: string
      readonly description: string
      readonly parameters: Readonly<Record<string, unknown>>
    }[]
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
      tools: toolsOverride ?? (exposeTools ? [
        ...this.registry.providerDefinitions(),
        ...(this.options.externalTools?.providerDefinitions({
          commandSafetyLevel: this.commandSafetyLevel,
          shellToolEnabled: this.shellToolEnabled
        }) ?? [])
      ] : []),
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
      /** 依据当前明确用户目标纠正模型误用的只读搜歌动作。 */
      const normalizedInput = this.normalizeToolInput(call.name, rawInput)
      /** 核心 Registry 或外部正向网关解析结果。 */
      const resolved = this.registry.resolve(call.name, normalizedInput)
        ?? await this.options.externalTools?.resolve(call.name, normalizedInput, {
          commandSafetyLevel: this.commandSafetyLevel,
          shellToolEnabled: this.shellToolEnabled
        })
      if (!resolved) {
        return this.registry.has(call.name) || this.options.externalTools?.has(call.name)
          ? this.invalidToolCall(call, 'TOOL_ARGUMENTS_INVALID', '工具参数未通过 Schema 校验，请修正参数后重试。')
          : this.invalidToolCall(call, 'CAPABILITY_UNAVAILABLE', '工具未注册。')
      }
      /** 初始 Tool 卡。 */
      const card: ToolExecutionCardSnapshot = {
        toolCallId: normalizeUuid(call.id),
        toolName: call.name,
        title: resolved.operation.title,
        category: toolCategory(call.name),
        status: 'queued',
        parameterSummary: summarizeParameters(resolved.input),
        startedAt: Date.now()
      }
      this.tools.push(card)
      this.publish()

      if ('deniedReason' in resolved.operation && resolved.operation.deniedReason) {
        return this.finishTool(card, false, 'POLICY_DENIED', resolved.operation.deniedReason)
      }

      /** 当前工具是否需要一次性用户批准。 */
      let approvalReason = 'requiresApproval' in resolved.operation
        ? resolved.operation.requiresApproval
        : undefined
      if (resolved.operation.riskAction) {
        /** 当前音乐策略结果。 */
        const policy = evaluateMusicPolicy({
          registered: true,
          action: resolved.operation.riskAction,
          level: this.musicSafetyLevel
        })
        if (policy.decision === 'deny') return this.finishTool(card, false, 'POLICY_DENIED', policy.reason)
        if (policy.decision === 'ask') approvalReason = policy.reason
      }
      if (approvalReason) {
          card.status = 'awaiting_approval'
          this.turnStatus = 'awaiting_approval'
          /** 当前 Tool Call 的一次性审批请求。 */
          const approval = this.approvalCoordinator.request({
            toolCallId: card.toolCallId,
            title: resolved.operation.title,
            impact: card.parameterSummary,
            riskReason: approvalReason
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
      card.status = 'running'
      card.startedAt = Date.now()
      this.turnStatus = 'executing_tools'
      this.publish()
      try {
        return await scheduler.schedule({
          toolCallId: card.toolCallId,
          effect: resolved.operation.effect,
          conflictKeys: resolved.operation.conflictKeys,
          run: () => this.executeRegisteredTool(call.name, resolved.input, card.toolCallId, signal)
        }).then((result) => this.finishTool(card, result.ok, result.code, result.summary, result.data))
      } catch (error) {
        return this.finishTool(card, false, errorCode(error), readableError(error))
      }
      }))
    } finally {
      signal.removeEventListener('abort', cancelScheduler)
    }
  }

  /** 根据当前用户的明确播放目标修正模型误发的只读搜歌动作。 */
  private normalizeToolInput(toolName: string, rawInput: unknown): unknown {
    if (toolName !== 'smart_search_and_play' || !this.turnRequiresPlayback || !isRecord(rawInput)) return rawInput
    if (rawInput['action'] !== 'search' || typeof rawInput['query'] !== 'string') return rawInput
    return { ...rawInput, action: 'play' }
  }

  /** 执行已经通过 Schema、Registry、Policy 与 Scheduler 的 Tool。 */
  private async executeRegisteredTool(
    toolName: string,
    input: Record<string, unknown>,
    toolCallId: string,
    signal: AbortSignal
  ): Promise<AgentToolResult> {
    if (!this.registry.has(toolName)) {
      return this.options.externalTools?.execute(toolName, input, toolCallId, signal)
        ?? { ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: '外部工具网关不可用。' }
    }
    if (toolName === 'smart_search_and_play') return this.smartSearchAndPlay(input, toolCallId)
    if (toolName === 'control_player') return this.controlPlayer(input, toolCallId)
    if (toolName === 'queue_manager') return this.manageQueue(input, toolCallId)
    if (toolName === 'playlist_manager') return this.managePlaylist(input)
    if (toolName === 'library_manager') return this.manageLibrary(input)
    if (toolName === 'music_explorer') return this.exploreMusic(input)
    if (toolName === 'comments_and_social') return this.commentsAndSocial(input)
    if (toolName === 'account_manager') return input['action'] === 'daily_signin'
      ? this.mutateMusic({ operation: 'dailySignin' })
      : { ok: true, code: 'OK', summary: '账户状态由当前 Ncxmusic 会话管理。' }
    if (toolName === 'user_profile_memory') {
      /** 当前画像与记忆动作。 */
      const action = String(input['action'])
      if (action === 'search_memory') {
        /** 用户自然语言记忆查询。 */
        const query = String(input['query'] ?? '')
        /** 当前账户 FTS5 搜索命中。 */
        const memories = await this.options.memory?.search(query, 5) ?? []
        return {
          ok: true,
          code: 'OK',
          summary: `找到 ${memories.length} 条相关长期记忆。`,
          data: memories
        }
      }
      /** 当前长期记忆公开统计。 */
      const memory = await this.options.memory?.status()
      /** 当前音乐画像公开快照。 */
      const profile = this.options.personalization?.snapshot(Boolean(this.profile))
      return {
        ok: true,
        code: 'OK',
        summary: profile?.usable
          ? `音乐画像 v${profile.version} 可用，长期记忆已建立 ${memory?.conversationBlocks ?? 0} 个会话块。`
          : `音乐画像尚未生成，长期记忆已建立 ${memory?.conversationBlocks ?? 0} 个会话块。`,
        data: { profile, memory }
      }
    }
    if (toolName === 'request_user_selection') return this.requestSelection(input, toolCallId)
    if (toolName === 'find_music_api_capabilities') return this.findCapabilities(String(input['query']))
    if (toolName === 'call_music_api') return this.callCapability(String(input['capabilityId']), input['params'])
    return { ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: '能力未注册。' }
  }

  /** 搜索歌曲，并由 Runtime 闭环完成必要消歧与真实播放。 */
  private async smartSearchAndPlay(input: Record<string, unknown>, toolCallId: string): Promise<AgentToolResult> {
    /** 选择完成后传回的稳定歌曲引用。 */
    const entityRef = typeof input['entityRef'] === 'string' ? input['entityRef'] : undefined
    if (entityRef) {
      /** 当前账户连续会话中已经由真实工具验证的歌曲。 */
      const selectedSong = this.resolveVerifiedEntity(entityRef)
      if (!selectedSong || selectedSong.kind !== 'song') return entityReferenceUnavailable()
      return this.requestPlayerCommand(toolCallId, {
        type: 'player.play-track',
        track: songToTrackSummary(selectedSong),
        source: { kind: 'agent' }
      })
    }
    /** 模型提供的搜索或推荐查询。 */
    const query = String(input['query'])
    /** Music Service 请求 ID。 */
    const requestId = crypto.randomUUID()
    this.activeMusicRequests.add(requestId)
    /** 搜索歌曲候选。 */
    let songs: StandardSong[]
    try {
      /** 随机推荐短语不进入关键词搜索，直接读取公开新歌候选。 */
      const payload: MusicReadPayload = isGenericPlaybackQuery(query)
        ? { operation: 'getNewSongs', limit: 10 }
        : { operation: 'search', query, category: 'songs', limit: 5, offset: 0 }
      /** 标准歌曲搜索或集合结果。 */
      const result = MusicReadResultSchema.parse(await this.options.music.read(requestId, payload))
      if (result.kind === 'search') songs = result.songs
      else if (result.kind === 'songCollection') songs = result.songs
      else return { ok: false, code: 'UPSTREAM_ERROR', summary: '音乐服务返回了不匹配的歌曲结果类型。' }
    } catch (error) {
      return { ok: false, code: errorCode(error), summary: readableError(error) }
    } finally {
      this.activeMusicRequests.delete(requestId)
    }
    this.collectEntities(songs)
    if (songs.length === 0) return { ok: false, code: 'NOT_FOUND', summary: '没有找到匹配歌曲。' }
    if (input['action'] === 'play') {
      /** 搜索排序、版本特征和显式歌手共同决定的点播消解结果。 */
      const resolution = resolvePlaybackSong(songs, query)
      /** 最终要交给真实播放器的歌曲。 */
      let preferredSong: StandardSong
      if (resolution.status === 'resolved') preferredSong = resolution.song
      else {
        /** Runtime 从真实候选构造的选择，不依赖模型拼接选项 Schema。 */
        const selectionResult = await this.requestSelection({
          prompt: '找到多首同名歌曲，请选择歌手或版本。',
          mode: 'single',
          options: resolution.candidates.map((song, index) => ({
            kind: 'entity',
            optionKey: `song-${index + 1}`,
            entityRef: `song:${song.id}`
          }))
        }, toolCallId)
        if (!selectionResult.ok) return selectionResult
        /** 选择工具返回的唯一真实歌曲引用。 */
        const selectedRef = selectedEntityRef(selectionResult.data)
        /** 仍在当前账户验证池中的用户选择。 */
        const selectedSong = selectedRef ? this.resolveVerifiedEntity(selectedRef) : undefined
        if (!selectedSong || selectedSong.kind !== 'song') return entityReferenceUnavailable()
        preferredSong = selectedSong
      }
      return this.requestPlayerCommand(toolCallId, {
        type: 'player.play-track',
        track: songToTrackSummary(preferredSong),
        source: { kind: 'agent' }
      })
    }
    /** 基于本轮实体事实池的确定性歌曲消解结果。 */
    const resolution = this.entityResolver.resolve({
      kind: 'song',
      reference: query
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
    return { ok: true, code: 'OK', summary: `找到了《${song.name}》。`, data: entityReference(song) }
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
    const tracks = (input['entityRefs'] as string[] | undefined)?.map((reference) => this.resolveVerifiedEntity(reference))
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
    /** 发起本次选择的 Assistant 消息。 */
    const ownerMessage = this.messages.findLast((message) =>
      message.role === 'assistant' && message.toolCallIds.includes(toolCallId))
    if (ownerMessage && ownerMessage.content.trim().length === 0) {
      ownerMessage.content = String(input['prompt'])
    }
    /** 与当前选择关联的执行卡。 */
    const card = this.tools.find((item) => item.toolCallId === toolCallId)
    if (card) card.status = 'awaiting_selection'
    this.turnStatus = 'awaiting_selection'
    this.publish()
    /** 无副作用用户选择结果。 */
    const outcome = await this.waitForUser(selection.outcome)
    if (card?.status === 'awaiting_selection') card.status = 'running'
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
      const artist = this.resolveVerifiedEntity(parsed.data.artistRef)
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
      const entity = this.resolveVerifiedEntity(parsed.data.resourceRef)
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
    if (ok) {
      this.turnPlayerCommandSucceeded = true
      this.playbackGoalPending = false
    }
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
      startedAt: Date.now(),
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

  /** 阻止模型在没有真实播放器成功回执时声称已经播放。 */
  private enforceGroundedPlaybackResponse(assistant: AgentMessage): void {
    if (!this.turnRequiresPlayback || this.turnPlayerCommandSucceeded) return
    if (!PLAYBACK_SUCCESS_CLAIM_PATTERN.test(assistant.content)) return
    /** 当前 Turn 最后一个失败工具，用于生成确定性说明。 */
    const failure = this.tools
      .slice(this.turnToolStartIndex)
      .findLast((tool) => ['failed', 'cancelled', 'rejected', 'expired'].includes(tool.status))
    /** 真实失败摘要。 */
    const reason = failure?.resultSummary ?? '播放器尚未返回成功回执。'
    assistant.content = `未能完成播放：${trimSentence(reason)}。`
  }

  /** 当模型未返回有效文本总结时，依据本轮工具卡执行结果生成确定性兜底回复。 */
  private enforceTurnCompletionFallback(assistant: AgentMessage): void {
    if (assistant.content.trim().length > 0) return
    /** 当前 Turn 从开始索引至今执行的全部工具卡。 */
    const turnTools = this.tools.slice(this.turnToolStartIndex)
    if (turnTools.length === 0) {
      assistant.content = '模型未返回有效回复。'
      return
    }
    /** 当前 Turn 执行失败的工具卡。 */
    const failedTools = turnTools.filter((tool) =>
      ['failed', 'cancelled', 'rejected', 'expired'].includes(tool.status)
    )
    if (failedTools.length === 0) {
      if (turnTools.length === 1) {
        /** 单工具成功摘要。 */
        const singleSummary = turnTools[0]?.resultSummary || turnTools[0]?.title || '操作已完成'
        assistant.content = `已完成操作：${trimSentence(singleSummary)}。`
      } else {
        /** 多工具成功摘要列表。 */
        const summaries = turnTools.map((tool) => trimSentence(tool.resultSummary || tool.title)).filter(Boolean)
        assistant.content = `已为你完成相关操作：\n${summaries.map((summary) => `- ${summary}`).join('\n')}`
      }
    } else {
      /** 失败工具摘要列表。 */
      const failedSummaries = failedTools.map((tool) => trimSentence(tool.resultSummary || tool.title)).filter(Boolean)
      assistant.content = `部分操作未能成功完成：\n${failedSummaries.map((summary) => `- ${summary}`).join('\n')}`
    }
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

  /** 将实体加入本轮事实池与当前账户有限验证池。 */
  private collectEntities(entities: readonly StandardMusicEntity[]): void {
    for (const entity of entities) {
      /** 标准稳定实体引用。 */
      const reference = `${entity.kind}:${entity.id}`
      this.entities.set(reference, entity)
      this.verifiedEntities.delete(reference)
      this.verifiedEntities.set(reference, entity)
    }
    while (this.verifiedEntities.size > VERIFIED_ENTITY_LIMIT) {
      /** 最早插入的验证实体引用。 */
      const oldestReference = this.verifiedEntities.keys().next().value as string | undefined
      if (!oldestReference) break
      this.verifiedEntities.delete(oldestReference)
    }
  }

  /** 从本轮或连续会话验证池解析稳定实体引用。 */
  private resolveVerifiedEntity(reference: string): StandardMusicEntity | undefined {
    return this.entities.get(reference) ?? this.verifiedEntities.get(reference)
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
  private publish(persistConversation = true): void {
    this.options.emit({ type: 'snapshot', snapshot: this.snapshot() })
    if (persistConversation) this.scheduleConversationPersistence()
  }

  /** 后台完成用户明确触发的画像采集与结构化模型分析。 */
  private async startProfileAnalysis(
    mode: 'initialize' | 'update' | 'regenerate'
  ): Promise<void> {
    /** 当前画像服务。 */
    const personalization = this.options.personalization
    /** 当前明确配置的 Provider 快照。 */
    const profile = this.profile
    if (!personalization || !profile || this.profileAnalysisController) return
    /** 独立于普通聊天 Turn 的画像取消控制器。 */
    const controller = new AbortController()
    this.profileAnalysisController = controller
    /** 已完成本地聚合的画像上下文。 */
    let prepared: AgentPreparedProfileAnalysis | undefined
    try {
      prepared = await personalization.prepareAnalysis(this.options.music, mode)
      if (controller.signal.aborted) return
      /** 画像模型请求只暴露结构化输入，不暴露主会话 Tool。 */
      const messages: AgentProviderMessage[] = [
        {
          role: 'system',
          content: '你是 Ncxmusic 音乐画像分析器。严格遵守输入中的非诊断、安全与 JSON 输出约束。'
        },
        { role: 'user', content: prepared.modelPrompt }
      ]
      /** 经严格共享 Schema 校验的模型画像。 */
      const analysis = await this.requestProfileAnalysis(
        personalization,
        profile,
        messages,
        controller.signal
      )
      await personalization.completeAnalysis(prepared, analysis)
    } catch (error) {
      if (!controller.signal.aborted && prepared) {
        /** 失败时携带的模型原始文本。 */
        const rawOutput = isRecord(error) && typeof error['rawOutput'] === 'string'
          ? error['rawOutput']
          : undefined
        await personalization.failAnalysis(prepared.jobId, readableError(error), rawOutput).catch(() => undefined)
      }
    } finally {
      if (this.profileAnalysisController === controller) this.profileAnalysisController = undefined
    }
  }

  /** 取消画像模型请求和仍在运行的音乐数据请求。 */
  private cancelProfileAnalysis(): void {
    this.profileAnalysisController?.abort()
    this.profileAnalysisController = undefined
    this.options.personalization?.cancelActiveJob(this.options.music)
  }

  /** 执行画像专用模型循环，并只允许有限次内部证据分页。 */
  private async requestProfileAnalysis(
    personalization: AgentPersonalizationPort,
    profile: AgentProviderProfile,
    messages: AgentProviderMessage[],
    signal: AbortSignal
  ): Promise<MusicProfileAnalysis> {
    /** 已执行的内部证据分页次数。 */
    let evidencePageCalls = 0
    for (let round = 0; round <= MAX_PROFILE_EVIDENCE_PAGE_CALLS; round += 1) {
      /** 当前模型轮次的结构化文本。 */
      let output = ''
      /** 当前模型轮次的 Tool Call 增量。 */
      const calls: ToolCallAccumulator[] = []
      /** 缺少稳定 ID 的参数片段回退目标。 */
      let currentCall: ToolCallAccumulator | undefined
      for await (const event of this.streamWithIdleTimeout(
        profile,
        messages,
        signal,
        false,
        PROFILE_INTERNAL_TOOLS
      )) {
        if (event.type === 'text-delta') {
          output += event.text
          if (output.length > PROFILE_MODEL_OUTPUT_MAX_CHARS) {
            throw Object.assign(new Error('画像模型输出超过 200,000 字符上限。'), {
              code: 'PROFILE_MODEL_LIMIT',
              rawOutput: output
            })
          }
        } else if (event.type === 'tool-call-delta') {
          /** 当前内部调用 ID。 */
          const eventId = event.id || crypto.randomUUID()
          /** 由稳定 ID 找到的内部调用。 */
          let targetCall = calls.find((call) => call.id === eventId)
          if (!targetCall && event.name) {
            targetCall = { id: eventId, name: event.name, arguments: '' }
            calls.push(targetCall)
          }
          if (targetCall) currentCall = targetCall
          /** 当前参数增量接收目标。 */
          const argumentTarget = targetCall ?? currentCall
          if (event.argumentsDelta && argumentTarget) argumentTarget.arguments += event.argumentsDelta
        }
      }
      if (signal.aborted) throw Object.assign(new Error('画像任务已取消。'), { code: 'PROFILE_CANCELLED' })
      /** 当前轮次完成的内部 Tool Call。 */
      const completedCalls: CompletedAgentToolCall[] = calls
        .filter((call) => call.name.length > 0)
        .map((call) => ({ id: call.id, name: call.name, arguments: call.arguments || '{}' }))
      if (completedCalls.length === 0) {
        try {
          return parseMusicProfileAnalysis(output)
        } catch (error) {
          throw Object.assign(
            error instanceof Error ? error : new Error(String(error)),
            { rawOutput: output }
          )
        }
      }
      if (completedCalls.some((call) => call.name !== 'get_profile_evidence_page')) {
        throw new Error('画像模型请求了未注册的内部工具。')
      }
      evidencePageCalls += completedCalls.length
      if (evidencePageCalls > MAX_PROFILE_EVIDENCE_PAGE_CALLS) {
        throw new Error('画像模型请求代表证据页次数超过上限。')
      }
      messages.push({ role: 'assistant', content: output, toolCalls: completedCalls })
      for (const call of completedCalls) {
        /** 经严格 Schema 校验的分页参数。 */
        const input = ProfileEvidencePageInputSchema.parse(JSON.parse(call.arguments) as unknown)
        /** 当前 Job 的归一化证据页。 */
        const page = await personalization.evidencePage(input.cursor, input.limit)
        messages.push({
          role: 'tool',
          content: JSON.stringify(page),
          toolCallId: call.id,
          toolName: call.name
        })
      }
    }
    throw new Error('画像模型未在内部证据分页上限内返回最终 JSON。')
  }

  /** 在最近用户消息满十分钟后归档当前稳定会话块。 */
  private scheduleConversationBlockArchive(): void {
    if (!this.options.memory) return
    if (this.conversationBlockTimer) clearTimeout(this.conversationBlockTimer)
    /** 最近一条用户消息。 */
    const latestUserMessage = this.messages.findLast((message) => message.role === 'user')
    if (!latestUserMessage) return
    /** 距离十分钟空闲边界的剩余时间。 */
    const delay = Math.max(0, latestUserMessage.createdAt + CONVERSATION_BLOCK_IDLE_MS - Date.now())
    this.conversationBlockTimer = setTimeout(() => {
      this.conversationBlockTimer = undefined
      void this.options.memory?.archiveIfInactive(this.messages, Date.now()).catch(() => false)
    }, delay)
  }

  /** 首次命令前确保当前账户会话已经恢复。 */
  private async ensureConversationRestored(): Promise<void> {
    if (this.conversationRestored) return
    await this.restoreConversation()
  }

  /** 从当前账户 SQLite 恢复消息、工具和交互历史；活动状态统一中止。 */
  private async loadConversation(): Promise<void> {
    await Promise.all([
      this.options.memory?.restore(),
      this.options.personalization?.restore()
    ])
    /** 当前账户持久化端口。 */
    const persistence = this.options.conversationPersistence
    /** 磁盘连续会话；损坏快照按空会话恢复，不拖垮 Runtime。 */
    const saved = persistence ? await persistence.load().catch(() => undefined) : undefined
    this.messages.splice(0, this.messages.length, ...restoreMessages(saved?.messages ?? []))
    this.tools.splice(0, this.tools.length, ...restoreTools(saved?.tools ?? []))
    this.approvals.splice(0, this.approvals.length, ...restoreApprovals(saved?.approvals ?? []))
    this.selections.splice(0, this.selections.length, ...restoreSelections(saved?.selections ?? []))
    this.shellTerminals.splice(0, this.shellTerminals.length)
    this.entities.clear()
    this.verifiedEntities.clear()
    for (const selection of this.selections) {
      for (const option of selection.options) {
        if (option.kind !== 'entity') continue
        /** 持久化选择卡中曾由 Music Service 验证的稳定实体引用。 */
        const reference = `${option.entity.kind}:${option.entity.id}`
        this.verifiedEntities.set(reference, option.entity)
      }
    }
    this.knownQueueItemIds.clear()
    this.turnId = undefined
    this.turnStatus = this.messages.length > 0 ? 'completed' : 'idle'
    this.endReason = this.messages.length > 0 ? 'completed' : undefined
    this.toolRounds = 0
    this.toolCalls = 0
    this.turnToolStartIndex = this.tools.length
    this.turnRequiresPlayback = false
    this.turnPlayerCommandSucceeded = false
    this.playbackGoalPending = false
    this.conversationRestored = true
    this.publish(false)
    this.scheduleConversationBlockArchive()
    void this.options.personalization?.refreshLightweightChangeScore(this.options.music).catch(() => undefined)
  }

  /** 合并流式快照写入，避免每个 Token 都触发 SQLite 事务。 */
  private scheduleConversationPersistence(): void {
    if (!this.options.conversationPersistence || !this.conversationRestored) return
    if (this.conversationPersistTimer) clearTimeout(this.conversationPersistTimer)
    this.conversationPersistTimer = setTimeout(() => {
      this.conversationPersistTimer = undefined
      void this.flushConversation().catch(() => undefined)
    }, CONVERSATION_PERSIST_DEBOUNCE_MS)
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
    toolCallIds: [],
    createdAt: Date.now(),
    streaming,
    interrupted: false
  }
}

/** 恢复消息历史，并把应用退出时仍在流式生成的消息标为已中止。 */
function restoreMessages(messages: readonly AgentMessage[]): AgentMessage[] {
  return messages.map((message) => ({
    ...message,
    streaming: false,
    interrupted: message.interrupted || message.streaming
  }))
}

/** 恢复工具历史，并把未进入终态的旧调用标为已取消。 */
function restoreTools(tools: readonly ToolExecutionCardSnapshot[]): ToolExecutionCardSnapshot[] {
  /** 不得跨应用继续等待或执行的工具状态。 */
  const activeStatuses = new Set<ToolExecutionCardSnapshot['status']>([
    'queued',
    'awaiting_approval',
    'awaiting_selection',
    'running'
  ])
  return tools.map((tool) => activeStatuses.has(tool.status)
    ? {
        ...tool,
        status: 'cancelled',
        errorCode: 'APP_RESTARTED',
        resultSummary: '应用退出时工具尚未完成。',
        endedAt: tool.endedAt ?? Date.now()
      }
    : { ...tool })
}

/** 恢复审批历史；旧待审批项不会跨应用继续有效。 */
function restoreApprovals(approvals: readonly ApprovalSnapshot[]): ApprovalSnapshot[] {
  return approvals.map((approval) => approval.status === 'pending'
    ? { ...approval, status: 'cancelled' }
    : { ...approval })
}

/** 恢复选择历史；旧待选择项不会跨应用继续有效。 */
function restoreSelections(selections: readonly SelectionSnapshot[]): SelectionSnapshot[] {
  return selections.map((selection) => selection.status === 'pending'
    ? { ...selection, status: 'cancelled' }
    : { ...selection })
}

/** 将非 UUID Provider Tool ID 映射成本地稳定 UUID。 */
function normalizeToolCallId(value: string, turnId?: string): string {
  return deterministicUuid(`${turnId ?? 'agent-turn'}:${value}`)
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

/** 从搜索结果中确定播放项，真正同名且分数接近时交给用户选择。 */
function resolvePlaybackSong(songs: readonly StandardSong[], query: string): PlaybackSongResolution {
  /** 归一化后的点播文本。 */
  const normalizedQuery = normalizeName(query)
  /** 带稳定上游顺序的候选评分。 */
  const ranked = songs.map((song, index) => ({
    song,
    index,
    score: playbackCandidateScore(song, normalizedQuery, index)
  })).sort((left, right) => right.score - left.score || left.index - right.index)
  /** 最高相关候选。 */
  const first = ranked[0]
  if (!first) return { status: 'resolved', song: songs[0] as StandardSong }
  /** 查询中明确包含歌曲标题且与首位分数接近的候选。 */
  const ambiguous = ranked.filter((candidate) => {
    /** 归一化候选标题。 */
    const title = normalizeName(candidate.song.name)
    return first.score - candidate.score < PLAYBACK_CLEAR_LEAD_MARGIN
      && Boolean(title)
      && normalizedQuery.includes(title)
  }).slice(0, 5)
  if (ambiguous.length > 1) {
    return { status: 'needs_selection', candidates: ambiguous.map((candidate) => candidate.song) }
  }
  return { status: 'resolved', song: first.song }
}

/** 计算播放候选分数；未被用户点名的翻唱、现场与混音版本会降权。 */
function playbackCandidateScore(song: StandardSong, normalizedQuery: string, index: number): number {
  /** 上游搜索相关性基础分；越靠前越高。 */
  let score = Math.max(0, 1 - index * 0.04)
  /** 歌曲标题、专辑与歌手组成的版本描述。 */
  const versionText = `${song.name} ${song.album?.name ?? ''} ${song.artists.map((artist) => artist.name).join(' ')}`
  /** 归一化歌曲标题。 */
  const normalizedTitle = normalizeName(song.name)
  if (normalizedTitle && normalizedQuery.includes(normalizedTitle)) score += 0.35
  for (const artist of song.artists) {
    /** 歌手主名和别名。 */
    const names = [artist.name, ...artist.alias]
    if (names.some((name) => normalizedQuery.includes(normalizeName(name)))) score += 0.7
  }
  /** 用户未明确要求特殊版本时偏向录音室原版。 */
  const candidateHasVersionMarker = NON_ORIGINAL_VERSION_PATTERN.test(versionText)
  const queryHasVersionMarker = NON_ORIGINAL_VERSION_PATTERN.test(normalizedQuery)
  if (candidateHasVersionMarker && !queryHasVersionMarker) score -= 0.65
  if (/原唱|原版|original/iu.test(versionText)) score += 0.25
  return score
}

/** 从选择结果中读取唯一歌曲实体引用。 */
function selectedEntityRef(data: unknown): string | undefined {
  if (!isRecord(data) || !Array.isArray(data['selectedRefs'])) return undefined
  /** 第一个且应为唯一的已选择引用。 */
  const reference = data['selectedRefs'][0]
  return typeof reference === 'string' ? reference : undefined
}

/** 判断模型查询是否属于随机推荐短语而不是歌曲关键词。 */
function isGenericPlaybackQuery(query: string): boolean {
  return GENERIC_PLAYBACK_QUERY_PATTERN.test(query.trim())
}

/** 判断短消息是否在延续上一轮未完成的歌曲版本澄清。 */
function isPlaybackClarification(content: string): boolean {
  /** 去除首尾空白后的澄清文本。 */
  const normalized = content.trim()
  if (!normalized || normalized.length > 80) return false
  return /(?:原版|原唱|专辑版|现场|live|翻唱|cover|remix|混音|song:\d{1,20})/iu.test(normalized)
    || !/[？?]/u.test(normalized)
}

/** 去除错误摘要末尾标点，避免确定性回复出现重复句号。 */
function trimSentence(value: string): string {
  return value.trim().replace(/[。！？!?]+$/u, '')
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
  if (name === 'execute_shell' || name === 'manage_skill' || name === 'mcp_manager') return 'gateway'
  if (name.startsWith('skill.') || name.startsWith('mcp.')) return 'gateway'
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
