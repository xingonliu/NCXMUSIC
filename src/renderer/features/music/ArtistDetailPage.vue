<script setup lang="ts">
import { Heart, Play, Radio } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type {
  MusicReadResult,
  StandardAlbum,
  StandardArtist,
  StandardSong
} from '../../../shared/schemas/music'
import {
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import EntityCard from './components/EntityCard.vue'
import AddTrackToPlaylistDialog from './components/AddTrackToPlaylistDialog.vue'
import Cover from './components/Cover.vue'
import MusicSection from './components/MusicSection.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'

// ========= 类型 =========

/** 页面独立列表 Section 状态。 */
interface ListSection<T> {
  /** Section 当前状态。 */
  state: 'loading' | 'empty' | 'error' | 'ready'
  /** Section 实体列表。 */
  items: T[]
  /** Section 错误文案。 */
  error: string
}

// ========= 变量 =========

/** 当前路由对象。 */
const route = useRoute()

/** Router 实例。 */
const router = useRouter()

/** 应用播放器接口。 */
const player = usePlayer()

/** 歌手主实体。 */
const artist = ref<StandardArtist | null>(null)

/** 歌手主实体加载状态。 */
const loading = ref<boolean>(true)

/** 歌手主实体错误文案。 */
const errorMessage = ref<string>('')

/** 歌手专辑 Section。 */
const albumsSection = ref<ListSection<StandardAlbum>>({ state: 'loading', items: [], error: '' })

/** 相似歌手 Section。 */
const similarSection = ref<ListSection<StandardArtist>>({ state: 'loading', items: [], error: '' })

/** 歌手按时间排序的作品 Section。 */
const worksSection = ref<ListSection<StandardSong>>({ state: 'loading', items: [], error: '' })

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 当前歌手 ID。 */
const artistId = computed<string>(() => String(route.params['artistId'] ?? ''))

/** 当前播放歌曲 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 歌手热门歌曲前十首。 */
const hotSongs = computed<StandardSong[]>(() => (artist.value?.hotSongs ?? []).slice(0, 10))

/** 按发行时间倒序的歌手专辑。 */
const sortedAlbums = computed<StandardAlbum[]>(() => [...albumsSection.value.items].sort((left, right) =>
  (right.publishTime ?? 0) - (left.publishTime ?? 0)))

/** 歌手最新发行。 */
const latestRelease = computed<StandardAlbum | null>(() => sortedAlbums.value[0] ?? null)

/** 明确包含其他艺人的合作作品。 */
const collaborativeSongs = computed<StandardSong[]>(() => worksSection.value.items.filter((song) =>
  song.artists.some((item) => item.id === artistId.value) && song.artists.some((item) => item.id !== artistId.value)))

/** 参与作品展示列表；无明确合作元数据时回退到近期作品。 */
const featuredSongs = computed<StandardSong[]>(() =>
  (collaborativeSongs.value.length > 0 ? collaborativeSongs.value : worksSection.value.items).slice(0, 8))

/** 当前参与作品是否使用近期作品优雅降级。 */
const featuredFallback = computed<boolean>(() => collaborativeSongs.value.length === 0 && worksSection.value.items.length > 0)

// ========= 函数 =========

/** 读取歌手主实体和热门歌曲。 */
async function loadArtist(): Promise<void> {
  artist.value = null
  errorMessage.value = ''
  loading.value = true
  const response = await window.ncx.runtime.getArtist({ id: artistId.value })
  loading.value = false
  if (!response.ok) {
    errorMessage.value = response.error.message
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'artist') {
    errorMessage.value = '歌手响应类型不匹配。'
    return
  }
  artist.value = result.entity
}

/** 读取歌手专辑独立 Section。 */
async function loadArtistAlbums(): Promise<void> {
  albumsSection.value.state = 'loading'
  const response = await window.ncx.runtime.getArtistAlbums({ artistId: artistId.value, limit: 16 })
  if (!response.ok) {
    albumsSection.value = { state: 'error', items: [], error: response.error.message }
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'albumCollection') {
    albumsSection.value = { state: 'error', items: [], error: '歌手专辑响应类型不匹配。' }
    return
  }
  albumsSection.value = {
    state: result.albums.length === 0 ? 'empty' : 'ready',
    items: result.albums,
    error: ''
  }
}

/** 读取相似歌手独立 Section。 */
async function loadSimilarArtists(): Promise<void> {
  similarSection.value.state = 'loading'
  const response = await window.ncx.runtime.getSimilarArtists({ artistId: artistId.value })
  if (!response.ok) {
    /** 未登录或上游限制时使用热门歌手作为替代推荐。 */
    const fallback = await window.ncx.runtime.readMusic({ operation: 'getRecommendedArtists', limit: 12, offset: 0 })
    if (fallback.ok && fallback.data.kind === 'artistCollection') {
      /** 排除当前歌手后的替代推荐。 */
      const artists = fallback.data.artists.filter((item) => item.id !== artistId.value).slice(0, 8)
      similarSection.value = { state: artists.length > 0 ? 'ready' : 'empty', items: artists, error: '' }
      return
    }
    similarSection.value = { state: 'error', items: [], error: response.error.message }
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'artistCollection') {
    similarSection.value = { state: 'error', items: [], error: '相似歌手响应类型不匹配。' }
    return
  }
  similarSection.value = {
    state: result.artists.length === 0 ? 'empty' : 'ready',
    items: result.artists,
    error: ''
  }
}

/** 读取歌手按时间排序的全部作品，用于参与作品与合集。 */
async function loadArtistWorks(): Promise<void> {
  worksSection.value.state = 'loading'
  /** 歌手作品标准响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getArtistSongs',
    artistId: artistId.value,
    order: 'time',
    limit: 50,
    offset: 0
  })
  if (!response.ok) {
    worksSection.value = { state: 'error', items: [], error: response.error.message }
    return
  }
  if (response.data.kind !== 'songCollection') {
    worksSection.value = { state: 'error', items: [], error: '歌手作品响应类型不匹配。' }
    return
  }
  worksSection.value = {
    state: response.data.songs.length > 0 ? 'ready' : 'empty',
    items: response.data.songs,
    error: ''
  }
}

/** 从热门歌曲中的指定位置播放集合。 */
async function playSong(song: StandardSong): Promise<void> {
  const startIndex = hotSongs.value.findIndex((item) => item.id === song.id)
  await player.playContext({
    tracks: standardSongsToTrackSummaries(hotSongs.value),
    source: { kind: 'artist', artistId: artistId.value },
    startIndex: Math.max(0, startIndex)
  })
}

/** 播放全部热门歌曲。 */
async function playAll(): Promise<void> {
  const first = hotSongs.value[0]
  if (first) await playSong(first)
}

/** 追加热门歌曲到队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'artist', artistId: artistId.value })
}

/** 收藏当前歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  showToast(`已收藏《${song.name}》。`, 'success')
}

/** 打开共享的自建歌单选择对话框。 */
function openAddToPlaylist(song: StandardSong): void {
  playlistTarget.value = song
}

/** 打开正式歌曲详情页。 */
function openSongDetails(song: StandardSong): void {
  void router.push({ name: 'song-detail', params: { songId: song.id } })
}

/** 将歌曲标准上下文交给小云入口。 */
function giveSongToAgent(song: StandardSong): void {
  void router.push({
    name: 'agent',
    query: { intent: 'track', trackId: song.id, title: song.name }
  })
}

/** 打开指定专辑。 */
function openAlbum(album: StandardAlbum): void {
  void router.push({ name: 'album-detail', params: { albumId: album.id } })
}

/** 打开指定相似歌手。 */
function openArtist(item: StandardArtist): void {
  void router.push({ name: 'artist-detail', params: { artistId: item.id } })
}

/** 关注或取消关注当前歌手。 */
async function toggleArtistFollow(): Promise<void> {
  /** 当前歌手实体快照。 */
  const current = artist.value
  if (!current) return
  /** 本次写入后的关注目标状态。 */
  const subscribed = !current.followed
  /** 关注歌手标准写入响应。 */
  const response = await mutateMusic({ operation: 'subscribeArtist', artistId: current.id, subscribed })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  artist.value = { ...current, followed: subscribed }
  showToast(subscribed ? `已关注 ${current.name}。` : `已取消关注 ${current.name}。`, 'success')
}

/** 读取歌手页全部独立数据区块。 */
async function loadPage(): Promise<void> {
  await Promise.all([loadArtist(), loadArtistAlbums(), loadSimilarArtists(), loadArtistWorks()])
}

// ========= 生命周期 =========

watch(artistId, () => {
  void loadPage()
}, { immediate: true })
</script>

<template>
  <section
    class="artist-page music-content-page"
    aria-labelledby="artist-title"
  >
    <Transition
      name="music-page-state"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="loading"
        class="artist-page-state artist-loading"
      >
        <CommonSpinner label="正在加载歌手" />
        <span>正在加载歌手</span>
      </div>

      <div
        v-else-if="errorMessage"
        key="error"
        class="artist-page-state"
      >
        <CommonErrorState
          title="歌手读取失败"
          :description="errorMessage"
          @retry="loadArtist"
        />
      </div>

      <div
        v-else-if="!artist"
        key="empty"
        class="artist-page-state"
      >
        <CommonEmptyState
          title="没有找到歌手"
          description="该歌手暂时不可用。"
        />
      </div>

      <div
        v-else
        key="content"
        class="artist-page-content"
      >
        <div class="artist-visual-hero-shell">
          <div
            class="artist-visual-glow"
            :style="{ backgroundImage: `url(${artist.coverUrl || artist.artworkUrl || ''})` }"
            aria-hidden="true"
          />
          <header class="artist-visual-hero">
            <div
              class="artist-visual-background"
              :style="{ backgroundImage: `url(${artist.coverUrl || artist.artworkUrl || ''})` }"
              aria-hidden="true"
            />
            <div class="artist-visual-scrim" />
            <div class="artist-visual-copy">
              <p class="music-page-eyebrow">
                <Radio :size="13" /> 歌手
              </p>
              <h1 id="artist-title">
                {{ artist.name }}
              </h1>
              <p class="music-detail-description">
                {{ artist.alias.join(' / ') || artist.description || '网易云音乐歌手' }}
              </p>
              <p class="music-detail-meta">
                {{ artist.songCount ?? hotSongs.length }} 首歌曲 · {{ artist.albumCount ?? albumsSection.items.length }} 张专辑
              </p>
              <div class="music-detail-actions">
                <CommonButton
                  variant="primary"
                  size="prominent"
                  :disabled="hotSongs.length === 0"
                  @click="playAll"
                >
                  <Play
                    :size="15"
                    fill="currentColor"
                  />
                  播放热门歌曲
                </CommonButton>
                <CommonButton
                  variant="secondary"
                  size="prominent"
                  @click="toggleArtistFollow"
                >
                  <Heart
                    :size="15"
                    :fill="artist.followed ? 'currentColor' : 'none'"
                  />
                  {{ artist.followed ? '已关注' : '关注' }}
                </CommonButton>
              </div>
            </div>
          </header>
        </div>

        <MusicSection
          section-id="artist-latest-release"
          title="最新发布"
          description="按发行时间读取的最新一张专辑或 EP。"
          :state="albumsSection.state"
          :error-text="albumsSection.error"
          empty-text="暂时没有最新发布。"
          min-height="0"
          @retry="loadArtistAlbums"
        >
          <button
            v-if="latestRelease"
            class="artist-latest-card"
            type="button"
            @click="openAlbum(latestRelease)"
          >
            <Cover
              :src="latestRelease.artworkUrl"
              :alt="latestRelease.name"
              size="card"
              :show-play-button="false"
            />
            <span>
              <small>Latest Release</small>
              <strong>{{ latestRelease.name }}</strong>
              <span>{{ latestRelease.publishTime ? new Date(latestRelease.publishTime).getFullYear() : '最新发行' }} · {{ latestRelease.size ?? 0 }} 首</span>
            </span>
            <Play
              :size="18"
              fill="currentColor"
            />
          </button>
        </MusicSection>

        <MusicSection
          section-id="artist-hot-songs"
          title="热门歌曲"
          :state="hotSongs.length > 0 ? 'ready' : 'empty'"
          empty-text="暂时没有热门歌曲。"
          min-height="0"
        >
          <VirtualTrackList
            :songs="hotSongs"
            :active-track-id="activeTrackId"
            @play="playSong"
            @enqueue="enqueueSong"
            @play-next="playSongNext($event, { kind: 'artist', artistId })"
            @like="likeSong"
            @add-to-playlist="openAddToPlaylist"
            @details="openSongDetails"
            @give-agent="giveSongToAgent"
          />
        </MusicSection>

        <MusicSection
          section-id="artist-albums"
          title="专辑与 EP"
          description="按发行时间倒序排列。"
          :state="albumsSection.state"
          :error-text="albumsSection.error"
          empty-text="暂时没有专辑。"
          min-height="0"
          @retry="loadArtistAlbums"
        >
          <div class="artist-card-grid">
            <EntityCard
              v-for="album in sortedAlbums"
              :key="album.id"
              :title="album.name"
              :subtitle="album.publishTime ? new Date(album.publishTime).getFullYear().toString() : '专辑'"
              :artwork-url="album.artworkUrl"
              @activate="openAlbum(album)"
            />
          </div>
        </MusicSection>

        <MusicSection
          section-id="artist-appears-on"
          title="参与作品与合集"
          :description="featuredFallback ? '上游未返回明确客串关系，暂以近期作品替代展示。' : '艺人客串、合作或共同演唱的近期作品。'"
          :state="worksSection.state"
          :error-text="worksSection.error"
          empty-text="暂时没有可识别的参与作品。"
          min-height="0"
          @retry="loadArtistWorks"
        >
          <VirtualTrackList
            :songs="featuredSongs"
            :active-track-id="activeTrackId"
            @play="playSong"
            @enqueue="enqueueSong"
            @play-next="playSongNext($event, { kind: 'artist', artistId })"
            @like="likeSong"
            @add-to-playlist="openAddToPlaylist"
            @details="openSongDetails"
            @give-agent="giveSongToAgent"
          />
        </MusicSection>

        <MusicSection
          section-id="similar-artists"
          title="相似歌手"
          description="登录时优先使用相似歌手；受限时回退为热门歌手推荐。"
          :state="similarSection.state"
          :error-text="similarSection.error"
          empty-text="暂时没有相似歌手。"
          min-height="0"
          @retry="loadSimilarArtists"
        >
          <div class="artist-card-grid">
            <EntityCard
              v-for="item in similarSection.items"
              :key="item.id"
              :title="item.name"
              :subtitle="item.alias.join(' / ') || '歌手'"
              :artwork-url="item.artworkUrl"
              @activate="openArtist(item)"
            />
          </div>
        </MusicSection>

        <AddTrackToPlaylistDialog
          :song="playlistTarget"
          @close="playlistTarget = null"
        />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.artist-visual-hero-shell {
  position: relative;
  isolation: isolate;
}

.artist-visual-glow {
  position: absolute;
  inset: 12% 6% -3%;
  z-index: -1;
  border-radius: 30px;
  background-position: center 26%;
  background-size: cover;
  filter: blur(52px) saturate(1.35) opacity(.42);
  transform: scale(.96) translateY(18px);
  pointer-events: none;
}

.artist-visual-hero {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: min(62vh, 560px);
  align-items: end;
  padding: 42px;
  border-radius: 30px;
  color: #fff;
  background: #26262c;
}

.artist-visual-background,
.artist-visual-scrim {
  position: absolute;
  inset: 0;
}

.artist-visual-background {
  background-position: center 26%;
  background-size: cover;
  transform: scale(1.02);
}

.artist-visual-scrim {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, .02) 24%, rgba(0, 0, 0, .82) 100%),
    linear-gradient(90deg, rgba(0, 0, 0, .46), transparent 62%);
}

