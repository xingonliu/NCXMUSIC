import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from '@playwright/test'

import type { PlayerSnapshot } from '../../src/domains/player/playback-coordinator'
import { QueueController } from '../../src/domains/player/queue-controller'
import type { TrackSummary } from '../../src/domains/player/types'
import {
  NeteaseMusicApiAdapter,
  type NeteaseMusicApi
} from '../../src/infrastructure/netease/music-api-adapter'
import { UtilityAccountStore } from '../../src/infrastructure/persistence/account-space'
import {
  PlaybackStore,
  type PlaybackStoreAccountContext
} from '../../src/renderer/features/music/playback-store'
import type { PersistedPlaybackSnapshot } from '../../src/shared/schemas/playback-persistence'
import { PlaybackSnapshotService } from '../../src/utility/playback-snapshot-service'

// ========= 变量 =========

/** E2E 创建的临时目录，测试完成后清理。 */
const temporaryDirectories: string[] = []

/** E2E 中已经打开、需要在清理目录前关闭的 SQLite 单写者。 */
const openAccountStores: UtilityAccountStore[] = []

// ========= 函数 =========

/** 创建可控的网易云搜索 API。 */
function searchApi(): NeteaseMusicApi {
  return {
    search: async (params) => ({
      status: 200,
      body: params['type'] === '1'
        ? {
            code: 200,
            result: {
              songs: [
                { id: 1, name: '第一首', ar: [{ id: 11, name: '歌手甲' }], al: { id: 21, name: '专辑甲' } },
                { id: 2, name: '第二首', ar: [{ id: 12, name: '歌手乙' }], al: { id: 22, name: '专辑乙' } }
              ]
            }
          }
        : { code: 200, result: {} }
    }),
    song_detail: async () => ({ status: 200, body: { code: 200, songs: [] } }),
    lyric_new: async () => ({ status: 200, body: { code: 200 } }),
    artists: async () => ({ status: 200, body: { code: 200, artist: null } }),
    album: async () => ({ status: 200, body: { code: 200, album: null } }),
    playlist_detail: async () => ({ status: 200, body: { code: 200, playlist: null } }),
    user_detail: async () => ({ status: 200, body: { code: 200, profile: null } })
  }
}

/** 把搜索结果歌曲转换为播放器队列摘要。 */
function trackSummary(id: string, name: string, artist: string, album: string): TrackSummary {
  return { trackId: id, name, artists: [artist], album, durationMs: null }
}

/** 构造可持久化的播放器快照。 */
function playerSnapshot(queue: ReturnType<QueueController['getSnapshot']>): PlayerSnapshot {
  const current = queue.items.find((item) => item.queueItemId === queue.currentItemId)?.track ?? null
  return {
    playback: {
      status: current ? 'paused' : 'idle',
      intent: 'pause',
      track: current,
      generation: 1,
      positionMs: 12_000,
      durationMs: current?.durationMs ?? null,
      bufferedMs: 18_000,
      volume: 0.8,
      muted: false,
      seeking: false,
      error: null,
      actualQuality: null,
      downgraded: false
    },
    queue,
    quality: 'auto'
  }
}

// ========= 测试区 =========

test.afterEach(async () => {
  for (const store of openAccountStores.splice(0)) await store.close()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('登录、搜索、播放、切歌、账户切换和重启按 generation 保持账户隔离', async () => {
  /** 本次流程的真实临时账户数据根目录。 */
  const dataRoot = mkdtempSync(join(tmpdir(), 'ncx-e2e-'))
  temporaryDirectories.push(dataRoot)
  /** Utility 账户 SQLite 单写者。 */
  const accountStore = new UtilityAccountStore({ dataRoot })
  openAccountStores.push(accountStore)
  await accountStore.open('netease:10001', 1)
  expect(accountStore.current()?.accountId).toBe('netease:10001')
  /** Utility SQLite 播放快照服务。 */
  const snapshotService = new PlaybackSnapshotService(accountStore)
  /** Renderer 只能通过 Utility 服务访问账户播放快照。 */
  const persistence = {
    load: async (account: PlaybackStoreAccountContext) => {
      const result = await snapshotService.load(account)
      return result.snapshot
    },
    save: async (snapshot: PersistedPlaybackSnapshot) => {
      await snapshotService.save({ snapshot })
    }
  }

  /** 网易云标准数据 Adapter。 */
  const adapter = new NeteaseMusicApiAdapter(searchApi())
  /** 搜索结果。 */
  const search = await adapter.read({ operation: 'search', query: '测试', limit: 20, offset: 0 }, '')
  expect(search.kind).toBe('search')
  if (search.kind !== 'search') throw new Error('Expected search result')

  /** 播放队列控制器。 */
  let nextQueueId = 0
  const queue = new QueueController({
    createId: () => `queue-${++nextQueueId}`,
    now: () => 1_723_046_400_000
  })
  /** 搜索结果转换后的两首曲目。 */
  const tracks = search.songs.map((song) => trackSummary(
    song.id,
    song.name,
    song.artists[0]?.name ?? '未知歌手',
    song.album?.name ?? ''
  ))
  const initial = queue.replaceAndPlay({ tracks, source: { kind: 'search' } })
  expect(initial.autoplay).toBe(true)
  expect(initial.nextItem?.track.trackId).toBe('1')
  const advanced = queue.next('manual')
  expect(advanced.autoplay).toBe(true)
  expect(advanced.nextItem?.track.trackId).toBe('2')

  /** 首次 Renderer 会话的播放快照存储。 */
  const firstRenderer = new PlaybackStore({
    persistence,
    now: () => 1_723_046_412_000
  })
  firstRenderer.flush(playerSnapshot(queue.getSnapshot()), {
    accountId: 'netease:10001',
    accountGeneration: 1
  })
  await firstRenderer.settled()

  await accountStore.switchAccount('netease:10002', 2)
  queue.clear()
  firstRenderer.flush(playerSnapshot(queue.getSnapshot()), {
    accountId: 'netease:10002',
    accountGeneration: 2
  })
  await firstRenderer.settled()
  await accountStore.switchAccount('netease:10001', 3)

  /** 模拟应用重启后的新 Renderer 存储实例。 */
  const restartedRenderer = new PlaybackStore({ persistence })
  /** A 账户旧 generation 的播放状态按冻结契约丢弃。 */
  const restored = await restartedRenderer.load({ accountId: 'netease:10001', accountGeneration: 3 })
  expect(restored).toBeNull()

  await accountStore.close()
})
