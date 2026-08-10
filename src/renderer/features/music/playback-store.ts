import type { PlayerSnapshot, RestoredPlayerState } from '../../../domains/player/playback-coordinator'
import type { AccountId } from '../../../shared/schemas/account'
import {
  PersistedPlaybackSnapshotSchema,
  type PersistedPlaybackSnapshot
} from '../../../shared/schemas/playback-persistence'

// ========= 类型 =========

/** 播放快照归属的账户上下文。 */
export interface PlaybackStoreAccountContext {
  /** 当前公开账户引用，不包含 Cookie 或本地路径。 */
  accountId: AccountId
  /** 当前账户 generation，用于换号后丢弃旧快照。 */
  accountGeneration: number
}

/** 播放快照存储可配置依赖。 */
export interface PlaybackStoreOptions {
  /** Utility SQLite 持久化端口；生产环境必须注入。 */
  persistence?: PlaybackSnapshotPersistence
  /** 浏览器存储对象，测试可注入内存实现。 */
  storage?: Storage
  /** 当前时间函数，测试可注入确定性时钟。 */
  now?: () => number
  /** 防抖写入延迟。 */
  debounceMs?: number
}

/** Renderer 使用的账户播放快照持久化端口。 */
export interface PlaybackSnapshotPersistence {
  /** 从 Utility SQLite 读取指定账户快照。 */
  load(account: PlaybackStoreAccountContext): Promise<PersistedPlaybackSnapshot | null>
  /** 通过 Utility 单写者保存指定账户快照。 */
  save(snapshot: PersistedPlaybackSnapshot): Promise<void>
}

// ========= 变量 =========

/** 旧版全账户共用的播放快照键，仅用于一次性兼容迁移。 */
const LEGACY_PLAYBACK_STORE_KEY = 'ncxmusic.playback.snapshot.v1'

/** 按账户隔离的播放快照键前缀。 */
const PLAYBACK_STORE_KEY_PREFIX = 'ncxmusic.playback.account.v1'

/** 语义变化写入防抖。 */
const DEFAULT_DEBOUNCE_MS = 250

/** 播放进度节流写入窗口。 */
const PROGRESS_THROTTLE_MS = 5_000

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

/** 为指定账户与登录 generation 生成独立播放快照键。 */
function playbackStoreKey(account: PlaybackStoreAccountContext): string {
  return `${PLAYBACK_STORE_KEY_PREFIX}.${encodeURIComponent(account.accountId)}.${account.accountGeneration}`
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
  /** Utility SQLite 持久化端口。 */
  private readonly persistence: PlaybackSnapshotPersistence | undefined

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

  /** 上一次调度写入的账户键，用于切换账户后重置防抖状态。 */
  private lastAccountKey = ''

  /** 上一次待写入快照。 */
  private pendingSnapshot: PlayerSnapshot | undefined

  /** 上一次待写入账户上下文。 */
  private pendingAccount: PlaybackStoreAccountContext | undefined

  /** Utility 持久化写入尾部，用于串行化快照并吸收瞬时错误。 */
  private persistenceTail: Promise<void> = Promise.resolve()

  constructor(options: PlaybackStoreOptions = {}) {
    this.persistence = options.persistence
    this.storage = options.storage
    this.now = options.now ?? Date.now
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  }

  /**
   * 读取指定账户的暂停恢复快照。
   *
   * @param account 当前账户上下文
   */
  async load(account: PlaybackStoreAccountContext): Promise<RestoredPlayerState | null> {
    if (this.persistence) {
      const snapshot = await this.persistence.load(account)
      return snapshot ? this.toRestoredState(snapshot) : null
    }
    if (!this.storage) return null
    const accountKey = playbackStoreKey(account)
    const raw = this.storage.getItem(accountKey) ?? this.storage.getItem(LEGACY_PLAYBACK_STORE_KEY)
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
    if (parsed.data.accountId !== account.accountId) return null
    if (parsed.data.accountGeneration !== account.accountGeneration) return null
    if (!this.storage.getItem(accountKey)) {
      this.storage.setItem(accountKey, raw)
      this.storage.removeItem(LEGACY_PLAYBACK_STORE_KEY)
    }

    return this.toRestoredState(parsed.data)
  }

  /**
   * 按语义变化防抖、按播放进度节流写入快照。
   *
   * @param snapshot 当前播放器快照
   * @param account 当前账户上下文；缺失时跳过写入
   */
  schedule(snapshot: PlayerSnapshot, account: PlaybackStoreAccountContext | undefined): void {
    if (!account || (!this.persistence && !this.storage)) return

    const accountKey = playbackStoreKey(account)
    if (accountKey !== this.lastAccountKey) {
      this.lastAccountKey = accountKey
      this.lastSignature = ''
      this.lastProgressWriteAt = 0
    }
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
    if (!account || (!this.persistence && !this.storage)) return
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = undefined
    this.write(snapshot, account)
  }

  /** 清理防抖计时器。 */
  dispose(): void {
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = undefined
  }

  /** 等待已提交给 Utility 的播放快照写入完成。 */
  async settled(): Promise<void> {
    await this.persistenceTail
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
    if (!this.persistence && !this.storage) return
    const savedAt = this.now()
    const data = PersistedPlaybackSnapshotSchema.parse(
      toPersistedSnapshot(snapshot, account, savedAt)
    )
    if (this.persistence) {
      const save = this.persistenceTail.then(() => this.persistence?.save(data))
      this.persistenceTail = save.then(() => undefined, () => undefined)
    } else {
      this.storage?.setItem(playbackStoreKey(account), JSON.stringify(data))
    }
    this.lastProgressWriteAt = savedAt
  }

  /** 把已校验的持久化快照转换为播放器恢复状态。 */
  private toRestoredState(snapshot: PersistedPlaybackSnapshot): RestoredPlayerState {
    return {
      queue: snapshot.queue,
      quality: snapshot.quality,
      positionMs: snapshot.positionMs,
      volume: snapshot.volume,
      muted: snapshot.muted
    }
  }
}
