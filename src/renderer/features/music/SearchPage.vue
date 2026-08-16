<script setup lang="ts">
import { Clock3, Disc3, Flame, ListMusic, Play, Search, Trash2, UserRound, X } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type {
  MusicReadResult,
  StandardAlbum,
  StandardArtist,
  StandardPlaylist,
  StandardSong
} from '../../../shared/schemas/music'
import {
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { t } from '../../i18n'
import AddTrackToPlaylistDialog from './components/AddTrackToPlaylistDialog.vue'
import Cover from './components/Cover.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** 搜索结果分类标签类型。 */
type SearchCategory = 'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'lyrics'

/** 搜索分类标签配置。 */
const searchTabs: ReadonlyArray<{ value: SearchCategory; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'songs', label: '歌曲' },
  { value: 'artists', label: '歌手' },
  { value: 'albums', label: '专辑' },
  { value: 'playlists', label: '歌单' },
  { value: 'lyrics', label: '歌词' }
]

/** 本地存储最近搜索记录的 Storage Key。 */
const SEARCH_HISTORY_KEY = 'ncx.search-history.v1'

/** 当前路由对象。 */
const route = useRoute()

/** Router 实例。 */
const router = useRouter()

/** 全局播放器驱动。 */
const player = usePlayer()

/** 搜索输入框 DOM 引用。 */
const inputRef = ref<HTMLInputElement | null>(null)

/** 搜索框当前实时输入的文本。 */
const query = ref<string>('')

/** 当前已提交生效并展示结果的搜索词。 */
const submittedQuery = ref<string>('')

/** 上一次输入的文本长度，用于区分追加字符与删除退格。 */
let previousQueryLength = 0

/** 输入框焦点状态。 */
const isInputFocused = ref<boolean>(false)

/** 下拉菜单中通过键盘上下键选中的项索引，-1 表示未选中。 */
const highlightedSuggestionIndex = ref<number>(-1)

/** API 返回的实时联想搜索建议词列表。 */
const apiSuggestions = ref<string[]>([])

/** 实时搜索建议加载中状态。 */
const suggestionsLoading = ref<boolean>(false)

/** 搜索建议请求防抖计时器。 */
let suggestionTimer: ReturnType<typeof setTimeout> | undefined

/** 最近一次搜索建议的 Request ID，用于防止竞态冲突。 */
let latestSuggestionRequestId = ''

/** 最近搜索历史关键词数组。 */
const searchHistory = ref<string[]>(readSearchHistory())

/** 热搜榜 / 热门歌曲 20 首列表。 */
const hotSongs = ref<StandardSong[]>([])

/** 热搜榜加载中状态。 */
const hotSongsLoading = ref<boolean>(false)

/** 搜索结果加载中状态。 */
const searchLoading = ref<boolean>(false)

/** 搜索错误文案。 */
const searchError = ref<string>('')

/** 搜索结果原始数据实体。 */
const searchResult = ref<Extract<MusicReadResult, { kind: 'search' }> | null>(null)

/** 当前选中的搜索结果分类。 */
const activeCategory = ref<SearchCategory>('all')

/** 最近一次搜索结果请求的 Request ID。 */
let latestSearchRequestId = ''

/** 当前等待加入自建歌单的目标歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 是否展示下拉建议菜单（仅在输入框有内容、且聚焦、且有建议候选时展示）。 */
const showDropdown = computed<boolean>(() => {
  return isInputFocused.value && query.value.trim().length > 0 && apiSuggestions.value.length > 0
})

/** 当前搜索结果中的歌曲列表。 */
const resultSongs = computed<StandardSong[]>(() => searchResult.value?.songs ?? [])

/** 当前搜索结果中的歌手列表。 */
const resultArtists = computed<StandardArtist[]>(() => searchResult.value?.artists ?? [])

/** 当前搜索结果中的专辑列表。 */
const resultAlbums = computed<StandardAlbum[]>(() => searchResult.value?.albums ?? [])

/** 当前搜索结果中的歌单列表。 */
const resultPlaylists = computed<StandardPlaylist[]>(() => searchResult.value?.playlists ?? [])

