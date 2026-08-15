import { readonly, ref, type DeepReadonly, type Ref } from 'vue'

import { usePlayerRuntime } from '../music/use-player'
import {
  AgentSnapshotSchema,
  type AgentCommand,
  type AgentPlayerState,
  type AgentRuntimeEvent,
  type AgentSnapshot,
  type CommandSafetyLevel,
  type MusicSafetyLevel
} from '../../../shared/schemas/agent'
import type { AgentSafetyPreferences } from '../../../shared/schemas/agent-settings'
import type { PlayerCommandAction } from '../../../shared/schemas/player-command'
import type { TrackSummary } from '../../../domains/player/types'

// ========= 类型 =========

/** 小云页面可消费的应用作用域 Store。 */
export interface AgentStore {
  /** 最新可恢复快照。 */
  readonly snapshot: Readonly<Ref<DeepReadonly<AgentSnapshot>>>
  /** Store 是否完成初始连接。 */
  readonly initialized: Readonly<Ref<boolean>>
  /** 初始化跨路由持续订阅。 */
  initialize(): Promise<void>
  /** 发送用户消息。 */
  sendMessage(content: string, context?: AgentMessageContext): Promise<void>
  /** 停止活动 Turn。 */
  stop(): Promise<void>
  /** 批准或拒绝单个 Tool Call。 */
  respondApproval(approvalId: string, decision: 'approve' | 'reject'): Promise<void>
  /** 提交无副作用选择。 */
  respondSelection(selectionId: string, selectedOptionKeys: string[]): Promise<void>
  /** 取消无副作用选择。 */
  cancelSelection(selectionId: string): Promise<void>
  /** 设置音乐安全等级并持久化应用级偏好。 */
  setMusicSafetyLevel(level: MusicSafetyLevel): Promise<void>
  /** 设置命令安全等级并持久化应用级偏好。 */
  setCommandSafetyLevel(level: CommandSafetyLevel): Promise<void>
  /** 设置 Shell Tool 开关并持久化应用级偏好。 */
  setShellToolEnabled(enabled: boolean): Promise<void>
  /** 用户明确启动初始化、更新或重新生成画像。 */
  startProfileAnalysis(mode: 'initialize' | 'update' | 'regenerate'): Promise<void>
  /** 关闭当前画像提示。 */
  dismissProfilePrompt(): Promise<void>
  /** 暂停画像更新。 */
  pauseProfile(): Promise<void>
  /** 恢复画像更新。 */
  resumeProfile(): Promise<void>
  /** 仅删除本地画像与中间证据。 */
  deleteProfile(): Promise<void>
  /** 保存用户纠正、隐藏或补充。 */
  setProfileOverride(input: {
    readonly kind: 'correction' | 'hidden' | 'supplement'
    readonly insightId?: string
    readonly value?: string
  }): Promise<void>
  /** 删除单条用户画像修正。 */
  removeProfileOverride(overrideId: string): Promise<void>
}

/** 页面交给小云的标准实体上下文。 */
export interface AgentMessageContext {
  /** 当前路由名。 */
  readonly routeName?: string
  /** 当前实体类型。 */
  readonly entityKind?: 'song' | 'artist' | 'album' | 'playlist'
  /** 当前稳定实体 ID。 */
  readonly entityId?: string
  /** 当前展示名称。 */
  readonly entityName?: string
}

// ========= 变量 =========

/** 未连接时的安全初始快照。 */
const EMPTY_AGENT_SNAPSHOT: AgentSnapshot = AgentSnapshotSchema.parse({
  configured: false,
  turnStatus: 'idle',
  messages: [],
  tools: [],
  approvals: [],
  selections: [],
  toolRounds: 0,
  toolCalls: 0,
  musicSafetyLevel: 'M1',
  commandSafetyLevel: 'S1',
  shellToolEnabled: false,
  updatedAt: 0
})

/** 应用作用域最新 Agent 快照。 */
const snapshot = ref<AgentSnapshot>(EMPTY_AGENT_SNAPSHOT)

/** 是否已建立持续订阅。 */
const initialized = ref<boolean>(false)

/** 是否正在初始化，防止多个路由实例重复连接。 */
let initializing: Promise<void> | undefined

