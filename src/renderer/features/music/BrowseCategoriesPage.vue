<script setup lang="ts">
import { LibraryBig } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type {
  MusicBrowseFacetGroup,
  StandardPlaylist
} from '../../../shared/schemas/music'
import {
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner,
  CommonTabs,
  type CommonOption
} from '../../design-system/components'
import CommonPagination from '../../design-system/components/CommonPagination.vue'
import EntityCard from './components/EntityCard.vue'
import './music-content-pages.css'
import { translatePublicError } from '../../i18n'

// ========= 类型 =========

/** 二级分类页支持的五个歌单分类键。 */
type PlaylistFacetKey =
  | 'playlist-language'
  | 'playlist-style'
  | 'playlist-scene'
  | 'playlist-mood'
  | 'playlist-theme'

// ========= 变量 =========

/** 当前路由信息。 */
const route = useRoute()

/** 页面路由实例。 */
const router = useRouter()

/** API 返回的全部浏览筛选分组。 */
const browseFacets = ref<MusicBrowseFacetGroup[]>([])

/** 当前五类 Tab。 */
const activeTab = ref<PlaylistFacetKey>('playlist-language')

/** 当前 Tab 下选中的具体分类。 */
const activeCategory = ref<string>('')

/** 当前分类歌单页码。 */
const currentPage = ref<number>(1)

/** 当前分页返回的歌单。 */
const playlists = ref<StandardPlaylist[]>([])

/** 当前分类结果总数。 */
const total = ref<number>(0)

/** 分类树是否正在加载。 */
const facetsLoading = ref<boolean>(true)

/** 分类歌单是否正在加载。 */
const playlistsLoading = ref<boolean>(false)

/** 页面当前错误信息。 */
const errorMessage = ref<string>('')

/** 分类树是否已经成功初始化。 */
const facetsReady = ref<boolean>(false)

/** 最近一次分类歌单请求 ID，用于丢弃迟到响应。 */
let latestRequestId = ''

/** 二级页每页展示的歌单数量。 */
const PAGE_SIZE = 30

/** 五类歌单 Tab 的稳定顺序。 */
const PLAYLIST_FACET_KEYS: readonly PlaylistFacetKey[] = [
  'playlist-language',
  'playlist-style',
  'playlist-scene',
  'playlist-mood',
  'playlist-theme'
]

/** API 返回且属于五类歌单的筛选分组。 */
const playlistFacetGroups = computed<MusicBrowseFacetGroup[]>(() => {
  return PLAYLIST_FACET_KEYS
    .map((key) => browseFacets.value.find((group) => group.key === key))
    .filter((group): group is MusicBrowseFacetGroup => Boolean(group))
})

/** 当前 Tab 对应的完整 API 分组。 */
const activeFacetGroup = computed<MusicBrowseFacetGroup | undefined>(() => {
  return playlistFacetGroups.value.find((group) => group.key === activeTab.value)
})

/** 通用标签页组件消费的五类选项。 */
const tabOptions = computed<CommonOption[]>(() => playlistFacetGroups.value.map((group) => ({
  value: group.key,
  label: group.label
})))

/** 当前分类结果总页数。 */
const totalPages = computed<number>(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

// ========= 函数 =========

/** 从 Vue Router query 值中读取第一个非空字符串。 */
function queryText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return typeof value[0] === 'string' ? value[0] : ''
}

/** 将路由页码约束为合法正整数。 */
function parsePage(value: unknown): number {
  /** query 中的原始页码文本。 */
  const text = queryText(value)
  /** 转换后的候选页码。 */
  const page = Number(text)
  return Number.isInteger(page) && page > 0 ? page : 1
}

/** 判断字符串是否是五类歌单 Tab 的稳定键。 */
function isPlaylistFacetKey(value: string): value is PlaylistFacetKey {
  return PLAYLIST_FACET_KEYS.includes(value as PlaylistFacetKey)
}

/** 将分类页筛选状态写入地址栏并保留可前进后退的浏览历史。 */
function navigateCategoryState(
  tab: PlaylistFacetKey,
  category: string,
  page: number,
  replace = false
): void {
  /** 规范化后的分类页 query。 */
  const query = { tab, category, page: String(page) }
  /** 交给 Vue Router 的命名路由位置。 */
  const navigation = { name: 'browse-categories', query }
  if (replace) void router.replace(navigation)
  else void router.push(navigation)
}

