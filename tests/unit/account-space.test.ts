import { describe, expect, it } from 'vitest'

import {
  buildActionJournalCleanupSql,
  resolveAccountSpace,
  resolveCacheSpace,
  resolveNcxCacheRoot,
  resolveNcxDataRoot,
  toNeteaseAccountId
} from '../../src/infrastructure/persistence/account-space'

// ========= 测试区 =========

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
})
