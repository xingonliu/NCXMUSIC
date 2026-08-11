import type { UtilityAccountStore } from '../infrastructure/persistence/account-space'
import {
  PersistedAgentConversationSchema,
  type PersistedAgentConversation
} from '../shared/schemas/agent-persistence'

// ========= 类型 =========

/** SQLite 当前会话快照查询行。 */
interface AgentConversationRow {
  /** JSON 编码后的标准连续会话。 */
  snapshot_json: string
}

// ========= 类 =========

/** Utility 侧当前连续会话服务；每次语义变化增量覆盖，分块前也不会丢记录。 */
export class AgentConversationService {
  constructor(private readonly accountStore: UtilityAccountStore) {}

  /** 读取当前账户最近一次完整连续会话。 */
  async load(): Promise<PersistedAgentConversation | undefined> {
    await this.accountStore.settled()
    /** 当前账户 ID。 */
    const accountId = this.accountStore.current()?.accountId
    if (!accountId) return undefined
    return this.accountStore.write((database, account) => {
      if (account.accountId !== accountId) return undefined
      /** 当前账户会话行。 */
      const row = database
        .prepare('SELECT snapshot_json FROM agent_conversation_snapshot WHERE account_id = ?')
        .get(accountId) as AgentConversationRow | undefined
      if (!row) return undefined
      /** 未信任磁盘 JSON。 */
      const decoded = JSON.parse(row.snapshot_json) as unknown
      return PersistedAgentConversationSchema.parse(decoded)
    })
  }

  /** 原子覆盖当前账户连续会话，并拒绝账户切换后的迟到写入。 */
  async save(rawSnapshot: PersistedAgentConversation): Promise<void> {
    /** 经共享 Schema 校验的会话快照。 */
    const snapshot = PersistedAgentConversationSchema.parse(rawSnapshot)
    await this.accountStore.settled()
    /** 发起保存时的账户 ID。 */
    const accountId = this.accountStore.current()?.accountId
    if (!accountId) return
    await this.accountStore.write((database, account) => {
      if (account.accountId !== accountId) return
      database.prepare(`
        INSERT INTO agent_conversation_snapshot (account_id, saved_at, snapshot_json)
        VALUES (?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          saved_at = excluded.saved_at,
          snapshot_json = excluded.snapshot_json
      `).run(accountId, snapshot.savedAt, JSON.stringify(snapshot))
    })
  }
}
