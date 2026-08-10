<script setup lang="ts">
import { Heart, ListPlus, Play } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { MusicReadResult, StandardSong } from '../../../shared/schemas/music'
import {
  CommonButton,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import Cover from './components/Cover.vue'
import { mutateMusic } from './music-actions'
import { formatMusicDuration, standardSongToTrackSummary } from './music-entity'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** 当前歌曲详情路由。 */
const route = useRoute()

/** 全局播放器接口。 */
const player = usePlayer()

/** 当前歌曲实体。 */
const song = ref<StandardSong | null>(null)

/** 当前加载状态。 */
const loading = ref<boolean>(false)

/** 当前错误文案。 */
const errorMessage = ref<string>('')

/** 用于丢弃迟到响应的最近请求 ID。 */
let latestRequestId = ''

/** 当前路由歌曲 ID。 */
const songId = computed<string>(() => String(route.params['songId'] ?? ''))

/** 歌手展示文本。 */
const artistText = computed<string>(() => song.value?.artists.map((artist) => artist.name).join(' / ') || '未知歌手')

// ========= 函数 =========

/** 从 Utility 读取单曲详情，并丢弃路由切换后的迟到响应。 */
async function loadSong(): Promise<void> {
  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  loading.value = true
  errorMessage.value = ''
  song.value = null

  try {
    const response = await window.ncx.runtime.getSong({ id: songId.value, requestId })
    if (requestId !== latestRequestId) return
    if (!response.ok) {
      errorMessage.value = response.error.message
      return
    }
    song.value = normalizeSongResponse(response.data)
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

/** 校验单曲详情响应类型。 */
function normalizeSongResponse(data: MusicReadResult): StandardSong | null {
  if (data.kind === 'song') return data.entity
  errorMessage.value = '歌曲响应类型不匹配。'
  return null
}

/** 立即播放当前歌曲。 */
async function playSong(): Promise<void> {
  if (!song.value) return
  await player.playTrack(standardSongToTrackSummary(song.value), { kind: 'search' })
}

/** 将当前歌曲追加到队列。 */
function enqueueSong(): void {
  if (!song.value) return
  player.enqueue([standardSongToTrackSummary(song.value)], { kind: 'search' })
  showToast(`已将《${song.value.name}》加入队列。`, 'info')
}

/** 收藏当前歌曲。 */
async function likeSong(): Promise<void> {
  if (!song.value) return
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.value.id, liked: true })
  showToast(response.ok ? `已收藏《${song.value.name}》。` : response.error.message, response.ok ? 'success' : 'warning')
}

// ========= 生命周期 =========

watch(songId, () => void loadSong(), { immediate: true })
</script>

<template>
  <section class="song-detail-page" aria-labelledby="song-detail-title">
    <div v-if="loading" class="song-detail-status"><CommonSpinner label="正在加载歌曲" /></div>
    <CommonErrorState
      v-else-if="errorMessage"
      title="歌曲加载失败"
      :description="errorMessage"
      @retry="loadSong"
    />
    <template v-else-if="song">
      <Cover :src="song.album?.artworkUrl" :alt="song.name" size="hero" />
      <div class="song-detail-copy">
        <p>歌曲</p>
        <h1 id="song-detail-title">{{ song.name }}</h1>
        <h2>{{ artistText }}</h2>
        <span>{{ song.album?.name ?? '未知专辑' }} · {{ formatMusicDuration(song.durationMs) }}</span>
        <div class="song-detail-actions">
          <CommonButton variant="primary" @click="playSong"><Play :size="15" fill="currentColor" />播放</CommonButton>
          <CommonButton variant="secondary" @click="enqueueSong"><ListPlus :size="15" />加入队列</CommonButton>
          <CommonButton variant="secondary" @click="likeSong"><Heart :size="15" />收藏</CommonButton>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.song-detail-page {
  display: grid;
  width: min(920px, calc(100% - 48px));
  min-height: calc(100vh - 180px);
  margin: 0 auto;
  padding: 84px 0 144px;
  align-items: center;
  grid-template-columns: minmax(260px, 420px) minmax(280px, 1fr);
  gap: clamp(32px, 7vw, 88px);
}
.song-detail-copy { display: grid; gap: var(--ncx-space-3); }
.song-detail-copy p, .song-detail-copy h1, .song-detail-copy h2 { margin: 0; }
.song-detail-copy p { color: var(--ncx-color-accent); font-size: 12px; font-weight: 700; }
.song-detail-copy h1 { font-size: clamp(32px, 5vw, 56px); }
.song-detail-copy h2, .song-detail-copy span { color: var(--ncx-color-text-secondary); }
.song-detail-actions { display: flex; flex-wrap: wrap; gap: var(--ncx-space-2); margin-top: var(--ncx-space-3); }
.song-detail-status { display: grid; place-items: center; grid-column: 1 / -1; }
@media (max-width: 720px) { .song-detail-page { grid-template-columns: 1fr; } }
</style>
