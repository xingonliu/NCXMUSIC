<script setup lang="ts">
import { ChevronRight, Play } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type {
  MusicBrowseFacetGroup,
  StandardAlbum,
  StandardArtist,
  StandardPlaylist,
  StandardSong
} from '../../../shared/schemas/music'
import { CommonButton, CommonSkeleton } from '../../design-system/components'
import Cover from './components/Cover.vue'
import EntityCard from './components/EntityCard.vue'
import MusicSection from './components/MusicSection.vue'
import { standardSongToTrackSummary } from './music-entity'
import { usePlayer } from './use-player'

// ========= 类型 =========

/** 浏览页独立内容区的统一状态。 */
interface BrowseSectionState<T> {
  /** 当前内容区状态。 */
  state: 'loading' | 'empty' | 'error' | 'ready'
  /** 当前内容区数据。 */
  data: T
  /** 当前内容区错误信息。 */
  error: string
}

/** 首页单个歌单分类分组的一行预览。 */
interface BrowseCategoryPreviewRow {
  /** API 返回的歌单分类分组。 */
  group: MusicBrowseFacetGroup
  /** 当前预览使用的具体分类名。 */
  category: string
  /** 当前分类下的歌单预览状态。 */
  section: BrowseSectionState<StandardPlaylist[]>
}

// ========= 变量 =========

/** 页面路由实例。 */
const router = useRouter()

/** 应用播放器接口。 */
const player = usePlayer()

/** 最新单曲内容区。 */
const newSongsSection = ref<BrowseSectionState<StandardSong[]>>({ state: 'loading', data: [], error: '' })

/** 最新专辑内容区。 */
const newAlbumsSection = ref<BrowseSectionState<StandardAlbum[]>>({ state: 'loading', data: [], error: '' })

/** 新歌推荐歌单内容区。 */
const featuredSection = ref<BrowseSectionState<StandardPlaylist[]>>({ state: 'loading', data: [], error: '' })

/** 热门排行榜内容区。 */
const chartsSection = ref<BrowseSectionState<StandardPlaylist[]>>({ state: 'loading', data: [], error: '' })

/** 歌手探索内容区。 */
const artistsSection = ref<BrowseSectionState<StandardArtist[]>>({ state: 'loading', data: [], error: '' })

/** 五类歌单首页预览内容区。 */
const categoryPreviewSection = ref<BrowseSectionState<BrowseCategoryPreviewRow[]>>({
  state: 'loading',
  data: [],
  error: ''
})

/** 首页每个分类分组展示的歌单数量。 */
const CATEGORY_PREVIEW_LIMIT = 5

/** 首页需要按接口顺序完整展示的五个歌单分类分组。 */
const PLAYLIST_FACET_KEYS: ReadonlySet<MusicBrowseFacetGroup['key']> = new Set([
  'playlist-language',
  'playlist-style',
  'playlist-scene',
  'playlist-mood',
  'playlist-theme'
])

/** 最新单曲预览。 */
const newSongPreview = computed<StandardSong[]>(() => newSongsSection.value.data.slice(0, 6))

/** 最新专辑预览。 */
const newAlbumPreview = computed<StandardAlbum[]>(() => newAlbumsSection.value.data.slice(0, 6))

/** 榜单预览。 */
const chartPreview = computed<StandardPlaylist[]>(() => chartsSection.value.data.slice(0, 6))

/** 歌手预览。 */
const artistPreview = computed<StandardArtist[]>(() => artistsSection.value.data.slice(0, 8))

// ========= 函数 =========

/** 将成功响应写入指定内容区。 */
function settleSection<T>(section: BrowseSectionState<T[]>, data: T[]): void {
  section.data = data
  section.error = ''
  section.state = data.length > 0 ? 'ready' : 'empty'
}

/** 将失败响应写入指定内容区。 */
function failSection<T>(section: BrowseSectionState<T>, message: string): void {
  section.error = message
  section.state = 'error'
}

/** 读取最新单曲。 */
async function loadNewSongs(): Promise<void> {
  newSongsSection.value.state = 'loading'
  /** 最新单曲标准响应。 */
  const response = await window.ncx.runtime.getNewSongs({ limit: 20 })
  if (!response.ok) return failSection(newSongsSection.value, response.error.message)
  if (response.data.kind !== 'songCollection') return failSection(newSongsSection.value, '最新单曲响应类型不匹配。')
  settleSection(newSongsSection.value, response.data.songs)
}

