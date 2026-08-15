import type {
  PlaybackCoordinator,
  PlayerSnapshot
} from '../../../domains/player/playback-coordinator'
import type { PlaybackSnapshot, TrackArtwork, TrackSummary } from '../../../domains/player/types'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** T-07 当前纳入自动化契约的系统媒体动作。 */
type SupportedSystemMediaAction =
  | 'play'
  | 'pause'
  | 'previoustrack'
  | 'nexttrack'
  | 'seekto'
  | 'seekbackward'
  | 'seekforward'

/** 系统媒体动作需要进入的唯一播放命令管道。 */
export interface SystemMediaCommands {
  /** 恢复当前队列项播放。 */
  play: () => Promise<void>
  /** 暂停当前播放器。 */
  pause: () => void
  /** 切到下一首。 */
  next: () => Promise<void>
  /** 切到上一首。 */
  previous: () => Promise<void>
  /** 跳转到指定播放位置。 */
  seek: (positionMs: number) => void
}

/** Media Session 的最小端口，便于单元测试替换浏览器对象。 */
export interface SystemMediaSessionPort {
  /** 系统媒体中心展示的曲目信息。 */
  metadata: MediaMetadata | null
  /** 系统媒体中心展示的播放状态。 */
  playbackState: MediaSessionPlaybackState
  /** 注册或清理系统媒体按键处理器。 */
  setActionHandler(action: SupportedSystemMediaAction, handler: MediaSessionActionHandler | null): void
  /** 同步播放进度；不带参数时用于清理位置状态。 */
  setPositionState?: (state?: MediaPositionState) => void
}

/** 播放快照来源，只暴露系统媒体桥需要的读模型。 */
export interface SystemMediaSnapshotSource {
  /** 读取当前完整播放快照。 */
  getSnapshot: () => PlayerSnapshot
  /** 订阅后续播放快照。 */
  subscribe: (listener: (snapshot: PlayerSnapshot) => void) => () => void
}

/** 系统媒体桥构造参数。 */
export interface SystemMediaSessionBridgeOptions {
  /** 注入的系统媒体端口；生产环境默认读取 navigator.mediaSession。 */
  session?: SystemMediaSessionPort
  /** 注入的 MediaMetadata 构造器；测试环境可替换为普通对象。 */
  metadataFactory?: (init: MediaMetadataInit) => MediaMetadata
}

// ─────────────────────────────────────────────────────────────────────────────
// 变量区
// ─────────────────────────────────────────────────────────────────────────────

/** 系统媒体中心支持展示的位置刷新速率固定为正常速度。 */
const SYSTEM_MEDIA_PLAYBACK_RATE = 1

/** 快退/快进媒体键未携带偏移量时使用的默认秒数。 */
const DEFAULT_SEEK_OFFSET_SECONDS = 10

