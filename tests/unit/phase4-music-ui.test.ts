// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MediaArtwork from '../../src/renderer/features/music/components/MediaArtwork.vue'
import VirtualTrackList from '../../src/renderer/features/music/components/VirtualTrackList.vue'
import { adaptArtworkUrl } from '../../src/renderer/features/music/music-entity'
import type { StandardSong } from '../../src/shared/schemas/music'

// ========= 变量 =========

/** 固定实体观测时间。 */
const observedAt = '2026-08-09T08:00:00.000Z'

// ========= 函数 =========

/** 创建虚拟列表歌曲夹具。 */
function song(index: number): StandardSong {
  return {
    kind: 'song',
    id: String(index + 1),
    name: `歌曲 ${index + 1}`,
    artists: [],
    access: { badges: [], playableKnown: false },
    sources: [{ api: 'test.fixture', observedAt }],
    updatedAt: observedAt
  }
}

// ========= 测试区 =========

describe('Phase 4 music UI primitives', () => {
  it('generates all semantic artwork variants with one normalized param', () => {
    /** 带已有尺寸和其他查询参数的原图地址。 */
    const source = 'https://p1.music.126.net/a.jpg?foo=bar&param=10y10'

    expect(adaptArtworkUrl(source, 'thumbnail')).toContain('param=96y96')
    expect(adaptArtworkUrl(source, 'compact')).toContain('param=160y160')
    expect(adaptArtworkUrl(source, 'card')).toContain('param=320y320')
    expect(adaptArtworkUrl(source, 'feature')).toContain('param=640y640')
    expect(adaptArtworkUrl(source, 'hero')).toContain('param=1024y1024')
    expect(adaptArtworkUrl(source, 'hero')?.match(/param=/gu)).toHaveLength(1)
  })

  it('keeps artwork layout stable when no image URL exists', () => {
    /** 无远程图片的封面组件。 */
    const wrapper = mount(MediaArtwork, { props: { src: undefined, alt: '占位封面', size: 'feature' } })

    expect(wrapper.find('.media-artwork--feature').exists()).toBe(true)
    expect(wrapper.find('.media-artwork-placeholder').exists()).toBe(true)
  })

  it('renders the complete collection for the page-level scrollbar', () => {
    /** 两百首歌曲的长列表。 */
    const songs = Array.from({ length: 200 }, (_, index) => song(index))
    /** 直接交给页面主滚动容器的歌曲列表。 */
    const wrapper = mount(VirtualTrackList, { props: { songs } })

    expect(wrapper.findAll('.track-row')).toHaveLength(200)
    expect(wrapper.find('.virtual-track-list').attributes('style')).toBeUndefined()
  })
})
