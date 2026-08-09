<script setup lang="ts">
import { ListMusic, Play } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { MusicReadResult, StandardSong } from '../../../shared/schemas/music'
import {
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { useAccountSessionStore } from '../account/account-session-store'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import { usePlayer } from './use-player'

// ========= 类型 =========

/** 歌曲集合二级页支持的集合类型。 */
type SongCollectionKind = 'new' | 'daily'

// ========= 变量 =========

/** 当前路由对象，用于识别歌曲集合类型。 */
const route = useRoute()

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
    errorMessage.value = response.error.message
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

/** 收藏歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  showToast(`已收藏《${song.name}》。`, 'success')
}

// ========= 生命周期 =========

watch(collection, async () => {
  await account.initialize()
  await loadSongs()
}, { immediate: true })
</script>

<template>
  <section class="song-collection-page" aria-labelledby="song-collection-title">
    <header class="song-collection-heading">
      <div>
        <p class="music-page-eyebrow"><ListMusic :size="13" /> 歌曲集合</p>
        <h1 id="song-collection-title">{{ pageTitle }}</h1>
        <p>{{ pageDescription }}</p>
      </div>
      <CommonButton
        variant="primary"
        :disabled="songs.length === 0"
        @click="playAll"
      >
        <Play :size="15" fill="currentColor" />
        播放全部
      </CommonButton>
    </header>

    <div v-if="loading" class="song-collection-loading">
      <CommonSpinner label="正在加载歌曲" />
      <span>正在加载</span>
    </div>
    <CommonEmptyState
      v-else-if="collection === 'daily' && !isAuthenticated"
      title="登录后查看每日推荐"
      description="游客不会读取网易云账户的每日推荐歌曲。"
    >
      <CommonButton variant="primary" @click="login">登录网易云</CommonButton>
    </CommonEmptyState>
    <CommonErrorState
      v-else-if="errorMessage"
      title="歌曲读取失败"
      :description="errorMessage"
      @retry="loadSongs"
    />
    <CommonEmptyState
      v-else-if="songs.length === 0"
      title="暂无歌曲"
      description="当前集合暂时没有可展示的歌曲。"
    />
    <VirtualTrackList
      v-else
      :songs="songs"
      :active-track-id="activeTrackId"
      @play="playSong"
      @enqueue="enqueueSong"
      @play-next="playSongNext($event, { kind: 'discover' })"
      @like="likeSong"
    />
  </section>
</template>

<style scoped>
.song-collection-page {
  display: grid;
  width: min(1120px, calc(100% - 32px));
  gap: var(--ncx-space-8);
  margin: 0 auto;
  padding: 52px 0 132px;
}

.song-collection-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--ncx-space-5);
}

.song-collection-heading h1,
.song-collection-heading p {
  margin: 0;
}

.song-collection-heading h1 {
  margin-top: var(--ncx-space-2);
  font-size: 36px;
}

.song-collection-heading > div > p:last-child {
  margin-top: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
}

.music-page-eyebrow {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
}

.song-collection-loading {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
}
</style>
