import { join, normalize } from 'node:path'

import { AccountIdSchema, type AccountId, type NeteaseUserId } from '../../shared/schemas/account'

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

// ========= 函数 =========

/** 解析持久业务数据根目录。 */
export function resolveNcxDataRoot(userDataPath: string): string {
  return join(normalize(userDataPath), 'ncx-data')
}

/** 解析可清理缓存根目录。 */
export function resolveNcxCacheRoot(cachePath: string): string {
  return join(normalize(cachePath), 'NcxMusic')
}

/** 将网易云数字用户 ID 转成应用内部账户引用。 */
export function toNeteaseAccountId(userId: NeteaseUserId): AccountId {
  return AccountIdSchema.parse(`netease:${userId}`)
}

/** 根据应用内部账户引用解析账户空间路径。 */
export function resolveAccountSpace(rootDir: string, input: AccountSpaceInput): AccountSpaceDescriptor {
  const accountId = AccountIdSchema.parse(input.accountId)
  const root = normalize(rootDir)

  if (accountId === 'guest:local') {
    const guestRoot = join(root, 'accounts', 'guest', 'local')
    return {
      kind: 'guest',
      accountId,
      rootDir: guestRoot,
      sqlitePath: join(guestRoot, 'account.sqlite'),
      workingMemoryPath: join(guestRoot, 'working-memory.json')
    }
  }

  const neteaseUserId = accountId.slice('netease:'.length)
  const accountRoot = join(root, 'accounts', 'netease', neteaseUserId)
  return {
    kind: 'netease',
    accountId,
    rootDir: accountRoot,
    sqlitePath: join(accountRoot, 'account.sqlite'),
    accountJsonPath: join(accountRoot, 'account.json'),
    profileJsonPath: join(accountRoot, 'profile.json'),
    workingMemoryPath: join(accountRoot, 'working-memory.json')
  }
}

/** 解析可重新生成缓存目录。 */
export function resolveCacheSpace(cacheRoot: string): CacheSpaceDescriptor {
  const root = normalize(cacheRoot)
  return {
    artworkDir: join(root, 'artwork'),
    apiDir: join(root, 'api'),
    mediaTempDir: join(root, 'media-temp')
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