/** 当前搜索结果中的歌词匹配歌曲。 */
const resultLyrics = computed<StandardSong[]>(() => searchResult.value?.lyrics ?? [])

/** 当前播放器正在播放的曲目 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 搜索结果总项数统计。 */
const searchResultCount = computed<number>(() => {
  return (
    resultSongs.value.length +
    resultArtists.value.length +
    resultAlbums.value.length +
    resultPlaylists.value.length +
    resultLyrics.value.length
  )
})

/** 是否完全没有搜索结果。 */
const isEmptyResult = computed<boolean>(() => {
  return !searchLoading.value && searchResultCount.value === 0 && Boolean(submittedQuery.value)
})

// ========= 函数 =========

/** 从本地存储中读取最近搜索历史记录。 */
function readSearchHistory(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 10)
      : []
  } catch {
    return []
  }
}

/** 将一个搜索词保存到最近搜索首位。 */
function rememberSearch(value: string): void {
  const trimmed = value.trim()
  if (!trimmed) return
  searchHistory.value = [trimmed, ...searchHistory.value.filter((item) => item !== trimmed)].slice(0, 10)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
}

/** 清除全部最近搜索记录。 */
function clearSearchHistory(): void {
  searchHistory.value = []
  localStorage.removeItem(SEARCH_HISTORY_KEY)
}

/** 格式化歌手名称字符串。 */
function formatArtists(artists: Array<{ name: string }>): string {
  if (!artists || artists.length === 0) return '未知歌手'
  return artists.map((item) => item.name).join(' / ')
}

/** 从标准建议结果中提取去重关键词。 */
function collectSuggestionLabels(result: Extract<MusicReadResult, { kind: 'search' }>): string[] {
  const labels = [
    ...result.songs.map((item) => item.name),
    ...result.artists.map((item) => item.name),
    ...result.albums.map((item) => item.name),
    ...result.playlists.map((item) => item.name)
  ]
  return [...new Set(labels.filter(Boolean))].slice(0, 8)
}

/** 请求网易云实时搜索建议接口。 */
async function fetchSearchSuggestions(keyword: string): Promise<void> {
  const trimmed = keyword.trim()
  if (!trimmed) {
    apiSuggestions.value = []
    suggestionsLoading.value = false
    return
  }

  const requestId = crypto.randomUUID()
  latestSuggestionRequestId = requestId
  suggestionsLoading.value = true

  try {
    const response = await window.ncx.runtime.readMusic({
      operation: 'getSearchSuggestions',
      query: trimmed,
      limit: 8,
      requestId
    })

    if (requestId !== latestSuggestionRequestId || trimmed !== query.value.trim()) return

    if (!response.ok || response.data.kind !== 'search') {
      apiSuggestions.value = []
      return
    }

    apiSuggestions.value = collectSuggestionLabels(response.data)
  } catch {
    if (requestId === latestSuggestionRequestId) {
      apiSuggestions.value = []
    }
  } finally {
    if (requestId === latestSuggestionRequestId) {
      suggestionsLoading.value = false
    }
  }
}

/** 加载热搜榜 / 热门歌曲 20 首。 */
async function loadHotSongs(): Promise<void> {
  hotSongsLoading.value = true
  try {
    const response = await window.ncx.runtime.readMusic({
      operation: 'getHotSongs',
      limit: 20
    })
    if (response.ok && response.data.kind === 'songCollection') {
      hotSongs.value = response.data.songs
    }
  } catch {
    hotSongs.value = []
  } finally {
    hotSongsLoading.value = false
  }
}