/** 读取最新专辑。 */
async function loadNewAlbums(): Promise<void> {
  newAlbumsSection.value.state = 'loading'
  /** 最新专辑标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getNewAlbums', area: 'ALL', limit: 20, offset: 0 })
  if (!response.ok) return failSection(newAlbumsSection.value, response.error.message)
  if (response.data.kind !== 'albumCollection' || response.data.collection !== 'new') {
    return failSection(newAlbumsSection.value, '最新专辑响应类型不匹配。')
  }
  settleSection(newAlbumsSection.value, response.data.albums)
}

/** 读取新歌推荐歌单。 */
async function loadFeaturedPlaylists(): Promise<void> {
  featuredSection.value.state = 'loading'
  /** 推荐歌单标准响应。 */
  const response = await window.ncx.runtime.getFeaturedPlaylists({ limit: 10 })
  if (!response.ok) return failSection(featuredSection.value, response.error.message)
  if (response.data.kind !== 'playlistCollection') return failSection(featuredSection.value, '推荐歌单响应类型不匹配。')
  settleSection(featuredSection.value, response.data.playlists)
}

/** 读取公开榜单摘要。 */
async function loadCharts(): Promise<void> {
  chartsSection.value.state = 'loading'
  /** 排行榜标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getCharts' })
  if (!response.ok) return failSection(chartsSection.value, response.error.message)
  if (response.data.kind !== 'playlistCollection' || response.data.collection !== 'charts') {
    return failSection(chartsSection.value, '排行榜响应类型不匹配。')
  }
  settleSection(chartsSection.value, response.data.playlists)
}

/** 读取首页歌手探索预览。 */
async function loadArtists(): Promise<void> {
  artistsSection.value.state = 'loading'
  /** 歌手探索标准响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getArtists',
    area: '-1',
    artistType: '-1',
    limit: 16,
    offset: 0
  })
  if (!response.ok) return failSection(artistsSection.value, response.error.message)
  if (response.data.kind !== 'artistCollection') return failSection(artistsSection.value, '歌手探索响应类型不匹配。')
  settleSection(artistsSection.value, response.data.artists)
}

/** 读取首页单个分类分组的首个分类预览。 */
async function loadCategoryPreview(row: BrowseCategoryPreviewRow): Promise<void> {
  row.section.state = 'loading'
  row.section.error = ''
  /** 当前行绑定的具体分类名。 */
  const category = row.category
  /** 当前分类的歌单标准响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getCategoryPlaylists',
    category,
    limit: CATEGORY_PREVIEW_LIMIT,
    offset: 0
  })
  if (!response.ok) return failSection(row.section, response.error.message)
  if (response.data.kind !== 'playlistCollection' || response.data.collection !== 'category') {
    return failSection(row.section, '分类歌单响应类型不匹配。')
  }
  settleSection(row.section, response.data.playlists)
}

/** 读取网易云五类歌单分类树，并并行生成每类一行的首页预览。 */
async function loadBrowseFacets(): Promise<void> {
  categoryPreviewSection.value = { state: 'loading', data: [], error: '' }
  /** 动态筛选标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getBrowseFacets' })
  if (!response.ok || response.data.kind !== 'playlistCollection' || response.data.collection !== 'facets') {
    categoryPreviewSection.value = {
      state: 'error',
      data: [],
      error: response.ok ? '分类筛选响应类型不匹配。' : response.error.message
    }
    return
  }
  /** 保持 API 顺序且只包含歌单五类的首页预览行。 */
  const rows = response.data.facets
    .filter((group) => PLAYLIST_FACET_KEYS.has(group.key))
    .map((group): BrowseCategoryPreviewRow | undefined => {
      /** 当前分组用于首页预览的首个真实分类。 */
      const category = group.options[0]?.value
      if (!category) return undefined
      return {
        group,
        category,
        section: { state: 'loading', data: [], error: '' }
      }
    })
    .filter((row): row is BrowseCategoryPreviewRow => Boolean(row))
  categoryPreviewSection.value = {
    state: rows.length > 0 ? 'ready' : 'empty',
    data: rows,
    error: ''
  }
  /** 必须通过状态树中的 Vue 代理行更新，直接修改写入前的原始 rows 不会触发视图刷新。 */
  await Promise.all(categoryPreviewSection.value.data.map(loadCategoryPreview))
}

/** 播放一首最新单曲。 */
async function playSong(song: StandardSong): Promise<void> {
  await player.playTrack(standardSongToTrackSummary(song), { kind: 'discover' })
}

/** 打开专辑详情。 */
function openAlbum(album: StandardAlbum): void {
  void router.push({ name: 'album-detail', params: { albumId: album.id } })
}

/** 打开歌单或榜单详情。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

/** 打开歌手详情。 */
function openArtist(artist: StandardArtist): void {
  void router.push({ name: 'artist-detail', params: { artistId: artist.id } })
}

/** 打开完整榜单浏览页。 */
function openAllCharts(): void {
  void router.push({ name: 'browse-rankings' })
}

/** 打开完整歌手探索页。 */
function openAllArtists(): void {
  void router.push({ name: 'browse-artists' })
}

/** 打开五类歌单的完整分页浏览页。 */
function openAllCategories(): void {
  void router.push({ name: 'browse-categories' })
}

/** 读取浏览页全部互相独立的内容区。 */
async function loadPage(): Promise<void> {
  await Promise.all([
    loadBrowseFacets(),
    loadNewSongs(),
    loadNewAlbums(),
    loadFeaturedPlaylists(),
    loadCharts(),
    loadArtists()
  ])
}

// ========= 生命周期 =========

onMounted(() => {
  void loadPage()
})
</script>

<template>
  <section class="browse-page" aria-labelledby="browse-title">
    <header class="browse-heading">
      <p>浏览</p>
      <h1 id="browse-title">更大的音乐世界</h1>
      <span>最新发行、全球榜单与风格探索，保持一条清晰的浏览路径。</span>
    </header>

    <MusicSection
      section-id="latest-releases"
      title="最新发行"
      :state="newSongsSection.state === 'error' && newAlbumsSection.state === 'error' ? 'error' : 'ready'"
      :error-text="newSongsSection.error || newAlbumsSection.error"
      @retry="loadPage"
    >
      <div class="browse-release-layout">
        <section class="browse-subsection" aria-labelledby="latest-songs-title">
          <header><h3 id="latest-songs-title">最新单曲</h3><span>{{ newSongPreview.length }} 首</span></header>
          <div v-if="newSongsSection.state === 'loading'" class="browse-song-list" aria-hidden="true">
            <div
              v-for="index in 6"
              :key="index"
              class="browse-skeleton-song-item"
            >
              <CommonSkeleton variant="rectangular" width="48px" height="48px" style="border-radius: var(--ncx-radius-md); flex-shrink: 0" />
              <div class="browse-skeleton-song-copy">
                <CommonSkeleton variant="rectangular" width="65%" height="14px" />
                <CommonSkeleton variant="rectangular" width="40%" height="11px" style="margin-top: 3px" />
              </div>
              <CommonSkeleton variant="avatar" width="16px" height="16px" style="opacity: 0.3; flex-shrink: 0" />
            </div>
          </div>
          <div v-else class="browse-song-list">
            <button v-for="song in newSongPreview" :key="song.id" type="button" @click="playSong(song)">
              <Cover :src="song.album?.artworkUrl" :alt="song.name" size="compact" :show-play-button="false" />
              <span><strong>{{ song.name }}</strong><small>{{ song.artists.map((artist) => artist.name).join(' / ') }}</small></span>
              <Play :size="15" fill="currentColor" />
            </button>
          </div>
        </section>

        <section class="browse-subsection" aria-labelledby="latest-albums-title">
          <header><h3 id="latest-albums-title">最新专辑</h3><span>{{ newAlbumPreview.length }} 张</span></header>
          <div v-if="newAlbumsSection.state === 'loading'" class="browse-album-grid" aria-hidden="true">
            <div
              v-for="index in 6"
              :key="index"
              class="browse-skeleton-card"
            >
              <CommonSkeleton variant="card" class="browse-skeleton-square-cover" />
              <div class="browse-skeleton-card-copy">
                <CommonSkeleton variant="rectangular" width="80%" height="14px" />
                <CommonSkeleton variant="rectangular" width="50%" height="12px" />
              </div>
            </div>
          </div>
          <div v-else class="browse-album-grid">
            <EntityCard
              v-for="album in newAlbumPreview"
              :key="album.id"
              :title="album.name"
              :subtitle="album.artist?.name"
              :artwork-url="album.artworkUrl"
              @activate="openAlbum(album)"
            />
          </div>
        </section>
      </div>
    </MusicSection>

    <MusicSection
      section-id="browse-featured"
      title="新歌推荐歌单"
      :state="featuredSection.state"
      :error-text="featuredSection.error"
      @retry="loadFeaturedPlaylists"
    >
      <template #skeleton>
        <div class="browse-card-strip" aria-hidden="true">
          <div
            v-for="index in 6"
            :key="index"
            class="browse-skeleton-card"
          >
            <CommonSkeleton variant="card" class="browse-skeleton-square-cover" />
            <div class="browse-skeleton-card-copy">
              <CommonSkeleton variant="rectangular" width="80%" height="14px" />
              <CommonSkeleton variant="rectangular" width="50%" height="12px" />
            </div>
          </div>
        </div>
      </template>
      <div class="browse-card-strip">
        <EntityCard
          v-for="playlist in featuredSection.data.slice(0, 6)"
          :key="playlist.id"
          :title="playlist.name"
          :subtitle="playlist.creator?.nickname"
          :artwork-url="playlist.artworkUrl"
          featured
          @activate="openPlaylist(playlist)"
        />
      </div>
    </MusicSection>

    <MusicSection
      section-id="popular-charts"
      title="热门排行榜"
      :state="chartsSection.state"
      :error-text="chartsSection.error"
      @retry="loadCharts"
    >
      <template #skeleton>
        <div class="browse-chart-grid" aria-hidden="true">
          <div
            v-for="index in 6"
            :key="index"
            class="browse-skeleton-chart-card"
          >
            <CommonSkeleton variant="card" class="browse-skeleton-chart-cover" />
            <div class="browse-skeleton-chart-copy">
              <CommonSkeleton variant="rectangular" width="70%" height="14px" />
              <CommonSkeleton variant="rectangular" width="45%" height="12px" style="margin-top: 4px" />
            </div>
            <CommonSkeleton variant="rectangular" width="14px" height="14px" style="opacity: 0.3; margin-left: auto" />
          </div>
        </div>
      </template>
      <template #actions>
        <CommonButton variant="ghost" size="compact" @click="openAllCharts">查看全部 <ChevronRight :size="14" /></CommonButton>
      </template>
      <div class="browse-chart-grid">
        <button v-for="chart in chartPreview" :key="chart.id" type="button" @click="openPlaylist(chart)">
          <Cover :src="chart.artworkUrl" :alt="chart.name" size="card" :show-play-button="false" />
          <span><strong>{{ chart.name }}</strong><small>{{ chart.updateFrequency || '持续更新' }}</small></span>
          <ChevronRight :size="16" />
        </button>
      </div>
    </MusicSection>

    <MusicSection
      section-id="browse-categories"
      title="按分类探索歌单"
      :state="categoryPreviewSection.state"
      :error-text="categoryPreviewSection.error"
      @retry="loadBrowseFacets"
    >
      <template #skeleton>
        <div class="browse-category-preview-list" aria-hidden="true">
          <section
            v-for="rowIndex in 5"
            :key="rowIndex"
            class="browse-category-preview-row"
          >
            <header>
              <CommonSkeleton variant="rectangular" width="36px" height="12px" />
              <CommonSkeleton variant="rectangular" width="68px" height="18px" style="margin-top: 4px" />
              <CommonSkeleton variant="rectangular" width="48px" height="11px" style="margin-top: 4px" />
            </header>
            <div class="browse-category-skeleton-strip">
              <div
                v-for="cardIndex in CATEGORY_PREVIEW_LIMIT"
                :key="cardIndex"
                class="browse-skeleton-card"
              >
                <CommonSkeleton variant="card" class="browse-skeleton-square-cover" />
                <div class="browse-skeleton-card-copy">
                  <CommonSkeleton variant="rectangular" width="80%" height="14px" />
                  <CommonSkeleton variant="rectangular" width="50%" height="12px" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
      <template #actions>
        <CommonButton
          variant="ghost"
          size="compact"
          @click="openAllCategories"
        >
          查看更多 <ChevronRight :size="14" />
        </CommonButton>
      </template>
      <div class="browse-category-preview-list">
        <section
          v-for="row in categoryPreviewSection.data"
          :key="row.group.key"
          class="browse-category-preview-row"
        >
          <header>
            <p>{{ row.group.label }}</p>
            <h3>{{ row.category }}</h3>
            <span>{{ row.section.data.length }} 个歌单</span>
          </header>
          <div
            v-if="row.section.state === 'loading'"
            class="browse-category-row-state browse-category-skeleton-strip"
          >
            <span class="sr-only">正在加载</span>
            <div
              v-for="cardIndex in CATEGORY_PREVIEW_LIMIT"
              :key="cardIndex"
              class="browse-skeleton-card"
            >
              <CommonSkeleton variant="card" class="browse-skeleton-square-cover" />
              <div class="browse-skeleton-card-copy">
                <CommonSkeleton variant="rectangular" width="80%" height="14px" />
                <CommonSkeleton variant="rectangular" width="50%" height="12px" />
              </div>
            </div>
          </div>
          <div
            v-else-if="row.section.state === 'error'"
            class="browse-category-row-state"
          >
            <span>{{ row.section.error }}</span>
            <button
              type="button"
              @click="loadCategoryPreview(row)"
            >
              重试
            </button>
          </div>
          <div
            v-else-if="row.section.state === 'empty'"
            class="browse-category-row-state"
          >
            当前分类暂无歌单
          </div>
          <div v-else class="browse-category-preview-strip">
            <EntityCard
              v-for="playlist in row.section.data"
              :key="playlist.id"
              :title="playlist.name"
              :subtitle="playlist.creator?.nickname"
              :artwork-url="playlist.artworkUrl"
              featured
              @activate="openPlaylist(playlist)"
            />
          </div>
        </section>
      </div>
    </MusicSection>

    <MusicSection
      section-id="artist-explore"
      title="歌手探索"
      :state="artistsSection.state"
      :error-text="artistsSection.error"
      @retry="loadArtists"
    >
      <template #skeleton>
        <div class="browse-artist-strip" aria-hidden="true">
          <div
            v-for="index in 8"
            :key="index"
            class="browse-skeleton-artist-card"
          >
            <CommonSkeleton variant="avatar" class="browse-skeleton-circle-avatar" />
            <CommonSkeleton variant="rectangular" width="60%" height="13px" style="margin-top: 8px" />
            <CommonSkeleton variant="rectangular" width="40%" height="11px" />
          </div>
        </div>
      </template>
      <template #actions>
        <CommonButton variant="ghost" size="compact" @click="openAllArtists">查看全部 <ChevronRight :size="14" /></CommonButton>
      </template>
      <div class="browse-artist-strip">
        <button v-for="artist in artistPreview" :key="artist.id" type="button" @click="openArtist(artist)">
          <Cover :src="artist.artworkUrl" :alt="artist.name" size="card" shape="circle" :show-play-button="false" />
          <strong>{{ artist.name }}</strong>
          <span>{{ artist.alias.join(' / ') || '歌手' }}</span>
        </button>
      </div>
    </MusicSection>
  </section>
</template>

<style scoped>
.browse-page { display: grid; width: min(1240px, calc(100% - 40px)); gap: 72px; margin: 0 auto; padding: 52px 0 148px; }
.browse-heading p, .browse-heading h1, .browse-heading span { margin: 0; }
.browse-heading p { color: var(--ncx-color-accent); font-size: 12px; font-weight: 750; letter-spacing: .04em; }
.browse-heading h1 { margin-top: 6px; font-size: clamp(36px, 5vw, 58px); line-height: 1.02; letter-spacing: -.035em; }
.browse-heading span { display: block; margin-top: 12px; color: var(--ncx-color-text-secondary); font-size: 15px; }
.browse-release-layout { display: grid; grid-template-columns: minmax(300px, .9fr) minmax(520px, 1.4fr); gap: 24px; }
.browse-subsection { min-width: 0; padding: 20px; border-radius: var(--ncx-radius-xl); background: color-mix(in srgb, var(--ncx-color-surface) 88%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ncx-color-text-primary) 7%, transparent); }
.browse-subsection > header, .browse-subsection > header h3 { display: flex; align-items: center; margin: 0; }
.browse-subsection > header { justify-content: space-between; margin-bottom: 14px; }
.browse-subsection > header h3 { font-size: 15px; }
.browse-subsection > header span { color: var(--ncx-color-text-tertiary); font-size: 12px; }
.browse-song-list { display: grid; gap: 4px; }
.browse-song-list > button { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 7px; border: 0; border-radius: 13px; color: inherit; text-align: left; background: transparent; cursor: pointer; }
.browse-song-list > button:hover { background: color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent); }
.browse-song-list > button:active { transform: scale(.985); }
.browse-song-list > button > span { display: grid; min-width: 0; }
.browse-song-list strong, .browse-song-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.browse-song-list strong { font-size: 13px; }
.browse-song-list small { margin-top: 3px; color: var(--ncx-color-text-secondary); font-size: 11px; }
.browse-album-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.browse-card-strip { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 20px; }
.browse-chart-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.browse-chart-grid > button { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; padding: 12px; border: 0; border-radius: var(--ncx-radius-lg); color: inherit; text-align: left; background: var(--ncx-color-surface); cursor: pointer; }
.browse-chart-grid > button:hover { transform: translateY(-2px); box-shadow: var(--ncx-shadow-md); }
.browse-chart-grid > button:active { transform: scale(.985); }
.browse-chart-grid > button > span { display: grid; min-width: 0; }
.browse-chart-grid strong, .browse-chart-grid small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.browse-chart-grid small { margin-top: 4px; color: var(--ncx-color-text-secondary); }
.browse-category-preview-list { display: grid; gap: 18px; }
.browse-category-preview-row { display: grid; min-width: 0; grid-template-columns: 132px minmax(0, 1fr); gap: 20px; padding: 18px; border-radius: var(--ncx-radius-xl); background: var(--ncx-color-surface); }
.browse-category-preview-row > header { display: grid; align-content: start; gap: 5px; }
.browse-category-preview-row > header p, .browse-category-preview-row > header h3, .browse-category-preview-row > header span { margin: 0; }
.browse-category-preview-row > header p { color: var(--ncx-color-accent); font-size: 12px; font-weight: 720; }
.browse-category-preview-row > header h3 { overflow: hidden; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }
.browse-category-preview-row > header span { color: var(--ncx-color-text-tertiary); font-size: 11px; }
.browse-category-preview-strip { display: grid; min-width: 0; grid-template-columns: repeat(5, minmax(126px, 1fr)); gap: 18px; }
.browse-category-row-state { display: flex; min-height: 150px; align-items: center; justify-content: center; gap: 10px; color: var(--ncx-color-text-secondary); font-size: 13px; }
.browse-category-row-state button { padding: 6px 10px; border: 0; border-radius: var(--ncx-radius-full); color: var(--ncx-color-accent); background: color-mix(in srgb, var(--ncx-color-accent) 10%, transparent); cursor: pointer; }
.browse-artist-strip { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 18px; }
.browse-artist-strip > button { display: grid; min-width: 0; justify-items: center; gap: 7px; padding: 0; border: 0; color: inherit; text-align: center; background: transparent; cursor: pointer; }
.browse-artist-strip :deep(.ncx-cover) { width: 100%; max-width: 118px; height: auto; aspect-ratio: 1 / 1; }
.browse-artist-strip strong, .browse-artist-strip span { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.browse-artist-strip strong { margin-top: 8px; font-size: 13px; }
.browse-artist-strip span { color: var(--ncx-color-text-secondary); font-size: 11px; }

/* ========= 骨架屏局部布局 ========= */

.browse-skeleton-song-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 7px;
  border-radius: 13px;
}

.browse-skeleton-song-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.browse-skeleton-card {
  display: grid;
  min-width: 0;
  gap: var(--ncx-space-3);
}

.browse-skeleton-card-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding-top: 2px;
}

.browse-skeleton-square-cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--ncx-radius-lg);
}

