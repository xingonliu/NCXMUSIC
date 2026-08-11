import { closeSync, fsyncSync, openSync, renameSync, writeFileSync } from 'node:fs'

import type { UtilityAccountStore } from '../infrastructure/persistence/account-space'
import type { AgentMessage } from '../shared/schemas/agent'
import {
  MemorySearchHitSchema,
  MemoryStatusSchema,
  WorkingMemorySnapshotSchema,
  type MemorySearchHit,
  type MemoryStatus,
  type WorkingMemorySnapshot
} from '../shared/schemas/personalization'

// ========= 类型 =========

/** 会话块数据库查询行。 */
interface ConversationBlockRow {
  /** 会话块自增 ID。 */
  id: number
  /** 块摘要。 */
  summary: string
  /** 可检索正文。 */
  content_text: string
  /** 块开始时间。 */
  started_at: number
  /** 块结束时间。 */
  ended_at: number
  /** 摘要重要性。 */
  importance: number
  /** FTS5 原始相关性排名。 */
  rank?: number
}

/** 已归档消息 ID 查询行。 */
interface ArchivedMessageIdsRow {
  /** JSON 编码的消息 ID 列表。 */
  message_ids_json: string
}

/** Working Memory 数据库查询行。 */
interface WorkingMemoryRow {
  /** JSON 编码的 Working Memory。 */
  snapshot_json: string
}

// ========= 变量 =========

/** 用户十分钟无新消息后关闭当前会话块。 */
export const CONVERSATION_BLOCK_IDLE_MS = 10 * 60 * 1_000

/** 单次长期记忆检索最多装入的块数。 */
const DEFAULT_MEMORY_SEARCH_LIMIT = 5

/** 当前账户内存中的 Working Memory。 */
const EMPTY_WORKING_MEMORY: WorkingMemorySnapshot = WorkingMemorySnapshotSchema.parse({
  schemaVersion: 1,
  currentGoal: '',
  selectedMemories: [],
  updatedAt: 0
})

// ========= 类 =========

/** Utility 侧账户隔离会话分块、FTS5 检索与 Working Memory 服务。 */
export class ConversationMemoryService {
  /** 当前账户内存中的 Working Memory 副本。 */
  private workingMemory: WorkingMemorySnapshot = EMPTY_WORKING_MEMORY

  constructor(private readonly accountStore: UtilityAccountStore) {}

  /** 账户打开后从 SQLite 恢复 Working Memory；损坏快照会重建为空状态。 */
  async restore(): Promise<void> {
    await this.accountStore.settled()
    /** SQLite 中的 Working Memory 行。 */
    const saved = await this.accountStore.write((database) => database
      .prepare('SELECT snapshot_json FROM agent_working_memory WHERE singleton_id = 1')
      .get() as WorkingMemoryRow | undefined)
    if (!saved) {
      this.workingMemory = EMPTY_WORKING_MEMORY
      await this.saveWorkingMemory(this.workingMemory)
      return
    }
    try {
      /** 未信任磁盘 JSON。 */
      const decoded = JSON.parse(saved.snapshot_json) as unknown
      this.workingMemory = WorkingMemorySnapshotSchema.parse(decoded)
      /** 始终以 SQLite 权威值重建快速快照，覆盖缺失或损坏文件。 */
      await this.accountStore.write((_database, account) => {
        writeJsonAtomically(account.workingMemoryPath, JSON.stringify(this.workingMemory))
      })
    } catch {
      this.workingMemory = EMPTY_WORKING_MEMORY
      await this.saveWorkingMemory(this.workingMemory)
    }
  }

