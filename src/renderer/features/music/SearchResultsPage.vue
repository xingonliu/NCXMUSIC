<script setup lang="ts">
import { Disc3, ListMusic, Play, Search, UserRound } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
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
  CommonSearchInput,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { t , translatePublicError} from '../../i18n'
import Cover from './components/Cover.vue'
import AddTrackToPlaylistDialog from './components/AddTrackToPlaylistDialog.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** 搜索结果分类标签。 */
type SearchCategory = 'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'lyrics'

/** 当前路由对象，用于读取搜索词。 */
const route = useRoute()

/** Router 实例，用于进入集合详情。 */
const router = useRouter()

/** 播放器接口。 */
const player = usePlayer()

/** 当前搜索请求状态。 */
const loading = ref<boolean>(false)

/** 当前错误文案。 */
const errorMessage = ref<string>('')

/** 当前搜索结果。 */
const result = ref<Extract<MusicReadResult, { kind: 'search' }> | null>(null)

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 当前搜索分类。 */
const activeCategory = ref<SearchCategory>('all')

/** 结果页顶部搜索框草稿。 */
const draftQuery = ref<string>('')

/** 搜索分类标签配置。 */
const searchTabs: ReadonlyArray<{ value: SearchCategory; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'songs', label: '歌曲' },
  { value: 'artists', label: '歌手' },
  { value: 'albums', label: '专辑' },
  { value: 'playlists', label: '歌单' },
  { value: 'lyrics', label: '歌词' }
]

/** 最近一次请求 ID，用于取消和丢弃迟到响应。 */
let latestRequestId = ''

/** 当前查询词。 */
const query = computed<string>(() => String(route.query['q'] ?? '').trim())

/** 当前搜索歌曲结果。 */
const songs = computed<StandardSong[]>(() => result.value?.songs ?? [])

/** 当前搜索歌手结果。 */
const artists = computed<StandardArtist[]>(() => result.value?.artists ?? [])

/** 当前搜索专辑结果。 */
const albums = computed<StandardAlbum[]>(() => result.value?.albums ?? [])

/** 当前搜索歌单结果。 */
const playlists = computed<StandardPlaylist[]>(() => result.value?.playlists ?? [])

/** 当前歌词搜索结果。 */
const lyrics = computed<StandardSong[]>(() => result.value?.lyrics ?? [])

/** 当前播放曲目 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 是否完全没有搜索结果。 */
const isEmpty = computed<boolean>(() => {
  return songs.value.length + artists.value.length + albums.value.length + playlists.value.length + lyrics.value.length === 0
})

/** 当前结果中全部内容实体的数量。 */
const resultCount = computed<number>(() => {
  return songs.value.length + artists.value.length + albums.value.length + playlists.value.length + lyrics.value.length
})

// ========= 函数 =========