/** 执行正式搜索并加载搜索结果。 */
async function executeSearch(keyword: string): Promise<void> {
  const trimmed = keyword.trim()
  if (!trimmed) {
    clearSearch()
    return
  }

  query.value = trimmed
  submittedQuery.value = trimmed
  rememberSearch(trimmed)
  isInputFocused.value = false
  highlightedSuggestionIndex.value = -1

  searchResult.value = null
  searchError.value = ''
  searchLoading.value = true

  const requestId = crypto.randomUUID()
  latestSearchRequestId = requestId

  try {
    const response = await window.ncx.runtime.searchMusic({
      query: trimmed,
      category: activeCategory.value,
      limit: 20,
      requestId
    })

    if (requestId !== latestSearchRequestId) return

    if (!response.ok) {
      searchError.value = response.error.message
      return
    }

    if (response.data.kind !== 'search') {
      searchError.value = t('music.search.mismatch')
      return
    }

    searchResult.value = response.data
  } catch (err) {
    if (requestId === latestSearchRequestId) {
      searchError.value = String(err)
    }
  } finally {
    if (requestId === latestSearchRequestId) {
      searchLoading.value = false
    }
  }
}

/** 提交当前搜索框内容。 */
function handleSubmit(): void {
  const currentQuery = query.value.trim()
  if (!currentQuery) return
  const targetSuggestion =
    highlightedSuggestionIndex.value >= 0
      ? apiSuggestions.value[highlightedSuggestionIndex.value]
      : undefined
  if (targetSuggestion) {
    void executeSearch(targetSuggestion)
  } else {
    void executeSearch(currentQuery)
  }
}

/** 选中某一建议项或历史项进行搜索。 */
function selectSuggestion(item: string): void {
  query.value = item
  executeSearch(item)
}

/** 清空搜索输入与结果状态，平滑返回主状态。 */
function clearSearch(): void {
  query.value = ''
  submittedQuery.value = ''
  searchResult.value = null
  searchError.value = ''
  apiSuggestions.value = []
  highlightedSuggestionIndex.value = -1
  if (suggestionTimer) clearTimeout(suggestionTimer)
  inputRef.value?.focus()
}

/** 搜索输入框聚焦处理。 */
function handleInputFocus(): void {
  isInputFocused.value = true
  if (query.value.trim() && apiSuggestions.value.length === 0) {
    void fetchSearchSuggestions(query.value)
  }
}

/** 搜索输入框失焦处理（延迟关闭以允许点击下拉项）。 */
function handleInputBlur(): void {
  setTimeout(() => {
    isInputFocused.value = false
    highlightedSuggestionIndex.value = -1
  }, 200)
}

/** 处理搜索框键盘导航与快捷键。 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!showDropdown.value) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (highlightedSuggestionIndex.value < apiSuggestions.value.length - 1) {
      highlightedSuggestionIndex.value++
    } else {
      highlightedSuggestionIndex.value = 0
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (highlightedSuggestionIndex.value > 0) {
      highlightedSuggestionIndex.value--
    } else {
      highlightedSuggestionIndex.value = apiSuggestions.value.length - 1
    }
  } else if (event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    isInputFocused.value = false
    highlightedSuggestionIndex.value = -1
  }
}

/** 播放单首歌曲。 */
async function playSong(song: StandardSong): Promise<void> {
  await player.playTrack(standardSongToTrackSummary(song), { kind: 'search' })
}

/** 播放搜索结果全部歌曲。 */
async function playAllSongs(): Promise<void> {
  if (resultSongs.value.length === 0) return
  await player.playContext({
    tracks: standardSongsToTrackSummaries(resultSongs.value),
    source: { kind: 'search' }
  })
}

/** 追加歌曲到播放队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'search' })
}

/** 收藏歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  showToast(t('music.search.liked', { song: song.name }), 'success')
}

/** 打开专辑详情。 */
function openAlbum(album: StandardAlbum): void {
  void router.push({ name: 'album-detail', params: { albumId: album.id } })
}

/** 打开歌单详情。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

/** 打开歌手详情。 */
function openArtist(artist: StandardArtist): void {
  void router.push({ name: 'artist-detail', params: { artistId: artist.id } })
}

/** 打开歌曲详情。 */
function openSongDetails(song: StandardSong): void {
  void router.push({ name: 'song-detail', params: { songId: song.id } })
}

/** 将歌曲转交给 Agent。 */
function giveSongToAgent(song: StandardSong): void {
  void router.push({
    name: 'agent',
    query: { intent: 'track', trackId: song.id, title: song.name }
  })
}

