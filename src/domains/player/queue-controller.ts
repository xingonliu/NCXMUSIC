import type {
  PlayMode,
  QueueEffect,
  QueueItem,
  QueueSnapshot,
  QueueSource,
  TrackSummary
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** next() 的触发原因，决定 loop-one 的行为差异 */
export type AdvanceReason = 'manual' | 'ended' | 'error-policy'

/** 建立新队列时的上下文 */
export interface PlayContext {
  /** 队列内容，按给定顺序入队 */
  tracks: TrackSummary[]
  /** 队列来源 */
  source: QueueSource
  /** 起始播放项在 tracks 中的下标；越界或省略时从 0 开始 */
  startIndex?: number
}

/** 构造依赖，测试时可注入确定性实现 */
export interface QueueControllerOptions {
  /** 生成队列项 ID */
  createId?: () => string
  /** 返回 [0, 1) 随机数，用于 Fisher–Yates 洗牌 */
  random?: () => number
  /** 当前时间戳 */
  now?: () => number
}

// ─────────────────────────────────────────────────────────────────────────────
// QueueController
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 队列状态机：只决定「播什么」，不获取播放 URL，也不操作媒体元素。
 * 所有方法为纯状态转移 + 返回副作用指令，便于纯函数测试。
 */
export class QueueController {
  // ── 变量区 ──

  /** 唯一一份可见队列；shuffle 后直接覆盖，不保留原顺序 */
  private items: QueueItem[] = []
  private currentItemId: string | null = null
  private mode: PlayMode = 'loop'
  private revision = 0

  /**
   * 本轮内已判定不可播放的队列项。
   * 成功播放或队列结构变更时清空，避免 error-policy 无限循环。
   */
  private readonly failedItemIds = new Set<string>()

  private readonly createId: () => string
  private readonly random: () => number
  private readonly now: () => number

  constructor(options: QueueControllerOptions = {}) {
    this.createId = options.createId ?? ((): string => crypto.randomUUID())
    this.random = options.random ?? Math.random
    this.now = options.now ?? Date.now
  }

  // ── 读取区 ──

  getSnapshot(): QueueSnapshot {
    return {
      items: [...this.items],
      currentItemId: this.currentItemId,
      mode: this.mode,
      revision: this.revision
    }
  }

  /** 当前播放项；队列为空或未选中时为 null */
  getCurrentItem(): QueueItem | null {
    if (!this.currentItemId) return null
    return this.items.find((item) => item.queueItemId === this.currentItemId) ?? null
  }

  /** 把曲目摘要包装为队列项 */
  createItem(track: TrackSummary, source: QueueSource): QueueItem {
    return {
      queueItemId: this.createId(),
      track,
      source,
      addedAt: this.now()
    }
  }

  // ── 队列命令区 ──

  /** 歌单播放：用新内容整体替换队列并从指定项开始播放 */
  replaceAndPlay(context: PlayContext): QueueEffect {
    const items = context.tracks.map((track) => this.createItem(track, context.source))
    this.items = items
    this.failedItemIds.clear()

    const startIndex =
      context.startIndex !== undefined &&
      context.startIndex >= 0 &&
      context.startIndex < items.length
        ? context.startIndex
        : 0
    const target = items[startIndex] ?? null
    this.currentItemId = target?.queueItemId ?? null
    this.revision += 1

    return this.effect(target, target !== null, true)
  }

  /** 单曲点播：插入到当前项之后并立即切换播放，不自动删除既有项 */
  insertAndPlay(item: QueueItem): QueueEffect {
    const currentIndex = this.indexOfCurrent()
    const insertAt = currentIndex === -1 ? this.items.length : currentIndex + 1
    this.items.splice(insertAt, 0, item)
    this.currentItemId = item.queueItemId
    this.failedItemIds.clear()
    this.revision += 1

    return this.effect(item, true, true)
  }

  /** 下一首播放：插入到当前项之后，不改变当前播放 */
  playNext(items: QueueItem[]): QueueEffect {
    if (items.length === 0) return this.effect(null, false, false)

    const currentIndex = this.indexOfCurrent()
    const insertAt = currentIndex === -1 ? this.items.length : currentIndex + 1
    this.items.splice(insertAt, 0, ...items)
    this.revision += 1

    return this.effect(null, false, true)
  }

  /** 追加到队列末尾，不改变当前播放 */
  enqueue(items: QueueItem[]): QueueEffect {
    if (items.length === 0) return this.effect(null, false, false)

    this.items.push(...items)
    this.revision += 1

    return this.effect(null, false, true)
  }

  /**
   * 删除指定队列项。
   * 删除当前项时立即切换到「删除后占据同一位置」的项；删除末项则回到第一项。
   * 该规则优先于 loop-one。
   */
  remove(queueItemId: string): QueueEffect {
    const index = this.items.findIndex((item) => item.queueItemId === queueItemId)
    if (index === -1) return this.effect(null, false, false)

    const wasCurrent = this.currentItemId === queueItemId
    this.items.splice(index, 1)
    this.failedItemIds.delete(queueItemId)
    this.revision += 1

    if (!wasCurrent) return this.effect(null, false, true)

    // 删除的是当前项：占据同一下标的项成为新当前项，越界则回到第一项
    if (this.items.length === 0) {
      this.currentItemId = null
      return this.effect(null, false, true)
    }
    const nextIndex = index < this.items.length ? index : 0
    const target = this.items[nextIndex] ?? null
    this.currentItemId = target?.queueItemId ?? null
    return this.effect(target, target !== null, true)
  }

  /** 移动队列项到新下标 */
  reorder(queueItemId: string, toIndex: number): QueueEffect {
    const from = this.items.findIndex((item) => item.queueItemId === queueItemId)
    if (from === -1) return this.effect(null, false, false)

    const bounded = Math.max(0, Math.min(toIndex, this.items.length - 1))
    if (bounded === from) return this.effect(null, false, false)

    const [moved] = this.items.splice(from, 1)
    if (moved) this.items.splice(bounded, 0, moved)
    this.revision += 1

    return this.effect(null, false, true)
  }

  /** 清空队列并停止播放 */
  clear(): QueueEffect {
    const wasEmpty = this.items.length === 0 && this.currentItemId === null
    this.items = []
    this.currentItemId = null
    this.failedItemIds.clear()
    if (!wasEmpty) this.revision += 1

    return this.effect(null, false, !wasEmpty)
  }

  /**
   * 从持久化快照恢复队列结构。
   *
   * @param snapshot 已校验的队列快照；不包含播放 URL 或凭据
   */
  restore(snapshot: QueueSnapshot): QueueEffect {
    this.items = [...snapshot.items]
    this.mode = snapshot.mode
    this.failedItemIds.clear()

    const restoredCurrent = snapshot.currentItemId
      ? this.items.find((item) => item.queueItemId === snapshot.currentItemId) ?? null
      : null
    const fallbackCurrent = restoredCurrent ?? this.items[0] ?? null
    this.currentItemId = fallbackCurrent?.queueItemId ?? null
    this.revision = Math.max(this.revision + 1, snapshot.revision)

    return this.effect(fallbackCurrent, false, true)
  }

  /**
   * 前进到下一项。
   *
   * - loop：末项回到第一项
   * - loop-one：ended 时重播当前项；manual 时跳到下一项
   * - shuffle：沿可见 items 前进，末项结束后重新洗牌
   */
  next(reason: AdvanceReason): QueueEffect {
    if (this.items.length === 0) {
      this.currentItemId = null
      return this.effect(null, false, false)
    }

    // 单曲循环且由播放结束触发：重播当前项
    if (this.mode === 'loop-one' && reason === 'ended') {
      const current = this.getCurrentItem()
      if (current) return this.effect(current, true, false)
    }

    if (reason === 'error-policy') {
      const current = this.currentItemId
      if (current) this.failedItemIds.add(current)
      // 全部项都已失败：停止，避免无限跳转
      if (this.failedItemIds.size >= this.items.length) {
        return this.effect(null, false, false)
      }
    }

    const currentIndex = this.indexOfCurrent()
    const atLastItem = currentIndex === this.items.length - 1

    // shuffle 到达末项且由播放结束触发：重新洗牌并从新首项开始
    if (this.mode === 'shuffle' && reason === 'ended' && atLastItem) {
      const previousLastId = this.items[this.items.length - 1]?.queueItemId
      this.shuffleItems(previousLastId)
      this.failedItemIds.clear()
      this.revision += 1
      const target = this.items[0] ?? null
      this.currentItemId = target?.queueItemId ?? null
      return this.effect(target, target !== null, true)
    }

    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % this.items.length
    const target = this.pickPlayable(nextIndex, reason)
    this.currentItemId = target?.queueItemId ?? null
    return this.effect(target, target !== null, false)
  }

  /** 上一首：始终切歌，不做「从头重播当前歌曲」的时长判断 */
  previous(): QueueEffect {
    if (this.items.length === 0) {
      this.currentItemId = null
      return this.effect(null, false, false)
    }

    const currentIndex = this.indexOfCurrent()
    const previousIndex =
      currentIndex <= 0 ? this.items.length - 1 : currentIndex - 1
    const target = this.items[previousIndex] ?? null
    this.currentItemId = target?.queueItemId ?? null
    return this.effect(target, target !== null, false)
  }

  /**
   * 设置播放模式。
   * 切入 shuffle 时立即洗牌并从新首项播放；切回 loop 不恢复原顺序。
   */
  setMode(mode: PlayMode): QueueEffect {
    if (mode === this.mode) return this.effect(null, false, false)

    const enteringShuffle = mode === 'shuffle'
    this.mode = mode
    this.revision += 1

    if (!enteringShuffle || this.items.length === 0) {
      return this.effect(null, false, true)
    }

    this.shuffleItems()
    this.failedItemIds.clear()
    const target = this.items[0] ?? null
    this.currentItemId = target?.queueItemId ?? null
    return this.effect(target, target !== null, true)
  }

  /**
   * 直接选中指定队列项作为当前项，不改动队列结构。
   * 用于用户在播放列表中双击某项。
   *
   * @returns 副作用指令；目标不存在时 nextItem 为 null 且 changed 为 false
   */
  selectItem(queueItemId: string): QueueEffect {
    const target = this.items.find((item) => item.queueItemId === queueItemId)
    if (!target) return this.effect(null, false, false)

    this.currentItemId = target.queueItemId
    this.failedItemIds.clear()
    return this.effect(target, true, false)
  }

  /** 标记当前项播放成功，清空失败集合 */
  markPlaybackSucceeded(): void {
    this.failedItemIds.clear()
  }

  // ── 内部函数区 ──

  /** 当前项在 items 中的下标；不存在时为 -1 */
  private indexOfCurrent(): number {
    if (!this.currentItemId) return -1
    return this.items.findIndex((item) => item.queueItemId === this.currentItemId)
  }

  /**
   * 从 startIndex 起找第一个未被判定失败的项。
   * 非 error-policy 场景直接返回 startIndex 对应项。
   */
  private pickPlayable(startIndex: number, reason: AdvanceReason): QueueItem | null {
    if (reason !== 'error-policy') return this.items[startIndex] ?? null

    for (let offset = 0; offset < this.items.length; offset += 1) {
      const index = (startIndex + offset) % this.items.length
      const candidate = this.items[index]
      if (candidate && !this.failedItemIds.has(candidate.queueItemId)) return candidate
    }
    return null
  }

  /**
   * 对 items 执行一次无偏 Fisher–Yates 洗牌。
   *
   * @param avoidFirstId 若洗牌后首项等于该 ID，则与后续随机位置交换，
   *                     避免上一轮末项紧接成为新一轮首项
   */
  private shuffleItems(avoidFirstId?: string): void {
    for (let i = this.items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1))
      const a = this.items[i]
      const b = this.items[j]
      if (a && b) {
        this.items[i] = b
        this.items[j] = a
      }
    }

    if (
      avoidFirstId !== undefined &&
      this.items.length > 1 &&
      this.items[0]?.queueItemId === avoidFirstId
    ) {
      const swapWith = 1 + Math.floor(this.random() * (this.items.length - 1))
      const first = this.items[0]
      const other = this.items[swapWith]
      if (first && other) {
        this.items[0] = other
        this.items[swapWith] = first
      }
    }
  }

  /** 组装副作用指令 */
  private effect(nextItem: QueueItem | null, autoplay: boolean, changed: boolean): QueueEffect {
    return {
      nextItem,
      autoplay,
      changed,
      snapshot: this.getSnapshot()
    }
  }
}
