import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { UtilityAccountStore } from '../../src/infrastructure/persistence/account-space'
import type { PersistedPlaybackSnapshot } from '../../src/shared/schemas/playback-persistence'
import { PlaybackSnapshotService } from '../../src/utility/playback-snapshot-service'

// ========= 变量 =========

/** 测试创建的临时目录，结束后清理。 */
const temporaryDirectories: string[] = []

// ========= 函数 =========

/** 创建最小合法播放快照。 */
function snapshot(accountId: 'netease:10001', accountGeneration: number): PersistedPlaybackSnapshot {
  return {
    schemaVersion: 1,
    accountId,
    accountGeneration,
    savedAt: 1_723_046_400_000,
    queue: { items: [], currentItemId: null, mode: 'loop', revision: 0 },
    quality: 'auto',
    positionMs: 0,
    volume: 1,
    muted: false
  }
}

/** 创建独占的账户数据根目录。 */
function dataRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ncx-playback-snapshot-'))
  temporaryDirectories.push(root)
  return root
}

// ========= 测试区 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('PlaybackSnapshotService', () => {
  it('discards a persisted snapshot after the account generation changes', async () => {
    /** Utility 账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: dataRoot() })
    await store.open('netease:10001', 1)
    /** 播放快照服务。 */
    const service = new PlaybackSnapshotService(store)

    await service.save({ snapshot: snapshot('netease:10001', 1) })
    await store.switchAccount('guest:local', 2)
    await store.switchAccount('netease:10001', 3)

    const restored = await service.load({ accountId: 'netease:10001', accountGeneration: 3 })
    expect(restored.snapshot).toBeNull()
    await store.close()
  })

  it('rejects a stale generation write after account context changes', async () => {
    /** Utility 账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: dataRoot() })
    await store.open('netease:10001', 3)
    /** 播放快照服务。 */
    const service = new PlaybackSnapshotService(store)

    await expect(service.save({ snapshot: snapshot('netease:10001', 1) }))
      .rejects.toMatchObject({ code: 'CONNECTION_REPLACED' })
    await store.close()
  })
})