/** 读取当前具体分类和页码对应的歌单。 */
async function loadCategoryPlaylists(): Promise<void> {
  if (!activeCategory.value) return
  /** 本次请求的唯一 ID。 */
  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  playlistsLoading.value = true
  errorMessage.value = ''
  playlists.value = []
  /** 当前页对应的接口偏移量。 */
  const offset = (currentPage.value - 1) * PAGE_SIZE
  /** 当前分类歌单标准响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getCategoryPlaylists',
    category: activeCategory.value,
    limit: PAGE_SIZE,
    offset,
    requestId
  })
  if (requestId !== latestRequestId) return
  playlistsLoading.value = false
  if (!response.ok) {
    errorMessage.value = translatePublicError(response.error)
    return
  }
  if (response.data.kind !== 'playlistCollection' || response.data.collection !== 'category') {
    errorMessage.value = '分类歌单响应类型不匹配。'
    return
  }
  playlists.value = response.data.playlists
  total.value = response.data.total
    ?? offset + response.data.playlists.length + (response.data.hasMore ? PAGE_SIZE : 0)
  /** 响应总数对应的最后一页。 */
  const lastPage = Math.max(1, Math.ceil(total.value / PAGE_SIZE))
  if (currentPage.value > lastPage) {
    navigateCategoryState(activeTab.value, activeCategory.value, lastPage, true)
  }
}

/** 根据地址栏 query 校准 Tab、具体分类和页码，然后读取结果。 */
function syncRouteState(): void {
  if (!facetsReady.value) return
  /** query 请求的 Tab 键。 */
  const requestedTab = queryText(route.query['tab'])
  /** query 命中或默认命中的歌单分类分组。 */
  const group = playlistFacetGroups.value.find((item) => item.key === requestedTab)
    ?? playlistFacetGroups.value[0]
  if (!group || !isPlaylistFacetKey(group.key)) return
  /** query 请求的具体分类名。 */
  const requestedCategory = queryText(route.query['category'])
  /** 当前分组内合法的具体分类名。 */
  const category = group.options.some((option) => option.value === requestedCategory)
    ? requestedCategory
    : (group.options[0]?.value ?? '')
  /** query 请求的页码。 */
  const page = parsePage(route.query['page'])
  if (!category) return

  const queryIsNormalized =
    requestedTab === group.key
    && requestedCategory === category
    && queryText(route.query['page']) === String(page)
  if (!queryIsNormalized) {
    navigateCategoryState(group.key, category, page, true)
    return
  }

  activeTab.value = group.key
  activeCategory.value = category
  currentPage.value = page
  void loadCategoryPlaylists()
}