/** 打开自建歌单选择对话框。 */
function openAddToPlaylist(song: StandardSong): void {
  playlistTarget.value = song
}

// ========= 生命周期 =========

/** 监听 query 变化：键盘按下实时请求，删除退格时防抖节流。 */
watch(query, (newVal) => {
  const newLength = newVal.length
  const isDeleting = newLength < previousQueryLength
  previousQueryLength = newLength
  highlightedSuggestionIndex.value = -1

  if (suggestionTimer) {
    clearTimeout(suggestionTimer)
    suggestionTimer = undefined
  }

  if (!newVal.trim()) {
    apiSuggestions.value = []
    suggestionsLoading.value = false
    return
  }

  if (isDeleting) {
    // 退格删除时使用 180ms 防抖节流
    suggestionTimer = setTimeout(() => {
      void fetchSearchSuggestions(newVal)
    }, 180)
  } else {
    // 增加字符输入时实时发起请求
    void fetchSearchSuggestions(newVal)
  }
})

/** 监听搜索分类 Tab 切换。 */
watch(activeCategory, () => {
  if (submittedQuery.value) {
    void executeSearch(submittedQuery.value)
  }
})

/** 监听路由变化（支持外链带 q 关键词直接搜索）。 */
watch(
  () => route.query['q'],
  (routeQ) => {
    const qStr = typeof routeQ === 'string' ? routeQ.trim() : ''
    if (qStr && qStr !== submittedQuery.value) {
      query.value = qStr
      void executeSearch(qStr)
    }
  },
  { immediate: true }
)

onMounted(() => {
  void loadHotSongs()
})

onBeforeUnmount(() => {
  if (suggestionTimer) clearTimeout(suggestionTimer)
  if (latestSuggestionRequestId) window.ncx.runtime.cancel(latestSuggestionRequestId)
  if (latestSearchRequestId) window.ncx.runtime.cancel(latestSearchRequestId)
})
</script>

