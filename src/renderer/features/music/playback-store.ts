import { z } from 'zod'

import type { PlayerSnapshot, RestoredPlayerState } from '../../../domains/player/playback-coordinator'
import { MusicQualityPreferenceSchema } from '../../../shared/schemas/music'

// ========= 类型 =========

/** 播放快照归属的账户上下文。 */
export interface PlaybackStoreAccountContext {
  /** 当前公开账户引用，不包含 Cookie 或本地路径。 */
  accountId: string
  /** 当前账户 generation，用于换号后丢弃旧快照。 */
  accountGeneration: number
}

/** 播放快照存储可配置依赖。 */
export interface PlaybackStoreOptions {
  /** 浏览器存储对象，测试可注入内存实现。 */
  storage?: Storage
  /** 当前时间函数，测试可注入确定性时钟。 */
  now?: () => number
  /** 防抖写入延迟。 */
  debounceMs?: number
}

// ========= 变量 =========

/** 播放快照存储键。 */
const PLAYBACK_STORE_KEY = 'ncxmusic.playback.snapshot.v1'

/** 语义变化写入防抖。 */
const DEFAULT_DEBOUNCE_MS = 250

/** 播放进度节流写入窗口。 */
const PROGRESS_THROTTLE_MS = 5_000

/** 队列来源持久化 Schema。 */
const PersistedQueueSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('search') }),
  z.strictObject({ kind: z.literal('playlist'), playlistId: z.string().min(1) }),
  z.strictObject({ kind: z.literal('album'), albumId: z.string().min(1) }),
  z.strictObject({ kind: z.literal('agent') }),
  z.strictObject({ kind: z.literal('resume') })
])

/** 曲目封面持久化 Schema。 */
const PersistedTrackArtworkSchema = z.strictObject({
  src: z.string().url(),
  sizes: z.string().optional(),
  type: z.string().optional()
})

/** 曲目摘要持久化 Schema。 */
const PersistedTrackSummarySchema = z.strictObject({
  trackId: z.string().regex(/^\d{1,20}$/u),
  name: z.string().min(1).max(200),
  artists: z.array(z.string().min(1).max(160)).default([]),
  album: z.string().max(200),
  artwork: z.array(PersistedTrackArtworkSchema).optional(),
  durationMs: z.number().int().nonnegative().nullable()
})

/** 队列项持久化 Schema。 */
const PersistedQueueItemSchema = z.strictObject({
  queueItemId: z.string().min(1),
  track: PersistedTrackSummarySchema,
  source: PersistedQueueSourceSchema,
  addedAt: z.number().int().nonnegative()
})

/** 队列快照持久化 Schema。 */
const PersistedQueueSnapshotSchema = z.strictObject({
  items: z.array(PersistedQueueItemSchema).default([]),
  currentItemId: z.string().min(1).nullable(),
  mode: z.enum(['loop', 'loop-one', 'shuffle']),
  revision: z.number().int().nonnegative()
})

/** 播放器持久化快照 Schema。 */
const PersistedPlaybackSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  accountId: z.string().min(1),
  accountGeneration: z.number().int().nonnegative(),
  savedAt: z.number().int().nonnegative(),
  queue: PersistedQueueSnapshotSchema,
  quality: MusicQualityPreferenceSchema,
  positionMs: z.number().int().nonnegative(),
  volume: z.number().min(0).max(1),
  muted: z.boolean()
})

/** 播放器持久化快照类型。 */
type PersistedPlaybackSnapshot = z.infer<typeof PersistedPlaybackSnapshotSchema>

// ========= 函数 =========

/**
 * 从播放器快照生成语义签名。
 *
 * @param snapshot 当前播放器快照
 */
function semanticSignature(snapshot: PlayerSnapshot): string {
  return JSON.stringify({
    queueRevision: snapshot.queue.revision,
    currentItemId: snapshot.queue.currentItemId,
    mode: snapshot.queue.mode,
    status: snapshot.playback.status,
    intent: snapshot.playback.intent,
    trackId: snapshot.playback.track?.trackId ?? null,
    volume: snapshot.playback.volume,
    muted: snapshot.playback.muted,
    seeking: snapshot.playback.seeking,
    quality: snapshot.quality
  })
}

/**
 * 判断当前快照是否值得按进度节流写入。
 *
 * @param snapshot 当前播放器快照
 */
function hasPositionToPersist(snapshot: PlayerSnapshot): boolean {
  return snapshot.playback.track !== null && snapshot.playback.positionMs >= 0
}

/**
 * 把运行时快照压缩为可持久化对象。
 *
 * @param snapshot 当前播放器快照
 * @param account 当前账户上下文
 * @param savedAt 保存时间戳
 */
