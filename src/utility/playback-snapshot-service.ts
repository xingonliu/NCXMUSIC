import type { UtilityAccountStore } from '../infrastructure/persistence/account-space'
import {
  PersistedPlaybackSnapshotSchema,
  PlaybackSnapshotLoadPayloadSchema,
  PlaybackSnapshotLoadResultSchema,
  PlaybackSnapshotSavePayloadSchema,
  PlaybackSnapshotSaveResultSchema,
  type PlaybackSnapshotLoadResult,
  type PlaybackSnapshotSaveResult
} from '../shared/schemas/playback-persistence'

// ========= 类型 =========

/** SQLite 播放快照查询行。 */
interface PlaybackSnapshotRow {
  /** JSON 编码后的标准播放快照。 */
  snapshot_json: string
}

// ========= 类 =========

/** Utility 侧账户播放快照服务，所有读写都经过当前账户单写者。 */
export class PlaybackSnapshotService {
  constructor(private readonly accountStore: UtilityAccountStore) {}

  /** 读取当前账户的权威播放快照。 */
  async load(rawPayload: unknown): Promise<PlaybackSnapshotLoadResult> {
    const payload = PlaybackSnapshotLoadPayloadSchema.parse(rawPayload)
    await this.accountStore.settled()
    this.assertCurrentAccount(payload.accountId, payload.accountGeneration)
    return this.accountStore.write((database) => {
      const row = database
        .prepare('SELECT snapshot_json FROM playback_snapshot WHERE account_id = ?')
        .get(payload.accountId) as PlaybackSnapshotRow | undefined
      if (!row) return PlaybackSnapshotLoadResultSchema.parse({ snapshot: null })
      const decoded = JSON.parse(row.snapshot_json) as unknown
      const snapshot = PersistedPlaybackSnapshotSchema.parse(decoded)
      if (snapshot.accountGeneration !== payload.accountGeneration) {
        return PlaybackSnapshotLoadResultSchema.parse({ snapshot: null })
      }
      return PlaybackSnapshotLoadResultSchema.parse({ snapshot })
    })
  }

  /** 保存当前账户播放快照，并拒绝旧 generation 的迟到写入。 */
  async save(rawPayload: unknown): Promise<PlaybackSnapshotSaveResult> {
    const payload = PlaybackSnapshotSavePayloadSchema.parse(rawPayload)
    await this.accountStore.settled()
    this.assertCurrentAccount(payload.snapshot.accountId, payload.snapshot.accountGeneration)
    return this.accountStore.write((database) => {
      database.prepare(`
        INSERT INTO playback_snapshot (account_id, account_generation, saved_at, snapshot_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          account_generation = excluded.account_generation,
          saved_at = excluded.saved_at,
          snapshot_json = excluded.snapshot_json
      `).run(
        payload.snapshot.accountId,
        payload.snapshot.accountGeneration,
        payload.snapshot.savedAt,
        JSON.stringify(payload.snapshot)
      )
      return PlaybackSnapshotSaveResultSchema.parse({ savedAt: payload.snapshot.savedAt })
    })
  }

  /** 校验请求只能访问 Utility 当前打开的账户与 generation。 */
  private assertCurrentAccount(accountId: string, accountGeneration?: number): void {
    if (this.accountStore.current()?.accountId !== accountId) {
      throw Object.assign(new Error('账户已切换，拒绝访问旧账户播放快照。'), {
        code: 'CONNECTION_REPLACED'
      })
    }
    if (
      accountGeneration !== undefined &&
      this.accountStore.currentGeneration() !== accountGeneration
    ) {
      throw Object.assign(new Error('账户 generation 已变化，拒绝迟到播放快照。'), {
        code: 'CONNECTION_REPLACED'
      })
    }
  }
}
