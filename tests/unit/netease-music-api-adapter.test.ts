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
    user_detail: vi.fn(async () => response({ profile: null })),
    personalized: vi.fn(async () => response({
      result: [{ id: 9001, name: '精选歌单', creator: { userId: 10001, nickname: '创建者' } }]
    })),
    personalized_newsong: vi.fn(async () => response({
      result: [{ song: { id: 7001, name: '新歌', ar: [{ id: 77, name: '新歌手' }] } }]
    })),
    recommend_songs: vi.fn(async () => response({
      data: { dailySongs: [{ id: 7002, name: '每日歌曲', ar: [{ id: 78, name: '每日歌手' }] }] }
    })),
    user_playlist: vi.fn(async () => response({
      playlist: [
        { id: 8001, name: '自建歌单', creator: { userId: 10001, nickname: '当前用户' } },
        { id: 8002, name: '收藏歌单', creator: { userId: 20002, nickname: '其他用户' }, subscribed: true }
      ]
    })),
    likelist: vi.fn(async () => response({ ids: [33894312] })),
    artist_album: vi.fn(async () => response({ hotAlbums: [{ id: 34740156, name: '新的心跳' }] })),
    simi_artist: vi.fn(async () => response({ artists: [{ id: 88, name: '相似歌手' }] })),
    like: vi.fn(async () => response({ code: 200 })),
    playlist_subscribe: vi.fn(async () => response({ code: 200 })),
    album_sub: vi.fn(async () => response({ code: 200 })),
    playlist_create: vi.fn(async () => response({ code: 200, playlist: { id: 9901 } })),
    playlist_name_update: vi.fn(async () => response({ code: 200 })),
    playlist_delete: vi.fn(async () => response({ code: 200 })),
    playlist_tracks: vi.fn(async () => response({ code: 200 })),
    song_order_update: vi.fn(async () => response({ code: 200 })),
    comment_music: vi.fn(async () => response({
      total: 2,
      more: false,
      hotComments: [{
        commentId: 91001,
        user: { userId: 10001, nickname: '热门听友', avatarUrl: 'https://p1.music.126.net/hot.jpg' },
        content: '热门评论',
        time: 1_786_000_000_000,
        likedCount: 12,
        liked: true,
        owner: false,
        ipLocation: { location: '上海' }
      }],
      comments: [{
        commentId: 91002,
        user: { userId: 10002, nickname: '普通听友' },
        content: '普通评论',
        time: 1_786_000_100_000,
        likedCount: 0,
        liked: false,
        owner: true
      }]
    })),
    comment_album: vi.fn(async () => response({ total: 0, more: false, comments: [], hotComments: [] })),
    comment_playlist: vi.fn(async () => response({ total: 0, more: false, comments: [], hotComments: [] })),
    comment: vi.fn(async () => response({ code: 200, comment: { commentId: 92001 } })),
    comment_like: vi.fn(async () => response({ code: 200 })),
    daily_signin: vi.fn(async () => response({ code: 200 }))
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

  it('prefers cloud search so song results retain complete album artwork', async () => {
    /** 同时提供新旧搜索接口的网易云 API 夹具。 */
    const api = apiFixture()
    api.cloudsearch = vi.fn(async () => response({
      result: {
        songs: [{
          id: 33894312,
          name: '光年之外',
          ar: [{ id: 7763, name: 'G.E.M.邓紫棋' }],
          al: {
            id: 34740156,
            name: '新的心跳',
            picUrl: 'http://p1.music.126.net/complete-cover.jpg'
          },
          dt: 235000
        }]
      }
    }))
    /** 使用完整云搜索结果的网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    const result = await adapter.read({
      operation: 'search',
      query: '光年之外',
      category: 'songs',
      limit: 10,
      offset: 0
    }, '', undefined)

    expect(result.kind).toBe('search')
    if (result.kind !== 'search') throw new Error('Expected search result')
    expect(result.songs[0]?.album?.artworkUrl).toBe('http://p1.music.126.net/complete-cover.jpg')
    expect(api.cloudsearch).toHaveBeenCalledWith(expect.objectContaining({
      keywords: '光年之外',
      type: '1'
    }))
    expect(api.search).not.toHaveBeenCalled()
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
      {
        lineStartMs: 1_000,
        lineDurationMs: 2_500,
        text: '夜空中最亮的星',
        words: [],
        translation: 'The brightest star'
      },
      {
        lineStartMs: 3_500,
        lineDurationMs: 2_200,
        text: '能否听清',
        words: [],
        translation: 'Can you hear me'
      }
    ])
    expect(JSON.stringify(result)).not.toContain('cookie')
  })

  it('prefers yrc and preserves line, word and duet-label timing', async () => {
    /** 提供逐字歌词的网易云 API 夹具。 */
    const api = apiFixture()
    api.lyric_new = vi.fn(async () => response({
      lrc: { lyric: '[00:01.00]夜空中\n[00:12.00]女：等你' },
      yrc: {
        lyric: [
          '[1000,2400](1000,500,0)夜(1500,500,0)空(2000,1000,0)中',
          '[12000,3000](12000,500,0)女：(12500,1000,0)等(13500,1000,0)你'
        ].join('\n')
      },
      tlyric: { lyric: '[00:01.00]In the night\n[00:12.00]Waiting for you' }
    }))
    /** 使用逐字夹具的网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    const result = await adapter.read({
      operation: 'getLyrics',
      id: '90001'
    }, '', undefined)

    expect(result.kind).toBe('lyrics')
    if (result.kind !== 'lyrics') throw new Error('Expected lyrics result')
    expect(result.entity?.lines).toEqual([
      {
        lineStartMs: 1_000,
        lineDurationMs: 2_400,
        text: '夜空中',
        words: [
          { text: '夜', startMs: 1_000, durationMs: 500 },
          { text: '空', startMs: 1_500, durationMs: 500 },
          { text: '中', startMs: 2_000, durationMs: 1_000 }
        ],
        translation: 'In the night'
      },
      {
        lineStartMs: 12_000,
        lineDurationMs: 3_000,
        text: '女：等你',
        words: [
          { text: '女：', startMs: 12_000, durationMs: 500 },
          { text: '等', startMs: 12_500, durationMs: 1_000 },
          { text: '你', startMs: 13_500, durationMs: 1_000 }
        ],
        translation: 'Waiting for you'
      }
    ])
  })

  it('marks harmony labels as background vocals without treating male/female leads as background', async () => {
    /** 同时包含主唱标签和和声标签的网易云 API 夹具。 */
    const api = apiFixture()
    api.lyric_new = vi.fn(async () => response({
      lrc: { lyric: '[00:01.00]男：主唱\n[00:02.00]和声：回响' }
    }))
    /** 使用声部标签夹具的网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    const result = await adapter.read({
      operation: 'getLyrics',
      id: '90003'
    }, '', undefined)

    expect(result.kind).toBe('lyrics')
    if (result.kind !== 'lyrics') throw new Error('Expected lyrics result')
    expect(result.entity?.lines[0]?.vocalRole).toBeUndefined()
    expect(result.entity?.lines[1]?.vocalRole).toBe('background')
  })

  it('accepts millisecond line headers when they are returned in the lrc field', async () => {
    /** 提供毫秒行头 LRC 的网易云 API 夹具。 */
    const api = apiFixture()
    api.lyric_new = vi.fn(async () => response({
      lrc: { lyric: '[1500,900]短句' }
    }))
    /** 使用毫秒行头夹具的网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    const result = await adapter.read({
      operation: 'getLyrics',
      id: '90002'
    }, '', undefined)

    expect(result.kind).toBe('lyrics')
    if (result.kind !== 'lyrics') throw new Error('Expected lyrics result')
    expect(result.entity?.lines).toEqual([{
      lineStartMs: 1_500,
      lineDurationMs: 900,
      text: '短句',
      words: []
    }])
  })

  it('normalizes independent Phase 4 discovery and library collections', async () => {
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(apiFixture())
    /** 平台推荐歌单结果。 */
    const featured = await adapter.read({ operation: 'getFeaturedPlaylists', limit: 10 }, '')
    /** 用户歌单资产结果。 */
    const library = await adapter.read({
      operation: 'getUserPlaylists',
      userId: '10001',
      limit: 50,
      offset: 0
    }, '')

    expect(featured).toMatchObject({
      kind: 'playlistCollection',
      collection: 'featured',
      playlists: [{ id: '9001', name: '精选歌单' }]
    })
    expect(library).toMatchObject({
      kind: 'playlistCollection',
      collection: 'user',
      playlists: [
        { id: '8001', owned: true },
        { id: '8002', owned: false, subscribed: true }
      ]
    })
  })

  it('executes registered Phase 4 mutations and returns only standard receipts', async () => {
    /** 带可控写入方法的 API 夹具。 */
    const api = apiFixture()
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)
    /** 创建歌单标准回执。 */
    const result = await adapter.mutate({
      operation: 'createPlaylist',
      name: '通勤',
      privacy: 'public'
    }, 'MUSIC_U=secret')

    expect(api.playlist_create).toHaveBeenCalledWith(expect.objectContaining({
      name: '通勤',
      privacy: 0,
      cookie: 'MUSIC_U=secret'
    }))
    expect(result).toMatchObject({ operation: 'createPlaylist', succeeded: true, entityId: '9901' })
    expect(JSON.stringify(result)).not.toContain('MUSIC_U')
  })

  it('normalizes public comments without leaking raw social fields', async () => {
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(apiFixture())

    const result = await adapter.read({
      operation: 'getComments',
      resourceType: 'song',
      resourceId: '33894312',
      limit: 20,
      offset: 0
    }, '')

    expect(result).toMatchObject({
      kind: 'commentCollection',
      resourceType: 'song',
      resourceId: '33894312',
      total: 2,
      more: false,
      hotComments: [{
        id: '91001',
        author: { id: '10001', nickname: '热门听友' },
        content: '热门评论',
        likedCount: 12,
        liked: true,
        location: '上海'
      }],
      comments: [{ id: '91002', owner: true }]
    })
    expect(JSON.stringify(result)).not.toContain('ipLocation')
  })

  it('executes comment and playlist ordering mutations with exact SDK parameters', async () => {
    /** 带可控评论和排序方法的 API 夹具。 */
    const api = apiFixture()
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    const added = await adapter.mutate({
      operation: 'addComment',
      resourceType: 'album',
      resourceId: '34740156',
      content: '值得反复听'
    }, 'MUSIC_U=secret')
    await adapter.mutate({
      operation: 'likeComment',
      resourceType: 'song',
      resourceId: '33894312',
      commentId: '91002',
      liked: true
    }, 'MUSIC_U=secret')
    await adapter.mutate({
      operation: 'reorderPlaylistTracks',
      playlistId: '8001',
      trackIds: ['3', '1', '2']
    }, 'MUSIC_U=secret')

    expect(api.comment).toHaveBeenCalledWith(expect.objectContaining({
      id: '34740156',
      type: 3,
      t: 1,
      content: '值得反复听'
    }))
    expect(api.comment_like).toHaveBeenCalledWith(expect.objectContaining({
      id: '33894312',
      type: 0,
      t: 1,
      cid: '91002'
    }))
    expect(api.song_order_update).toHaveBeenCalledWith(expect.objectContaining({
      pid: '8001',
      ids: '3,1,2'
    }))
    expect(added).toMatchObject({ operation: 'addComment', entityId: '92001' })
    expect(JSON.stringify(added)).not.toContain('MUSIC_U')
  })

  it('rejects non-success HTTP status instead of returning an empty entity', async () => {
    /** 返回限流响应的网易云 API。 */
    const api = apiFixture()
    api.song_detail = vi.fn(async () => ({ status: 429, body: { code: 429 } }))
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    await expect(adapter.read({ operation: 'getSong', id: '33894312' }, '', undefined))
      .rejects.toMatchObject({
        code: 'UPSTREAM_ERROR',
        httpStatus: 429,
        upstreamCode: 429,
        retryable: true
      })
  })

  it('rejects non-success body code even when HTTP succeeds', async () => {
    /** 返回登录失效业务码的网易云 API。 */
    const api = apiFixture()
    api.lyric_new = vi.fn(async () => ({ status: 200, body: { code: 301 } }))
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    await expect(adapter.read({ operation: 'getLyrics', id: '33894312' }, '', undefined))
      .rejects.toMatchObject({
        code: 'UPSTREAM_ERROR',
        httpStatus: 200,
        upstreamCode: 301,
        retryable: false
      })
  })

  it('restores console only after all concurrent third-party calls complete', async () => {
    /** 测试进入前的 console.log。 */
    const originalLog = console.log
    /** 第一个并发调用释放函数。 */
    let releaseFirst = (): void => {}
    /** 第一个并发调用。 */
    const first = new Promise<{ status: number; body: unknown }>((resolve) => {
      releaseFirst = () => resolve(response({ songs: [] }))
    })
    /** 第二个并发调用释放函数。 */
    let releaseSecond = (): void => {}
    /** 第二个并发调用。 */
    const second = new Promise<{ status: number; body: unknown }>((resolve) => {
      releaseSecond = () => resolve(response({ songs: [] }))
    })
    /** 并发读取歌曲的网易云 API。 */
    const api = apiFixture()
    api.song_detail = vi
      .fn<() => Promise<{ status: number; body: unknown }>>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)
    /** 第一个读取任务。 */
    const firstRead = adapter.read({ operation: 'getSong', id: '1' }, '', undefined)
    /** 第二个读取任务。 */
    const secondRead = adapter.read({ operation: 'getSong', id: '2' }, '', undefined)

    releaseFirst()
    await firstRead
    expect(console.log).not.toBe(originalLog)

    releaseSecond()
    await secondRead
    expect(console.log).toBe(originalLog)
  })

  it('normalizes raw third-party rejection objects into NeteaseUpstreamError', async () => {
    /** 抛出未封装对象 (301 未登录) 的三方 API 夹具。 */
    const api = apiFixture()
    api.daily_signin = vi.fn(async () => {
      throw { status: 301, body: { code: 301, message: null } }
    })
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    await expect(adapter.mutate({ operation: 'dailySignin' }, 'cookie'))
      .rejects.toMatchObject({
        code: 'UPSTREAM_ERROR',
        httpStatus: 301,
        upstreamCode: 301,
        retryable: false,
        message: '登录状态已失效，请重新登录。'
      })
  })

  it('handles duplicate daily signin code -2 with specific error message', async () => {
    /** 返回重复签到业务码的 API 夹具。 */
    const api = apiFixture()
    api.daily_signin = vi.fn(async () => ({ status: 200, body: { code: -2, msg: '重复签到' } }))
    /** 网易云 Adapter。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    await expect(adapter.mutate({ operation: 'dailySignin' }, 'cookie'))
      .rejects.toMatchObject({
        code: 'UPSTREAM_ERROR',
        upstreamCode: -2,
        retryable: false,
        message: '重复签到'
      })
  })
})
