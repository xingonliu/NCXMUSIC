<script setup lang="ts">
import { CalendarCheck, ChevronRight, Play } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type {
  MusicReadResult,
  StandardPlaylist,
  StandardSong
} from '../../../shared/schemas/music'
import { CommonButton } from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { useAccountSessionStore } from '../account/account-session-store'
import EntityCard from './components/EntityCard.vue'
import MusicSection from './components/MusicSection.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { useDailySignin } from './daily-signin'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import { usePlayer } from './use-player'

// ========= 类型 =========

/** 独立页面 Section 的运行状态。 */
interface SectionState<T> {
  /** Section 当前状态。 */
  state: 'loading' | 'empty' | 'error' | 'ready'
  /** Section 标准数据。 */
  data: T
  /** Section 错误文案。 */
  error: string
}

// ========= 变量 =========

/** Router 实例，用于打开歌单详情。 */
const router = useRouter()

/** 应用播放器接口。 */
const player = usePlayer()

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 个人资料页与发现页共享的每日签到控制器。 */
const signinController = useDailySignin()

/** 平台推荐歌单 Section。 */
const featuredSection = ref<SectionState<StandardPlaylist[]>>({
  state: 'loading',
  data: [],
  error: ''
})

/** 推荐新歌 Section。 */
const newSongsSection = ref<SectionState<StandardSong[]>>({
  state: 'loading',
  data: [],
  error: ''
})

/** 每日推荐歌曲 Section。 */
const dailySection = ref<SectionState<StandardSong[]>>({
  state: 'loading',
  data: [],
  error: ''
})

/** 当前账户是否为登录账户。 */
const isAuthenticated = computed<boolean>(() => account.snapshot.value?.state === 'authenticated')

/** 当前播放歌曲 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 发现页每日推荐预览歌曲。 */
const dailyPreviewSongs = computed<StandardSong[]>(() => dailySection.value.data.slice(0, 5))

/** 发现页新歌速递预览歌曲。 */
const newSongsPreview = computed<StandardSong[]>(() => newSongsSection.value.data.slice(0, 5))

// ========= 函数 =========

/** 把 Section 响应结果写入统一状态。 */
function settleSection<T>(section: SectionState<T>, data: T, empty: boolean): void {
  section.data = data
  section.error = ''
  section.state = empty ? 'empty' : 'ready'
}

/** 把请求失败写入独立 Section 状态。 */
function failSection<T>(section: SectionState<T>, message: string): void {
  section.error = message
  section.state = 'error'
}

/** 读取平台推荐歌单 Section。 */
async function loadFeaturedPlaylists(): Promise<void> {
  featuredSection.value.state = 'loading'
  const response = await window.ncx.runtime.getFeaturedPlaylists({ limit: 10 })
  if (!response.ok) {
    failSection(featuredSection.value, response.error.message)
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'playlistCollection' || result.collection !== 'featured') {
    failSection(featuredSection.value, '推荐歌单响应类型不匹配。')
    return
  }
  settleSection(featuredSection.value, result.playlists, result.playlists.length === 0)
}

/** 读取推荐新歌 Section。 */
async function loadNewSongs(): Promise<void> {
  newSongsSection.value.state = 'loading'
  const response = await window.ncx.runtime.getNewSongs({ limit: 30 })
  if (!response.ok) {
    failSection(newSongsSection.value, response.error.message)
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'songCollection' || result.collection !== 'new') {
    failSection(newSongsSection.value, '推荐新歌响应类型不匹配。')
    return
  }
  settleSection(newSongsSection.value, result.songs, result.songs.length === 0)
}

/** 读取登录用户每日推荐 Section。 */
async function loadDailySongs(): Promise<void> {
  if (!isAuthenticated.value) return
  dailySection.value.state = 'loading'
  const response = await window.ncx.runtime.getDailySongs({ limit: 50 })
  if (!response.ok) {
    failSection(dailySection.value, response.error.message)
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'songCollection' || result.collection !== 'daily') {
    failSection(dailySection.value, '每日推荐响应类型不匹配。')
    return
  }
  settleSection(dailySection.value, result.songs, result.songs.length === 0)
}

/** 打开指定歌单详情。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

/** 打开歌曲集合二级页。 */
function openSongCollection(collection: 'new' | 'daily'): void {
  void router.push({ name: 'song-collection', params: { collection } })
}

/** 从发现页立即播放单首歌曲。 */
async function playSong(song: StandardSong): Promise<void> {
  await player.playTrack(standardSongToTrackSummary(song), { kind: 'discover' })
}

/** 把发现页歌曲追加到队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'discover' })
}

/** 从可见集合首项播放全部歌曲。 */
async function playAll(songs: StandardSong[]): Promise<void> {
  if (songs.length === 0) return
  await player.playContext({
    tracks: standardSongsToTrackSummaries(songs),
    source: { kind: 'discover' }
  })
}

