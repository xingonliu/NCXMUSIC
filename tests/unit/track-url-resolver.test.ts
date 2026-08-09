import { describe, expect, it, vi } from 'vitest'

import {
  TrackUrlResolver,
  type NeteaseApi
} from '../../src/infrastructure/netease/track-url-resolver'

// ========= 变量 =========

/** 构造一个带短期明文 CDN 地址的 API 夹具。 */
function apiFixture(): NeteaseApi {
  return {
    song_url_v1: vi.fn(async () => ({
      status: 200,
      body: {
        code: 200,
        data: [{
          url: 'http://m8.music.126.net/example.mp3',
          level: 'standard',
          br: 128000,
          type: 'mp3'
        }]
      }
    }))
  }
}

// ========= 测试 =========

describe('TrackUrlResolver', () => {
  it('显式使用 weapi 并将 CDN 地址规范为 HTTPS', async () => {
    /** 可控网易云 API 夹具。 */
    const api = apiFixture()
    /** 注入夹具的播放地址解析器。 */
    const resolver = new TrackUrlResolver(api)

    /** 解析后的标准音质媒体源。 */
    const result = await resolver.resolve('457264737', 'standard', '')

    expect(api.song_url_v1).toHaveBeenCalledWith({
      id: '457264737',
      level: 'standard',
      cookie: '',
      timeout: 15_000,
      crypto: 'weapi'
    })
    expect(result.url).toBe('https://m8.music.126.net/example.mp3')
  })
})
