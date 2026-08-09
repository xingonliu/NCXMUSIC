<script setup lang="ts">
import { Disc3, ListMusic, Play, UserRound } from '@lucide/vue'
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
  CommonSpinner
} from '../../design-system/components'
import MediaArtwork from './components/MediaArtwork.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import { usePlayer } from './use-player'

// ========= 变量 =========

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

/** 当前播放曲目 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 是否完全没有搜索结果。 */
const isEmpty = computed<boolean>(() => {
  return songs.value.length + artists.value.length + albums.value.length + playlists.value.length === 0
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
    const response = await window.ncx.runtime.searchMusic({ query: query.value, limit: 20, requestId })
    if (requestId !== latestRequestId) return
    if (!response.ok) {
      errorMessage.value = response.error.message
      return
    }
    if (response.data.kind !== 'search') {
      errorMessage.value = '搜索响应类型不匹配。'
      return
    }
    result.value = response.data
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
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
  if (!response.ok) errorMessage.value = response.error.message
}

/** 打开专辑详情。 */
function openAlbum(album: StandardAlbum): void {
  void router.push({ name: 'album-detail', params: { albumId: album.id } })
}

/** 打开歌单详情。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

// ========= 生命周期 =========

watch(query, () => {
  void loadSearchResults()
}, { immediate: true })
</script>

<template>
  <section class="search-results-page" aria-labelledby="search-results-title">
    <div class="search-results-header">
      <div>
        <p class="music-page-eyebrow">搜索结果</p>
        <h1 id="search-results-title">{{ query || '搜索' }}</h1>
      </div>
      <CommonButton
        variant="primary"
        :disabled="songs.length === 0"
        @click="playAllSongs"
      >
        <Play :size="15" fill="currentColor" />
        播放全部
      </CommonButton>
    </div>

    <div v-if="loading" class="search-results-loading">
      <CommonSpinner label="搜索中" />
      <span>正在搜索</span>
    </div>

    <CommonErrorState
      v-else-if="errorMessage"
      title="搜索失败"
      :description="errorMessage"
      @retry="loadSearchResults"
    />

    <CommonEmptyState
      v-else-if="!query || isEmpty"
      title="暂无结果"
      description="换个关键词试试。"
    />

    <div v-else class="search-results-content">
      <section v-if="songs.length > 0" class="music-section">
        <h2>歌曲</h2>
        <VirtualTrackList
          class="track-list"
          :songs="songs"
          :active-track-id="activeTrackId"
          @play="playSong"
          @enqueue="enqueueSong"
          @play-next="playSongNext($event, { kind: 'search' })"
          @like="likeSong"
        />
      </section>

      <section v-if="albums.length > 0 || playlists.length > 0" class="music-section">
        <h2>集合</h2>
        <div class="collection-grid">
          <button
            v-for="album in albums"
            :key="`album-${album.id}`"
            class="collection-card"
            type="button"
            @click="openAlbum(album)"
          >
            <MediaArtwork :src="album.artworkUrl" :alt="album.name" size="card" />
            <strong>{{ album.name }}</strong>
            <span><Disc3 :size="13" /> 专辑</span>
          </button>

          <button
            v-for="playlist in playlists"
            :key="`playlist-${playlist.id}`"
            class="collection-card"
            type="button"
            @click="openPlaylist(playlist)"
          >
            <MediaArtwork :src="playlist.artworkUrl" :alt="playlist.name" size="card" />
            <strong>{{ playlist.name }}</strong>
            <span><ListMusic :size="13" /> 歌单</span>
          </button>
        </div>
      </section>

      <section v-if="artists.length > 0" class="music-section">
        <h2>歌手</h2>
        <div class="artist-strip">
          <article v-for="artist in artists" :key="artist.id" class="artist-card">
              <MediaArtwork :src="artist.artworkUrl" :alt="artist.name" size="compact" />
            <strong>{{ artist.name }}</strong>
            <span><UserRound :size="13" /> 歌手</span>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.search-results-page {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  padding: 72px 0 132px;
}

.search-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ncx-space-5);
}

.music-page-eyebrow {
  margin: 0;
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.search-results-header h1 {
  margin: var(--ncx-space-2) 0 0;
  font-size: 38px;
  line-height: 1.12;
}

.search-results-loading {
  display: inline-flex;
  margin-top: 48px;
  align-items: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
}

.search-results-content {
  display: grid;
  gap: var(--ncx-space-8);
  margin-top: 36px;
}

.music-section h2 {
  margin: 0 0 var(--ncx-space-3);
  font-size: 20px;
}

.track-list {
  display: grid;
  gap: var(--ncx-space-1);
}

.collection-grid,
.artist-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--ncx-space-4);
}

.collection-card,
.artist-card {
  display: grid;
  gap: var(--ncx-space-2);
  padding: var(--ncx-space-3);
  border: 0;
  border-radius: var(--ncx-radius-lg);
  color: var(--ncx-color-text-primary);
  background: var(--ncx-color-surface);
  text-align: left;
}

.collection-card {
  cursor: pointer;
}

.collection-card:hover {
  background: var(--ncx-color-surface-raised);
}

.collection-card strong,
.artist-card strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-card span,
.artist-card span {
  display: inline-flex;
  align-items: center;
  gap: var(--ncx-space-1);
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
}
</style>
