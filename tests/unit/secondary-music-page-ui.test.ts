// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BrowsePage from '../../src/renderer/features/music/BrowsePage.vue'
import SearchPage from '../../src/renderer/features/music/SearchPage.vue'
import { disposePlayer } from '../../src/renderer/features/music/use-player'

// ========= 变量 =========

/** 标准测试实体观测时间。 */
const observedAt = '2026-08-12T07:00:00.000Z'

/** 五个首页歌单分类分组夹具。 */
const playlistFacets = [
  { key: 'playlist-language' as const, label: '语种', options: [{ value: '华语', label: '华语' }] },
  { key: 'playlist-style' as const, label: '风格', options: [{ value: '流行', label: '流行' }] },
  { key: 'playlist-scene' as const, label: '场景', options: [{ value: '清晨', label: '清晨' }] },
  { key: 'playlist-mood' as const, label: '情感', options: [{ value: '怀旧', label: '怀旧' }] },
  { key: 'playlist-theme' as const, label: '主题', options: [{ value: '综艺', label: '综艺' }] }
]

// ========= 函数 =========

/** 创建成功的 Runtime 响应。 */
function runtimeSuccess(data: unknown): { ok: true; data: unknown } {
  return { ok: true, data }
}

// ========= 测试区 =========

describe('二级音乐内容页视觉结构', () => {
  afterEach(() => {
    disposePlayer()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('保持搜索页为单一搜索控件而不叠加装饰卡片', async () => {
    /** 搜索页结构测试使用的内存路由。 */
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/search', component: SearchPage }]
    })
    await router.push('/search')
    await router.isReady()

    /** 当前搜索页组件包装器。 */
    const wrapper = mount(SearchPage, {
      global: { plugins: [router] }
    })

    expect(wrapper.classes()).toContain('music-content-page')
    expect(wrapper.get('h1').text()).toBe('搜索')
    expect(wrapper.find('.music-search-box').exists()).toBe(true)
    expect(wrapper.find('.music-search-panel').exists()).toBe(false)
  })

  it('分类请求晚于其他内容区完成时仍会结束每行加载状态', async () => {
    /** 释放五个分类歌单请求的函数。 */
    let resolveCategoryRequests = (): void => {}
    /** 由测试显式延后完成的分类歌单响应。 */
    const categoryResponse = new Promise<ReturnType<typeof runtimeSuccess>>((resolve) => {
      resolveCategoryRequests = () => resolve(runtimeSuccess({
        kind: 'playlistCollection',
        collection: 'category',
        category: '测试分类',
        playlists: [{
          kind: 'playlist',
          id: '701',
          name: '分类精选歌单',
          songs: [],
          sources: [{ api: 'test.fixture', observedAt }],
          updatedAt: observedAt
        }],
        updatedAt: observedAt
      }))
    })
    /** 页面音乐读取替身，只有分类歌单请求会保持等待。 */
    const readMusic = vi.fn(async (input: Record<string, unknown>) => {
      if (input['operation'] === 'getBrowseFacets') {
        return runtimeSuccess({
          kind: 'playlistCollection',
          collection: 'facets',
          facets: playlistFacets,
          playlists: [],
          updatedAt: observedAt
        })
      }
      if (input['operation'] === 'getCategoryPlaylists') return categoryResponse
      if (input['operation'] === 'getNewAlbums') {
        return runtimeSuccess({ kind: 'albumCollection', collection: 'new', albums: [], updatedAt: observedAt })
      }
      if (input['operation'] === 'getCharts') {
        return runtimeSuccess({ kind: 'playlistCollection', collection: 'charts', playlists: [], updatedAt: observedAt })
      }
      return runtimeSuccess({ kind: 'artistCollection', collection: 'filtered', artists: [], updatedAt: observedAt })
    })
    Object.defineProperty(window, 'ncx', {
      configurable: true,
      value: {
        runtime: {
          readMusic,
          getNewSongs: vi.fn(async () => runtimeSuccess({
            kind: 'songCollection',
            collection: 'new',
            songs: [],
            updatedAt: observedAt
          })),
          getFeaturedPlaylists: vi.fn(async () => runtimeSuccess({
            kind: 'playlistCollection',
            collection: 'featured',
            playlists: [],
            updatedAt: observedAt
          }))
        }
      }
    })
    /** 浏览页测试使用的内存路由。 */
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/browse', name: 'browse', component: BrowsePage }]
    })
    await router.push('/browse')
    await router.isReady()
    /** 已挂载的浏览页。 */
    const wrapper = mount(BrowsePage, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.findAll('.browse-category-row-state')).toHaveLength(5)
    expect(wrapper.text()).toContain('正在加载')

    resolveCategoryRequests()
    await flushPromises()

    expect(wrapper.findAll('.browse-category-row-state')).toHaveLength(0)
    expect(wrapper.findAll('.browse-category-preview-strip')).toHaveLength(5)
    expect(wrapper.text()).toContain('分类精选歌单')
    wrapper.unmount()
  })
})
