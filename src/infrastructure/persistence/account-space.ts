import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { posix, win32, type PlatformPath } from 'node:path'

import { AccountIdSchema, type AccountId, type NeteaseUserId } from '../../shared/schemas/account'
import { ACCOUNT_SQLITE_SCHEMA_VERSION } from '../../shared/schemas/storage'
import {
  type SQLiteMigration,
  runSqliteMigrations,
  type SQLiteMigrationDatabase
} from './migration-runner'

// ========= 类型 =========

/** 账户空间类型。 */
export type AccountSpaceKind = 'guest' | 'netease'

/** 账户空间解析入参。 */
export interface AccountSpaceInput {
  /** 应用内部账户引用，必须通过 AccountIdSchema 校验。 */
  accountId: AccountId
}

/** 账户空间路径描述，仅供 Main/Utility 内部使用，禁止通过 Preload 暴露。 */
export interface AccountSpaceDescriptor {
  /** 账户空间类型。 */
  kind: AccountSpaceKind
  /** 应用内部账户引用。 */
  accountId: AccountId
  /** 账户空间根目录。 */
  rootDir: string
  /** 当前账户唯一 SQLite 文件。 */
  sqlitePath: string
  /** 当前账户工作记忆快照路径。 */
  workingMemoryPath: string
  /** 网易云账户可重建显示快照路径。 */
  accountJsonPath?: string
  /** 画像快速启动快照路径。 */
  profileJsonPath?: string
}

/** 可重新生成缓存目录描述。 */
export interface CacheSpaceDescriptor {
  /** 封面缓存目录。 */
  artworkDir: string
  /** API 响应缓存目录。 */
  apiDir: string
  /** 临时媒体缓存目录。 */
  mediaTempDir: string
}

/** Action Journal 保留策略。 */
export interface ActionJournalRetentionPolicy {
  /** 语义事件保留天数。 */
  retentionDays: number
  /** 单账户最多保留语义事件数。 */
  maxEvents: number
}

// ========= 变量 =========

/** 默认 Action Journal 保留策略，来自存储架构基线。 */
export const DEFAULT_ACTION_JOURNAL_RETENTION: ActionJournalRetentionPolicy = {
  retentionDays: 30,
  maxEvents: 10_000
}

/** 按输入根目录风格选择路径实现，使 Windows 上的跨平台路径单测不被反斜杠污染。 */
function pathApi(rootDir: string): PlatformPath {
  return rootDir.includes('\\') || /^[A-Za-z]:/u.test(rootDir) ? win32 : posix
}

// ========= 函数 =========

/** 解析持久业务数据根目录。 */
export function resolveNcxDataRoot(userDataPath: string): string {
  const path = pathApi(userDataPath)
  return path.join(path.normalize(userDataPath), 'ncx-data')
}

/** 解析可清理缓存根目录。 */
export function resolveNcxCacheRoot(cachePath: string): string {
  const path = pathApi(cachePath)
  return path.join(path.normalize(cachePath), 'NcxMusic')
}

/** 将网易云数字用户 ID 转成应用内部账户引用。 */
export function toNeteaseAccountId(userId: NeteaseUserId): AccountId {
  return AccountIdSchema.parse(`netease:${userId}`)
}

/** 根据应用内部账户引用解析账户空间路径。 */
export function resolveAccountSpace(rootDir: string, input: AccountSpaceInput): AccountSpaceDescriptor {
  const accountId = AccountIdSchema.parse(input.accountId)
  const path = pathApi(rootDir)
  const root = path.normalize(rootDir)

  if (accountId === 'guest:local') {
    const guestRoot = path.join(root, 'accounts', 'guest', 'local')
    return {
      kind: 'guest',
      accountId,
      rootDir: guestRoot,
      sqlitePath: path.join(guestRoot, 'account.sqlite'),
      workingMemoryPath: path.join(guestRoot, 'working-memory.json')
    }
  }

  const neteaseUserId = accountId.slice('netease:'.length)
  const accountRoot = path.join(root, 'accounts', 'netease', neteaseUserId)
  return {
    kind: 'netease',
    accountId,
    rootDir: accountRoot,
    sqlitePath: path.join(accountRoot, 'account.sqlite'),
    accountJsonPath: path.join(accountRoot, 'account.json'),
    profileJsonPath: path.join(accountRoot, 'profile.json'),
    workingMemoryPath: path.join(accountRoot, 'working-memory.json')
  }
}

