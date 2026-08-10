import { StandardEntityPool } from '../domains/music/entity-pool'
import {
  MusicMutationPayloadSchema,
  MusicMutationResultSchema,
  MusicReadPayloadSchema,
  MusicReadResultSchema,
  type MusicMutationResult,
  type MusicReadResult
} from '../shared/schemas/music'
import { NeteaseMusicApiAdapter, type MusicDataSource } from '../infrastructure/netease/music-api-adapter'
import type { CredentialLeaseService } from './credential-lease-service'

// ========= 类 =========

/** Utility 侧 Music Service，统一处理账户感知的只读音乐数据请求。 */
export class MusicService {
  /** 进行中的请求取消控制器。 */
  private readonly pending = new Map<string, AbortController>()

  /** 标准实体池，保证 UI 与 Agent 消费同一归一化实体。 */
  private readonly entityPool = new StandardEntityPool()

  constructor(
    private readonly credentialLease: CredentialLeaseService,
    private readonly dataSource: MusicDataSource = new NeteaseMusicApiAdapter(),
    private readonly appendJournal: ((eventType: string, payload: Record<string, unknown>) => Promise<void>) | undefined = undefined
  ) {}

  /** 执行只读音乐请求。 */
  async read(requestId: string, rawPayload: unknown): Promise<MusicReadResult> {
    const parsed = MusicReadPayloadSchema.safeParse(rawPayload)
    if (!parsed.success) {
      throw Object.assign(
        new Error(`music.read 载荷格式错误：${parsed.error.message}`),
        { code: 'PROTOCOL_INVALID_MESSAGE' }
      )
    }

    const controller = new AbortController()
    this.pending.set(requestId, controller)

    try {
      const cookie = this.credentialLease.hasActiveLease()
        ? await this.credentialLease.executeWithCookie(async (value) => value)
        : ''
      const result = await this.dataSource.read(parsed.data, cookie, controller.signal)
      const normalized = MusicReadResultSchema.parse(result)
      return this.collectAndResolveEntities(normalized)
    } finally {
      this.pending.delete(requestId)
    }
  }

  /** 执行必须登录的音乐写入请求，且不进行透明重试。 */
  async mutate(requestId: string, rawPayload: unknown): Promise<MusicMutationResult> {
    const parsed = MusicMutationPayloadSchema.safeParse(rawPayload)
    if (!parsed.success) {
      throw Object.assign(new Error(`music.mutate 载荷格式错误：${parsed.error.message}`), {
        code: 'PROTOCOL_INVALID_MESSAGE'
      })
    }
    if (!this.credentialLease.hasAuthenticatedLease()) {
      throw Object.assign(new Error('当前操作需要登录网易云账户。'), { code: 'AUTH_REQUIRED' })
    }
    const mutate = this.dataSource.mutate
    if (!mutate) {
      throw Object.assign(new Error('当前 Music Service 数据源不支持写操作。'), {
        code: 'CAPABILITY_UNAVAILABLE'
      })
    }

    const controller = new AbortController()
    this.pending.set(requestId, controller)
    try {
      const result = await this.credentialLease.executeWithCookie((cookie) =>
        mutate.call(this.dataSource, parsed.data, cookie, controller.signal)
      )
      const normalized = MusicMutationResultSchema.parse(result)
      await this.appendJournal?.('music.mutation', {
        operation: normalized.operation,
        ...(normalized.entityId ? { entityId: normalized.entityId } : {})
      }).catch(() => undefined)
      return normalized
    } finally {
      this.pending.delete(requestId)
    }
  }

  /** 取消进行中的只读音乐请求。 */
  cancel(requestId: string): void {
    const controller = this.pending.get(requestId)
    if (!controller) return
    controller.abort()
    this.pending.delete(requestId)
  }

  /** 关闭服务并取消全部进行中请求。 */
  shutdown(): void {
    for (const controller of this.pending.values()) controller.abort()
    this.pending.clear()
  }

  /** 账户切换后清空实体池，保证账户专属实体严格隔离。 */
  resetEntities(): void {
    this.entityPool.clear()
  }

  /** 把响应实体收敛到实体池并从池中返回合并后的标准实体。 */
  private collectAndResolveEntities(result: MusicReadResult): MusicReadResult {
    if (result.kind === 'search') {
      return MusicReadResultSchema.parse({
        ...result,
        songs: result.songs.map((entity) => this.entityPool.upsert(entity)),
        lyrics: result.lyrics.map((entity) => this.entityPool.upsert(entity)),
        artists: result.artists.map((entity) => this.entityPool.upsert(entity)),
        albums: result.albums.map((entity) => this.entityPool.upsert(entity)),
        playlists: result.playlists.map((entity) => this.entityPool.upsert(entity))
      })
    }
    if (result.kind === 'songCollection') {
      return MusicReadResultSchema.parse({
        ...result,
        songs: result.songs.map((entity) => this.entityPool.upsert(entity))
      })
    }
    if (result.kind === 'playlistCollection') {
      return MusicReadResultSchema.parse({
        ...result,
        playlists: result.playlists.map((entity) => this.entityPool.upsert(entity))
      })
    }
    if (result.kind === 'albumCollection') {
      return MusicReadResultSchema.parse({
        ...result,
        albums: result.albums.map((entity) => this.entityPool.upsert(entity))
      })
    }
    if (result.kind === 'artistCollection') {
      return MusicReadResultSchema.parse({
        ...result,
        artists: result.artists.map((entity) => this.entityPool.upsert(entity))
      })
    }
    if (result.kind === 'lyrics' || result.kind === 'commentCollection' || !result.entity) return result
    return MusicReadResultSchema.parse({
      kind: result.kind,
      entity: this.entityPool.upsert(result.entity)
    })
  }
}