/** Agent 事件取消订阅函数；应用生命周期内保持。 */
let unsubscribeAgentEvents: (() => void) | undefined

/** 应用退出前会话刷新取消订阅函数。 */
let unsubscribeConversationFlush: (() => void) | undefined

// ========= 函数 =========

/** 执行 Agent 命令并采用响应快照。 */
async function execute(command: AgentCommand): Promise<void> {
  /** Utility Agent 响应。 */
  const response = await window.ncx.runtime.agent(command)
  if (response.ok) snapshot.value = response.data
}

/** 在 Renderer 本地立即应用安全偏好，避免运行时暂不可用导致 UI 回弹。 */
function applySafetyPreferences(preferences: AgentSafetyPreferences): void {
  snapshot.value = AgentSnapshotSchema.parse({
    ...snapshot.value,
    ...preferences,
    updatedAt: Date.now()
  })
}

/** 处理 Utility 的快照与播放器命令事件。 */
function handleAgentEvent(event: AgentRuntimeEvent): void {
  if (event.type === 'snapshot') {
    snapshot.value = event.snapshot
    return
  }
  if (event.type === 'player-command') {
    void executePlayerCommand(event.request.toolCallId, event.request.action)
    return
  }
  void executePlayerStateRequest(event.request.toolCallId)
}

/** 通过 Renderer 唯一 PlayerCommandGateway 执行并返回真实回执。 */
async function executePlayerCommand(toolCallId: string, action: PlayerCommandAction): Promise<void> {
  /** 应用唯一播放器运行时。 */
  const player = usePlayerRuntime()
  /** 执行前最新队列修订号。 */
  const expectedRevision = player.coordinator.getSnapshot().queue.revision
  /** PlayerCommandGateway 真实回执。 */
  const result = await player.gateway.execute({
    commandId: crypto.randomUUID(),
    expectedRevision,
    issuedAt: Date.now(),
    timeoutMs: 10_000,
    action
  })
  await execute({
    operation: 'playerCommandResult',
    toolCallId,
    ok: result.ok,
    summary: result.ok ? summarizePlayerAction(action) : `播放器命令失败：${result.code}`,
    latestRevision: result.latestRevision
  })
}

/** 读取唯一 PlaybackCoordinator 的真实状态并裁剪公开曲目信息。 */
async function executePlayerStateRequest(toolCallId: string): Promise<void> {
  /** 应用唯一播放器运行时。 */
  const player = usePlayerRuntime()
  /** 当前真实播放器快照。 */
  const current = player.coordinator.getSnapshot()
  /** 不含媒体 URL 与内部错误的 Agent 状态。 */
  const state: AgentPlayerState = {
    playbackStatus: current.playback.status,
    currentTrack: current.playback.track ? sanitizeTrack(current.playback.track) : null,
    positionMs: current.playback.positionMs,
    durationMs: current.playback.durationMs,
    volume: current.playback.volume,
    muted: current.playback.muted,
    mode: current.queue.mode,
    revision: current.queue.revision,
    queue: current.queue.items.map((item) => ({
      queueItemId: item.queueItemId,
      track: sanitizeTrack(item.track)
    }))
  }
  await execute({ operation: 'playerStateResult', toolCallId, state })
}

/** 从播放器曲目摘要移除封面 URL，只保留模型完成音乐任务所需字段。 */
function sanitizeTrack(track: TrackSummary): NonNullable<AgentPlayerState['currentTrack']> {
  return {
    trackId: track.trackId,
    name: track.name,
    artists: track.artists,
    album: track.album,
    durationMs: track.durationMs
  }
}

/** 初始化一次持续事件订阅并恢复安全等级。 */
async function initialize(): Promise<void> {
  if (initialized.value) return
  initializing ??= (async () => {
    unsubscribeAgentEvents ??= window.ncx.runtime.onAgentEvent(handleAgentEvent)
    unsubscribeConversationFlush ??= window.ncx.lifecycle.onFlushRequest(async () => {
      await execute({ operation: 'flushConversation' })
    })
    await window.ncx.providerProfiles.request({ operation: 'list' }).catch(() => undefined)
    await execute({ operation: 'snapshot' })
    await hydrateSafetyPreferences()
    initialized.value = true
  })().finally(() => {
    initializing = undefined
  })
  return initializing
}

