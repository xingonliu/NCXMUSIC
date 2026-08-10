// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MediaArtwork from '../../src/renderer/features/music/components/MediaArtwork.vue'
import MusicCommentsSection from '../../src/renderer/features/music/components/MusicCommentsSection.vue'
import VirtualTrackList from '../../src/renderer/features/music/components/VirtualTrackList.vue'
import { disposeAccountSessionStore } from '../../src/renderer/features/account/account-session-store'
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
  afterEach(() => {
    disposeAccountSessionStore()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

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

  it('can preserve an already cached artwork URL during a shared element transition', () => {
    /** PlayerBar 已经加载过的原始缩略封面。 */
    const source = 'https://p1.music.126.net/cached.jpg?param=96y96'
    /** 禁止 URL 改写后的沉浸封面组件。 */
    const wrapper = mount(MediaArtwork, {
      props: {
        src: source,
        alt: '共享动画封面',
        size: 'hero',
        adaptSource: false,
        loading: 'eager'
      }
    })

    expect(wrapper.find('img').attributes('src')).toBe(source)
    expect(wrapper.find('img').attributes('loading')).toBe('eager')
  })

  it('只挂载真实可视窗口和 overscan 行', () => {
    /** 两百首歌曲的长列表。 */
    const songs = Array.from({ length: 200 }, (_, index) => song(index))
    /** 直接交给页面主滚动容器的歌曲列表。 */
    const wrapper = mount(VirtualTrackList, { props: { songs } })

    expect(wrapper.findAll('.track-row').length).toBeLessThan(200)
    expect(wrapper.find('.virtual-track-list').attributes('style')).toContain('height: 520px')
    expect(wrapper.find('.virtual-track-list-spacer').attributes('style')).toContain('height: 12000px')
  })

  it('exposes keyboard-reachable playlist removal controls and context actions', async () => {
    /** 两首可管理的自建歌单歌曲。 */
    const songs = [song(0), song(1)]
    /** 开启歌单管理能力的虚拟歌曲列表。 */
    const wrapper = mount(VirtualTrackList, {
      props: { songs, playlistManagement: true }
    })

    const remove = wrapper.find('button[aria-label="从当前歌单移除"]')
    expect(remove.exists()).toBe(true)
    await remove.trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual([songs[0]])
    await wrapper.find('.track-row').trigger('keydown', { key: 'F10', shiftKey: true })
    await flushPromises()
    expect(document.body.querySelector('.ncx-common-context-panel')).not.toBeNull()
    wrapper.unmount()
  })

  it('renders normalized public comments while keeping guest mutations disabled', async () => {
    /** 标准评论读取方法。 */
    const readMusic = vi.fn(async () => ({
      ok: true as const,
      data: {
        kind: 'commentCollection' as const,
        resourceType: 'song' as const,
        resourceId: '1',
        comments: [{
          id: '91',
          resourceType: 'song' as const,
          resourceId: '1',
          author: { id: '8', nickname: '听友甲' },
          content: '这一段编曲很耐听。',
          time: 1_786_000_000_000,
          likedCount: 3,
          liked: false,
          owner: false
        }],
        hotComments: [],
        total: 1,
        more: false,
        updatedAt: observedAt
      }
    }))
    /** 游客账户快照。 */
    const guestSnapshot = {
      state: 'guest' as const,
      accountGeneration: 1,
      activeAccount: { kind: 'guest' as const },
      canMutateMusic: false
    }
    Object.defineProperty(window, 'ncx', {
      configurable: true,
      value: {
        runtime: {
          readMusic,
          mutateMusic: vi.fn(),
          cancel: vi.fn()
        },
        account: {
          snapshot: vi.fn(async () => guestSnapshot),
          onSnapshot: vi.fn(() => (): void => {})
        }
      }
    })

    /** 评论 Section。 */
    const wrapper = mount(MusicCommentsSection, {
      props: { resourceType: 'song', resourceId: '1' },
      attachTo: document.body
    })
    await flushPromises()

    expect(readMusic).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'getComments',
      resourceType: 'song',
      resourceId: '1'
    }))
    expect(wrapper.text()).toContain('听友甲')
    expect(wrapper.text()).toContain('这一段编曲很耐听。')
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
