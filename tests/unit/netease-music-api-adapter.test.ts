import { describe, expect, it, vi } from 'vitest'

import {
  NeteaseMusicApiAdapter,
  type NeteaseMusicApi
} from '../../src/infrastructure/netease/music-api-adapter'

// ========= 测试夹具区 =========

/** 构造网易云 API 响应。 */
function response(body: unknown): { body: unknown; status: number } {
  return { body, status: 200 }
}

/** 构造网易云 API 夹具。 */
function apiFixture(): NeteaseMusicApi {
  return {
    search: vi.fn(async (params: Record<string, unknown>) => {
      if (params['type'] === '1') {
        return response({
          result: {
            songs: [{
              id: 33894312,
              name: '光年之外',
              fee: 1,
              ar: [{ id: 7763, name: 'G.E.M.邓紫棋' }],
              al: { id: 34740156, name: '新的心跳', picUrl: 'https://p1.music.126.net/a.jpg' },
              dt: 235000
            }]
          }
        })
      }
      if (params['type'] === '100') {
        return response({ result: { artists: [{ id: 7763, name: 'G.E.M.邓紫棋' }] } })
      }
      if (params['type'] === '10') {
        return response({ result: { albums: [{ id: 34740156, name: '新的心跳' }] } })
      }
      return response({ result: { playlists: [{ id: 2488306802, name: '华语私人雷达' }] } })
    }),
    song_detail: vi.fn(async () => response({ songs: [] })),
    lyric_new: vi.fn(async () =>
      response({
        lrc: { lyric: '[00:01.00]夜空中最亮的星\n[00:03.50]能否听清' },
        tlyric: { lyric: '[00:01.00]The brightest star\n[00:03.50]Can you hear me' }
      })
    ),
    artists: vi.fn(async () => response({ artist: null })),
    album: vi.fn(async () => response({ album: null })),
    playlist_detail: vi.fn(async () => response({ playlist: null })),
    user_detail: vi.fn(async () => response({ profile: null }))
  }
}

// ========= 测试区 =========

describe('NeteaseMusicApiAdapter', () => {
  it('normalizes search results into standard entities', async () => {
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(apiFixture())

    const result = await adapter.read({
      operation: 'search',
      query: '光年之外',
      limit: 10,
      offset: 0
    }, '', undefined)

    expect(result.kind).toBe('search')
    if (result.kind !== 'search') throw new Error('Expected search result')
    expect(result.songs[0]).toMatchObject({
      kind: 'song',
      id: '33894312',
      name: '光年之外',
      access: { badges: ['vip'] }
    })
    expect(result.artists[0]).toMatchObject({ kind: 'artist', id: '7763' })
    expect(result.albums[0]).toMatchObject({ kind: 'album', id: '34740156' })
    expect(result.playlists[0]).toMatchObject({ kind: 'playlist', id: '2488306802' })
    expect(JSON.stringify(result)).not.toContain('cookie')
  })

  it('normalizes lyrics into timed lines with translations', async () => {
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(apiFixture())

    const result = await adapter.read({
      operation: 'getLyrics',
      id: '33894312'
    }, '', undefined)

    expect(result.kind).toBe('lyrics')
    if (result.kind !== 'lyrics') throw new Error('Expected lyrics result')
    expect(result.entity?.lines).toEqual([
      { timeMs: 1000, text: '夜空中最亮的星', translation: 'The brightest star' },
      { timeMs: 3500, text: '能否听清', translation: 'Can you hear me' }
    ])
    expect(JSON.stringify(result)).not.toContain('cookie')
  })
})
