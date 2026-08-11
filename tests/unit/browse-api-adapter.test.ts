import { describe, expect, it, vi } from 'vitest'

import {
  NeteaseMusicApiAdapter,
  type NeteaseMusicApi
} from '../../src/infrastructure/netease/music-api-adapter'

// ========= 函数 =========

/** 创建覆盖浏览能力的最小网易云 API 测试替身。 */
function createApi(): NeteaseMusicApi {
  return {
    search: vi.fn(async () => ({ status: 200, body: { code: 200, result: {} } })),
    song_detail: vi.fn(async () => ({ status: 200, body: { code: 200, songs: [] } })),
    artists: vi.fn(async () => ({ status: 200, body: { code: 200, artist: null, hotSongs: [] } })),
    album: vi.fn(async () => ({ status: 200, body: { code: 200, album: null, songs: [] } })),
    playlist_detail: vi.fn(async () => ({ status: 200, body: { code: 200, playlist: null } })),
    user_detail: vi.fn(async () => ({ status: 200, body: { code: 200, profile: null } })),
    likelist: vi.fn(async () => ({ status: 200, body: { code: 200, ids: [] } })),
    playlist_catlist: vi.fn(async () => ({
      status: 200,
      body: {
        code: 200,
        categories: { 1: '服务端新风格', 2: '服务端新场景' },
        sub: [
          { name: '未来曲风', category: 1 },
          { name: '深空通勤', category: 2 }
        ]
      }
    })),
    top_playlist: vi.fn(async () => ({
      status: 200,
      body: {
        code: 200,
        playlists: [{ id: 701, name: '未来曲风精选', coverImgUrl: 'https://example.com/list.jpg' }]
      }
    })),
    artist_list: vi.fn(async () => ({
      status: 200,
      body: {
        code: 200,
        artists: [{ id: 801, name: 'API 歌手', picUrl: 'https://example.com/artist.jpg' }]
      }
    })),
    search_suggest: vi.fn(async () => ({
      status: 200,
      body: {
        code: 200,
        result: { artists: [{ id: 801, name: 'API 歌手' }] }
      }
    })),
    user_record: vi.fn(async () => ({
      status: 200,
      body: {
        code: 200,
        weekData: [{ song: { id: 901, name: '本周歌曲', ar: [], al: { id: 902, name: '专辑' } }, playCount: 17 }]
      }
    }))
  }
}

// ========= 测试 =========

describe('浏览与个人页 API 适配', () => {
  it('从 playlist_catlist 动态生成分类 facet，并原样驱动分类请求', async () => {
    /** 网易云 API 测试替身。 */
    const api = createApi()
    /** 标准音乐 API 适配器。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    /** API 分类树标准响应。 */
    const facets = await adapter.read({ operation: 'getBrowseFacets' }, '')
    expect(facets.kind).toBe('playlistCollection')
    if (facets.kind !== 'playlistCollection') return
    expect(facets.collection).toBe('facets')
    expect(facets.facets.find((group) => group.key === 'playlist-style')?.options).toEqual([
      { value: '未来曲风', label: '未来曲风' }
    ])
    expect(facets.facets.find((group) => group.key === 'artist-area')?.options.length).toBeGreaterThan(0)

    /** 动态分类对应的歌单响应。 */
    const playlists = await adapter.read({
      operation: 'getCategoryPlaylists',
      category: '未来曲风',
      limit: 10
    }, '')
    expect(playlists.kind).toBe('playlistCollection')
    expect(api.top_playlist).toHaveBeenCalledWith(expect.objectContaining({ cat: '未来曲风', limit: 10 }))
  })

  it('把 API 歌手筛选、实时建议和听歌次数归一化为标准实体', async () => {
    /** 网易云 API 测试替身。 */
    const api = createApi()
    /** 标准音乐 API 适配器。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    /** 筛选歌手标准响应。 */
    const artists = await adapter.read({
      operation: 'getArtists',
      area: '96',
      artistType: '2',
      initial: 'A',
      limit: 30,
      offset: 0
    }, '')
    expect(artists.kind).toBe('artistCollection')
    expect(api.artist_list).toHaveBeenCalledWith(expect.objectContaining({ area: '96', type: '2', initial: 'A' }))

    /** 实时搜索建议标准响应。 */
    const suggestions = await adapter.read({ operation: 'getSearchSuggestions', query: 'API', limit: 8 }, '')
    expect(suggestions.kind).toBe('search')
    if (suggestions.kind === 'search') expect(suggestions.artists[0]?.name).toBe('API 歌手')
    expect(api.search_suggest).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'API', type: 'web' }))

    /** 最近一周听歌排行标准响应。 */
    const history = await adapter.read({
      operation: 'getListeningHistory',
      userId: '1001',
      period: 'week',
      limit: 100
    }, '')
    expect(history.kind).toBe('songCollection')
    if (history.kind === 'songCollection') expect(history.songs[0]?.listeningCount).toBe(17)
  })

  it('分批读取超过五百首喜欢歌曲并保留歌单加入时间', async () => {
    /** 覆盖大喜欢列表与歌单详情的 API 测试替身。 */
    const api = createApi()
    /** 五百零一个稳定歌曲 ID。 */
    const likedIds = Array.from({ length: 501 }, (_, index) => String(index + 1))
    api.likelist = vi.fn(async () => ({ status: 200, body: { code: 200, ids: likedIds } }))
    api.song_detail = vi.fn(async (params) => {
      /** 当前分批请求的歌曲 ID。 */
      const ids = String(params['ids']).split(',')
      return {
        status: 200,
        body: { code: 200, songs: ids.map((id) => ({ id, name: `歌曲 ${id}`, ar: [] })) }
      }
    })
    api.playlist_detail = vi.fn(async () => ({
      status: 200,
      body: {
        code: 200,
        playlist: {
          id: 7001,
          name: '加入时间歌单',
          tracks: [{ id: 9, name: '带时间歌曲', ar: [] }],
          trackIds: [{ id: 9, at: 1_700_000_000_000 }]
        }
      }
    }))
    /** 标准音乐 API 适配器。 */
    const adapter = new NeteaseMusicApiAdapter(api)

    /** 未截断的喜欢歌曲集合。 */
    const liked = await adapter.read({ operation: 'getLikedSongs', userId: '1001', limit: 100_000 }, '')
    expect(liked.kind).toBe('songCollection')
    if (liked.kind === 'songCollection') expect(liked.songs).toHaveLength(501)
    expect(api.song_detail).toHaveBeenCalledTimes(2)

    /** 带歌单上下文加入时间的标准详情。 */
    const playlist = await adapter.read({ operation: 'getPlaylist', id: '7001' }, '')
    expect(playlist.kind).toBe('playlist')
    if (playlist.kind === 'playlist') expect(playlist.entity?.songs[0]?.addedAt).toBe(1_700_000_000_000)
  })
})
