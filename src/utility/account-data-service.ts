import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'

import type { AccountId } from '../shared/schemas/account'
import {
  AccountDataRequestSchema,
  AccountDataResultSchema,
  type AccountDataResult
} from '../shared/schemas/account-data'
import {
  buildActionJournalCleanupSql,
  resolveCacheSpace,
  type UtilityAccountStore
} from '../infrastructure/persistence/account-space'

// ========= 类 =========

/** Utility 单写者账户数据服务，统一处理偏好、Journal、统计与可清理缓存。 */
export class AccountDataService {
  constructor(
    private readonly accountStore: UtilityAccountStore,
    private readonly cacheRoot: string
  ) {
    for (const directory of this.cacheDirectories()) mkdirSync(directory, { recursive: true })
  }

  /** 校验并执行账户数据请求。 */
  async execute(rawPayload: unknown): Promise<AccountDataResult> {
    const request = AccountDataRequestSchema.parse(rawPayload)
    this.assertCurrentAccount(request.accountId, request.accountGeneration)

    if (request.operation === 'getStats') return this.getStats()
    if (request.operation === 'getPreferences') return this.getPreferences()
    if (request.operation === 'setPreference') {
      return this.setPreference(request.key, request.value)
    }
    if (request.operation === 'appendJournal') {
      return this.appendJournal(request.eventType, request.payload)
    }
    if (request.operation === 'clearCache') return this.clearCache()

    await this.accountStore.deleteCurrentData(request.accountId, request.accountGeneration)
    return AccountDataResultSchema.parse({ operation: 'deleteLocalData', deleted: true })
  }

  /** 由可信 Utility 业务服务追加语义事件。 */
  async appendInternal(eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.appendJournal(eventType, payload)
  }

  /** 校验请求仍属于 Utility 当前账户与 generation。 */
  private assertCurrentAccount(accountId: AccountId, accountGeneration: number): void {
    if (
      this.accountStore.current()?.accountId !== accountId
      || this.accountStore.currentGeneration() !== accountGeneration
    ) {
      throw Object.assign(new Error('账户已切换，请刷新后重试。'), { code: 'ACCOUNT_STALE' })
    }
  }

  /** 读取当前账户数据库、缓存与 Journal 统计。 */
  private async getStats(): Promise<AccountDataResult> {
    const account = this.accountStore.current()
    if (!account) throw new Error('账户空间尚未打开。')
    const databaseBytes = existsSync(account.sqlitePath) ? statSync(account.sqlitePath).size : 0
    const cacheBytes = this.cacheDirectories().reduce((total, directory) => total + directoryBytes(directory), 0)
    const statistics = await this.accountStore.write((database) => {
      /** Action Journal 事件数量。 */
      const journal = database.prepare('SELECT COUNT(*) AS count FROM action_journal').get() as { count: number }
      /** 已归档会话块数量。 */
      const memory = database.prepare('SELECT COUNT(*) AS count FROM agent_conversation_blocks').get() as { count: number }
      /** 当前连续会话快照。 */
      const conversation = database.prepare('SELECT snapshot_json FROM agent_conversation_snapshot LIMIT 1').get() as { snapshot_json?: string } | undefined
      /** 当前画像版本。 */
      const profile = database.prepare('SELECT version FROM music_profile_state WHERE singleton_id = 1').get() as { version?: number } | undefined
      /** 当前快照消息数；损坏快照按零统计。 */
      const chatMessages = readConversationMessageCount(conversation?.snapshot_json)
      return {
        journalEvents: Number(journal.count),
        conversationBlocks: Number(memory.count),
        chatMessages,
        profileVersion: Number(profile?.version ?? 0)
      }
    })
    return AccountDataResultSchema.parse({ operation: 'getStats', databaseBytes, cacheBytes, ...statistics })
  }

  /** 读取当前账户所有持久偏好。 */
  private async getPreferences(): Promise<AccountDataResult> {
    const preferences = await this.accountStore.write((database) => {
      const rows = database.prepare('SELECT preference_key, value_json FROM account_preferences').all() as Array<{
        preference_key: string
        value_json: string
      }>
      return Object.fromEntries(rows.map((row) => [row.preference_key, JSON.parse(row.value_json) as unknown]))
    })
    return AccountDataResultSchema.parse({ operation: 'getPreferences', preferences })
  }

  /** 写入单个账户持久偏好。 */
  private async setPreference(key: string, value: unknown): Promise<AccountDataResult> {
    await this.accountStore.write((database) => {
      database.prepare(`
        INSERT INTO account_preferences (preference_key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(preference_key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
      `).run(key, JSON.stringify(value), Date.now())
    })
    return AccountDataResultSchema.parse({ operation: 'setPreference', key })
  }

  /** 追加语义 Action Journal，并立即执行冻结保留策略。 */
  private async appendJournal(eventType: string, payload: Record<string, unknown>): Promise<AccountDataResult> {
    const eventId = await this.accountStore.write((database) => {
      const result = database.prepare(`
        INSERT INTO action_journal (occurred_at, event_type, payload_json)
        VALUES (?, ?, ?)
      `).run(Date.now(), eventType, JSON.stringify(payload))
      for (const sql of buildActionJournalCleanupSql(Date.now())) database.exec(sql)
      return Number(result.lastInsertRowid)
    })
    return AccountDataResultSchema.parse({ operation: 'appendJournal', eventId })
  }

  /** 删除三类可重建缓存目录并返回清理前体积。 */
  private clearCache(): AccountDataResult {
    const directories = this.cacheDirectories()
    const clearedBytes = directories.reduce((total, directory) => total + directoryBytes(directory), 0)
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true })
      mkdirSync(directory, { recursive: true })
    }
    return AccountDataResultSchema.parse({ operation: 'clearCache', clearedBytes })
  }

  /** 返回冻结的三类可重建缓存目录。 */
  private cacheDirectories(): string[] {
    const cache = resolveCacheSpace(this.cacheRoot)
    return [cache.artworkDir, cache.apiDir, cache.mediaTempDir]
  }
}

// ========= 函数 =========

/** 递归统计单个受控缓存目录的字节数。 */
function directoryBytes(directory: string): number {
  if (!existsSync(directory)) return 0
  return readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = `${directory}/${entry.name}`
    return total + (entry.isDirectory() ? directoryBytes(entryPath) : statSync(entryPath).size)
  }, 0)
}

/** 从未信任会话 JSON 读取消息数量，损坏内容按零统计。 */
function readConversationMessageCount(snapshotJson: string | undefined): number {
  try {
    /** 未信任会话 JSON。 */
    const decoded = snapshotJson ? JSON.parse(snapshotJson) as { messages?: unknown } : undefined
    return Array.isArray(decoded?.messages) ? decoded.messages.length : 0
  } catch {
    return 0
  }
}
