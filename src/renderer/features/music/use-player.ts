import { readonly, ref, type Ref } from 'vue'

import { PlaybackCoordinator } from '../../../domains/player/playback-coordinator'
import { PlaybackEngine } from '../../../domains/player/playback-engine'
import { PlayerCommandGateway } from '../../../domains/player/player-command-gateway'
import { QueueController } from '../../../domains/player/queue-controller'
import type { PlayerSnapshot } from '../../../domains/player/playback-coordinator'
import type { PlayContext } from '../../../domains/player/queue-controller'
import type {
  MusicQualityPreference,
  PlayMode,
  QueueSource,
  TrackSummary
} from '../../../domains/player/types'
import type { DesktopBridge } from '../../../shared/contracts/desktop-bridge'
import type { AccountSessionSnapshot } from '../../../shared/schemas/account'
import type { PlayerCommandAction } from '../../../shared/schemas/player-command'
import { HtmlAudioAdapter } from './html-audio-adapter'
import { IpcTrackResolver } from './ipc-track-resolver'
import {
  PlaybackStore,
  type PlaybackStoreAccountContext
} from './playback-store'
import {
  createSystemMediaSessionBridge,
  type SystemMediaSessionBridge
} from './system-media-session'

// ─────────────────────────────────────────────────────────────────────────────
// 变量区
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 应用作用域唯一的播放器实例。
 *
 * 架构约束 A-012：根层只有一个 AudioHost / 一个 HTMLAudioElement。
 * 主播放、试听与 Agent 点播全部复用这一套，不创建第二个内容播放器。
 */
interface PlayerRuntime {
  /** 唯一播放编排器，所有播放命令都必须经过它。 */
  coordinator: PlaybackCoordinator
  /** 所有外部播放入口共用的唯一命令 Gateway。 */
  gateway: PlayerCommandGateway
  /** 唯一播放引擎，持有媒体状态事实源。 */
  engine: PlaybackEngine
  /** 唯一 HTMLAudioElement 适配器。 */
  adapter: HtmlAudioAdapter
  /** Chromium Media Session / 系统媒体中心桥。 */
  systemMedia: SystemMediaSessionBridge
  /** Vue 只读快照引用，供 UI 消费。 */
  snapshot: Ref<PlayerSnapshot>
  /** 最近一次「曲目不可播放」提示，UI 消费后可清空 */
  notice: Ref<string | null>
  /** 播放快照持久化清理函数。 */
  disposePersistence: () => void
}

let runtime: PlayerRuntime | undefined

/** 最近一次 Main 公布的账户数据隔离上下文。 */
let journalAccountContext: PlaybackStoreAccountContext | undefined

/** 允许写入 Action Journal 的低频语义命令；排除 Seek 与音量滑动等高频事件。 */
const JOURNALED_PLAYER_COMMANDS = new Set<PlayerCommandAction['type']>([
  'player.play-context',
  'player.play-track',
  'player.play-queue-item',
  'player.play',
  'player.pause',
  'player.toggle',
  'player.next',
  'player.previous',
  'player.set-muted',
  'player.set-mode',
  'player.set-quality',
  'player.enqueue',
  'player.play-next',
  'player.reorder',
  'player.remove',
  'player.clear'
])

// ─────────────────────────────────────────────────────────────────────────────
// 函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 创建播放器运行时（惰性单例） */
function createRuntime(): PlayerRuntime {
  const adapter = new HtmlAudioAdapter()
  const engine = new PlaybackEngine(adapter)
  const queue = new QueueController()
  const resolver = new IpcTrackResolver()
  const coordinator = new PlaybackCoordinator(queue, engine, resolver)
  const gateway = new PlayerCommandGateway(coordinator)
  /** 通过统一 Gateway 执行系统媒体命令。 */
  const runSystemCommand = (action: PlayerCommandAction): Promise<void> =>
    executeAppliedCommand(coordinator, gateway, action)
  const systemMedia = createSystemMediaSessionBridge(coordinator, {
    play: () => runSystemCommand({ type: 'player.play' }),
    pause: () => { void runSystemCommand({ type: 'player.pause' }) },
    next: () => runSystemCommand({ type: 'player.next' }),
    previous: () => runSystemCommand({ type: 'player.previous' }),
    seek: (positionMs) => { void runSystemCommand({ type: 'player.seek', positionMs }) }
  })

  const snapshot = ref<PlayerSnapshot>(coordinator.getSnapshot())
  const notice = ref<string | null>(null)

  coordinator.subscribe((event) => {
    if (event.type === 'snapshot') {
      snapshot.value = event.snapshot
      return
    }
    notice.value = event.message
  })

  const partialRuntime = { coordinator, gateway, engine, adapter, systemMedia, snapshot, notice }
  const disposePersistence = installPlaybackPersistence(partialRuntime)

  return { ...partialRuntime, disposePersistence }
}

