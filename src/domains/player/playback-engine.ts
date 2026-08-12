import type {
  LoadMediaInput,
  MediaElementEvent,
  MediaElementPort,
  PlaybackError,
  PlaybackEvent,
  PlaybackIntent,
  PlaybackSnapshot,
  PlaybackStatus,
  TrackSummary
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** 构造依赖 */
export interface PlaybackEngineOptions {
  /** 初始音量（0~1） */
  initialVolume?: number
  /** 初始静音状态 */
  initialMuted?: boolean
}

/** 各错误码对应的用户提示与可重试性 */
const ERROR_TEXT: Record<PlaybackError['code'], { message: string; retryable: boolean }> = {
  'resolve-failed': { message: '无法获取播放地址。', retryable: true },
  'media-unsupported': { message: '当前格式无法播放。', retryable: false },
  'network-error': { message: '网络中断，播放已停止。', retryable: true },
  'decode-error': { message: '音频解码失败。', retryable: false },
  'source-expired': { message: '播放地址已过期，需要重新获取。', retryable: true },
  'autoplay-blocked': { message: '浏览器阻止了自动播放，请手动开始。', retryable: true },
  aborted: { message: '播放已取消。', retryable: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// PlaybackEngine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 媒体状态单一事实源。
 *
 * 只负责「把指定媒体播好」：不决定下一首，不修改队列，不获取播放 URL。
 * status 表示媒体当前事实，intent 表示用户期望，两者严格分离。
 * 所有异步结果绑定 generation，换代后的迟到事件一律丢弃。
 */
export class PlaybackEngine {
  // ── 变量区 ──

  private status: PlaybackStatus = 'idle'
  private intent: PlaybackIntent = 'pause'
  private track: TrackSummary | null = null

  /** 装载代次；每次 load/stop 递增，用于隔离迟到的媒体事件 */
  private generation = 0

  private positionMs = 0
  private durationMs: number | null = null
  private bufferedMs = 0
  private volume: number
  private muted: boolean
  private seeking = false
  private error: PlaybackError | null = null
  private actualQuality: PlaybackSnapshot['actualQuality'] = null
  private downgraded = false

  /** 当前媒体是否已可播放，决定 play() 是直接调用还是等待 canplay */
  private canPlay = false

  /** 装载后待执行的自动播放意图 */
  private pendingAutoplay = false

  /** 装载时请求的起始位置，canplay 后应用一次 */
  private pendingStartPositionMs = 0

  private readonly listeners = new Set<(event: PlaybackEvent) => void>()
  private readonly unsubscribeMedia: () => void

  constructor(
    private readonly media: MediaElementPort,
    options: PlaybackEngineOptions = {}
  ) {
    this.volume = clamp01(options.initialVolume ?? 1)
    this.muted = options.initialMuted ?? false
    this.media.setVolume(this.volume)
    this.media.setMuted(this.muted)
    this.unsubscribeMedia = this.media.subscribe((event) => this.handleMediaEvent(event))
  }

  // ── 读取区 ──

  getSnapshot(): PlaybackSnapshot {
    return {
      status: this.status,
      intent: this.intent,
      track: this.track,
      generation: this.generation,
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      bufferedMs: this.bufferedMs,
      volume: this.volume,
      muted: this.muted,
      seeking: this.seeking,
      error: this.error,
      actualQuality: this.actualQuality,
      downgraded: this.downgraded
    }
  }

  /** 当前装载代次，供 Coordinator 校验异步结果是否过期 */
  currentGeneration(): number {
    return this.generation
  }

  subscribe(listener: (event: PlaybackEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // ── 命令区 ──

  /**
   * 装载新媒体源。递增 generation，使先前所有异步结果失效。
   *
   * @param input 已解析的媒体源、曲目摘要与自动播放意图
   */
  load(input: LoadMediaInput): void {
    this.generation += 1
    this.canPlay = false
    this.status = 'loading'
    this.intent = input.autoplay ? 'play' : 'pause'
    this.pendingAutoplay = input.autoplay
    this.pendingStartPositionMs = Math.max(0, input.startPositionMs ?? 0)
    this.track = input.track
    this.positionMs = this.pendingStartPositionMs
    this.durationMs = input.track.durationMs
    this.bufferedMs = 0
    this.seeking = false
    this.error = null
    this.actualQuality = input.source.actualQuality
    this.downgraded = input.source.downgraded

    // 换源前先停旧媒体：保证快速连续切歌时不会出现两路音频同时出声。
    // 该保证放在领域层而非适配器，任何 MediaElementPort 实现都能得到它。
    this.media.pause()
    this.media.setSource(input.source.url, this.generation)
    this.emitSnapshot()
  }

  /**
   * 恢复持久化的暂停态。
   *
   * @param track 上次当前队列项的曲目摘要
   * @param positionMs 上次保存的播放位置（毫秒）
   */
  restorePaused(track: TrackSummary, positionMs: number): void {
    this.generation += 1
    this.canPlay = false
    this.status = 'paused'
    this.intent = 'pause'
    this.pendingAutoplay = false
    this.pendingStartPositionMs = Math.max(0, positionMs)
    this.track = track
    this.positionMs = this.pendingStartPositionMs
    this.durationMs = track.durationMs
    this.bufferedMs = 0
    this.seeking = false
    this.error = null
    this.actualQuality = null
    this.downgraded = false

    this.media.pause()
    this.media.clearSource()
    this.emitSnapshot()
  }

  /** 请求播放。媒体尚未 canplay 时只记录意图，等 canplay 后再真正播放。 */
  async play(): Promise<void> {
    if (this.status === 'idle' || !this.track) return

    this.intent = 'play'
    this.error = null

    if (!this.canPlay) {
      this.pendingAutoplay = true
      this.emitSnapshot()
      return
    }

    await this.startMedia(this.generation)
  }

  /** 暂停播放，意图同步改为 pause */
  pause(): void {
    if (this.status === 'idle') return

    this.intent = 'pause'
    this.pendingAutoplay = false
    this.media.pause()
    // 不在此处直接置 paused，等待媒体 pause 事件确认事实
    this.emitSnapshot()
  }

  /** 按当前意图切换播放/暂停 */
  async toggle(): Promise<void> {
    if (this.intent === 'play') {
      this.pause()
      return
    }
    await this.play()
  }

  /** 停止播放并清空媒体源，递增 generation 丢弃所有在途结果 */
  stop(): void {
    this.generation += 1
    this.canPlay = false
    this.pendingAutoplay = false
    this.pendingStartPositionMs = 0
    this.status = 'idle'
    this.intent = 'pause'
    this.track = null
    this.positionMs = 0
    this.durationMs = null
    this.bufferedMs = 0
    this.seeking = false
    this.error = null
    this.actualQuality = null
    this.downgraded = false

    this.media.pause()
    this.media.clearSource()
    this.emitSnapshot()
  }

  /**
   * 跳转到指定位置。
   *
   * @param positionMs 目标位置（毫秒），自动裁剪到 [0, duration]
   */
  seek(positionMs: number): void {
    if (this.status === 'idle' || !this.track) return

    const bounded =
      this.durationMs === null
        ? Math.max(0, positionMs)
        : Math.max(0, Math.min(positionMs, this.durationMs))

    // 同一位置不启动原生 seek；部分媒体实现不会为 no-op 派发 seeked，
    // 若仍把领域状态置为 seeking，后续 timeupdate 会被永久丢弃。
    if (bounded === this.positionMs) return

    this.seeking = true
    this.positionMs = bounded

    if (this.canPlay) {
      this.media.seek(bounded)
    } else {
      // 尚未 canplay：记为起始位置，canplay 后统一应用
      this.pendingStartPositionMs = bounded
    }
    this.emitSnapshot()
  }

  /** 设置持久音量（0~1） */
  setVolume(volume: number): void {
    this.volume = clamp01(volume)
    this.media.setVolume(this.volume)
    this.emitSnapshot()
  }

  /** 设置静音 */
  setMuted(muted: boolean): void {
    this.muted = muted
    this.media.setMuted(muted)
    this.emitSnapshot()
  }

  /**
   * 设置临时输出增益，用于 Alt+Space 聆听阶段 ducking。
   * 不修改持久化的用户音量，也不改变 status/intent。
   *
   * @param gain 有效输出比例（0~1），恢复时传 1
   */
  setDuckGain(gain: number): void {
    this.media.setDuckGain(clamp01(gain))
  }

  /** 报告一次解析失败，使引擎进入 error 状态 */
  reportResolveFailure(generation: number, retryable = true): void {
    if (generation !== this.generation) return

    this.status = 'error'
    this.error = {
      code: 'resolve-failed',
      message: ERROR_TEXT['resolve-failed'].message,
      retryable
    }
    this.emitSnapshot()
    this.emit({ type: 'error', generation: this.generation, error: this.error })
  }

  /** 释放引擎资源，解绑全部监听器 */
  dispose(): void {
    this.unsubscribeMedia()
    this.listeners.clear()
    this.media.pause()
    this.media.clearSource()
  }

  // ── 内部函数区 ──

  /**
   * 真正调用媒体播放，并处理被策略拒绝的情况。
   *
   * @param generation 发起播放时的代次，用于丢弃换代后的结果
   */
  private async startMedia(generation: number): Promise<void> {
    try {
      await this.media.play()
    } catch (error) {
      // 换代后的失败与当前状态无关，直接丢弃
      if (generation !== this.generation) return

      const aborted = error instanceof Error && error.name === 'AbortError'
      const code: PlaybackError['code'] = aborted ? 'aborted' : 'autoplay-blocked'
      this.status = aborted ? this.status : 'paused'
      this.intent = 'pause'
      this.error = {
        code,
        message: ERROR_TEXT[code].message,
        retryable: ERROR_TEXT[code].retryable
      }
      this.emitSnapshot()
      this.emit({ type: 'error', generation, error: this.error })
    }
  }

  /** 处理媒体元素上报的原始事件 */
  private handleMediaEvent(event: MediaElementEvent): void {
    if (
      event.sourceGeneration !== undefined &&
      event.sourceGeneration !== this.generation
    ) return
    switch (event.type) {
      case 'loadedmetadata':
        // API 未提供时长时以媒体元素读数补齐
        if (event.durationMs !== null) this.durationMs = event.durationMs
        this.emitSnapshot()
        return

      case 'canplay': {
        this.canPlay = true

        // 应用装载时请求的起始位置
        if (this.pendingStartPositionMs > 0) {
          this.media.seek(this.pendingStartPositionMs)
          this.pendingStartPositionMs = 0
        }

        if (this.pendingAutoplay && this.intent === 'play') {
          this.pendingAutoplay = false
          void this.startMedia(this.generation)
        } else if (this.status === 'loading') {
          this.status = 'ready'
        }
        this.emitSnapshot()
        return
      }

      case 'playing':
        this.status = 'playing'
        this.error = null
        this.emitSnapshot()
        return

      case 'pause':
        // 播放结束触发的 pause 不应覆盖 idle/error 状态。
        // loading 期间的 pause 是换源副产物（旧媒体被停下），
        // 不能据此把状态打成 paused，否则每次切歌 UI 都会闪一下「已暂停」。
        if (
          this.status !== 'idle' &&
          this.status !== 'error' &&
          this.status !== 'loading'
        ) {
          this.status = 'paused'
        }
        this.emitSnapshot()
        return

      case 'waiting':
      case 'stalled':
        // 仅在播放中转 buffering，避免 ready/paused 被误改
        if (this.status === 'playing') {
          this.status = 'buffering'
          this.emitSnapshot()
        }
        return

      case 'timeupdate':
        // seek 进行中不接受媒体读数，避免进度条回跳
        if (this.seeking) return
        this.positionMs = event.positionMs
        this.bufferedMs = event.bufferedMs
        this.emitSnapshot()
        return

      case 'seeking':
        this.seeking = true
        this.emitSnapshot()
        return

      case 'seeked':
        this.seeking = false
        this.positionMs = event.positionMs
        this.emitSnapshot()
        return

      case 'ended': {
        const endedTrackId = this.track?.trackId
        this.status = 'paused'
        this.positionMs = this.durationMs ?? this.positionMs
        this.emitSnapshot()
        // 交给队列决策下一首，引擎本身不推进
        if (endedTrackId) {
          this.emit({ type: 'ended', generation: this.generation, trackId: endedTrackId })
        }
        return
      }

      case 'error': {
        this.status = 'error'
        this.intent = 'pause'
        this.error = {
          code: event.code,
          message: ERROR_TEXT[event.code].message,
          retryable: ERROR_TEXT[event.code].retryable
        }
        this.emitSnapshot()
        this.emit({ type: 'error', generation: this.generation, error: this.error })
        return
      }
    }
  }

  private emitSnapshot(): void {
    this.emit({ type: 'snapshot', snapshot: this.getSnapshot() })
  }

  private emit(event: PlaybackEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 把数值裁剪到 [0, 1] */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
