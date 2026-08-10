<script setup lang="ts">
import { ChevronRight, Play, Radio, Sparkles } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type {
  MusicBrowseFacetGroup,
  StandardAlbum,
  StandardArtist,
  StandardPlaylist,
  StandardSong
} from '../../../shared/schemas/music'
import { CommonButton } from '../../design-system/components'
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

/** 当前分类的歌单预览内容区。 */
const categorySection = ref<BrowseSectionState<StandardPlaylist[]>>({ state: 'loading', data: [], error: '' })

/** API 能力层返回的浏览筛选分组。 */
const browseFacets = ref<MusicBrowseFacetGroup[]>([])

/** 当前用于拉取分类歌单的分类名。 */
const activeCategory = ref<string>('')

/** 浏览页展示的音乐风格、场景与情绪 API 分组。 */
const playlistFacetGroups = computed<MusicBrowseFacetGroup[]>(() => browseFacets.value.filter((group) =>
  group.key === 'playlist-style' || group.key === 'playlist-scene' || group.key === 'playlist-mood'
))

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

/** 读取当前选中分类的歌单预览。 */
async function loadCategoryPlaylists(): Promise<void> {
  if (!activeCategory.value) {
    categorySection.value = { state: 'empty', data: [], error: '' }
    return
  }
  categorySection.value.state = 'loading'
  /** 当前分类请求发起时的分类快照。 */
  const category = activeCategory.value
  /** 分类歌单标准响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getCategoryPlaylists',
    category,
    limit: 10
  })
  if (category !== activeCategory.value) return
  if (!response.ok) return failSection(categorySection.value, response.error.message)
  if (response.data.kind !== 'playlistCollection') return failSection(categorySection.value, '分类歌单响应类型不匹配。')
  settleSection(categorySection.value, response.data.playlists)
}

/** 读取由网易云分类树与歌手 API 能力层返回的动态筛选项。 */
async function loadBrowseFacets(): Promise<void> {
  /** 动态筛选标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getBrowseFacets' })
  if (!response.ok || response.data.kind !== 'playlistCollection' || response.data.collection !== 'facets') {
    browseFacets.value = []
    return
  }
  browseFacets.value = response.data.facets
  /** API 返回的第一个音乐风格选项。 */
  const firstCategory = playlistFacetGroups.value.flatMap((group) => group.options)[0]
  if (!activeCategory.value && firstCategory) activeCategory.value = firstCategory.value
}

/** 切换音乐风格或场景情绪分类。 */
function selectCategory(category: string): void {
  if (activeCategory.value === category) return
  activeCategory.value = category
  void loadCategoryPlaylists()
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

/** 读取浏览页全部互相独立的内容区。 */
async function loadPage(): Promise<void> {
  await loadBrowseFacets()
  await Promise.all([
    loadNewSongs(),
    loadNewAlbums(),
    loadFeaturedPlaylists(),
    loadCharts(),
    loadArtists(),
    loadCategoryPlaylists()
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
      description="最新单曲与专辑，按上架时间保持新鲜。"
      :state="newSongsSection.state === 'error' && newAlbumsSection.state === 'error' ? 'error' : 'ready'"
      :error-text="newSongsSection.error || newAlbumsSection.error"
      @retry="loadPage"
    >
      <div class="browse-release-layout">
        <section class="browse-subsection" aria-labelledby="latest-songs-title">
          <header><h3 id="latest-songs-title">最新单曲</h3><span>{{ newSongPreview.length }} 首</span></header>
          <div class="browse-song-list">
            <button v-for="song in newSongPreview" :key="song.id" type="button" @click="playSong(song)">
              <Cover :src="song.album?.artworkUrl" :alt="song.name" size="compact" :show-play-button="false" />
              <span><strong>{{ song.name }}</strong><small>{{ song.artists.map((artist) => artist.name).join(' / ') }}</small></span>
              <Play :size="15" fill="currentColor" />
            </button>
          </div>
        </section>

        <section class="browse-subsection" aria-labelledby="latest-albums-title">
          <header><h3 id="latest-albums-title">最新专辑</h3><span>{{ newAlbumPreview.length }} 张</span></header>
          <div class="browse-album-grid">
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
      description="用完整歌单继续探索刚刚发现的声音。"
      :state="featuredSection.state"
      :error-text="featuredSection.error"
      @retry="loadFeaturedPlaylists"
    >
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
      description="全球与地区榜单会按网易云当前可用目录展示。"
      :state="chartsSection.state"
      :error-text="chartsSection.error"
      @retry="loadCharts"
    >
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
      title="按音乐风格与场景探索"
      :description="activeCategory ? `正在浏览“${activeCategory}”` : '分类会随网易云 API 返回结果动态生成。'"
      :state="categorySection.state"
      :error-text="categorySection.error"
      @retry="loadCategoryPlaylists"
    >
      <div class="browse-category-board">
        <section v-for="group in playlistFacetGroups" :key="group.key">
          <header>
            <Radio v-if="group.key === 'playlist-scene'" :size="17" />
            <Sparkles v-else :size="17" />
            <h3>{{ group.label }}</h3>
          </header>
          <div>
            <button
              v-for="option in group.options"
              :key="option.value"
              type="button"
              :class="{ active: activeCategory === option.value }"
              @click="selectCategory(option.value)"
            >{{ option.label }}</button>
          </div>
        </section>
      </div>
      <div class="browse-card-strip browse-category-results">
        <EntityCard
          v-for="playlist in categorySection.data.slice(0, 5)"
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
      section-id="artist-explore"
      title="歌手探索"
      description="从不同地区和类型继续发现歌手。"
      :state="artistsSection.state"
      :error-text="artistsSection.error"
      @retry="loadArtists"
    >
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
.browse-category-board { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 22px; }
.browse-category-board > section { padding: 18px; border-radius: var(--ncx-radius-xl); background: var(--ncx-color-surface); }
.browse-category-board header { display: flex; align-items: center; gap: 8px; color: var(--ncx-color-accent); }
.browse-category-board h3 { margin: 0; color: var(--ncx-color-text-primary); font-size: 14px; }
.browse-category-board section > div { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.browse-category-board button { padding: 8px 12px; border: 0; border-radius: 999px; color: var(--ncx-color-text-secondary); background: color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent); cursor: pointer; }
.browse-category-board button:hover, .browse-category-board button.active { color: #fff; background: var(--ncx-color-accent); }
.browse-category-board button:active { transform: scale(.96); }
.browse-category-results { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.browse-artist-strip { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 18px; }
.browse-artist-strip > button { display: grid; min-width: 0; justify-items: center; gap: 7px; padding: 0; border: 0; color: inherit; text-align: center; background: transparent; cursor: pointer; }
.browse-artist-strip strong, .browse-artist-strip span { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.browse-artist-strip strong { margin-top: 8px; font-size: 13px; }
.browse-artist-strip span { color: var(--ncx-color-text-secondary); font-size: 11px; }
@media (width < 1100px) { .browse-release-layout { grid-template-columns: 1fr; } .browse-card-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } .browse-chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .browse-artist-strip { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
@media (width < 760px) { .browse-page { width: min(100% - 24px, 1240px); gap: 52px; } .browse-album-grid, .browse-chart-grid { grid-template-columns: 1fr 1fr; } .browse-card-strip, .browse-category-results { grid-template-columns: repeat(2, minmax(0, 1fr)); } .browse-category-board { grid-template-columns: 1fr; } .browse-artist-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .browse-page button { transition: none !important; } .browse-page button:hover, .browse-page button:active { transform: none; } }
</style>