<template>
  <section class="music-search-page music-content-page" aria-label="音乐搜索">
    <!-- 极简黏性吸顶搜索栏 -->
    <header class="music-search-sticky-bar">
      <div class="music-search-bar-inner">
        <form class="music-search-input-wrapper" @submit.prevent="handleSubmit">
          <span class="music-search-icon" aria-hidden="true">
            <Search :size="18" />
          </span>
          <input
            ref="inputRef"
            v-model="query"
            type="search"
            class="music-search-input-minimal"
            placeholder="搜索歌曲、歌手、专辑或歌单"
            autocomplete="off"
            aria-label="搜索音乐"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
            @keydown="handleKeyDown"
          />
          <button
            v-if="query"
            type="button"
            class="music-search-clear-btn"
            aria-label="清空搜索内容"
            @mousedown.prevent
            @click="clearSearch"
          >
            <X :size="15" />
          </button>
        </form>

        <!-- 实时建议下拉菜单（纯文字列表，无多余标题） -->
        <Transition name="music-dropdown-fade">
          <ul
            v-if="showDropdown"
            class="music-search-dropdown"
            role="listbox"
          >
            <li
              v-for="(item, index) in apiSuggestions"
              :key="item"
              :class="[
                'music-search-dropdown-item',
                { 'is-highlighted': index === highlightedSuggestionIndex }
              ]"
              role="option"
              :aria-selected="index === highlightedSuggestionIndex"
              @mousedown.prevent="selectSuggestion(item)"
            >
              <Search :size="14" class="dropdown-item-icon" />
              <span class="dropdown-item-text">{{ item }}</span>
            </li>
          </ul>
        </Transition>
      </div>
    </header>

    <!-- 状态 A：输入框为空或未提交搜索时，展示“最近搜索”与“热搜榜 20 首” -->
    <div v-if="!submittedQuery" class="music-search-home">
      <!-- 最近搜索历史 -->
      <section
        v-if="searchHistory.length > 0"
        class="music-search-history-section"
        aria-label="最近搜索"
      >
        <header class="music-search-section-header">
          <h2>最近搜索</h2>
          <button
            type="button"
            class="music-search-clear-history-btn"
            @click="clearSearchHistory"
          >
            <Trash2 :size="13" />
            清除
          </button>
        </header>
        <div class="music-search-history-chips">
          <button
            v-for="item in searchHistory"
            :key="item"
            type="button"
            class="music-search-chip"
            @click="selectSuggestion(item)"
          >
            <Clock3 :size="13" />
            <span>{{ item }}</span>
          </button>
        </div>
      </section>

      <!-- 热搜榜 / 热门搜索 20 首卡片网格 -->
      <section class="music-hot-songs-section" aria-label="热搜榜">
        <header class="music-search-section-header">
          <div class="hot-songs-title-group">
            <Flame :size="18" class="hot-flame-icon" />
            <h2>热搜榜</h2>
            <span class="hot-songs-sub">热门歌曲 TOP 20</span>
          </div>
        </header>

        <!-- 骨架屏 -->
        <div v-if="hotSongsLoading" class="music-hot-songs-grid">
          <div
            v-for="i in 20"
            :key="`skeleton-${i}`"
            class="hot-song-card-skeleton"
          >
            <div class="skeleton-cover"></div>
            <div class="skeleton-line title"></div>
            <div class="skeleton-line artist"></div>
          </div>
        </div>

        <!-- 20 首歌曲网格 -->
        <div v-else class="music-hot-songs-grid">
          <article
            v-for="(song, idx) in hotSongs"
            :key="song.id"
            class="hot-song-card"
            @click="playSong(song)"
          >
            <div class="hot-song-cover-container">
              <Cover
                :src="song.album?.artworkUrl"
                :alt="song.name"
                size="feature"
                hover-effect
                show-play-button
                @play="playSong(song)"
              />
              <span
                class="hot-song-badge"
                :class="{ 'is-top-three': idx < 3 }"
              >
                {{ idx + 1 }}
              </span>
            </div>
            <div class="hot-song-info">
              <span class="hot-song-name" :title="song.name">{{ song.name }}</span>
              <span class="hot-song-artist" :title="formatArtists(song.artists)">
                {{ formatArtists(song.artists) }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- 状态 B：已提交搜索词，展示分类结果与详细列表 -->
    <div v-else class="music-search-results-container">
      <!-- 搜索分类 Tab -->
      <nav class="search-category-tabs" aria-label="搜索结果分类">
        <button
          v-for="tab in searchTabs"
          :key="tab.value"
          type="button"
          :class="{ active: activeCategory === tab.value }"
          @click="activeCategory = tab.value"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- 搜索结果统计与播放全部 -->
      <div class="search-results-header">
        <div class="music-page-heading">
          <p class="music-page-eyebrow">搜索结果</p>
          <h1 class="search-results-title">{{ submittedQuery }}</h1>
          <p class="search-results-summary">
            {{
              searchLoading
                ? '正在搜索...'
                : searchResult
                  ? `已找到 ${searchResultCount} 项内容`
                  : '结果会按歌曲、歌手、专辑、歌单与歌词分类'
            }}
          </p>
        </div>
        <CommonButton
          v-if="resultSongs.length > 0"
          variant="primary"
          @click="playAllSongs"
        >
          <Play :size="15" fill="currentColor" />
          播放全部
        </CommonButton>
      </div>

      <!-- 状态切换与结果展示 -->
      <Transition name="music-page-state" mode="out-in">
        <div
          v-if="searchLoading"
          key="loading"
          class="search-results-state search-results-loading"
        >
          <CommonSpinner label="搜索中" />
          <span>正在搜索...</span>
        </div>

        <div
          v-else-if="searchError"
          key="error"
          class="search-results-state"
        >
          <CommonErrorState
            title="搜索失败"
            :description="searchError"
            @retry="executeSearch(submittedQuery)"
          />
        </div>

        <div
          v-else-if="isEmptyResult"
          key="empty"
          class="search-results-state"
        >
          <CommonEmptyState
            title="暂无结果"
            description="换个关键词试试。"
          />
        </div>

        <div
          v-else
          key="content"
          class="search-results-content"
        >
          <!-- 歌曲列表 -->
          <section
            v-if="resultSongs.length > 0 && (activeCategory === 'all' || activeCategory === 'songs')"
            class="music-result-section music-surface"
          >
            <header class="music-section-heading">
              <h2>歌曲</h2>
              <span>{{ resultSongs.length }} 首</span>
            </header>
            <VirtualTrackList
              class="track-list"
              :songs="resultSongs"
              :active-track-id="activeTrackId"
              @play="playSong"
              @enqueue="enqueueSong"
              @play-next="playSongNext($event, { kind: 'search' })"
              @like="likeSong"
              @add-to-playlist="openAddToPlaylist"
              @details="openSongDetails"
              @give-agent="giveSongToAgent"
            />
          </section>

          <!-- 专辑与歌单 -->
          <section
            v-if="
              (resultAlbums.length > 0 && (activeCategory === 'all' || activeCategory === 'albums')) ||
              (resultPlaylists.length > 0 && (activeCategory === 'all' || activeCategory === 'playlists'))
            "
            class="music-result-section music-surface"
          >
            <header class="music-section-heading">
              <h2>专辑与歌单</h2>
              <span>
                {{
                  (activeCategory === 'playlists' ? 0 : resultAlbums.length) +
                  (activeCategory === 'albums' ? 0 : resultPlaylists.length)
                }} 个
              </span>
            </header>
            <div class="collection-grid">
              <button
                v-for="album in activeCategory === 'playlists' ? [] : resultAlbums"
                :key="`album-${album.id}`"
                class="collection-card"
                type="button"
                @click="openAlbum(album)"
              >
                <Cover
                  :src="album.artworkUrl"
                  :alt="album.name"
                  size="card"
                />
                <strong>{{ album.name }}</strong>
                <span><Disc3 :size="13" /> 专辑</span>
              </button>

              <button
                v-for="playlist in activeCategory === 'albums' ? [] : resultPlaylists"
                :key="`playlist-${playlist.id}`"
                class="collection-card"
                type="button"
                @click="openPlaylist(playlist)"
              >
                <Cover
                  :src="playlist.artworkUrl"
                  :alt="playlist.name"
                  size="card"
                />
                <strong>{{ playlist.name }}</strong>
                <span><ListMusic :size="13" /> 歌单</span>
              </button>
            </div>
          </section>

          <!-- 歌手 -->
          <section
            v-if="resultArtists.length > 0 && (activeCategory === 'all' || activeCategory === 'artists')"
            class="music-result-section music-surface"
          >
            <header class="music-section-heading">
              <h2>歌手</h2>
              <span>{{ resultArtists.length }} 位</span>
            </header>
            <div class="artist-strip">
              <button
                v-for="artist in resultArtists"
                :key="artist.id"
                class="artist-card"
                type="button"
                @click="openArtist(artist)"
              >
                <Cover
                  :src="artist.artworkUrl"
                  :alt="artist.name"
                  size="compact"
                  shape="circle"
                />
                <span class="artist-card-copy">
                  <strong>{{ artist.name }}</strong>
                  <span><UserRound :size="13" /> 歌手</span>
                </span>
              </button>
            </div>
          </section>

          <!-- 歌词 -->
          <section
            v-if="resultLyrics.length > 0 && activeCategory === 'lyrics'"
            class="music-result-section music-surface"
          >
            <header class="music-section-heading">
              <h2>歌词</h2>
              <span>{{ resultLyrics.length }} 首含关键词</span>
            </header>
            <VirtualTrackList
              class="track-list"
              :songs="resultLyrics"
              :active-track-id="activeTrackId"
              @play="playSong"
              @enqueue="enqueueSong"
              @play-next="playSongNext($event, { kind: 'search' })"
              @like="likeSong"
              @add-to-playlist="openAddToPlaylist"
              @details="openSongDetails"
              @give-agent="giveSongToAgent"
            />
          </section>
        </div>
      </Transition>
    </div>

    <!-- 加入歌单对话框 -->
    <AddTrackToPlaylistDialog
      :song="playlistTarget"
      @close="playlistTarget = null"
    />
  </section>
</template>