  /** 新用户消息前关闭已超时块、检索相关历史并更新 Working Memory。 */
  async prepareForTurn(
    messages: readonly AgentMessage[],
    currentGoal: string,
    now = Date.now()
  ): Promise<WorkingMemorySnapshot> {
    await this.archiveIfInactive(messages, now)
    /** 与当前目标相关的账户内历史。 */
    const selectedMemories = await this.search(currentGoal, DEFAULT_MEMORY_SEARCH_LIMIT)
    /** 本轮新的 Working Memory。 */
    const snapshot = WorkingMemorySnapshotSchema.parse({
      schemaVersion: 1,
      currentGoal: currentGoal.slice(0, 2_000),
      selectedMemories,
      updatedAt: now
    })
    this.workingMemory = snapshot
    await this.saveWorkingMemory(snapshot)
    return snapshot
  }

  /** 当前用户已空闲十分钟时关闭尚未归档的会话块。 */
  async archiveIfInactive(messages: readonly AgentMessage[], now = Date.now()): Promise<boolean> {
    /** 最近一条用户消息。 */
    const latestUserMessage = messages.findLast((message) => message.role === 'user')
    if (!latestUserMessage || now - latestUserMessage.createdAt < CONVERSATION_BLOCK_IDLE_MS) return false
    return this.archiveUnstoredMessages(messages, 'idle_timeout')
  }

