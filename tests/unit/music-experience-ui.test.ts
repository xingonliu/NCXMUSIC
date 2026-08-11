import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** 仓库根目录。 */
const root = resolve(__dirname, '../..')

// ========= 函数 =========

/** 读取仓库内 UTF-8 文本文件。 */
async function read(relativePath: string): Promise<string> {
  return readFile(resolve(root, relativePath), 'utf8')
}

// ========= 测试 =========

describe('十项音乐体验 UI 契约', () => {
  it('首页使用十首双列新歌、猜你喜欢组合卡与歌手推荐', async () => {
    /** 首页源码。 */
    const source = await read('src/renderer/features/music/DiscoverPage.vue')

    expect(source).toContain('newSongsSection.value.data.slice(0, 10)')
    expect(source).toContain('discover-new-song-grid')
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(source).toContain('discover-personal-grid')
    expect(source).toContain('getPersonalFm')
    expect(source).toContain('title="歌手推荐"')
  })

  it('浏览是首页之后的一级入口，并具备分类、榜单与歌手二级页', async () => {
    /** 主导航源码。 */
    const navigation = await read('src/renderer/app/navigation.ts')
    /** 路由源码。 */
    const router = await read('src/renderer/app/router.ts')

    expect(navigation.indexOf("routeName: 'browse'")).toBeGreaterThan(navigation.indexOf("routeName: 'discover'"))
    expect(navigation.indexOf("routeName: 'browse'")).toBeLessThan(navigation.indexOf("routeName: 'search'"))
    expect(router).toContain("name: 'browse-rankings'")
    expect(router).toContain("name: 'browse-artists'")
    expect(router).toContain("name: 'browse-categories'")
  })

  it('分类与歌手筛选完全消费 API facet，不在页面写死枚举', async () => {
    /** 浏览页源码。 */
    const browse = await read('src/renderer/features/music/BrowsePage.vue')
    /** 歌手探索页源码。 */
    const artists = await read('src/renderer/features/music/ArtistExplorePage.vue')

    expect(browse).toContain("operation: 'getBrowseFacets'")
    expect(browse).toContain('group.options')
    expect(browse).toContain("'playlist-language'")
    expect(browse).toContain("'playlist-theme'")
    expect(browse).toContain('browse-category-preview-row')
    expect(browse).not.toContain("['流行', '摇滚'")
    expect(artists).toContain("operation: 'getBrowseFacets'")
    expect(artists).toContain('areaFacet?.options')
    expect(artists).toContain('typeFacet?.options')
    expect(artists).not.toContain("label: '华语'")
    expect(artists).not.toContain("label: '欧美'")
  })

  it('分类二级页使用五个动态 Tab、URL 状态和服务端分页', async () => {
    /** 分类歌单二级页源码。 */
    const source = await read('src/renderer/features/music/BrowseCategoriesPage.vue')

    expect(source).toContain('PLAYLIST_FACET_KEYS')
    expect(source).toContain('CommonTabs')
    expect(source).toContain('route.query')
    expect(source).toContain('const offset =')
    expect(source).toContain('offset,')
    expect(source).toContain('category-pagination')
    expect(source).toContain('PAGE_SIZE = 30')
  })

  it('排行榜标签由 API 返回的更新频率动态生成', async () => {
    /** 排行榜二级页源码。 */
    const rankings = await read('src/renderer/features/music/BrowseRankingsPage.vue')

    expect(rankings).toContain('chart.updateFrequency?.trim()')
    expect(rankings).toContain('chart.updateFrequency === activeFrequency.value')
    expect(rankings).not.toContain('regionalKeywords')
    expect(rankings).not.toContain("label: '精选榜单'")
    expect(rankings).not.toContain("label: '国家与地区'")
  })

  it('侧栏仅保留一个我的歌单分组并使用 API 封面', async () => {
    /** 歌单导航源码。 */
    const source = await read('src/renderer/features/music/components/PlaylistNavigation.vue')

    expect(source).toContain('我的歌单')
    expect(source).toContain('adaptArtworkUrl(playlist.artworkUrl')
    expect(source).toContain('v-for="playlist in visiblePlaylists"')
    expect(source).not.toContain('>我喜欢<')
    expect(source).not.toContain('slice(0, 5)')
  })

  it('个人页保留音乐核心内容并在 Phase 6 增加音乐人格画像', async () => {
    /** 个人页源码。 */
    const source = await read('src/renderer/features/profile/ProfilePage.vue')

    expect(source).toContain('user?.backgroundUrl')
    expect(source).toContain('累积听歌')
    expect(source).toContain('最近一周')
    expect(source).toContain('所有时间')
    expect(source).toContain('创建的歌单')
    expect(source).toContain('收藏的歌单')
    expect(source).toContain('暂未公开')
    expect(source).toContain('音乐人格画像')
    expect(source).not.toContain('清理缓存')
  })

  it('搜索使用实时 API 建议并支持歌词等分类标签', async () => {
    /** 搜索入口源码。 */
    const search = await read('src/renderer/features/music/SearchPage.vue')
    /** 搜索结果源码。 */
    const results = await read('src/renderer/features/music/SearchResultsPage.vue')

    expect(search).toContain("operation: 'getSearchSuggestions'")
    expect(search).toContain('180')
    expect(results).toContain("{ value: 'lyrics', label: '歌词' }")
    expect(results).toContain('category: activeCategory.value')
    expect(results).toContain('search-results-input')
  })

  it('集合详情提供完整主操作组，歌手页覆盖六个核心内容区', async () => {
    /** 集合详情源码。 */
    const collection = await read('src/renderer/features/music/CollectionDetailPage.vue')
    /** 音乐内容页样式源码。 */
    const contentStyles = await read('src/renderer/features/music/music-content-pages.css')
    /** 歌手详情源码。 */
    const artist = await read('src/renderer/features/music/ArtistDetailPage.vue')

    expect(collection).toContain('随机播放')
    expect(collection).toContain('添加至资料库')
    expect(collection).toContain('downloadCollection')
    expect(collection).toContain('moreMenuItems')
    expect(collection).toContain(':always-show-shadow="true"')
    expect(collection).toContain('collection-comments-button')
    expect(collection).toContain('<CommonDrawer')
    expect(collection).toContain('mode="drawer"')
    expect(collection).toContain('collection-detail-skeleton')
    expect(collection).not.toContain('class="music-track-surface music-surface"')
    expect(contentStyles).toContain('.music-content-page .track-row--active')
    expect(contentStyles).not.toContain('box-shadow: inset 3px 0 0 var(--ncx-color-accent)')
    expect(artist).toContain('最新发布')
    expect(artist).toContain('热门歌曲')
    expect(artist).toContain('专辑与 EP')
    expect(artist).toContain('参与作品与合集')
    expect(artist).toContain('相似歌手')
    expect(artist).toContain('toggleArtistFollow')
  })
})