/** 从 Main 本地配置恢复双安全等级与 Shell 开关。 */
async function hydrateSafetyPreferences(): Promise<void> {
  /** Main 持久化的应用级安全偏好。 */
  const response = await window.ncx.agentSettings.request({ operation: 'snapshot' })
  applySafetyPreferences(response.preferences)
  await execute({
    operation: 'setSafety',
    ...response.preferences
  })
}

/** 持久化应用级安全偏好并返回合并后的完整偏好。 */
async function persistSafetyPreferences(preferences: Partial<AgentSafetyPreferences>): Promise<AgentSafetyPreferences> {
  /** Main 写入后的完整安全偏好。 */
  const response = await window.ncx.agentSettings.request({
    operation: 'setSafety',
    ...preferences
  })
  return response.preferences
}

/** 设置音乐安全等级并立即应用。 */
async function setMusicSafetyLevel(level: MusicSafetyLevel): Promise<void> {
  /** 写入 Main 后返回的完整偏好。 */
  const preferences = await persistSafetyPreferences({ musicSafetyLevel: level })
  applySafetyPreferences(preferences)
  await execute({ operation: 'setSafety', ...preferences })
}

/** 设置命令安全等级并立即应用。 */
async function setCommandSafetyLevel(level: CommandSafetyLevel): Promise<void> {
  /** 写入 Main 后返回的完整偏好。 */
  const preferences = await persistSafetyPreferences({ commandSafetyLevel: level })
  applySafetyPreferences(preferences)
  await execute({ operation: 'setSafety', ...preferences })
}

/** 设置 Shell Tool 开关并立即应用。 */
async function setShellToolEnabled(enabled: boolean): Promise<void> {
  /** 写入 Main 后返回的完整偏好。 */
  const preferences = await persistSafetyPreferences({ shellToolEnabled: enabled })
  applySafetyPreferences(preferences)
  await execute({ operation: 'setSafety', ...preferences })
}

/** 将播放器动作转换为用户可理解的真实回执摘要。 */
function summarizePlayerAction(action: PlayerCommandAction): string {
  if (action.type === 'player.play-track') return `已开始播放《${action.track.name}》。`
  if (action.type === 'player.next') return '已切换到下一首。'
  if (action.type === 'player.previous') return '已切换到上一首。'
  if (action.type === 'player.pause') return '已暂停播放。'
  if (action.type === 'player.clear') return '已清空播放队列。'
  return '播放器命令已应用。'
}

/** 取得应用作用域小云 Store。 */
export function useAgentStore(): AgentStore {
  return {
    snapshot: readonly(snapshot),
    initialized: readonly(initialized),
    initialize,
    sendMessage: async (content, context) => execute({
      operation: 'sendMessage',
      content,
      ...(context ? { context } : {})
    }),
    stop: async () => execute({ operation: 'stop' }),
    respondApproval: async (approvalId, decision) => execute({ operation: 'respondApproval', approvalId, decision }),
    respondSelection: async (selectionId, selectedOptionKeys) => execute({ operation: 'respondSelection', selectionId, selectedOptionKeys }),
    cancelSelection: async (selectionId) => execute({ operation: 'cancelSelection', selectionId }),
    setMusicSafetyLevel,
    setCommandSafetyLevel,
    setShellToolEnabled,
    startProfileAnalysis: async (mode) => execute({ operation: 'startProfileAnalysis', mode }),
    dismissProfilePrompt: async () => execute({ operation: 'dismissProfilePrompt' }),
    pauseProfile: async () => execute({ operation: 'pauseProfile' }),
    resumeProfile: async () => execute({ operation: 'resumeProfile' }),
    deleteProfile: async () => execute({ operation: 'deleteProfile' }),
    setProfileOverride: async (input) => execute({
      operation: 'setProfileOverride',
      kind: input.kind,
      ...(input.insightId ? { insightId: input.insightId } : {}),
      ...(input.value ? { value: input.value } : {})
    }),
    removeProfileOverride: async (overrideId) => execute({ operation: 'removeProfileOverride', overrideId })
  }
}