/** 读取当前搜索词对应的标准搜索结果。 */
async function loadSearchResults(): Promise<void> {
  result.value = null
  errorMessage.value = ''

  if (!query.value) return

  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  loading.value = true

  try {
    const response = await window.ncx.runtime.searchMusic({
      query: query.value,
      category: activeCategory.value,
      limit: 20,
      requestId
    })
    if (requestId !== latestRequestId) return
    if (!response.ok) {
      errorMessage.value = translatePublicError(response.error)
      return
    }
    if (response.data.kind !== 'search') {
      errorMessage.value = t('music.search.mismatch')
      return
    }
    result.value = response.data
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

/** 提交结果页顶部搜索框。 */
function submitDraftSearch(): void {
  /** 清理后的新搜索词。 */
  const value = draftQuery.value.trim()
  if (!value) return
  void router.replace({ name: 'search-results', query: { q: value } })
}

/** 播放单首搜索结果。 */
async function playSong(song: StandardSong): Promise<void> {
  await player.playTrack(standardSongToTrackSummary(song), { kind: 'search' })
}

/** 播放当前可见歌曲列表。 */
async function playAllSongs(): Promise<void> {
  if (songs.value.length === 0) return
  await player.playContext({
    tracks: standardSongsToTrackSummaries(songs.value),
    source: { kind: 'search' }
  })
}

/** 把歌曲追加到队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'search' })
}

/** 收藏搜索结果歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
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

/** 打开正式歌曲详情路由。 */
function openSongDetails(song: StandardSong): void {
  void router.push({ name: 'song-detail', params: { songId: song.id } })
}

/** 将歌曲上下文交给 Agent 正式入口。 */
function giveSongToAgent(song: StandardSong): void {
  void router.push({
    name: 'agent',
    query: { intent: 'track', trackId: song.id, title: song.name }
  })
}

/** 打开共享的自建歌单选择对话框。 */
function openAddToPlaylist(song: StandardSong): void {
  playlistTarget.value = song
}

// ========= 生命周期 =========

watch([query, activeCategory], () => {
  draftQuery.value = query.value
  void loadSearchResults()
}, { immediate: true })
</script>

<template>
  <section
    class="search-results-page music-content-page"
    aria-labelledby="search-results-title"
  >
    <form
      class="search-results-input"
      @submit.prevent="submitDraftSearch"
    >
      <CommonSearchInput
        v-model="draftQuery"
        size="prominent"
        :placeholder="$tSource('搜索歌曲、歌手、专辑、歌单或歌词')"
        :aria-label="$tSource('搜索音乐')"
        @search="submitDraftSearch"
      />
      <CommonButton
        variant="primary"
        size="prominent"
        type="submit"
      >
        <Search :size="16" />{{ $tSource("搜索") }}
      </CommonButton>
    </form>

    <nav
      class="search-category-tabs"
      :aria-label="$tSource('搜索结果分类')"
    >
      <button
        v-for="tab in searchTabs"
        :key="tab.value"
        type="button"
        :class="{ active: activeCategory === tab.value }"
        @click="activeCategory = tab.value"
      >
        {{ $tSource(tab.label) }}
      </button>
    </nav>

    <div class="search-results-header">
      <div class="music-page-heading">
        <p class="music-page-eyebrow">
          {{ $tSource("搜索结果") }}
        </p>
        <h1 id="search-results-title">
          {{ $tSource(query || '搜索') }}
        </h1>
        <p class="search-results-summary">
          {{ $tSource(result ? `已整理 ${resultCount} 项内容` : '结果会按歌曲、歌手、专辑、歌单与歌词分类') }}
        </p>
      </div>
      <CommonButton
        variant="primary"
        :disabled="songs.length === 0"
        @click="playAllSongs"
      >
        <Play
          :size="15"
          fill="currentColor"
        /> {{ $tSource("播放全部") }}
      </CommonButton>
    </div>

    <Transition
      name="music-page-state"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="loading"
        class="search-results-state search-results-loading"
      >
        <CommonSpinner :label="$tSource('搜索中')" />
        <span>{{ $tSource("正在搜索") }}</span>
      </div>

      <div
        v-else-if="errorMessage"
        key="error"
        class="search-results-state"
      >
        <CommonErrorState
          :title="$tSource('搜索失败')"
          :description="errorMessage"
          @retry="loadSearchResults"
        />
      </div>

      <div
        v-else-if="!query || isEmpty"
        key="empty"
        class="search-results-state"
      >
        <CommonEmptyState
          :title="$tSource('暂无结果')"
          :description="$tSource('换个关键词试试。')"
        />
      </div>

      <div
        v-else
        key="content"
        class="search-results-content"
      >
        <section
          v-if="songs.length > 0 && (activeCategory === 'all' || activeCategory === 'songs')"
          class="music-result-section music-surface"
        >
          <header class="music-section-heading">
            <h2>{{ $tSource("歌曲") }}</h2>
            <span>{{ songs.length }} {{ $tSource("首") }}</span>
          </header>
          <VirtualTrackList
            class="track-list"
            :songs="songs"
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

        <section
          v-if="(albums.length > 0 && (activeCategory === 'all' || activeCategory === 'albums')) || (playlists.length > 0 && (activeCategory === 'all' || activeCategory === 'playlists'))"
          class="music-result-section music-surface"
        >
          <header class="music-section-heading">
            <h2>{{ $tSource("专辑与歌单") }}</h2>
            <span>{{ albums.length + playlists.length }} {{ $tSource("个") }}</span>
          </header>
          <div class="collection-grid">
            <button
              v-for="album in activeCategory === 'playlists' ? [] : albums"
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
              <span><Disc3 :size="13" /> {{ $tSource("专辑") }}</span>
            </button>

            <button
              v-for="playlist in activeCategory === 'albums' ? [] : playlists"
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
              <span><ListMusic :size="13" /> {{ $tSource("歌单") }}</span>
            </button>
          </div>
        </section>

        <section
          v-if="artists.length > 0 && (activeCategory === 'all' || activeCategory === 'artists')"
          class="music-result-section music-surface"
        >
          <header class="music-section-heading">
            <h2>{{ $tSource("歌手") }}</h2>
            <span>{{ artists.length }} {{ $tSource("位") }}</span>
          </header>
          <div class="artist-strip">
            <button
              v-for="artist in artists"
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
                <span><UserRound :size="13" /> {{ $tSource("歌手") }}</span>
              </span>
            </button>
          </div>
        </section>

        <section
          v-if="lyrics.length > 0 && activeCategory === 'lyrics'"
          class="music-result-section music-surface"
        >
          <header class="music-section-heading">
            <h2>{{ $tSource("歌词") }}</h2>
            <span>{{ lyrics.length }} {{ $tSource("首含关键词") }}</span>
          </header>
          <VirtualTrackList
            class="track-list"
            :songs="lyrics"
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

    <AddTrackToPlaylistDialog
      :song="playlistTarget"
      @close="playlistTarget = null"
    />
  </section>
</template>

<style scoped>
.search-results-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.search-category-tabs {
  display: flex;
  overflow-x: auto;
  gap: 6px;
  padding: 5px;
  border-radius: var(--ncx-squircle-radius-full);
  background: color-mix(in srgb, var(--ncx-color-surface) 82%, transparent);
}

.search-category-tabs button {
  flex: 0 0 auto;
  padding: 9px 15px;
  border: 0;
  border-radius: var(--ncx-squircle-radius-full);
  color: var(--ncx-color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.search-category-tabs button:hover,
.search-category-tabs button.active {
  color: var(--ncx-color-text-primary);
  background: color-mix(in srgb, var(--ncx-color-text-primary) 8%, transparent);
}

.search-category-tabs button:active {
  transform: scale(.96);
}

@media (width < 640px) {
  .search-results-input {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .search-category-tabs button {
    transition: none !important;
  }

  .search-category-tabs button:active {
    transform: none;
  }
}
</style>