.browse-skeleton-chart-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: var(--ncx-radius-lg);
  background: var(--ncx-color-surface);
}

.browse-skeleton-chart-cover {
  width: 56px;
  height: 56px;
  border-radius: var(--ncx-radius-md);
}

.browse-skeleton-chart-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.browse-skeleton-artist-card {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 7px;
}

.browse-skeleton-circle-avatar {
  width: 100%;
  max-width: 118px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
}

.browse-category-skeleton-strip {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(5, minmax(126px, 1fr));
  gap: 18px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

@media (width < 1360px) { .browse-artist-strip { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
@media (width < 1100px) { .browse-release-layout { grid-template-columns: 1fr; } .browse-card-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } .browse-chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .browse-artist-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (width < 1100px) { .browse-category-preview-strip { overflow-x: auto; grid-template-columns: repeat(5, minmax(138px, 1fr)); padding-bottom: 8px; } }
@media (width < 760px) { .browse-page { width: min(100% - 24px, 1240px); gap: 52px; } .browse-album-grid, .browse-chart-grid { grid-template-columns: 1fr 1fr; } .browse-card-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } .browse-category-preview-row { grid-template-columns: 96px minmax(0, 1fr); gap: 14px; padding: 14px; } .browse-artist-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .browse-page button { transition: none !important; } .browse-page button:hover, .browse-page button:active { transform: none; } }
</style>
