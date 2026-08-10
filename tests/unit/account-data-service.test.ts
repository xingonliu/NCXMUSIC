import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { UtilityAccountStore, resolveCacheSpace } from '../../src/infrastructure/persistence/account-space'
import { AccountDataService } from '../../src/utility/account-data-service'

// ========= 变量 =========

/** 测试期间创建的临时目录。 */
const temporaryDirectories: string[] = []

// ========= 函数 =========

/** 创建并记录独占临时目录。 */
function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(root)
  return root
}

// ========= 测试 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('AccountDataService', () => {
  it('持久化账户偏好、Journal，并统计当前账户数据', async () => {
    const store = new UtilityAccountStore({ dataRoot: temporaryRoot('ncx-account-data-') })
    await store.open('netease:10001', 7)
    const service = new AccountDataService(store, temporaryRoot('ncx-account-cache-'))

    await service.execute({
      operation: 'setPreference',
      accountId: 'netease:10001',
      accountGeneration: 7,
      key: 'lyrics.translation',
      value: true
    })
    await service.execute({
      operation: 'appendJournal',
      accountId: 'netease:10001',
      accountGeneration: 7,
      eventType: 'player.command',
      payload: { commandType: 'player.play' }
    })

    const preferences = await service.execute({
      operation: 'getPreferences',
      accountId: 'netease:10001',
      accountGeneration: 7
    })
    const stats = await service.execute({
      operation: 'getStats',
      accountId: 'netease:10001',
      accountGeneration: 7
    })
    expect(preferences).toMatchObject({ preferences: { 'lyrics.translation': true } })
    expect(stats).toMatchObject({ journalEvents: 1 })
    await store.close()
  })

  it('只清理冻结缓存目录，并按 accountId/generation 删除当前账户数据', async () => {
    const dataRoot = temporaryRoot('ncx-delete-account-')
    const cacheRoot = temporaryRoot('ncx-clear-cache-')
    const store = new UtilityAccountStore({ dataRoot })
    const account = await store.open('netease:10001', 4)
    const service = new AccountDataService(store, cacheRoot)
    const cache = resolveCacheSpace(cacheRoot)
    writeFileSync(join(cacheRoot, 'keep.txt'), 'keep')
    writeFileSync(join(cache.apiDir, 'response.json'), 'cache', { flag: 'w' })

    const cleared = await service.execute({
      operation: 'clearCache',
      accountId: 'netease:10001',
      accountGeneration: 4
    })
    expect(cleared).toMatchObject({ operation: 'clearCache', clearedBytes: 5 })
    expect(readFileSync(join(cacheRoot, 'keep.txt'), 'utf8')).toBe('keep')

    await expect(service.execute({
      operation: 'deleteLocalData',
      accountId: 'netease:10001',
      accountGeneration: 3
    })).rejects.toMatchObject({ code: 'ACCOUNT_STALE' })
    await service.execute({
      operation: 'deleteLocalData',
      accountId: 'netease:10001',
      accountGeneration: 4
    })
    expect(existsSync(account.sqlitePath)).toBe(true)
    expect(store.current()?.accountId).toBe('netease:10001')
    await store.close()
  })
})