/** 读取 API 分类树并初始化地址栏驱动的页面状态。 */
async function loadBrowseFacets(): Promise<void> {
  facetsLoading.value = true
  errorMessage.value = ''
  /** 动态筛选标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getBrowseFacets' })
  facetsLoading.value = false
  if (!response.ok) {
    errorMessage.value = translatePublicError(response.error)
    return
  }
  if (response.data.kind !== 'playlistCollection' || response.data.collection !== 'facets') {
    errorMessage.value = '分类筛选响应类型不匹配。'
    return
  }
  browseFacets.value = response.data.facets
  if (playlistFacetGroups.value.length === 0) {
    errorMessage.value = '当前没有可用的歌单分类。'
    return
  }
  facetsReady.value = true
  syncRouteState()
}

/** 切换五类主 Tab，并选中该分组的第一个真实分类。 */
function selectTab(value: string): void {
  if (!isPlaylistFacetKey(value)) return
  /** 目标 Tab 对应的动态分类分组。 */
  const group = playlistFacetGroups.value.find((item) => item.key === value)
  /** 目标 Tab 默认使用的首个具体分类。 */
  const category = group?.options[0]?.value
  if (!category) return
  navigateCategoryState(value, category, 1)
}

/** 切换当前 Tab 下的具体分类并回到第一页。 */
function selectCategory(category: string): void {
  if (category === activeCategory.value) return
  navigateCategoryState(activeTab.value, category, 1)
}

/** 跳转到合法的分类歌单页码。 */
function goToPage(page: number): void {
  /** 约束后的目标页码。 */
  const targetPage = Math.min(totalPages.value, Math.max(1, page))
  if (targetPage === currentPage.value) return
  navigateCategoryState(activeTab.value, activeCategory.value, targetPage)
}

/** 打开歌单详情页。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

/** 根据当前初始化阶段重试分类树或当前分类列表。 */
function retryPage(): void {
  if (!facetsReady.value) void loadBrowseFacets()
  else void loadCategoryPlaylists()
}

// ========= 生命周期 =========

watch([
  () => route.query['tab'],
  () => route.query['category'],
  () => route.query['page']
], () => {
  syncRouteState()
})

onMounted(() => {
  void loadBrowseFacets()
})
</script>

<template>
  <section
    class="category-explore-page music-content-page"
    aria-labelledby="category-explore-title"
  >
    <header class="category-explore-heading">
      <p class="music-page-eyebrow">
        <LibraryBig :size="13" /> {{ $tSource("浏览") }}
      </p>
      <h1 id="category-explore-title">
        {{ $tSource("分类歌单") }}
      </h1>
      <p>{{ $tSource("在语种、风格、场景、情感与主题之间切换，并逐页浏览当前分类的全部歌单。") }}</p>
    </header>

    <section
      v-if="!facetsLoading && facetsReady"
      class="category-explore-controls music-surface"
      :aria-label="$tSource('歌单分类筛选')"
    >
      <CommonTabs
        :model-value="activeTab"
        :options="tabOptions"
        variant="segmented"
        full-width
        @update:model-value="selectTab"
      />
      <div
        class="category-option-list"
        :aria-label="$tSource('具体分类')"
      >
        <button
          v-for="option in activeFacetGroup?.options ?? []"
          :key="option.value"
          type="button"
          :class="{ active: option.value === activeCategory }"
          :aria-pressed="option.value === activeCategory"
          @click="selectCategory(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <div
      v-if="facetsLoading || playlistsLoading"
      class="category-explore-state"
    >
      <CommonSpinner :label="$tSource('正在加载分类歌单')" />
      <span>{{ $tSource("正在加载分类歌单") }}</span>
    </div>
    <CommonErrorState
      v-else-if="errorMessage"
      :title="$tSource('分类歌单读取失败')"
      :description="errorMessage"
      @retry="retryPage"
    />
    <CommonEmptyState
      v-else-if="playlists.length === 0"
      :title="$tSource('当前分类暂无歌单')"
      :description="$tSource('切换其他分类后再试。')"
    />
    <template v-else>
      <header class="category-results-heading">
        <div>
          <p>{{ activeFacetGroup?.label }}</p>
          <h2>{{ activeCategory }}</h2>
        </div>
        <span>{{ $tSource("共") }} {{ total }} {{ $tSource("个歌单 · 第") }} {{ currentPage }} / {{ totalPages }} {{ $tSource("页") }}</span>
      </header>

      <div class="category-playlist-grid">
        <EntityCard
          v-for="playlist in playlists"
          :key="playlist.id"
          :title="playlist.name"
          :subtitle="playlist.creator?.nickname"
          :artwork-url="playlist.artworkUrl"
          featured
          @activate="openPlaylist(playlist)"
        />
      </div>

      <CommonPagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        :aria-label="$tSource('分类歌单分页')"
        @change="goToPage"
      />
    </template>
  </section>
</template>

<style scoped>
.category-explore-page { display: grid; width: min(1240px, calc(100% - 40px)); gap: 28px; margin: 0 auto; padding: 52px 0 0; }
.category-explore-heading p, .category-explore-heading h1 { margin: 0; }
.category-explore-heading h1 { margin-top: 7px; font-size: clamp(36px, 5vw, 54px); line-height: 1.04; letter-spacing: -.03em; }
.category-explore-heading > p:last-child { max-width: 720px; margin-top: 10px; color: var(--ncx-color-text-secondary); line-height: 1.55; }
.category-explore-controls { display: grid; gap: 16px; padding: 16px; }
.category-option-list { display: flex; overflow-x: auto; gap: 7px; padding: 2px 0 5px; scrollbar-width: thin; }
.category-option-list button { flex: 0 0 auto; padding: 8px 13px; border: 0; border-radius: var(--ncx-squircle-radius-full); color: var(--ncx-color-text-secondary); background: transparent; cursor: pointer; }
.category-option-list button:hover, .category-option-list button.active { color: var(--ncx-color-text-primary); background: color-mix(in srgb, var(--ncx-color-text-primary) 9%, transparent); }
.category-option-list button:active { transform: scale(.96); }
.category-explore-state { display: flex; min-height: 300px; align-items: center; justify-content: center; gap: 10px; color: var(--ncx-color-text-secondary); }
.category-results-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-top: 8px; }
.category-results-heading p, .category-results-heading h2, .category-results-heading span { margin: 0; }
.category-results-heading p { color: var(--ncx-color-accent); font-size: 12px; font-weight: 700; }
.category-results-heading h2 { margin-top: 4px; font-size: 26px; letter-spacing: -.025em; }
.category-results-heading span { color: var(--ncx-color-text-tertiary); font-size: 12px; font-variant-numeric: tabular-nums; }
.category-playlist-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 28px 20px; }
@media (width < 980px) { .category-playlist-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (width < 720px) { .category-explore-page { width: calc(100% - 24px); padding-top: 40px; } .category-playlist-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .category-results-heading { align-items: start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { .category-explore-page button { transition: none !important; } .category-explore-page button:active { transform: none; } }
</style>
