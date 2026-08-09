import type { PlaybackEngine } from './playback-engine'
import type { AdvanceReason, PlayContext, QueueController } from './queue-controller'
import type {
  MusicQualityPreference,
  PlaybackEvent,
  PlaybackSnapshot,
  QueueEffect,
  QueueItem,
  QueueSnapshot,
  QueueSource,
  PlayMode,
  TrackResolver,
  TrackSummary
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** Coordinator 对外暴露的合并读模型 */
export interface PlayerSnapshot {
  playback: PlaybackSnapshot
  queue: QueueSnapshot
  /** 当前音质偏好 */
  quality: MusicQualityPreference
}

/** Coordinator 事件 */
export type PlayerEvent =
  | { type: 'snapshot'; snapshot: PlayerSnapshot }
  /** 曲目不可播放，UI 应给出轻量提示 */
  | { type: 'track-unplayable'; trackId: string; message: string }

export interface PlaybackCoordinatorOptions {
  /** 初始音质偏好 */
  quality?: MusicQualityPreference
}

/** 持久化恢复所需的最小播放器快照。 */
export interface RestoredPlayerState {
  /** 已持久化的队列快照。 */
  queue: QueueSnapshot
  /** 上次音质偏好。 */
  quality: MusicQualityPreference
  /** 上次播放位置（毫秒）。 */
  positionMs: number
  /** 上次音量（0~1）。 */
  volume: number
  /** 上次静音状态。 */
  muted: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// PlaybackCoordinator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 编排「选择队列项 → 解析可播放源 → 装载 → 按意图播放」。
 *
 * 持有解析取消句柄；所有异步解析结果都用 engine 的 generation 校验，
 * 换代后的结果一律丢弃，防止旧歌复活。
 */
export class PlaybackCoordinator {
  // ── 变量区 ──

  /** 当前进行中的解析取消句柄 */
  private activeResolve: AbortController | undefined

  /** 发起当前解析时的引擎代次 */
  private activeResolveGeneration = -1

  private quality: MusicQualityPreference

  private readonly listeners = new Set<(event: PlayerEvent) => void>()
  private readonly unsubscribeEngine: () => void

  constructor(
    private readonly queue: QueueController,
    private readonly engine: PlaybackEngine,
    private readonly resolver: TrackResolver,
    options: PlaybackCoordinatorOptions = {}
  ) {
    this.quality = options.quality ?? 'auto'
    this.unsubscribeEngine = this.engine.subscribe((event) => this.handleEngineEvent(event))
  }

  // ── 读取区 ──

  getSnapshot(): PlayerSnapshot {
    return {
      playback: this.engine.getSnapshot(),
      queue: this.queue.getSnapshot(),
      quality: this.quality
    }
  }

  subscribe(listener: (event: PlayerEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // ── 播放命令区 ──

  /** 歌单播放：用新内容替换队列并开始播放 */
  async playContext(context: PlayContext): Promise<void> {
    await this.applyEffect(this.queue.replaceAndPlay(context))
  }

  /** 单曲点播：插入当前项之后并立即播放 */
  async playTrack(track: TrackSummary, source: QueueSource): Promise<void> {
    const item = this.queue.createItem(track, source)
    await this.applyEffect(this.queue.insertAndPlay(item))
  }

  /** 切换到指定队列项 */
  async playQueueItem(queueItemId: string): Promise<void> {
    // 由队列负责更新 currentItemId，避免队列与引擎当前项不一致
    await this.applyEffect(this.queue.selectItem(queueItemId))
  }

  /** 播放/暂停切换 */
  async toggle(): Promise<void> {
    const playback = this.engine.getSnapshot()
    if (playback.intent === 'play') {
      this.pause()
      return
    }
    await this.play()
  }

  /** 恢复播放 */
  async play(): Promise<void> {
    const current = this.queue.getCurrentItem()
    const playback = this.engine.getSnapshot()
    if (current && this.shouldResolveRestoredSource(current, playback)) {
      await this.switchTo(current, true, playback.positionMs)
      this.emitSnapshot()
      return
    }

    await this.engine.play()
  }

  /** 暂停播放 */
  pause(): void {
    this.engine.pause()
  }

  /** 下一首（手动） */
  async next(): Promise<void> {
    await this.applyEffect(this.queue.next('manual'))
  }

  /** 上一首 */
  async previous(): Promise<void> {
    await this.applyEffect(this.queue.previous())
  }

  /** 跳转播放位置 */
  seek(positionMs: number): void {
    this.engine.seek(positionMs)
  }

  /** 设置音量 */
  setVolume(volume: number): void {
    this.engine.setVolume(volume)
  }

  /** 设置静音 */
  setMuted(muted: boolean): void {
    this.engine.setMuted(muted)
  }

  /** 设置播放模式 */
  async setMode(mode: PlayMode): Promise<void> {
    await this.applyEffect(this.queue.setMode(mode))
  }

  // ── 队列命令区 ──

  /** 下一首播放 */
  playNext(tracks: TrackSummary[], source: QueueSource): void {
    const items = tracks.map((track) => this.queue.createItem(track, source))
    this.emitQueueEffect(this.queue.playNext(items))
  }

  /** 追加到队列末尾 */
  enqueue(tracks: TrackSummary[], source: QueueSource): void {
    const items = tracks.map((track) => this.queue.createItem(track, source))
    this.emitQueueEffect(this.queue.enqueue(items))
  }

  /** 从队列移除指定项 */
  async remove(queueItemId: string): Promise<void> {
    await this.applyEffect(this.queue.remove(queueItemId))
  }

  /** 移动队列项 */
  reorder(queueItemId: string, toIndex: number): void {
    this.emitQueueEffect(this.queue.reorder(queueItemId, toIndex))
  }

  /** 清空队列并停止播放 */
  async clear(): Promise<void> {
    await this.applyEffect(this.queue.clear())
  }

  /** 恢复持久化的播放器状态，只恢复到暂停态。 */
  restorePausedState(state: RestoredPlayerState): void {
    this.abortActiveResolve()
    this.quality = state.quality
    this.engine.setVolume(state.volume)
    this.engine.setMuted(state.muted)
    this.queue.restore(state.queue)

    const current = this.queue.getCurrentItem()
    if (current) {
      this.engine.restorePaused(current.track, state.positionMs)
    } else {
      this.engine.stop()
    }
    this.emitSnapshot()
  }

  // ── 音质区 ──

  /**
   * 变更音质偏好。
   *
   * 播放中变更时：新源就绪前保持旧媒体源工作，
   * 新源就绪且仍指向同一队列项时才换代 load，仅在 intent='play' 时恢复播放。
   */
  async setQuality(quality: MusicQualityPreference): Promise<void> {
    if (quality === this.quality) return
    this.quality = quality

    const current = this.queue.getCurrentItem()
    const playback = this.engine.getSnapshot()
    if (!current || playback.status === 'idle') {
      this.emitSnapshot()
      return
    }

    // 保留当前播放位置与意图，用新音质重新装载
    const resumeAt = playback.positionMs
    const shouldResume = playback.intent === 'play'
    await this.switchTo(current, shouldResume, resumeAt)
    this.emitSnapshot()
  }

  // ── 生命周期区 ──

  /** 释放资源：取消在途解析并解绑监听器 */
  dispose(): void {
    this.abortActiveResolve()
    this.unsubscribeEngine()
    this.listeners.clear()
  }

  // ── 内部函数区 ──

  /**
   * 执行队列副作用：切歌或停止。
   *
   * 只有队列明确失去当前项（清空、删除末项、全部不可播放）才停止媒体；
   * 单纯的结构变更（如切换播放模式、删除非当前项）不得打断正在播放的曲目。
   */
  private async applyEffect(effect: QueueEffect): Promise<void> {
    if (effect.nextItem) {
      await this.switchTo(effect.nextItem, effect.autoplay)
    } else if (effect.snapshot.currentItemId === null) {
      this.abortActiveResolve()
      this.engine.stop()
    }
    this.emitSnapshot()
  }

  /** 仅队列结构变化、不涉及切歌时只广播快照 */
  private emitQueueEffect(effect: QueueEffect): void {
    if (effect.changed) this.emitSnapshot()
  }

  /**
   * 切换到指定队列项：取消旧解析 → 换代 → 解析 → 校验代次 → 装载。
   *
   * @param item          目标队列项
   * @param autoplay      装载后是否自动播放
   * @param startPositionMs 起始播放位置，用于音质切换保位
   */
  private async switchTo(
    item: QueueItem,
    autoplay: boolean,
    startPositionMs = 0
  ): Promise<void> {
    // 取消上一次解析，避免旧结果覆盖新装载
    this.abortActiveResolve()

    const controller = new AbortController()
    this.activeResolve = controller

    // 递增代次：此刻之后所有旧的媒体事件与解析结果都失效
    const generation = this.engine.currentGeneration() + 1
    this.activeResolveGeneration = generation

    try {
      const source = await this.resolver.resolve(item.track.trackId, this.quality, controller.signal)

      // 代次校验：期间又发生了切歌，丢弃本次结果
      if (this.activeResolveGeneration !== generation) return

      this.engine.load({
        source,
        track: item.track,
        autoplay,
        ...(startPositionMs > 0 ? { startPositionMs } : {})
      })
      this.queue.markPlaybackSucceeded()
    } catch (error) {
      if (this.activeResolveGeneration !== generation) return
      if (error instanceof Error && error.name === 'AbortError') return

      // 解析失败：轻量提示 + 按错误策略跳到下一首
      this.emit({
        type: 'track-unplayable',
        trackId: item.track.trackId,
        message: `《${item.track.name}》当前无法播放，已自动跳过。`
      })
      await this.applyEffect(this.queue.next('error-policy'))
    } finally {
      if (this.activeResolve === controller) this.activeResolve = undefined
    }
  }

  /**
   * 判断当前引擎状态是否为“恢复占位源”。
   *
   * @param item 队列当前项
   * @param playback 引擎播放快照
   */
  private shouldResolveRestoredSource(item: QueueItem, playback: PlaybackSnapshot): boolean {
    return (
      playback.status === 'paused' &&
      playback.actualQuality === null &&
      playback.track?.trackId === item.track.trackId
    )
  }

  /** 取消进行中的解析 */
  private abortActiveResolve(): void {
    this.activeResolve?.abort()
    this.activeResolve = undefined
  }

  /** 处理引擎事件：ended 交给队列决策，error 按策略跳过 */
  private handleEngineEvent(event: PlaybackEvent): void {
    if (event.type === 'snapshot') {
      this.emitSnapshot()
      return
    }

    if (event.type === 'ended') {
      // 迟到的 ended 不推进队列
      if (event.generation !== this.engine.currentGeneration()) return
      void this.applyEffect(this.queue.next('ended'))
      return
    }

    // 播放错误：可重试的交给上层决定，不可播放的按错误策略跳过
    if (event.generation !== this.engine.currentGeneration()) return
    if (event.error.code === 'autoplay-blocked' || event.error.code === 'aborted') return

    const current = this.queue.getCurrentItem()
    if (current) {
      this.emit({
        type: 'track-unplayable',
        trackId: current.track.trackId,
        message: `《${current.track.name}》播放失败，已自动跳过。`
      })
    }
    void this.applyEffect(this.queue.next('error-policy'))
  }

  private emitSnapshot(): void {
    this.emit({ type: 'snapshot', snapshot: this.getSnapshot() })
  }

  private emit(event: PlayerEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

export type { AdvanceReason, PlayContext }
