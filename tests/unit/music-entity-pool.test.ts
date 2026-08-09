import { describe, expect, it } from 'vitest'

import { StandardEntityPool } from '../../src/domains/music/entity-pool'
import type { StandardSong } from '../../src/shared/schemas/music'

// ========= 测试夹具区 =========

/** 构造标准歌曲实体。 */
function song(name: string, api: string, observedAt: string): StandardSong {
  return {
    kind: 'song',
    id: '33894312',
    name,
    artists: [],
    access: { badges: [], playableKnown: false },
    sources: [{ api, observedAt }],
    updatedAt: observedAt
  }
}

// ========= 测试区 =========

describe('StandardEntityPool', () => {
  it('merges duplicate entities and keeps source lineage', () => {
    /** 标准实体池。 */
    const pool = new StandardEntityPool()
    /** 初始实体。 */
    const first = pool.upsert(song('旧名称', 'ncm.search', '2026-08-08T00:00:00.000Z'))
    /** 后续详情实体。 */
    const second = pool.upsert(song('光年之外', 'ncm.song_detail', '2026-08-08T01:00:00.000Z'))

    expect(first.sources).toHaveLength(1)
    if (second.kind !== 'song') throw new Error('Expected song entity')
    expect(second.name).toBe('光年之外')
    expect(second.sources.map((source) => source.api)).toEqual(['ncm.search', 'ncm.song_detail'])
    expect(pool.snapshot().entities).toHaveLength(1)
  })

  it('does not let default empty search fields erase richer detail fields', () => {
    /** 标准实体池。 */
    const pool = new StandardEntityPool()
    /** 详情接口返回的丰富歌曲实体。 */
    const detail: StandardSong = {
      ...song('光年之外', 'ncm.song_detail', '2026-08-08T00:00:00.000Z'),
      artists: [{ id: '7763', name: 'G.E.M.邓紫棋', alias: ['G.E.M.'] }],
      album: { id: '34740156', name: '新的心跳' },
      access: { badges: ['vip'], playableKnown: true }
    }
    /** 后到但字段较弱的搜索实体。 */
    const search = song('光年之外', 'ncm.search', '2026-08-08T01:00:00.000Z')

    pool.upsert(detail)
    const merged = pool.upsert(search)

    if (merged.kind !== 'song') throw new Error('Expected song entity')
    expect(merged.artists).toEqual(detail.artists)
    expect(merged.album).toEqual(detail.album)
    expect(merged.access).toEqual({ badges: ['vip'], playableKnown: true })
  })
})
