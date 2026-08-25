// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { disposeAccountSessionStore } from '../../src/renderer/features/account/account-session-store'
import VirtualTrackList from '../../src/renderer/features/music/components/VirtualTrackList.vue'
import {
  disposeLikedSongsStore,
  useLikedSongsStore
} from '../../src/renderer/features/music/liked-songs-store'
import type { StandardSong } from '../../src/shared/schemas/music'

// -- Constants

/** 固定实体观测时间。 */
const observedAt = '2026-08-25T12:00:00.000Z'

// -- Functions

/** 创建收藏状态测试歌曲。 */
function createSong(id: string): StandardSong {
  return {
    kind: 'song',
    id,
    name: `歌曲 ${id}`,
    artists: [],
    access: { badges: [], playableKnown: false },
    sources: [{ api: 'test.fixture', observedAt }],
    updatedAt: observedAt
  }
}

// -- Lifecycle Hooks

afterEach(() => {
  disposeLikedSongsStore()
  disposeAccountSessionStore()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

// -- Tests

describe('应用级歌曲收藏状态', () => {
  it('使用完整 ID 集合展示已收藏状态，并将点击切换为取消收藏', async () => {
    /** 已登录网易云账户快照。 */
    const accountSnapshot = {
      state: 'authenticated' as const,
      accountGeneration: 3,
      activeAccount: {
        kind: 'netease' as const,
        accountId: 'netease:1001',
        neteaseUserId: '1001'
      }
    }
    /** 仅返回一首详情但携带完整收藏 ID 的读取替身。 */
    const getLikedSongs = vi.fn(async () => ({
      ok: true as const,
      data: {
        kind: 'songCollection' as const,
        collection: 'liked' as const,
        ownerId: '1001',
        songIds: ['1', '2'],
        songs: [createSong('1')],
        updatedAt: observedAt
      }
    }))
    /** 收藏写入替身。 */
    const mutateMusic = vi.fn(async () => ({
      ok: true as const,
      data: {
        operation: 'likeTrack' as const,
        succeeded: true as const,
        entityId: '2',
        updatedAt: observedAt
      }
    }))
    Object.defineProperty(window, 'ncx', {
      configurable: true,
      value: {
        account: {
          snapshot: vi.fn(async () => accountSnapshot),
          onSnapshot: vi.fn(() => (): void => {})
        },
        runtime: { getLikedSongs, mutateMusic }
      }
    })

    /** 全局收藏状态。 */
    const likedSongs = useLikedSongsStore()
    await likedSongs.initialize()

    expect(getLikedSongs).toHaveBeenCalledWith({ userId: '1001', limit: 1 })
    expect(likedSongs.isLiked('2')).toBe(true)

    /** 展示第二首歌曲的通用列表。 */
    const wrapper = mount(VirtualTrackList, { props: { songs: [createSong('2')] } })
    const likedButton = wrapper.get('button[aria-label="取消收藏"]')
    expect(likedButton.attributes('aria-pressed')).toBe('true')
    expect(likedButton.get('svg').attributes('fill')).toBe('currentColor')

    await likedSongs.toggle('2')
    await flushPromises()

    expect(mutateMusic).toHaveBeenCalledWith({
      operation: 'likeTrack',
      trackId: '2',
      liked: false
    })
    expect(likedSongs.isLiked('2')).toBe(false)
    expect(wrapper.get('button[aria-label="收藏"]').attributes('aria-pressed')).toBeUndefined()
  })
})
