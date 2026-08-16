<script setup lang="ts">
import { Heart, LogIn, Play } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { MusicReadResult, StandardSong } from '../../../shared/schemas/music'
import {
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { useAccountSessionStore } from '../account/account-session-store'
import AddTrackToPlaylistDialog from './components/AddTrackToPlaylistDialog.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** Router 实例，用于歌曲详情和小云上下文导航。 */
const router = useRouter()

/** 应用播放器接口。 */
const player = usePlayer()

/** 喜欢歌曲列表。 */
const songs = ref<StandardSong[]>([])

/** 页面加载状态。 */
const loading = ref<boolean>(true)

/** 页面错误文案。 */
const errorMessage = ref<string>('')

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 当前网易云用户 ID。 */
const userId = computed<string | null>(() => {
  const activeAccount = account.snapshot.value?.activeAccount
  return activeAccount?.kind === 'netease' ? activeAccount.neteaseUserId : null
})

/** 当前播放歌曲 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

// ========= 函数 =========

/** 读取当前账户喜欢歌曲。 */
async function loadLikedSongs(): Promise<void> {
  songs.value = []
  errorMessage.value = ''
  if (!userId.value) {
    loading.value = false
    return
  }
  loading.value = true
  const response = await window.ncx.runtime.getLikedSongs({ userId: userId.value, limit: 500 })
  loading.value = false
  if (!response.ok) {
    errorMessage.value = response.error.message
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'songCollection' || result.collection !== 'liked') {
    errorMessage.value = '喜欢歌曲响应类型不匹配。'
    return
  }
  songs.value = result.songs
}

/** 打开官方登录流程。 */
async function login(): Promise<void> {
  await window.ncx.account.login()
}

/** 播放喜欢歌曲列表中的指定歌曲。 */
async function playSong(song: StandardSong): Promise<void> {
  const startIndex = songs.value.findIndex((item) => item.id === song.id)
  await player.playContext({
    tracks: standardSongsToTrackSummaries(songs.value),
    source: { kind: 'liked' },
    startIndex: Math.max(0, startIndex)
  })
}

/** 从第一首开始播放可见喜欢歌曲集合。 */
async function playAll(): Promise<void> {
  const first = songs.value[0]
  if (first) await playSong(first)
}

/** 追加喜欢歌曲到队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'liked' })
}

/** 从我喜欢中取消收藏歌曲。 */
async function unlikeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: false })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  songs.value = songs.value.filter((item) => item.id !== song.id)
  showToast(`已从我喜欢移除《${song.name}》。`, 'info')
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

onMounted(async () => {
  await account.initialize()
  await loadLikedSongs()
})
</script>

<template>
  <section class="liked-page" aria-labelledby="liked-title">
    <header class="liked-heading">
      <div class="liked-title-group">
        <span class="liked-icon"><Heart :size="28" fill="currentColor" /></span>
        <div>
          <p>我的音乐</p>
          <h1 id="liked-title">我喜欢</h1>
          <small v-if="userId">{{ songs.length }} 首歌曲</small>
        </div>
      </div>
      <CommonButton
        v-if="userId"
        variant="primary"
        :disabled="songs.length === 0"
        @click="playAll"
      >
        <Play :size="15" fill="currentColor" />
        播放全部
      </CommonButton>
    </header>

    <div v-if="loading" class="liked-loading">
      <CommonSpinner label="正在加载我喜欢" />
      <span>正在加载</span>
    </div>
    <CommonEmptyState
      v-else-if="!userId"
      title="登录后查看我喜欢"
      description="游客不会读取或创建网易云音乐资产。"
    >
      <CommonButton variant="primary" @click="login">
        <LogIn :size="14" />
        登录网易云
      </CommonButton>
    </CommonEmptyState>
    <CommonErrorState
      v-else-if="errorMessage"
      title="我喜欢读取失败"
      :description="errorMessage"
      @retry="loadLikedSongs"
    />
    <CommonEmptyState
      v-else-if="songs.length === 0"
      title="还没有喜欢的歌曲"
      description="可在歌曲右键菜单或收藏按钮中添加。"
    />
    <VirtualTrackList
      v-else
      :songs="songs"
      :active-track-id="activeTrackId"
      liked
      @play="playSong"
      @enqueue="enqueueSong"
      @play-next="playSongNext($event, { kind: 'liked' })"
      @like="unlikeSong"
      @add-to-playlist="openAddToPlaylist"
      @details="openSongDetails"
      @give-agent="giveSongToAgent"
    />

    <AddTrackToPlaylistDialog
      :song="playlistTarget"
      @close="playlistTarget = null"
    />
  </section>
</template>

<style scoped>
.liked-page {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 52px 0 0;
}

.liked-heading,
.liked-title-group,
.liked-loading {
  display: flex;
  align-items: center;
}

.liked-heading {
  justify-content: space-between;
  gap: var(--ncx-space-4);
  margin-bottom: var(--ncx-space-8);
}

.liked-title-group {
  gap: var(--ncx-space-4);
}

.liked-icon {
  display: inline-flex;
  width: 68px;
  height: 68px;
  align-items: center;
  justify-content: center;
  border-radius: var(--ncx-radius-lg);
  color: white;
  background: var(--ncx-color-accent);
}

.liked-heading p,
.liked-heading h1,
.liked-heading small {
  margin: 0;
}

.liked-heading p,
.liked-heading small {
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
}

.liked-heading h1 {
  margin: 3px 0;
  font-size: 34px;
}

.liked-loading {
  min-height: 240px;
  justify-content: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
}
</style>