  /** 将当前尚未归档的稳定消息写成一个会话块与 FTS5 文档。 */
  async archiveUnstoredMessages(
    messages: readonly AgentMessage[],
    closeReason: 'idle_timeout' | 'manual'
  ): Promise<boolean> {
    await this.accountStore.settled()
    return this.accountStore.write((database) => {
      /** 已归档块中的消息 ID。 */
      const archivedIds = new Set<string>()
      /** 账户内全部已归档消息 ID 行。 */
      const archivedRows = database
        .prepare('SELECT message_ids_json FROM agent_conversation_blocks')
        .all() as unknown as ArchivedMessageIdsRow[]
      for (const row of archivedRows) {
        try {
          /** 当前块已归档的消息 ID。 */
          const ids = JSON.parse(row.message_ids_json) as unknown
          if (Array.isArray(ids)) {
            for (const id of ids) if (typeof id === 'string') archivedIds.add(id)
          }
        } catch {
          // 损坏的单个旧块不阻止其余记忆继续归档。
        }
      }
      /** 当前块可安全落库的消息。 */
      const blockMessages = messages.filter((message) =>
        !archivedIds.has(message.messageId)
        && message.role !== 'system'
        && !message.streaming
        && message.content.trim().length > 0)
      if (blockMessages.length === 0) return false

      /** 会话块正文。 */
      const contentText = blockMessages
        .map((message) => `${message.role === 'user' ? '用户' : '小云'}：${message.content.trim()}`)
        .join('\n')
        .slice(0, 200_000)
      /** 会话块确定性摘要。 */
      const summary = summarizeConversationBlock(blockMessages)
      /** 会话块关键词。 */
      const keywordsText = extractSearchTerms(contentText).join(' ')
      /** 重要性同时考虑用户目标数与块长度。 */
      const userMessageCount = blockMessages.filter((message) => message.role === 'user').length
      /** 归一化后的摘要重要性。 */
      const importance = Math.min(1, 0.35 + userMessageCount * 0.12 + Math.min(contentText.length, 4_000) / 20_000)
      /** 块开始时间。 */
      const startedAt = Math.min(...blockMessages.map((message) => message.createdAt))
      /** 块结束时间。 */
      const endedAt = Math.max(...blockMessages.map((message) => message.createdAt))

      database.exec('BEGIN IMMEDIATE')
      try {
        database.prepare(`
          INSERT INTO agent_conversation_blocks (
            started_at,
            ended_at,
            close_reason,
            message_ids_json,
            content_text,
            summary,
            keywords_text,
            importance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          startedAt,
          endedAt,
          closeReason,
          JSON.stringify(blockMessages.map((message) => message.messageId)),
          contentText,
          summary,
          keywordsText,
          importance
        )
        database.exec('COMMIT')
        return true
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    })
  }

  /** 使用账户内 SQLite FTS5 检索相关会话块。 */
  async search(query: string, limit = DEFAULT_MEMORY_SEARCH_LIMIT): Promise<MemorySearchHit[]> {
    await this.accountStore.settled()
    /** 经裁剪的检索数量。 */
    const safeLimit = Math.max(1, Math.min(8, Math.trunc(limit)))
    /** 不把用户原始 FTS 运算符直接交给 MATCH。 */
    const matchQuery = buildFtsQuery(query)
    /** 当前时间，用于组合新鲜度。 */
    const now = Date.now()
    return this.accountStore.write((database) => {
      /** FTS 命中或最近高价值块。 */
      /** 优先使用 FTS5 相关性检索。 */
      let rows = matchQuery
        ? database.prepare(`
            SELECT
              block.id,
              block.summary,
              block.content_text,
              block.started_at,
              block.ended_at,
              block.importance,
              fts.rank AS rank
            FROM agent_memory_fts AS fts
            JOIN agent_conversation_blocks AS block ON block.id = fts.rowid
            WHERE agent_memory_fts MATCH ?
            ORDER BY fts.rank
            LIMIT ?
          `).all(matchQuery, safeLimit * 3) as unknown as ConversationBlockRow[]
        : database.prepare(`
            SELECT id, summary, content_text, started_at, ended_at, importance
            FROM agent_conversation_blocks
            ORDER BY importance DESC, ended_at DESC
            LIMIT ?
          `).all(safeLimit) as unknown as ConversationBlockRow[]
      if (rows.length === 0 && query.trim()) {
        /** 中文连续文本在 unicode61 下可能形成长词，使用参数化 LIKE 做有限召回补充。 */
        const fallbackTerms = extractSearchTerms(query)
          .filter((term) => term.length >= 2)
          .sort((left, right) => left.length - right.length)
          .slice(0, 8)
        if (fallbackTerms.length > 0) {
          /** 每个安全词项对应三列参数化匹配。 */
          const clauses = fallbackTerms
            .map(() => '(summary LIKE ? OR content_text LIKE ? OR keywords_text LIKE ?)')
            .join(' OR ')
          /** 展平后的 LIKE 参数。 */
          const parameters = fallbackTerms.flatMap((term) => [`%${term}%`, `%${term}%`, `%${term}%`])
          rows = database.prepare(`
            SELECT id, summary, content_text, started_at, ended_at, importance
            FROM agent_conversation_blocks
            WHERE ${clauses}
            ORDER BY importance DESC, ended_at DESC
            LIMIT ?
          `).all(...parameters, safeLimit) as unknown as ConversationBlockRow[]
        }
      }
      return rows
        .map((row) => ({
          row,
          /** FTS rank 越小越相关；重要性和 30 天内的新鲜度提供有限加权。 */
          score: -(row.rank ?? 0) + row.importance * 0.35
            + Math.max(0, 1 - (now - row.ended_at) / (30 * 24 * 60 * 60 * 1_000)) * 0.15
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, safeLimit)
        .map(({ row }) => MemorySearchHitSchema.parse({
          blockId: Number(row.id),
          summary: row.summary,
          excerpt: row.content_text.slice(0, 800),
          startedAt: Number(row.started_at),
          endedAt: Number(row.ended_at),
          importance: Number(row.importance)
        }))
    })
  }

  /** 返回可注入当前模型请求的最小 Working Memory 文本。 */
  contextText(): string {
    /** 当前被选择的历史摘要。 */
    const memories = this.workingMemory.selectedMemories
      .map((memory, index) => `${index + 1}. ${memory.summary}`)
      .join('\n')
    return [
      this.workingMemory.currentGoal ? `当前目标：${this.workingMemory.currentGoal}` : '',
      memories ? `相关长期记忆：\n${memories}` : ''
    ].filter(Boolean).join('\n')
  }

  /** 返回当前账户长期记忆公开统计。 */
  async status(): Promise<MemoryStatus> {
    await this.accountStore.settled()
    return this.accountStore.write((database) => {
      /** 已归档会话块数量。 */
      const blocks = database.prepare('SELECT COUNT(*) AS count FROM agent_conversation_blocks').get() as { count: number }
      /** FTS5 索引文档数量。 */
      const indexed = database.prepare('SELECT COUNT(*) AS count FROM agent_memory_fts').get() as { count: number }
      return MemoryStatusSchema.parse({
        conversationBlocks: Number(blocks.count),
        indexedBlocks: Number(indexed.count),
        selectedMemories: this.workingMemory.selectedMemories.length,
        ...(this.workingMemory.updatedAt > 0 ? { workingMemoryUpdatedAt: this.workingMemory.updatedAt } : {})
      })
    })
  }

  /** 原子保存 Working Memory 到 SQLite 与快速启动 JSON。 */
  private async saveWorkingMemory(snapshot: WorkingMemorySnapshot): Promise<void> {
    await this.accountStore.write((database, account) => {
      /** 经共享 Schema 校验的 JSON 文本。 */
      const snapshotJson = JSON.stringify(WorkingMemorySnapshotSchema.parse(snapshot))
      database.prepare(`
        INSERT INTO agent_working_memory (singleton_id, updated_at, snapshot_json)
        VALUES (1, ?, ?)
        ON CONFLICT(singleton_id) DO UPDATE SET
          updated_at = excluded.updated_at,
          snapshot_json = excluded.snapshot_json
      `).run(snapshot.updatedAt, snapshotJson)
      writeJsonAtomically(account.workingMemoryPath, snapshotJson)
    })
  }
}

// ========= 函数 =========

/** 生成不依赖额外模型调用的稳定会话块摘要。 */
function summarizeConversationBlock(messages: readonly AgentMessage[]): string {
  /** 块内最近三个用户目标。 */
  const goals = messages
    .filter((message) => message.role === 'user')
    .slice(-3)
    .map((message) => compactText(message.content, 240))
  /** 块内最近三个小云结果。 */
  const outcomes = messages
    .filter((message) => message.role === 'assistant')
    .slice(-3)
    .map((message) => compactText(message.content, 260))
  return [
    goals.length > 0 ? `用户目标：${goals.join('；')}` : '',
    outcomes.length > 0 ? `处理结果：${outcomes.join('；')}` : ''
  ].filter(Boolean).join('。').slice(0, 2_000)
}

/** 把任意消息压缩为单行短文本。 */
function compactText(value: string, maxLength: number): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, maxLength)
}

/** 从文本提取去重检索词，避免把标点或 FTS 运算符写入索引。 */
function extractSearchTerms(value: string): string[] {
  /** Unicode 字母数字词。 */
  const terms = value.toLocaleLowerCase('zh-CN').match(/[\p{L}\p{N}]{2,40}/gu) ?? []
  /** 同时加入中文二元片段，补足 unicode61 对连续汉字的召回。 */
  const expandedTerms: string[] = []
  for (const term of terms) {
    expandedTerms.push(term)
    /** 当前词项内的连续汉字片段。 */
    const hanRuns = term.match(/[\p{Script=Han}]{2,}/gu) ?? []
    for (const run of hanRuns) {
      for (let index = 0; index < run.length - 1; index += 1) {
        expandedTerms.push(run.slice(index, index + 2))
      }
    }
  }
  return [...new Set(expandedTerms)].slice(0, 60)
}

/** 将自然语言查询转换为只含带引号词项的安全 FTS5 查询。 */
function buildFtsQuery(value: string): string {
  /** 最多十二个安全词项。 */
  const terms = extractSearchTerms(value).slice(0, 12)
  return terms.map((term) => `"${term.replace(/"/gu, '""')}"`).join(' OR ')
}

/** 通过同目录临时文件与原子替换写入 JSON 快照。 */
function writeJsonAtomically(targetPath: string, contents: string): void {
  /** 同目录唯一临时文件。 */
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporaryPath, contents, 'utf8')
  /** 临时文件描述符，用于在替换前刷新内容。 */
  const descriptor = openSync(temporaryPath, 'r+')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporaryPath, targetPath)
}
