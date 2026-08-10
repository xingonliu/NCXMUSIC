import type {
  MusicQualityLevel,
  MusicQualityPreference,
  ResolvedMediaSource
} from '../../shared/schemas/music'

// ─────────────────────────────────────────────────────────────────────────────
// 曲目与媒体源
// ─────────────────────────────────────────────────────────────────────────────

/** UI 与队列使用的曲目摘要，不含任何播放地址或凭据 */
export interface TrackSummary {
  /** 网易云曲目 ID（纯数字字符串） */
  trackId: string
  /** 曲目名 */
  name: string
  /** 演唱者名称，按顺序拼接展示 */
  artists: string[]
  /** 专辑名 */
  album: string
  /** 专辑封面候选图；仅用于 UI / 系统媒体元数据，不含鉴权信息 */
  artwork?: TrackArtwork[] | undefined
  /** 曲目总时长（毫秒）；API 未提供时为 null */
  durationMs: number | null
}

/** 系统媒体中心可消费的封面候选图 */
export interface TrackArtwork {
  /** 图片地址；必须是可由 Renderer 安全展示的公开资源 */
  src: string
  /** 图片尺寸，例如 512x512 */
  sizes?: string | undefined
  /** 图片 MIME 类型，例如 image/jpeg */
  type?: string | undefined
}

/** 引擎装载媒体所需的输入 */
export interface LoadMediaInput {
  /** 已解析的可播放源（短期 HTTPS URL） */
  source: ResolvedMediaSource
  /** 与该源对应的曲目摘要 */
  track: TrackSummary
  /** 装载完成后是否立即播放 */
  autoplay: boolean
  /** 起始播放位置（毫秒），用于启动恢复 */
  startPositionMs?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 播放状态
// ─────────────────────────────────────────────────────────────────────────────

/** 媒体当前事实状态 */
export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error'

/** 用户期望状态，与 status 分离 */
export type PlaybackIntent = 'play' | 'pause'

/** 播放失败信息，message 已脱敏且不含 URL */
export interface PlaybackError {
  /** 稳定的错误分类码 */
  code:
    | 'resolve-failed'
    | 'media-unsupported'
    | 'network-error'
    | 'decode-error'
    | 'source-expired'
    | 'autoplay-blocked'
    | 'aborted'
  /** 面向用户的中文提示 */
  message: string
  /** 是否值得重试（例如重新解析 URL） */
  retryable: boolean
}

/** 播放快照：UI 唯一消费的读模型 */
export interface PlaybackSnapshot {
  status: PlaybackStatus
  intent: PlaybackIntent
  track: TrackSummary | null
  /** 装载代次，用于丢弃迟到的异步结果 */
  generation: number
  positionMs: number
  durationMs: number | null
  bufferedMs: number
  volume: number
  muted: boolean
  seeking: boolean
  error: PlaybackError | null
  /** 当前实际生效的音质；未装载时为 null */
  actualQuality: MusicQualityLevel | null
  /** 是否因权限或可用性发生了音质降级 */
  downgraded: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// 播放事件
// ─────────────────────────────────────────────────────────────────────────────

/** 引擎向上报告的事件；调用方不得用 UI 猜测播放状态 */
export type PlaybackEvent =
  | { type: 'snapshot'; snapshot: PlaybackSnapshot }
  | { type: 'ended'; generation: number; trackId: string }
  | { type: 'error'; generation: number; error: PlaybackError }

// ─────────────────────────────────────────────────────────────────────────────
// 媒体元素端口（Effects 适配器边界）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 引擎通过该端口驱动真实媒体元素。
 * 领域层只依赖此接口，HTMLAudioElement 的实现位于 Renderer。
 */
export interface MediaElementPort {
  /** 设置媒体源地址并触发加载 */
  setSource(url: string, sourceGeneration?: number): void
  /** 清空源并释放底层缓冲 */
  clearSource(): void
  /** 请求播放；被浏览器策略拒绝时 reject */
  play(): Promise<void>
  /** 暂停播放 */
  pause(): void
  /** 跳转到指定位置（毫秒） */
  seek(positionMs: number): void
  /** 设置音量（0~1） */
  setVolume(volume: number): void
  /** 设置静音 */
  setMuted(muted: boolean): void
  /** 设置临时输出增益（0~1），用于 ducking，不影响持久音量 */
  setDuckGain(gain: number): void
  /** 订阅媒体事件，返回取消订阅函数 */
  subscribe(listener: (event: MediaElementEvent) => void): () => void
}

/** 由媒体元素上报的原始事件 */
export type MediaElementEvent = (
  | { type: 'loadedmetadata'; durationMs: number | null }
  | { type: 'canplay' }
  | { type: 'playing' }
  | { type: 'pause' }
  | { type: 'waiting' }
  | { type: 'stalled' }
  | { type: 'timeupdate'; positionMs: number; bufferedMs: number }
  | { type: 'seeking' }
  | { type: 'seeked'; positionMs: number }
  | { type: 'ended' }
  | { type: 'error'; code: PlaybackError['code'] }
) & {
  /** 产生事件的媒体 source generation；生产适配器始终提供。 */
  sourceGeneration?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 队列
// ─────────────────────────────────────────────────────────────────────────────

/** 队列项的来源，用于 Action Journal 与 UI 展示 */
export type QueueSource =
  | { kind: 'search' }
  | { kind: 'discover' }
  | { kind: 'liked' }
  | { kind: 'artist'; artistId: string }
  | { kind: 'playlist'; playlistId: string }
  | { kind: 'album'; albumId: string }
  | { kind: 'agent' }
  | { kind: 'resume' }

/** 队列中的一项；同一曲目可重复入队，靠 queueItemId 区分 */
export interface QueueItem {
  /** 队列项唯一 ID，与 trackId 不同 */
  queueItemId: string
  track: TrackSummary
  source: QueueSource
  /** 入队时间戳（毫秒） */
  addedAt: number
}

/** 播放模式 */
export type PlayMode = 'loop' | 'loop-one' | 'shuffle'

/** 队列读模型 */
export interface QueueSnapshot {
  items: QueueItem[]
  currentItemId: string | null
  mode: PlayMode
  /** 队列修订号，每次变更递增，用于 expectedRevision 幂等校验 */
  revision: number
}

/** 队列命令产生的副作用指令，由 Coordinator 执行 */
export interface QueueEffect {
  /** 需要切换到的队列项；null 表示应停止播放 */
  nextItem: QueueItem | null
  /** 切换后是否应自动播放 */
  autoplay: boolean
  /** 队列是否发生了变化 */
  changed: boolean
  /** 变更后的队列快照 */
  snapshot: QueueSnapshot
}

// ─────────────────────────────────────────────────────────────────────────────
// 曲目解析
// ─────────────────────────────────────────────────────────────────────────────

/** 播放地址解析器；Renderer 实现走 IPC，测试可注入假实现 */
export interface TrackResolver {
  /**
   * 解析指定曲目的可播放源。
   *
   * @param trackId 曲目 ID
   * @param quality 音质偏好
   * @param signal  取消信号；中止时应 reject AbortError
   */
  resolve(
    trackId: string,
    quality: MusicQualityPreference,
    signal: AbortSignal
  ): Promise<ResolvedMediaSource>
}

export type { MusicQualityLevel, MusicQualityPreference, ResolvedMediaSource }