/** 生成带 commandId、expectedRevision 与有限超时的命令并等待真实回执。 */
async function executeAppliedCommand(
  coordinator: PlaybackCoordinator,
  gateway: PlayerCommandGateway,
  action: PlayerCommandAction
): Promise<void> {
  /** 当前命令执行前读取的队列修订号。 */
  const expectedRevision = coordinator.getSnapshot().queue.revision
  /** 统一 Gateway 返回的真实执行回执。 */
  const result = await gateway.execute({
    commandId: crypto.randomUUID(),
    expectedRevision,
    issuedAt: Date.now(),
    timeoutMs: 5_000,
    action
  })
  if (!result.ok) {
    throw Object.assign(new Error(`播放器命令失败：${result.code}`), { code: result.code })
  }
  void appendPlayerCommandJournal(action.type, result.commandId, result.latestRevision)
}

/** 将成功应用的 PlayerCommand 作为语义事件写入当前账户 Journal。 */
async function appendPlayerCommandJournal(
  commandType: PlayerCommandAction['type'],
  commandId: string,
  latestRevision: number
): Promise<void> {
  const bridge = readDesktopBridge()
  const account = journalAccountContext
  if (!bridge || !account || !JOURNALED_PLAYER_COMMANDS.has(commandType)) return
  await bridge.runtime.accountData({
    operation: 'appendJournal',
    accountId: account.accountId,
    accountGeneration: account.accountGeneration,
    eventType: 'player.command',
    payload: { commandType, commandId, latestRevision }
  })
}

/** 读取可能存在的桌面 Bridge，测试环境缺失时返回 undefined。 */
function readDesktopBridge(): DesktopBridge | undefined {
  const maybeWindow = window as Window & { ncx?: DesktopBridge }
  return maybeWindow.ncx
}

/**
 * 为播放器运行时安装快照恢复和持久化监听。
 *
 * @param active 当前播放器运行时核心对象
 */
function installPlaybackPersistence(
  active: Omit<PlayerRuntime, 'disposePersistence'>
): () => void {
  const bridge = readDesktopBridge()
  if (!bridge?.account) return () => {}

  const store = new PlaybackStore({
    persistence: {
      load: async (nextAccount) => {
        const result = await bridge.runtime.loadPlaybackSnapshot(nextAccount)
        return result.ok ? result.data : null
      },
      save: async (persistedSnapshot) => {
        await bridge.runtime.savePlaybackSnapshot(persistedSnapshot)
      }
    }
  })
  let account: PlaybackStoreAccountContext | undefined
  let hasRestoredInitialSnapshot = false

  /** 从账户快照生成存储上下文。 */
  function toAccountContext(snapshot: AccountSessionSnapshot): PlaybackStoreAccountContext {
    return {
      accountId: snapshot.activeAccount.accountId,
      accountGeneration: snapshot.accountGeneration
    }
  }

  /** 立即保存当前播放快照。 */
  function flushCurrentSnapshot(): void {
    store.flush(active.coordinator.getSnapshot(), account)
  }

  /** 页面隐藏时立即刷新播放进度。 */
  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') flushCurrentSnapshot()
  }

  /** 根据账户上下文恢复对应播放快照；无快照时清空当前队列。 */
  async function restoreForAccount(nextAccount: PlaybackStoreAccountContext, clearWhenMissing: boolean): Promise<void> {
    const restored = await store.load(nextAccount)
    if (restored) {
      active.coordinator.restorePausedState(restored)
      return
    }
    if (clearWhenMissing) await active.coordinator.clear()
  }

  const unsubscribePlayer = active.coordinator.subscribe((event) => {
    if (event.type === 'snapshot') store.schedule(event.snapshot, account)
  })

  const unsubscribeAccount = bridge.account.onSnapshot((snapshot) => {
    const nextAccount = toAccountContext(snapshot)
    const accountChanged =
      account !== undefined &&
      (account.accountId !== nextAccount.accountId ||
        account.accountGeneration !== nextAccount.accountGeneration)
    account = nextAccount
    journalAccountContext = nextAccount
    if (hasRestoredInitialSnapshot && accountChanged) {
      void restoreForAccount(nextAccount, true)
    }
  })

  /** Main 退出前请求的可等待播放快照刷新。 */
  const unsubscribeLifecycle = bridge.lifecycle.onFlushRequest(async () => {
    flushCurrentSnapshot()
    await store.settled()
  })

  void bridge.account.snapshot().then(async (snapshot) => {
    account = toAccountContext(snapshot)
    journalAccountContext = account
    await restoreForAccount(account, false)
    hasRestoredInitialSnapshot = true
  })

  window.addEventListener('beforeunload', flushCurrentSnapshot)
  window.addEventListener('pagehide', flushCurrentSnapshot)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    flushCurrentSnapshot()
    unsubscribePlayer()
    unsubscribeAccount()
    unsubscribeLifecycle()
    window.removeEventListener('beforeunload', flushCurrentSnapshot)
    window.removeEventListener('pagehide', flushCurrentSnapshot)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    store.dispose()
    journalAccountContext = undefined
  }
}

