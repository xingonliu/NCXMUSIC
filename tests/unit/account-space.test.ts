import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  buildActionJournalCleanupSql,
  resolveAccountSpace,
  resolveCacheSpace,
  resolveNcxCacheRoot,
  resolveNcxDataRoot,
  toNeteaseAccountId,
  UtilityAccountStore
} from '../../src/infrastructure/persistence/account-space'

// ========= 变量 =========

/** 测试创建的临时目录，结束后逐个清理。 */
const temporaryDirectories: string[] = []

// ========= 函数 =========

/** 创建本测试独占的临时持久数据根目录。 */
function temporaryDataRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ncx-account-space-'))
  temporaryDirectories.push(root)
  return root
}

// ========= 测试区 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('account storage spaces', () => {
  it('resolves guest and netease account paths without leaking arbitrary names', () => {
    /** 持久业务数据根目录。 */
    const root = resolveNcxDataRoot('/Users/demo/Library/Application Support/NcxMusic')
    /** 游客账户空间。 */
    const guest = resolveAccountSpace(root, { accountId: 'guest:local' })
    /** 网易云账户空间。 */
    const netease = resolveAccountSpace(root, { accountId: toNeteaseAccountId('10001') })

    expect(guest.sqlitePath).toContain('/accounts/guest/local/account.sqlite')
    expect(netease.sqlitePath).toContain('/accounts/netease/10001/account.sqlite')
    expect(() => resolveAccountSpace(root, { accountId: '../escape' as never })).toThrow()
  })

  it('keeps regenerable cache outside the persistent account root', () => {
    /** 可清理缓存根目录。 */
    const cacheRoot = resolveNcxCacheRoot('/Users/demo/Library/Caches')
    /** 缓存目录描述。 */
    const cache = resolveCacheSpace(cacheRoot)

    expect(cache.artworkDir).toContain('/NcxMusic/artwork')
    expect(cache.apiDir).toContain('/NcxMusic/api')
    expect(cache.mediaTempDir).toContain('/NcxMusic/media-temp')
  })

  it('builds action journal cleanup statements from the retention policy', () => {
    /** 固定当前时间。 */
    const now = Date.UTC(2026, 7, 8)
    /** 清理 SQL。 */
    const statements = buildActionJournalCleanupSql(now)

    expect(statements).toHaveLength(2)
    expect(statements[0]).toContain('DELETE FROM action_journal')
    expect(statements[1]).toContain('OFFSET 10000')
  })

  it('creates, migrates and switches the Utility-owned account SQLite connection', async () => {
    /** Utility 单写者测试实例。 */
    const store = new UtilityAccountStore({ dataRoot: temporaryDataRoot() })
    /** 已打开的游客账户。 */
    const guest = await store.open('guest:local')
    /** 游客数据库表名。 */
    const guestTables = await store.write((database) =>
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
    ) as Array<{ name: string }>

    expect(existsSync(guest.sqlitePath)).toBe(true)
    expect(guestTables.map((row) => row.name)).toContain('playback_snapshot')
    expect(guestTables.map((row) => row.name)).toContain('agent_conversation_snapshot')

    /** 已切换的网易云账户。 */
    const netease = await store.switchAccount(toNeteaseAccountId('10001'))
    expect(netease.sqlitePath).not.toBe(guest.sqlitePath)
    expect(existsSync(netease.sqlitePath)).toBe(true)
    expect(store.current()?.accountId).toBe('netease:10001')

    await store.close()
    expect(store.current()).toBeUndefined()
  })
})
