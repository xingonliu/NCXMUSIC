import { describe, expect, it } from 'vitest'

import { EntityResolver } from '../../src/domains/agent/entity-resolver'
import type { StandardSong } from '../../src/shared/schemas/music'

// ========= 工具函数 =========

/** 创建名称可控的标准歌曲实体。 */
function song(id: string, name: string): StandardSong {
  return {
    kind: 'song',
    id,
    name,
    artists: [],
    access: { badges: [], playableKnown: true },
    sources: [{ api: 'fixture', observedAt: '2026-08-10T08:00:00.000Z' }],
    updatedAt: '2026-08-10T08:00:00.000Z'
  }
}

// ========= 测试 =========

describe('agent entity resolver', () => {
  it('唯一名称候选直接解析', () => {
    /** 只包含唯一匹配歌曲的解析器。 */
    const resolver = new EntityResolver(() => ({ entities: [song('1', '晴天')] }))

    expect(resolver.resolve({ kind: 'song', reference: '晴天' })).toMatchObject({
      status: 'resolved',
      entity: { id: '1' }
    })
  })

  it('同名精确候选必须进入消歧而不擅自选择', () => {
    /** 包含两个同名歌曲的解析器。 */
    const resolver = new EntityResolver(() => ({
      entities: [song('1', '同名歌曲'), song('2', '同名歌曲')]
    }))

    expect(resolver.resolve({ kind: 'song', reference: '同名歌曲' })).toMatchObject({
      status: 'needs_selection',
      candidates: [{ id: '1' }, { id: '2' }]
    })
  })
})
