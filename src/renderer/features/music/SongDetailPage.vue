<script setup lang="ts">
import { Heart, ListPlus, Play } from '@lucide/vue'
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
import Cover from './components/Cover.vue'
import MusicCommentsSection from './components/MusicCommentsSection.vue'
import { useLikedSongsStore } from './liked-songs-store'
import { toggleSongLike } from './music-actions'
import { formatMusicDuration, standardSongToTrackSummary } from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'
import { translatePublicError } from '../../i18n'

// ========= 变量 =========

/** 当前歌曲详情路由。 */
const route = useRoute()

/** 全局播放器接口。 */
const player = usePlayer()

/** 应用级歌曲收藏状态。 */
const likedSongs = useLikedSongsStore()

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

/** 当前歌曲是否已收藏。 */
const isLiked = computed<boolean>(() => song.value ? likedSongs.isLiked(song.value.id) : false)

/** 当前歌曲收藏按钮是否暂时不可操作。 */
const likeBusy = computed<boolean>(() => (
  likedSongs.loading.value || (song.value ? likedSongs.isPending(song.value.id) : false)
))

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
      errorMessage.value = translatePublicError(response.error)
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

/** 收藏或取消收藏当前歌曲。 */
async function likeSong(): Promise<void> {
  if (!song.value) return
  await toggleSongLike(song.value)
}

// ========= 生命周期 =========

watch(songId, () => void loadSong(), { immediate: true })
</script>

<template>
  <section
    class="song-detail-page music-content-page"
    aria-labelledby="song-detail-title"
  >
    <Transition
      name="music-page-state"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="loading"
        class="song-detail-state song-detail-status"
      >
        <CommonSpinner :label="$tSource('正在加载歌曲')" />
      </div>

      <div
        v-else-if="errorMessage"
        key="error"
        class="song-detail-state"
      >
        <CommonErrorState
          :title="$tSource('歌曲加载失败')"
          :description="errorMessage"
          @retry="loadSong"
        />
      </div>

      <div
        v-else-if="song"
        key="content"
        class="song-detail-content"
      >
        <header class="music-detail-hero music-surface">
          <Cover
            :src="song.album?.artworkUrl"
            :alt="song.name"
            size="hero"
            :hover-effect="false"
            :always-show-shadow="true"
            :show-play-button="false"
          />
          <div class="music-detail-hero-copy">
            <p class="music-page-eyebrow">
              {{ $tSource("歌曲") }}
            </p>
            <h1 id="song-detail-title">
              {{ song.name }}
            </h1>
            <p class="song-detail-artist">
              {{ artistText }}
            </p>
            <p class="music-detail-meta">
              {{ $tSource(song.album?.name ?? '未知专辑') }} · {{ formatMusicDuration(song.durationMs) }}
            </p>
            <div class="music-detail-actions">
              <CommonButton
                variant="primary"
                @click="playSong"
              >
                <Play
                  :size="15"
                  fill="currentColor"
                />{{ $tSource("播放") }}
              </CommonButton>
              <CommonButton
                variant="secondary"
                @click="enqueueSong"
              >
                <ListPlus :size="15" />{{ $tSource("加入队列") }}
              </CommonButton>
              <CommonButton
                variant="secondary"
                :disabled="likeBusy"
                @click="likeSong"
              >
                <Heart
                  :size="15"
                  :fill="isLiked ? 'currentColor' : 'none'"
                />{{ $tSource(isLiked ? "取消收藏" : "收藏") }}
              </CommonButton>
            </div>
          </div>
        </header>

        <MusicCommentsSection
          resource-type="song"
          :resource-id="song.id"
        />
      </div>

      <div
        v-else
        key="empty"
        class="song-detail-state"
      >
        <CommonEmptyState
          :title="$tSource('没有找到歌曲')"
          :description="$tSource('该歌曲暂时不可用。')"
        />
      </div>
    </Transition>
  </section>
</template>
