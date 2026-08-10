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
  CommonDialog,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { t } from '../../i18n'
import Cover from './components/Cover.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { useAccountSessionStore } from '../account/account-session-store'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** 当前路由对象，用于读取搜索词。 */
const route = useRoute()

/** Router 实例，用于进入集合详情。 */
const router = useRouter()

/** 播放器接口。 */
const player = usePlayer()

/** 应用账户公开状态，用于能力判定和读取自建歌单。 */
const account = useAccountSessionStore()

/** 当前搜索请求状态。 */
const loading = ref<boolean>(false)

/** 当前错误文案。 */
const errorMessage = ref<string>('')

/** 当前搜索结果。 */
const result = ref<Extract<MusicReadResult, { kind: 'search' }> | null>(null)

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 当前账户可写入的自建歌单。 */
const ownedPlaylists = ref<StandardPlaylist[]>([])

/** 目标歌单加载状态。 */
const playlistsLoading = ref<boolean>(false)

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

/** 当前结果中全部内容实体的数量。 */
const resultCount = computed<number>(() => {
  return songs.value.length + artists.value.length + albums.value.length + playlists.value.length
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
      errorMessage.value = t('music.search.mismatch')
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

/** 校验写权限，并打开自建歌单选择对话框。 */
async function openAddToPlaylist(song: StandardSong): Promise<void> {
  const snapshot = account.snapshot.value ?? await account.refresh()
  if (!snapshot.canMutateMusic || snapshot.activeAccount.kind !== 'netease') {
    showToast(t('music.search.loginForPlaylist'), 'warning')
    return
  }

  playlistTarget.value = song
  ownedPlaylists.value = []
  playlistsLoading.value = true
  const response = await window.ncx.runtime.getUserPlaylists({
    userId: snapshot.activeAccount.neteaseUserId,
    limit: 100
  })
  playlistsLoading.value = false
  if (!response.ok) {
    playlistTarget.value = null
    showToast(response.error.message, 'warning')
    return
  }
  if (response.data.kind !== 'playlistCollection' || response.data.collection !== 'user') {
    playlistTarget.value = null
    showToast(t('music.search.playlistMismatch'), 'warning')
    return
  }
  ownedPlaylists.value = response.data.playlists.filter((playlist) => playlist.owned)
}

/** 将待处理歌曲添加到指定自建歌单。 */
async function addSongToPlaylist(playlist: StandardPlaylist): Promise<void> {
  const song = playlistTarget.value
  if (!song) return
  const response = await mutateMusic({
    operation: 'updatePlaylistTracks',
    playlistId: playlist.id,
    trackIds: [song.id],
    action: 'add'
  })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  playlistTarget.value = null
  showToast(t('music.search.addedToPlaylist', {
    song: song.name,
    playlist: playlist.name
  }), 'success')
}

// ========= 生命周期 =========

watch(query, () => {
  void loadSearchResults()
}, { immediate: true })
</script>

<template>
  <section
    class="search-results-page music-content-page"
    aria-labelledby="search-results-title"
  >
    <div class="search-results-header">
      <div class="music-page-heading">
        <p class="music-page-eyebrow">
          搜索结果
        </p>
        <h1 id="search-results-title">
          {{ query || '搜索' }}
        </h1>
        <p class="search-results-summary">
          {{ result ? `已整理 ${resultCount} 项内容` : '歌曲、歌手、专辑和歌单会按类型整理' }}
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
        />
        播放全部
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
        <CommonSpinner label="搜索中" />
        <span>正在搜索</span>
      </div>

      <div
        v-else-if="errorMessage"
        key="error"
        class="search-results-state"
      >
        <CommonErrorState
          title="搜索失败"
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
          title="暂无结果"
          description="换个关键词试试。"
        />
      </div>

      <div
        v-else
        key="content"
        class="search-results-content"
      >
        <section
          v-if="songs.length > 0"
          class="music-result-section music-surface"
        >
          <header class="music-section-heading">
            <h2>歌曲</h2>
            <span>{{ songs.length }} 首</span>
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
          v-if="albums.length > 0 || playlists.length > 0"
          class="music-result-section music-surface"
        >
          <header class="music-section-heading">
            <h2>专辑与歌单</h2>
            <span>{{ albums.length + playlists.length }} 个</span>
          </header>
          <div class="collection-grid">
            <button
              v-for="album in albums"
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
              v-for="playlist in playlists"
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

        <section
          v-if="artists.length > 0"
          class="music-result-section music-surface"
        >
          <header class="music-section-heading">
            <h2>歌手</h2>
            <span>{{ artists.length }} 位</span>
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
                <span><UserRound :size="13" /> 歌手</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </Transition>

    <CommonDialog
      :visible="Boolean(playlistTarget)"
      title="添加到歌单"
      :subtitle="playlistTarget?.name ?? ''"
      @close="playlistTarget = null"
    >
      <div
        v-if="playlistsLoading"
        class="playlist-picker-status"
      >
        <CommonSpinner label="正在读取歌单" />
      </div>
      <CommonEmptyState
        v-else-if="ownedPlaylists.length === 0"
        title="暂无自建歌单"
        description="请先创建一个歌单。"
      />
      <div
        v-else
        class="playlist-picker-list"
      >
        <button
          v-for="playlist in ownedPlaylists"
          :key="playlist.id"
          type="button"
          @click="addSongToPlaylist(playlist)"
        >
          <Cover
            :src="playlist.artworkUrl"
            :alt="playlist.name"
            size="thumbnail"
          />
          <span>{{ playlist.name }}</span>
        </button>
      </div>
    </CommonDialog>
  </section>
</template>