.artist-visual-copy {
  position: relative;
  z-index: 2;
  width: min(680px, 90%);
}

.artist-visual-copy h1,
.artist-visual-copy p {
  margin: 0;
}

.artist-visual-copy .music-page-eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, .76);
}

.artist-visual-copy h1 {
  margin-top: 7px;
  font-size: clamp(48px, 8vw, 92px);
  line-height: .98;
  letter-spacing: -.045em;
}

.artist-visual-copy .music-detail-description {
  max-width: 60ch;
  margin-top: 15px;
  color: rgba(255, 255, 255, .78);
}

.artist-visual-copy .music-detail-meta {
  margin-top: 10px;
  color: rgba(255, 255, 255, .64);
}

.artist-visual-copy .music-detail-actions {
  margin-top: 22px;
}

.artist-latest-card {
  display: grid;
  width: min(620px, 100%);
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  padding: 4px 8px 4px 0;
  border: 0;
  border-radius: var(--ncx-radius-lg);
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.artist-latest-card:hover {
  background: var(--music-page-surface-subtle);
  transform: translateY(-1px);
}

.artist-latest-card:active {
  transform: scale(.99);
}

.artist-latest-card > span {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.artist-latest-card small {
  color: var(--ncx-color-accent);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.artist-latest-card strong,
.artist-latest-card > span > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-latest-card strong {
  font-size: 19px;
}

.artist-latest-card > span > span {
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
}

@media (width < 720px) {
  .artist-visual-hero {
    min-height: 440px;
    padding: 28px;
  }

  .artist-visual-copy h1 {
    font-size: 46px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .artist-visual-background,
  .artist-visual-glow {
    transform: none;
  }

  .artist-latest-card {
    transition: none !important;
  }

  .artist-latest-card:hover,
  .artist-latest-card:active {
    transform: none;
  }
}
</style>