/** 系统媒体中心在曲目未提供封面时使用的默认应用图标回退候选图。 */
const DEFAULT_MEDIA_FALLBACK_ARTWORK: readonly MediaImage[] = [
  { src: '/icon.png', sizes: '512x512', type: 'image/png' },
  { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
]

/** 需要注册到 Media Session 的动作列表。 */
const SYSTEM_MEDIA_ACTIONS: SupportedSystemMediaAction[] = [
  'play',
  'pause',
  'previoustrack',
  'nexttrack',
  'seekto',
  'seekbackward',
  'seekforward'
]

// ─────────────────────────────────────────────────────────────────────────────
// SystemMediaSessionBridge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chromium Media Session 适配器。
 *
 * 该桥只把 PlaybackCoordinator 的快照映射给系统媒体中心，并把系统按键
 * 重新投递回 Coordinator；不持有音频元素，也不创建第二套播放状态。
 */
export class SystemMediaSessionBridge {
  // ── 变量区 ──

  /** 当前可用的系统媒体端口；不支持 Media Session 时保持 undefined。 */
  private readonly session: SystemMediaSessionPort | undefined

  /** 当前播放器快照，用于处理相对 seek 媒体键。 */
  private snapshot: PlayerSnapshot

  /** 已成功注册的动作，dispose 时逐个清理。 */
  private readonly registeredActions = new Set<SupportedSystemMediaAction>()

  /** 取消订阅播放快照的句柄。 */
  private readonly unsubscribeSnapshots: () => void

  /** MediaMetadata 构造器，测试可注入假实现。 */
  private readonly metadataFactory: (init: MediaMetadataInit) => MediaMetadata

  constructor(
    private readonly source: SystemMediaSnapshotSource,
    private readonly commands: SystemMediaCommands,
    options: SystemMediaSessionBridgeOptions = {}
  ) {
    this.session = options.session ?? readSystemMediaSession()
    this.metadataFactory = options.metadataFactory ?? createDefaultMetadata
    this.snapshot = this.source.getSnapshot()
    this.unsubscribeSnapshots = this.source.subscribe((snapshot) => this.sync(snapshot))

    this.registerActionHandlers()
    this.sync(this.snapshot)
  }

  // ── 同步区 ──

  /** 把最新播放器快照同步到系统媒体中心。 */
  sync(snapshot: PlayerSnapshot): void {
    this.snapshot = snapshot
    if (!this.session) return

    this.syncMetadata(snapshot.playback.track)
    this.syncPlaybackState(snapshot.playback)
    this.syncPosition(snapshot.playback)
  }

  // ── 生命周期区 ──

  /** 释放系统媒体桥，清理媒体键处理器和展示状态。 */
  dispose(): void {
    this.unsubscribeSnapshots()
    this.clearActionHandlers()
    this.clearSessionState()
  }

  // ── 内部函数区 ──

  /** 注册系统媒体动作；平台不支持的动作会被跳过。 */
  private registerActionHandlers(): void {
    if (!this.session) return

    for (const action of SYSTEM_MEDIA_ACTIONS) {
      try {
        this.session.setActionHandler(action, (details) => this.handleAction(action, details))
        this.registeredActions.add(action)
      } catch {
        // Chromium / Electron 会对部分平台不可用动作抛 NotSupportedError，跳过即可。
      }
    }
  }

  /** 清理已注册的系统媒体动作。 */
  private clearActionHandlers(): void {
    if (!this.session) return

    for (const action of this.registeredActions) {
      try {
        this.session.setActionHandler(action, null)
      } catch {
        // 清理阶段不让平台差异影响播放器释放。
      }
    }
    this.registeredActions.clear()
  }

  /** 清空系统媒体中心展示的信息。 */
  private clearSessionState(): void {
    if (!this.session) return

    this.session.metadata = null
    this.session.playbackState = 'none'
    this.clearPositionState()
  }

  /** 处理系统媒体按键。 */
  private handleAction(action: SupportedSystemMediaAction, details: MediaSessionActionDetails): void {
    switch (action) {
      case 'play':
        this.runAsyncCommand(this.commands.play)
        return

      case 'pause':
        this.commands.pause()
        return

      case 'previoustrack':
        this.runAsyncCommand(this.commands.previous)
        return

      case 'nexttrack':
        this.runAsyncCommand(this.commands.next)
        return

      case 'seekto':
        this.handleAbsoluteSeek(details)
        return

      case 'seekbackward':
        this.handleRelativeSeek(details, -1)
        return

      case 'seekforward':
        this.handleRelativeSeek(details, 1)
        return
    }
  }

  /** 执行异步命令，并吸收由播放器状态拒绝造成的 Promise rejection。 */
  private runAsyncCommand(command: () => Promise<void>): void {
    void command().catch(() => undefined)
  }

  /** 处理系统媒体中心发起的绝对进度跳转。 */
  private handleAbsoluteSeek(details: MediaSessionActionDetails): void {
    if (typeof details.seekTime !== 'number' || !Number.isFinite(details.seekTime)) return
    const durationMs = readDurationMs(this.snapshot.playback)
    this.commands.seek(clampPositionMs(Math.round(details.seekTime * 1_000), durationMs))
  }

  /** 处理系统媒体中心发起的相对进度跳转。 */
  private handleRelativeSeek(details: MediaSessionActionDetails, direction: -1 | 1): void {
    const offsetSeconds =
      typeof details.seekOffset === 'number' && Number.isFinite(details.seekOffset)
        ? details.seekOffset
        : DEFAULT_SEEK_OFFSET_SECONDS
    const durationMs = readDurationMs(this.snapshot.playback)
    const targetMs = this.snapshot.playback.positionMs + direction * Math.round(offsetSeconds * 1_000)
    this.commands.seek(clampPositionMs(targetMs, durationMs))
  }

  /** 同步曲目标题、作者、专辑和封面。 */
  private syncMetadata(track: TrackSummary | null): void {
    if (!this.session) return

    if (!track) {
      this.session.metadata = null
      return
    }

    this.session.metadata = this.metadataFactory(createMetadataInit(track))
  }

  /** 同步播放状态到系统媒体中心。 */
  private syncPlaybackState(playback: PlaybackSnapshot): void {
    if (!this.session) return
    this.session.playbackState = toMediaPlaybackState(playback)
  }

  /** 同步播放位置到系统媒体中心。 */
  private syncPosition(playback: PlaybackSnapshot): void {
    if (!this.session?.setPositionState) return

    const durationMs = readDurationMs(playback)
    if (durationMs === null) {
      this.clearPositionState()
      return
    }

    try {
      this.session.setPositionState({
        duration: durationMs / 1_000,
        playbackRate: SYSTEM_MEDIA_PLAYBACK_RATE,
        position: clampPositionMs(playback.positionMs, durationMs) / 1_000
      })
    } catch {
      // 部分平台对位置状态校验更严格；失败只影响系统展示，不影响播放主状态。
    }
  }

  /** 清理系统媒体中心位置状态。 */
  private clearPositionState(): void {
    try {
      this.session?.setPositionState?.()
    } catch {
      // 清理失败不应阻断主播放器释放。
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 为 PlaybackCoordinator 创建系统媒体桥。 */
export function createSystemMediaSessionBridge(
  coordinator: PlaybackCoordinator,
  commands: SystemMediaCommands = {
    play: () => coordinator.play(),
    pause: () => coordinator.pause(),
    next: () => coordinator.next(),
    previous: () => coordinator.previous(),
    seek: (positionMs) => coordinator.seek(positionMs)
  }
): SystemMediaSessionBridge {
  return new SystemMediaSessionBridge(
    {
      getSnapshot: () => coordinator.getSnapshot(),
      subscribe: (listener) =>
        coordinator.subscribe((event) => {
          if (event.type === 'snapshot') listener(event.snapshot)
        })
    },
    commands
  )
}

/** 读取当前浏览器环境的 Media Session 端口。 */
function readSystemMediaSession(): SystemMediaSessionPort | undefined {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined
  return navigator.mediaSession as SystemMediaSessionPort
}

/** 创建生产环境使用的 MediaMetadata。 */
function createDefaultMetadata(init: MediaMetadataInit): MediaMetadata {
  if (typeof MediaMetadata === 'undefined') return init as MediaMetadata
  return new MediaMetadata(init)
}

/** 把曲目摘要转换为 MediaMetadataInit。 */
function createMetadataInit(track: TrackSummary): MediaMetadataInit {
  const metadata: MediaMetadataInit = {
    title: track.name,
    artist: track.artists.join(' / '),
    album: track.album
  }
  const artwork = normalizeArtwork(track.artwork)
  metadata.artwork = artwork ?? [...DEFAULT_MEDIA_FALLBACK_ARTWORK]
  return metadata
}

/** 过滤并规范化系统媒体中心可展示的封面候选图。 */
function normalizeArtwork(artwork: TrackArtwork[] | undefined): MediaImage[] | undefined {
  const images = artwork
    ?.filter((image) => image.src.trim().length > 0)
    .map((image) => ({
      src: image.src,
      ...(image.sizes ? { sizes: image.sizes } : {}),
      ...(image.type ? { type: image.type } : {})
    }))
  return images && images.length > 0 ? images : undefined
}

/** 把播放器事实状态与意图映射到系统媒体状态。 */
function toMediaPlaybackState(playback: PlaybackSnapshot): MediaSessionPlaybackState {
  if (!playback.track || playback.status === 'idle' || playback.status === 'error') return 'none'
  if (playback.status === 'playing' || playback.intent === 'play') return 'playing'
  return 'paused'
}

/** 读取用于系统媒体位置展示的有效时长。 */
function readDurationMs(playback: PlaybackSnapshot): number | null {
  const durationMs = playback.durationMs ?? playback.track?.durationMs ?? null
  return typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
    ? durationMs
    : null
}

/** 把播放位置裁剪到系统媒体中心可接受的范围。 */
function clampPositionMs(positionMs: number, durationMs: number | null): number {
  const nonNegativePositionMs = Number.isFinite(positionMs) ? Math.max(0, positionMs) : 0
  return durationMs === null
    ? nonNegativePositionMs
    : Math.min(nonNegativePositionMs, durationMs)
}
