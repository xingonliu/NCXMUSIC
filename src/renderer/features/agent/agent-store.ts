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
  /** 设置音乐安全等级并持久化当前账户偏好。 */
  setMusicSafetyLevel(level: MusicSafetyLevel): Promise<void>
  /** 设置命令安全等级并持久化当前账户偏好。 */
  setCommandSafetyLevel(level: CommandSafetyLevel): Promise<void>
  /** 设置 Shell Tool 开关并持久化当前账户偏好。 */
  setShellToolEnabled(enabled: boolean): Promise<void>
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

// ========= 函数 =========

/** 执行 Agent 命令并采用响应快照。 */
async function execute(command: AgentCommand): Promise<void> {
  /** Utility Agent 响应。 */
  const response = await window.ncx.runtime.agent(command)
  if (response.ok) snapshot.value = response.data
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
    await execute({ operation: 'snapshot' })
    await hydrateSafetyPreferences()
    initialized.value = true
  })().finally(() => {
    initializing = undefined
  })
  return initializing
}

/** 从当前账户 SQLite 恢复双安全等级与 Shell 开关。 */
async function hydrateSafetyPreferences(): Promise<void> {
  /** 当前账户快照。 */
  const account = await window.ncx.account.snapshot()
  /** 当前账户偏好响应。 */
  const response = await window.ncx.runtime.accountData({
    operation: 'getPreferences',
    accountId: account.activeAccount.accountId,
    accountGeneration: account.accountGeneration
  })
  if (!response.ok || response.data.operation !== 'getPreferences') return
  /** 持久音乐安全等级。 */
  const musicSafetyLevel = response.data.preferences['agent.musicSafetyLevel']
  /** 持久命令安全等级。 */
  const commandSafetyLevel = response.data.preferences['agent.commandSafetyLevel']
  /** 持久 Shell Tool 开关。 */
  const shellToolEnabled = response.data.preferences['agent.shellToolEnabled']
  await execute({
    operation: 'setSafety',
    ...(isMusicSafetyLevel(musicSafetyLevel) ? { musicSafetyLevel } : {}),
    ...(isCommandSafetyLevel(commandSafetyLevel) ? { commandSafetyLevel } : {}),
    ...(typeof shellToolEnabled === 'boolean' ? { shellToolEnabled } : {})
  })
}

/** 持久化单个安全偏好。 */
async function persistSafetyPreference(key: string, value: string | boolean): Promise<void> {
  /** 当前账户快照。 */
  const account = await window.ncx.account.snapshot()
  await window.ncx.runtime.accountData({
    operation: 'setPreference',
    accountId: account.activeAccount.accountId,
    accountGeneration: account.accountGeneration,
    key,
    value
  })
}

/** 设置音乐安全等级并立即应用。 */
async function setMusicSafetyLevel(level: MusicSafetyLevel): Promise<void> {
  await execute({ operation: 'setSafety', musicSafetyLevel: level })
  await persistSafetyPreference('agent.musicSafetyLevel', level)
}

/** 设置命令安全等级并立即应用。 */
async function setCommandSafetyLevel(level: CommandSafetyLevel): Promise<void> {
  await execute({ operation: 'setSafety', commandSafetyLevel: level })
  await persistSafetyPreference('agent.commandSafetyLevel', level)
}

/** 设置 Shell Tool 开关并立即应用。 */
async function setShellToolEnabled(enabled: boolean): Promise<void> {
  await execute({ operation: 'setSafety', shellToolEnabled: enabled })
  await persistSafetyPreference('agent.shellToolEnabled', enabled)
}

/** 判断持久值是否为音乐安全等级。 */
function isMusicSafetyLevel(value: unknown): value is MusicSafetyLevel {
  return value === 'M1' || value === 'M2' || value === 'M3' || value === 'M4'
}

/** 判断持久值是否为命令安全等级。 */
function isCommandSafetyLevel(value: unknown): value is CommandSafetyLevel {
  return value === 'S1' || value === 'S2' || value === 'S3' || value === 'S4'
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
    setShellToolEnabled
  }
}