function toPersistedSnapshot(
  snapshot: PlayerSnapshot,
  account: PlaybackStoreAccountContext,
  savedAt: number
): PersistedPlaybackSnapshot {
  return {
    schemaVersion: 1,
    accountId: account.accountId,
    accountGeneration: account.accountGeneration,
    savedAt,
    queue: snapshot.queue,
    quality: snapshot.quality,
    positionMs: Math.max(0, Math.floor(snapshot.playback.positionMs)),
    volume: snapshot.playback.volume,
    muted: snapshot.playback.muted
  }
}

// ========= 类 =========

/** Renderer 侧播放快照存储。 */
export class PlaybackStore {
  /** 实际使用的存储对象。 */
  private readonly storage: Storage | undefined

  /** 当前时间函数。 */
  private readonly now: () => number

  /** 防抖写入延迟。 */
  private readonly debounceMs: number

  /** 待写入计时器。 */
  private pendingTimer: ReturnType<typeof setTimeout> | undefined

  /** 上一次语义签名。 */
  private lastSignature = ''

  /** 上一次进度写入时间。 */
  private lastProgressWriteAt = 0

  /** 上一次待写入快照。 */
  private pendingSnapshot: PlayerSnapshot | undefined

  /** 上一次待写入账户上下文。 */
  private pendingAccount: PlaybackStoreAccountContext | undefined

  constructor(options: PlaybackStoreOptions = {}) {
    this.storage = options.storage ?? globalThis.localStorage
    this.now = options.now ?? Date.now
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  }

  /**
   * 读取指定账户的暂停恢复快照。
   *
   * @param account 当前账户上下文
   */
  load(account: PlaybackStoreAccountContext): RestoredPlayerState | null {
    if (!this.storage) return null
    const raw = this.storage.getItem(PLAYBACK_STORE_KEY)
    if (!raw) return null

    /** 本地存储反序列化后的未知数据。 */
    let decoded: unknown
    try {
      decoded = JSON.parse(raw) as unknown
    } catch {
      return null
    }

    const parsed = PersistedPlaybackSnapshotSchema.safeParse(decoded)
    if (!parsed.success) return null
    if (
      parsed.data.accountId !== account.accountId ||
      parsed.data.accountGeneration !== account.accountGeneration
    ) {
      return null
    }

    return {
      queue: parsed.data.queue,
      quality: parsed.data.quality,
      positionMs: parsed.data.positionMs,
      volume: parsed.data.volume,
      muted: parsed.data.muted
    }
  }

  /**
   * 按语义变化防抖、按播放进度节流写入快照。
   *
   * @param snapshot 当前播放器快照
   * @param account 当前账户上下文；缺失时跳过写入
   */
  schedule(snapshot: PlayerSnapshot, account: PlaybackStoreAccountContext | undefined): void {
    if (!account || !this.storage) return

    const nextSignature = semanticSignature(snapshot)
    const signatureChanged = nextSignature !== this.lastSignature
    const progressDue =
      hasPositionToPersist(snapshot) &&
      this.now() - this.lastProgressWriteAt >= PROGRESS_THROTTLE_MS

    if (!signatureChanged && !progressDue) return

    this.lastSignature = nextSignature
    this.pendingSnapshot = snapshot
    this.pendingAccount = account

    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = setTimeout(() => {
      this.flushPending()
    }, signatureChanged ? this.debounceMs : 0)
  }

  /**
   * 立即写入给定快照。
   *
   * @param snapshot 当前播放器快照
   * @param account 当前账户上下文；缺失时跳过写入
   */
  flush(snapshot: PlayerSnapshot, account: PlaybackStoreAccountContext | undefined): void {
    if (!account || !this.storage) return
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = undefined
    this.write(snapshot, account)
  }

  /** 清理防抖计时器。 */
  dispose(): void {
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = undefined
  }

  /** 写入防抖队列中最新的快照。 */
  private flushPending(): void {
    this.pendingTimer = undefined
    if (!this.pendingSnapshot || !this.pendingAccount) return
    this.write(this.pendingSnapshot, this.pendingAccount)
  }

  /**
   * 写入快照到本地存储。
   *
   * @param snapshot 当前播放器快照
   * @param account 当前账户上下文
   */
  private write(snapshot: PlayerSnapshot, account: PlaybackStoreAccountContext): void {
    if (!this.storage) return
    const savedAt = this.now()
    const data = PersistedPlaybackSnapshotSchema.parse(
      toPersistedSnapshot(snapshot, account, savedAt)
    )
    this.storage.setItem(PLAYBACK_STORE_KEY, JSON.stringify(data))
    this.lastProgressWriteAt = savedAt
  }
}