/**
 * 获取应用唯一播放器。
 *
 * 首次调用时惰性创建运行时；由根层 AudioHost 负责最早触发创建。
 * 其他组件只读取快照并发送命令，不得持有引擎或适配器。
 */
export function usePlayer(): {
  snapshot: Readonly<Ref<PlayerSnapshot>>
  notice: Readonly<Ref<string | null>>
  playContext: (context: PlayContext) => Promise<void>
  playTrack: (track: TrackSummary, source: QueueSource) => Promise<void>
  playQueueItem: (queueItemId: string) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  toggle: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (positionMs: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setMode: (mode: PlayMode) => Promise<void>
  setQuality: (quality: MusicQualityPreference) => Promise<void>
  enqueue: (tracks: TrackSummary[], source: QueueSource) => void
  playNext: (tracks: TrackSummary[], source: QueueSource) => void
  reorder: (queueItemId: string, toIndex: number) => void
  remove: (queueItemId: string) => Promise<void>
  clear: () => Promise<void>
  /** 清空提示 */
  dismissNotice: () => void
  /** 获取低频音频波形能量 [0, 1] */
  getAudioEnergy: () => number
} {
  runtime ??= createRuntime()
  const active = runtime

  return {
    snapshot: readonly(active.snapshot) as Readonly<Ref<PlayerSnapshot>>,
    notice: readonly(active.notice) as Readonly<Ref<string | null>>,
    getAudioEnergy: () => active.adapter.getAudioEnergy(),
    playContext: (context) => executeAppliedCommand(active.coordinator, active.gateway, {
      type: 'player.play-context',
      tracks: context.tracks,
      source: context.source,
      ...(context.startIndex !== undefined ? { startIndex: context.startIndex } : {})
    }),
    playTrack: (track, source) => executeAppliedCommand(active.coordinator, active.gateway, {
      type: 'player.play-track', track, source
    }),
    playQueueItem: (queueItemId) => executeAppliedCommand(active.coordinator, active.gateway, {
      type: 'player.play-queue-item', queueItemId
    }),
    play: () => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.play' }),
    pause: () => { void executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.pause' }) },
    toggle: () => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.toggle' }),
    next: () => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.next' }),
    previous: () => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.previous' }),
    seek: (positionMs) => { void executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.seek', positionMs }) },
    setVolume: (volume) => { void executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.set-volume', volume }) },
    setMuted: (muted) => { void executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.set-muted', muted }) },
    setMode: (mode) => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.set-mode', mode }),
    setQuality: (quality) => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.set-quality', quality }),
    enqueue: (tracks, source) => { void executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.enqueue', tracks, source }) },
    playNext: (tracks, source) => { void executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.play-next', tracks, source }) },
    reorder: (queueItemId, toIndex) => { void executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.reorder', queueItemId, toIndex }) },
    remove: (queueItemId) => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.remove', queueItemId }),
    clear: () => executeAppliedCommand(active.coordinator, active.gateway, { type: 'player.clear' }),
    dismissNotice: () => {
      active.notice.value = null
    }
  }
}

/**
 * 读取包含内部 coordinator / engine 的播放器运行时。仅供底层宿主与测试使用。
 */
export function usePlayerRuntime(): PlayerRuntime {
  runtime ??= createRuntime()
  return runtime
}

/**
 * 释放播放器单例。仅供测试与应用退出使用。
 * 正常路由切换不得调用——会销毁根层 AudioHost。
 */
export function disposePlayer(): void {
  if (!runtime) return
  // 顺序固定：先解绑系统媒体入口 → 停编排 → 停引擎 → 解绑原生监听器
  runtime.systemMedia.dispose()
  runtime.disposePersistence()
  runtime.coordinator.dispose()
  runtime.engine.dispose()
  runtime.adapter.dispose()
  runtime = undefined
}
