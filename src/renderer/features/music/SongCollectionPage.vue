<script setup lang="ts">
import { ListMusic, Play } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { MusicReadResult, StandardSong } from '../../../shared/schemas/music'
import {
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { useAccountSessionStore } from '../account/account-session-store'
import AddTrackToPlaylistDialog from './components/AddTrackToPlaylistDialog.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { playSongNext, toggleSongLike } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'
import { translatePublicError } from '../../i18n'

// ========= 类型 =========

/** 歌曲集合二级页支持的集合类型。 */
type SongCollectionKind = 'new' | 'daily'

// ========= 变量 =========

/** 当前路由对象，用于识别歌曲集合类型。 */
const route = useRoute()

/** Router 实例，用于歌曲详情和小云上下文导航。 */
const router = useRouter()

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 应用播放器接口。 */
const player = usePlayer()

/** 当前集合歌曲。 */
const songs = ref<StandardSong[]>([])

/** 页面加载状态。 */
const loading = ref<boolean>(true)

/** 页面错误文案。 */
const errorMessage = ref<string>('')

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 当前歌曲集合类型。 */
const collection = computed<SongCollectionKind>(() => {
  return route.params['collection'] === 'daily' ? 'daily' : 'new'
})

/** 当前集合页面标题。 */
const pageTitle = computed<string>(() => collection.value === 'daily' ? '每日推荐' : '新歌速递')

/** 当前集合页面说明。 */
const pageDescription = computed<string>(() => collection.value === 'daily'
  ? '来自当前网易云账户的完整每日推荐歌曲。'
  : '平台推荐的新歌完整列表。')

/** 当前播放歌曲 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 当前账户是否已登录。 */
const isAuthenticated = computed<boolean>(() => account.snapshot.value?.state === 'authenticated')

// ========= 函数 =========

/** 读取当前歌曲集合的完整内容。 */
async function loadSongs(): Promise<void> {
  songs.value = []
  errorMessage.value = ''
  loading.value = true

  if (collection.value === 'daily' && !isAuthenticated.value) {
    loading.value = false
    return
  }

  const response = collection.value === 'daily'
    ? await window.ncx.runtime.getDailySongs({ limit: 50 })
    : await window.ncx.runtime.getNewSongs({ limit: 30 })
  loading.value = false

  if (!response.ok) {
    errorMessage.value = translatePublicError(response.error)
    return
  }

  const result: MusicReadResult = response.data
  if (result.kind !== 'songCollection' || result.collection !== collection.value) {
    errorMessage.value = '歌曲集合响应类型不匹配。'
    return
  }
  songs.value = result.songs
}

/** 打开官方登录流程。 */
async function login(): Promise<void> {
  await window.ncx.account.login()
}

/** 播放歌曲集合中的指定歌曲并从该曲目开始。 */
async function playSong(song: StandardSong): Promise<void> {
  const startIndex = songs.value.findIndex((item) => item.id === song.id)
  await player.playContext({
    tracks: standardSongsToTrackSummaries(songs.value),
    source: { kind: 'discover' },
    startIndex: Math.max(0, startIndex)
  })
}

/** 播放当前歌曲集合全部内容。 */
async function playAll(): Promise<void> {
  const firstSong = songs.value[0]
  if (firstSong) await playSong(firstSong)
}

/** 把歌曲追加到播放队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'discover' })
}

/** 收藏或取消收藏歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  await toggleSongLike(song)
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

// ========= 生命周期 =========

watch(collection, async () => {
  await account.initialize()
  await loadSongs()
}, { immediate: true })
</script>

<template>
  <section
    class="song-collection-page music-content-page"
    aria-labelledby="song-collection-title"
  >
    <header class="music-list-hero music-surface">
      <div>
        <p class="music-page-eyebrow">
          <ListMusic :size="13" /> {{ $tSource("歌曲集合") }}
        </p>
        <h1 id="song-collection-title">
          {{ $tSource(pageTitle) }}
        </h1>
        <p class="music-page-description">
          {{ $tSource(pageDescription) }}
        </p>
      </div>
      <CommonButton
        variant="primary"
        :disabled="songs.length === 0"
        @click="playAll"
      >
        <Play
          :size="15"
          fill="currentColor"
        /> {{ $tSource("播放全部") }}
      </CommonButton>
    </header>

    <Transition
      name="music-page-state"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="loading"
        class="song-collection-state song-collection-loading"
      >
        <CommonSpinner :label="$tSource('正在加载歌曲')" />
        <span>{{ $tSource("正在加载") }}</span>
      </div>

      <div
        v-else-if="collection === 'daily' && !isAuthenticated"
        key="login"
        class="song-collection-state"
      >
        <CommonEmptyState
          :title="$tSource('登录后查看每日推荐')"
          :description="$tSource('游客不会读取网易云账户的每日推荐歌曲。')"
        >
          <CommonButton
            variant="primary"
            @click="login"
          >
            {{ $tSource("登录网易云") }}
          </CommonButton>
        </CommonEmptyState>
      </div>

      <div
        v-else-if="errorMessage"
        key="error"
        class="song-collection-state"
      >
        <CommonErrorState
          :title="$tSource('歌曲读取失败')"
          :description="errorMessage"
          @retry="loadSongs"
        />
      </div>

      <div
        v-else-if="songs.length === 0"
        key="empty"
        class="song-collection-state"
      >
        <CommonEmptyState
          :title="$tSource('暂无歌曲')"
          :description="$tSource('当前集合暂时没有可展示的歌曲。')"
        />
      </div>

      <div
        v-else
        key="content"
        class="music-track-surface music-surface"
      >
        <header class="music-section-heading">
          <h2>{{ $tSource("歌曲") }}</h2>
          <span>{{ songs.length }} {{ $tSource("首") }}</span>
        </header>
        <VirtualTrackList
          :songs="songs"
          :active-track-id="activeTrackId"
          @play="playSong"
          @enqueue="enqueueSong"
          @play-next="playSongNext($event, { kind: 'discover' })"
          @like="likeSong"
          @add-to-playlist="openAddToPlaylist"
          @details="openSongDetails"
          @give-agent="giveSongToAgent"
        />
      </div>
    </Transition>

    <AddTrackToPlaylistDialog
      :song="playlistTarget"
      @close="playlistTarget = null"
    />
  </section>
</template>