/** 收藏当前歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  const result = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  if (!result.ok) {
    showToast(result.error.message, 'warning')
    return
  }
  showToast(`已收藏《${song.name}》。`, 'success')
}

/** 执行网易云每日签到。 */
async function dailySignin(): Promise<void> {
  await signinController.signin()
}

// ========= 生命周期 =========

onMounted(async () => {
  await account.initialize()
  await Promise.all([loadFeaturedPlaylists(), loadNewSongs()])
  if (isAuthenticated.value) await loadDailySongs()
})

watch(
  () => [account.snapshot.value?.state, account.snapshot.value?.accountGeneration] as const,
  ([state]) => {
    if (state === 'authenticated') void loadDailySongs()
    else dailySection.value = { state: 'empty', data: [], error: '' }
  }
)
</script>

<template>
  <section class="discover-page" aria-labelledby="discover-title">
    <header class="discover-heading">
      <div>
        <p class="music-page-eyebrow">发现音乐</p>
        <h1 id="discover-title">今天想听什么？</h1>
      </div>
      <CommonButton
        v-if="isAuthenticated"
        variant="secondary"
        size="compact"
        :loading="signinController.state.value === 'signing'"
        :disabled="!account.snapshot.value?.canMutateMusic"
        @click="dailySignin"
      >
        <CalendarCheck :size="14" />
        {{ signinController.state.value === 'already-signed' ? '今日已签到' : '签到' }}
      </CommonButton>
    </header>

    <MusicSection
      section-id="featured-playlists"
      title="精选歌单"
      description="平台推荐，适合直接开始一段播放。"
      :state="featuredSection.state"
      :error-text="featuredSection.error"
      empty-text="暂时没有可展示的推荐歌单。"
      @retry="loadFeaturedPlaylists"
    >
      <div class="discover-card-grid">
        <EntityCard
          v-for="playlist in featuredSection.data"
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
      v-if="isAuthenticated"
      section-id="daily-songs"
      title="每日推荐"
      description="来自当前网易云账户的每日歌曲。"
      :state="dailySection.state"
      :error-text="dailySection.error"
      empty-text="今天的推荐还没有准备好。"
      @retry="loadDailySongs"
    >
      <template #actions>
        <CommonButton
          variant="ghost"
          size="compact"
          :disabled="dailySection.data.length === 0"
          @click="openSongCollection('daily')"
        >
          查看更多
          <ChevronRight :size="14" />
        </CommonButton>
        <CommonButton
          variant="primary"
          size="compact"
          :disabled="dailySection.data.length === 0"
          @click="playAll(dailySection.data)"
        >
          <Play :size="14" fill="currentColor" />
          播放全部
        </CommonButton>
      </template>
      <VirtualTrackList
        :songs="dailyPreviewSongs"
        :active-track-id="activeTrackId"
        @play="playSong"
        @enqueue="enqueueSong"
        @play-next="playSongNext($event, { kind: 'discover' })"
        @like="likeSong"
      />
    </MusicSection>

    <MusicSection
      section-id="new-songs"
      title="新歌速递"
      description="当前可见集合保持统一队列语义。"
      :state="newSongsSection.state"
      :error-text="newSongsSection.error"
      empty-text="暂时没有推荐新歌。"
      @retry="loadNewSongs"
    >
      <template #actions>
        <CommonButton
          variant="ghost"
          size="compact"
          :disabled="newSongsSection.data.length === 0"
          @click="openSongCollection('new')"
        >
          查看更多
          <ChevronRight :size="14" />
        </CommonButton>
        <CommonButton
          variant="secondary"
          size="compact"
          :disabled="newSongsSection.data.length === 0"
          @click="playAll(newSongsSection.data)"
        >
          <Play :size="14" fill="currentColor" />
          播放全部
        </CommonButton>
      </template>
      <VirtualTrackList
        :songs="newSongsPreview"
        :active-track-id="activeTrackId"
        @play="playSong"
        @enqueue="enqueueSong"
        @play-next="playSongNext($event, { kind: 'discover' })"
        @like="likeSong"
      />
    </MusicSection>
  </section>
</template>

<style scoped>
.discover-page {
  display: grid;
  width: min(1180px, calc(100% - 32px));
  gap: var(--ncx-space-12);
  margin: 0 auto;
  padding: 48px 0 132px;
}

.discover-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--ncx-space-4);
}

.discover-heading h1,
.music-page-eyebrow {
  margin: 0;
}

.discover-heading h1 {
  margin-top: var(--ncx-space-2);
  font-size: 38px;
  line-height: 1.12;
}

.music-page-eyebrow {
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
}

.discover-card-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--ncx-space-5);
}

@media (width < 1180px) {
  .discover-card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