/** 解析可重新生成缓存目录。 */
export function resolveCacheSpace(cacheRoot: string): CacheSpaceDescriptor {
  const path = pathApi(cacheRoot)
  const root = path.normalize(cacheRoot)
  return {
    artworkDir: path.join(root, 'artwork'),
    apiDir: path.join(root, 'api'),
    mediaTempDir: path.join(root, 'media-temp')
  }
}

/** 生成 Action Journal 清理 SQL，调用方在账户 SQLite 事务中执行。 */
export function buildActionJournalCleanupSql(
  nowMs: number,
  policy: ActionJournalRetentionPolicy = DEFAULT_ACTION_JOURNAL_RETENTION
): string[] {
  const cutoffMs = nowMs - policy.retentionDays * 24 * 60 * 60 * 1_000
  return [
    `DELETE FROM action_journal WHERE occurred_at < ${cutoffMs};`,
    `DELETE FROM action_journal WHERE id IN (
      SELECT id FROM action_journal
      ORDER BY occurred_at DESC, id DESC
      LIMIT -1 OFFSET ${policy.maxEvents}
    );`
  ]
}

// ========= SQLite 迁移 =========

/** 账户数据库版本 1 迁移：建立 Action Journal 与播放快照事实表。 */
export const ACCOUNT_SQLITE_MIGRATIONS: readonly SQLiteMigration[] = [
  {
    version: 1,
    description: '建立账户 Action Journal 与播放快照表',
    up: (database): void => {
      database.exec?.(`
        CREATE TABLE IF NOT EXISTS action_journal (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          occurred_at INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_action_journal_occurred_at
          ON action_journal (occurred_at DESC, id DESC);
        CREATE TABLE IF NOT EXISTS playback_snapshot (
          account_id TEXT PRIMARY KEY,
          account_generation INTEGER NOT NULL,
          saved_at INTEGER NOT NULL,
          snapshot_json TEXT NOT NULL
        );
      `)
    }
  },
  {
    version: 2,
    description: '建立账户级持久偏好表',
    up: (database): void => {
      database.exec?.(`
        CREATE TABLE IF NOT EXISTS account_preferences (
          preference_key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)
    }
  },
  {
    version: 3,
    description: '建立 Agent 当前连续会话快照表',
    up: (database): void => {
      database.exec?.(`
        CREATE TABLE IF NOT EXISTS agent_conversation_snapshot (
          account_id TEXT PRIMARY KEY,
          saved_at INTEGER NOT NULL,
          snapshot_json TEXT NOT NULL
        );
      `)
    }
  },
  {
    version: 4,
    description: '建立 Phase 6 会话记忆、FTS5 与音乐画像表',
    up: (database): void => {
      database.exec?.(`
        CREATE TABLE IF NOT EXISTS agent_conversation_blocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER NOT NULL,
          close_reason TEXT NOT NULL,
          message_ids_json TEXT NOT NULL,
          content_text TEXT NOT NULL,
          summary TEXT NOT NULL,
          keywords_text TEXT NOT NULL,
          importance REAL NOT NULL CHECK (importance >= 0 AND importance <= 1)
        );
        CREATE INDEX IF NOT EXISTS idx_agent_conversation_blocks_time
          ON agent_conversation_blocks (ended_at DESC, id DESC);

        CREATE VIRTUAL TABLE IF NOT EXISTS agent_memory_fts USING fts5(
          summary,
          content_text,
          keywords_text,
          content='agent_conversation_blocks',
          content_rowid='id',
          tokenize='unicode61'
        );
        CREATE TRIGGER IF NOT EXISTS agent_conversation_blocks_ai AFTER INSERT ON agent_conversation_blocks BEGIN
          INSERT INTO agent_memory_fts(rowid, summary, content_text, keywords_text)
          VALUES (new.id, new.summary, new.content_text, new.keywords_text);
        END;
        CREATE TRIGGER IF NOT EXISTS agent_conversation_blocks_ad AFTER DELETE ON agent_conversation_blocks BEGIN
          INSERT INTO agent_memory_fts(agent_memory_fts, rowid, summary, content_text, keywords_text)
          VALUES ('delete', old.id, old.summary, old.content_text, old.keywords_text);
        END;
        CREATE TRIGGER IF NOT EXISTS agent_conversation_blocks_au AFTER UPDATE ON agent_conversation_blocks BEGIN
          INSERT INTO agent_memory_fts(agent_memory_fts, rowid, summary, content_text, keywords_text)
          VALUES ('delete', old.id, old.summary, old.content_text, old.keywords_text);
          INSERT INTO agent_memory_fts(rowid, summary, content_text, keywords_text)
          VALUES (new.id, new.summary, new.content_text, new.keywords_text);
        END;

        CREATE TABLE IF NOT EXISTS agent_working_memory (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          updated_at INTEGER NOT NULL,
          snapshot_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS music_profile_state (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          status TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER,
          profile_json TEXT,
          baseline_json TEXT,
          overrides_json TEXT NOT NULL DEFAULT '[]',
          active_job_json TEXT,
          change_score REAL NOT NULL DEFAULT 0,
          dismissed_at INTEGER,
          dismissed_score REAL,
          error_message TEXT
        );
        CREATE TABLE IF NOT EXISTS music_profile_evidence (
          job_id TEXT NOT NULL,
          ordinal INTEGER NOT NULL,
          evidence_json TEXT NOT NULL,
          PRIMARY KEY (job_id, ordinal)
        );
        CREATE INDEX IF NOT EXISTS idx_music_profile_evidence_job
          ON music_profile_evidence (job_id, ordinal);

        CREATE TABLE IF NOT EXISTS account_basic_profile (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          nickname TEXT NOT NULL,
          gender INTEGER,
          birthday INTEGER,
          source_api TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)
    }
  }
]

// ========= 类型 =========

/** Utility 单写者账户存储的写事务回调。 */
export type AccountStoreWrite<T> = (database: DatabaseSync, account: AccountSpaceDescriptor) => T | Promise<T>

/** Utility 当前账户 SQLite 单写者。 */
export interface AccountStoreOptions {
  /** 应用持久数据根目录。 */
  dataRoot: string
  /** 可注入迁移集合，测试可使用最小迁移。 */
  migrations?: readonly SQLiteMigration[]
}

// ========= 函数 =========

/** 将 Node SQLite 连接适配为迁移运行器依赖。 */
function createMigrationDatabase(
  database: DatabaseSync,
  backupPath: string,
  shouldCreateBackup: boolean
): SQLiteMigrationDatabase {
  return {
    exec: (sql: string): void => database.exec(sql),
    getUserVersion: async (): Promise<number> => {
      const row = database.prepare('PRAGMA user_version').get() as { user_version?: unknown }
      return typeof row.user_version === 'number' ? row.user_version : Number(row.user_version ?? 0)
    },
    setUserVersion: async (version: number): Promise<void> => {
      database.exec(`PRAGMA user_version = ${version}`)
    },
    runInTransaction: async (work: () => Promise<void>): Promise<void> => {
      database.exec('BEGIN IMMEDIATE')
      try {
        await work()
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
    createBackup: async (): Promise<void> => {
      if (!shouldCreateBackup || existsSync(backupPath)) return
      const sourcePath = database.prepare('PRAGMA database_list').all()[0] as { file?: unknown } | undefined
      const sourceFile = typeof sourcePath?.file === 'string' ? sourcePath.file : undefined
      if (sourceFile && existsSync(sourceFile)) copyFileSync(sourceFile, backupPath)
    }
  }
}

// ========= 类 =========

/** Utility 进程持有的单账户 SQLite 单写者。 */
export class UtilityAccountStore {
  /** 应用持久数据根目录。 */
  private readonly dataRoot: string

  /** 当前使用的迁移集合。 */
  private readonly migrations: readonly SQLiteMigration[]

  /** 当前账户描述。 */
  private currentAccount: AccountSpaceDescriptor | undefined

  /** 当前账户数据库连接。 */
  private database: DatabaseSync | undefined

  /** 当前账户 generation，用于拒绝 Renderer 的迟到写入。 */
  private accountGeneration = 0

  /** 串行化所有写操作，确保 Utility 是唯一写者。 */
  private writeTail: Promise<void> = Promise.resolve()

  /** 串行化账户打开与关闭，避免快速换号时同时持有多个连接。 */
  private lifecycleTail: Promise<void> = Promise.resolve()

  constructor(options: AccountStoreOptions) {
    this.dataRoot = pathApi(options.dataRoot).normalize(options.dataRoot)
    this.migrations = options.migrations ?? ACCOUNT_SQLITE_MIGRATIONS
  }

  /** 打开账户目录、SQLite 连接并执行待应用迁移。 */
  async open(accountId: AccountId, accountGeneration = 0): Promise<AccountSpaceDescriptor> {
    const run = this.lifecycleTail.then(() => this.openNow(accountId, accountGeneration))
    this.lifecycleTail = run.then(() => undefined, () => undefined)
    return run
  }

  /** 实际执行账户连接切换；只允许由生命周期队列调用。 */
  private async openNow(accountId: AccountId, accountGeneration: number): Promise<AccountSpaceDescriptor> {
    await this.closeNow()
    const account = resolveAccountSpace(this.dataRoot, { accountId })
    mkdirSync(account.rootDir, { recursive: true })
    const databaseExisted = existsSync(account.sqlitePath)
    const database = new DatabaseSync(account.sqlitePath, {
      timeout: 5_000,
      enableForeignKeyConstraints: true
    })
    try {
      database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
      const backupPath = `${account.sqlitePath}.bak-v${ACCOUNT_SQLITE_SCHEMA_VERSION}`
      await runSqliteMigrations(
        createMigrationDatabase(database, backupPath, databaseExisted),
        this.migrations,
        ACCOUNT_SQLITE_SCHEMA_VERSION
      )
    } catch (error) {
      database.close()
      throw error
    }
    this.database = database
    this.currentAccount = account
    this.accountGeneration = accountGeneration
    return account
  }

  /** 切换账户时先关闭旧连接，再打开目标账户连接。 */
  async switchAccount(accountId: AccountId, accountGeneration = 0): Promise<AccountSpaceDescriptor> {
    return this.open(accountId, accountGeneration)
  }

  /** 在 Utility 单写者队列中执行一个数据库操作。 */
  write<T>(operation: AccountStoreWrite<T>): Promise<T> {
    const run = this.writeTail.then(async () => {
      const database = this.database
      const account = this.currentAccount
      if (!database || !account) throw new Error('账户 SQLite 尚未打开。')
      return operation(database, account)
    })
    this.writeTail = run.then(() => undefined, () => undefined)
    return run
  }

  /** 返回当前账户描述；未打开时返回 undefined。 */
  current(): AccountSpaceDescriptor | undefined {
    return this.currentAccount
  }

  /** 返回 Utility 当前账户 generation。 */
  currentGeneration(): number {
    return this.accountGeneration
  }

  /** 删除当前账户本地业务空间后，以同一 generation 重建空数据库。 */
  async deleteCurrentData(accountId: AccountId, accountGeneration: number): Promise<AccountSpaceDescriptor> {
    const run = this.lifecycleTail.then(async () => {
      const account = this.currentAccount
      if (!account || account.accountId !== accountId || this.accountGeneration !== accountGeneration) {
        throw Object.assign(new Error('账户已切换，拒绝删除迟到请求。'), { code: 'ACCOUNT_STALE' })
      }

      /** 使用规范化后的 accounts 根目录约束递归删除目标。 */
      const path = pathApi(this.dataRoot)
      const accountsRoot = path.resolve(this.dataRoot, 'accounts')
      const targetRoot = path.resolve(account.rootDir)
      const relativeTarget = path.relative(accountsRoot, targetRoot)
      if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        throw new Error('账户数据删除目标不在受控 accounts 目录内。')
      }

      await this.closeNow()
      rmSync(targetRoot, { recursive: true, force: true })
      return this.openNow(accountId, accountGeneration)
    })
    this.lifecycleTail = run.then(() => undefined, () => undefined)
    return run
  }

  /** 等待已排队的账户打开或关闭操作完成。 */
  async settled(): Promise<void> {
    await this.lifecycleTail
  }

  /** 等待写入队列并关闭当前账户数据库。 */
  async close(): Promise<void> {
    const run = this.lifecycleTail.then(() => this.closeNow())
    this.lifecycleTail = run.then(() => undefined, () => undefined)
    return run
  }

  /** 实际关闭当前连接；只允许由生命周期队列调用。 */
  private async closeNow(): Promise<void> {
    await this.writeTail
    const database = this.database
    this.database = undefined
    this.currentAccount = undefined
    this.accountGeneration = 0
    database?.close()
  }
}
