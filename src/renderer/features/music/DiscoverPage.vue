<script setup lang="ts">
import { CalendarCheck, ChevronRight, Play, Radio, Sparkles } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type {
  MusicReadResult,
  StandardArtist,
  StandardPlaylist,
  StandardSong
} from '../../../shared/schemas/music'
import { CommonButton } from '../../design-system/components'
import { useAccountSessionStore } from '../account/account-session-store'
import { useAgentStore } from '../agent/agent-store'
import EntityCard from './components/EntityCard.vue'
import Cover from './components/Cover.vue'
import MusicSection from './components/MusicSection.vue'
import { useDailySignin } from './daily-signin'
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

/** 应用作用域 Agent Store，用于画像就绪后装配推荐 Section。 */
const agent = useAgentStore()

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

/** 私人 FM Section。 */
const personalFmSection = ref<SectionState<StandardSong[]>>({
  state: 'loading',
  data: [],
  error: ''
})

/** 首页推荐歌手 Section。 */
const artistsSection = ref<SectionState<StandardArtist[]>>({
  state: 'loading',
  data: [],
  error: ''
})

/** 当前账户是否为登录账户。 */
const isAuthenticated = computed<boolean>(() => account.snapshot.value?.state === 'authenticated')

/** 发现页每日推荐堆叠卡片歌曲。 */
const dailyPreviewSongs = computed<StandardSong[]>(() => dailySection.value.data.slice(0, 3))

/** 发现页新歌速递十首预览歌曲。 */
const newSongsPreview = computed<StandardSong[]>(() => newSongsSection.value.data.slice(0, 10))

/** 私人 FM 当前主卡片歌曲；游客模式优雅回退到新歌。 */
const personalFmSong = computed<StandardSong | null>(() => personalFmSection.value.data[0] ?? newSongsSection.value.data[0] ?? null)

/** 画像就绪后“小云为你推荐”的可见歌曲集合。 */
const profileRecommendationSongs = computed<StandardSong[]>(() => rankSongsForProfile(
  dailySection.value.data,
  [
    ...agent.snapshot.value.personalization.recommendationSeeds,
    ...agent.snapshot.value.personalization.insights.flatMap((insight) => [insight.label, insight.value])
  ]
).slice(0, 8))

/** 由画像推荐种子生成的 Section 解释文案。 */
const profileRecommendationDescription = computed<string>(() => {
  /** 当前画像推荐种子。 */
  const seeds = agent.snapshot.value.personalization.recommendationSeeds.slice(0, 3)
  return seeds.length > 0
    ? `结合你的画像偏好：${seeds.join('、')}。内容只展示，不会自动播放。`
    : '结合当前音乐人格画像与每日候选，只展示内容，不会自动播放。'
})

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

/** 读取登录用户私人 FM。 */
async function loadPersonalFm(): Promise<void> {
  if (!isAuthenticated.value) {
    personalFmSection.value = { state: 'empty', data: [], error: '' }
    return
  }
  personalFmSection.value.state = 'loading'
  /** 私人 FM 标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getPersonalFm', limit: 3 })
  if (!response.ok) {
    failSection(personalFmSection.value, response.error.message)
    return
  }
  if (response.data.kind !== 'songCollection' || response.data.collection !== 'personalFm') {
    failSection(personalFmSection.value, '私人 FM 响应类型不匹配。')
    return
  }
  settleSection(personalFmSection.value, response.data.songs, response.data.songs.length === 0)
}

/** 读取首页热门推荐歌手。 */
async function loadRecommendedArtists(): Promise<void> {
  artistsSection.value.state = 'loading'
  /** 推荐歌手标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getRecommendedArtists', limit: 12, offset: 0 })
  if (!response.ok) {
    failSection(artistsSection.value, response.error.message)
    return
  }
  if (response.data.kind !== 'artistCollection') {
    failSection(artistsSection.value, '推荐歌手响应类型不匹配。')
    return
  }
  settleSection(artistsSection.value, response.data.artists, response.data.artists.length === 0)
}

/** 打开指定歌单详情。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

/** 打开推荐歌手详情。 */
function openArtist(artist: StandardArtist): void {
  void router.push({ name: 'artist-detail', params: { artistId: artist.id } })
}

/** 打开歌曲集合二级页。 */
function openSongCollection(collection: 'new' | 'daily'): void {
  void router.push({ name: 'song-collection', params: { collection } })
}

/** 从发现页立即播放单首歌曲。 */
async function playSong(song: StandardSong): Promise<void> {
  await player.playTrack(standardSongToTrackSummary(song), { kind: 'discover' })
}

/** 从可见集合首项播放全部歌曲。 */
async function playAll(songs: StandardSong[]): Promise<void> {
  if (songs.length === 0) return
  await player.playContext({
    tracks: standardSongsToTrackSummaries(songs),
    source: { kind: 'discover' }
  })
}

/** 执行网易云每日签到。 */
async function dailySignin(): Promise<void> {
  await signinController.signin()
}

/** 使用画像种子对上游每日候选做稳定重排，同分时保留原始顺序。 */
function rankSongsForProfile(songs: readonly StandardSong[], rawTerms: readonly string[]): StandardSong[] {
  /** 去重并裁剪后的画像匹配词。 */
  const terms = [...new Set(rawTerms
    .flatMap((term) => term.toLocaleLowerCase('zh-CN').match(/[\p{L}\p{N}]{2,24}/gu) ?? [])
    .filter((term) => term.length >= 2))]
    .slice(0, 40)
  return songs
    .map((song, index) => {
      /** 当前候选的可解释文本字段。 */
      const haystack = [
        song.name,
        ...song.artists.map((artist) => artist.name),
        song.album?.name ?? ''
      ].join(' ').toLocaleLowerCase('zh-CN')
      /** 画像词命中数量。 */
      const score = terms.reduce((total, term) => total + Number(haystack.includes(term)), 0)
      return { song, index, score }
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.song)
}

// ========= 生命周期 =========

onMounted(async () => {
  await Promise.all([account.initialize(), agent.initialize()])
  await Promise.all([loadFeaturedPlaylists(), loadNewSongs(), loadRecommendedArtists()])
  if (isAuthenticated.value) await Promise.all([loadDailySongs(), loadPersonalFm()])
})

watch(
  () => [account.snapshot.value?.state, account.snapshot.value?.accountGeneration] as const,
  ([state]) => {
    if (state === 'authenticated') void Promise.all([loadDailySongs(), loadPersonalFm()])
    else {
      dailySection.value = { state: 'empty', data: [], error: '' }
      personalFmSection.value = { state: 'empty', data: [], error: '' }
    }
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
      v-if="agent.snapshot.value.personalization.usable && isAuthenticated"
      section-id="xiaoyun-profile-recommendations"
      title="小云为你推荐"
      :description="profileRecommendationDescription"
      :state="dailySection.state"
      :error-text="dailySection.error"
      empty-text="画像已就绪，但当前没有可展示的推荐歌曲。"
      @retry="loadDailySongs"
    >
      <template #actions>
        <CommonButton
          variant="secondary"
          size="compact"
          :disabled="profileRecommendationSongs.length === 0"
          @click="playAll(profileRecommendationSongs)"
        >
          <Play :size="14" fill="currentColor" />
          播放全部
        </CommonButton>
      </template>
      <div class="discover-profile-recommendations">
        <button
          v-for="song in profileRecommendationSongs"
          :key="song.id"
          type="button"
          @click="playSong(song)"
        >
          <Cover :src="song.album?.artworkUrl" :alt="song.name" size="card" :show-play-button="false" />
          <strong>{{ song.name }}</strong>
          <span>{{ song.artists.map((artist) => artist.name).join(' / ') }}</span>
        </button>
      </div>
    </MusicSection>

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
      section-id="personal-recommendations"
      title="猜你喜欢"
      description="每日推荐与私人电台并排呈现，一个适合挑选，一个适合直接开始。"
      :state="newSongsSection.state === 'loading' && !isAuthenticated ? 'loading' : 'ready'"
      min-height="260px"
    >
      <div class="discover-personal-grid">
        <article class="discover-taste-card">
          <div class="discover-taste-copy">
            <span><Sparkles :size="14" /> 猜你喜欢</span>
            <h3>{{ isAuthenticated ? '为今天挑选' : '先从新歌认识你' }}</h3>
            <p>{{ isAuthenticated ? '根据当前账户的听歌偏好每日更新。' : '登录后会切换为专属每日推荐。' }}</p>
            <div class="discover-taste-actions">
              <CommonButton
                variant="primary"
                size="compact"
                :disabled="isAuthenticated ? dailySection.data.length === 0 : newSongsSection.data.length === 0"
                @click="playAll(isAuthenticated ? dailySection.data : newSongsSection.data)"
              ><Play :size="14" fill="currentColor" />播放</CommonButton>
              <CommonButton
                v-if="isAuthenticated"
                variant="ghost"
                size="compact"
                @click="openSongCollection('daily')"
              >查看全部<ChevronRight :size="14" /></CommonButton>
            </div>
          </div>
          <div class="discover-cover-stack" aria-label="猜你喜欢歌曲预览">
            <Cover
              v-for="(song, index) in (isAuthenticated ? dailyPreviewSongs : newSongsPreview.slice(0, 3))"
              :key="song.id"
              :src="song.album?.artworkUrl"
              :alt="song.name"
              size="card"
              :show-play-button="false"
              :style="{ '--stack-index': index }"
              @click="playSong(song)"
            />
          </div>
        </article>

        <article class="discover-radio-card">
          <div class="discover-radio-art">
            <Cover
              :src="personalFmSong?.album?.artworkUrl"
              :alt="personalFmSong?.name || '私人电台'"
              size="feature"
              :show-play-button="false"
              :hover-effect="false"
            />
            <span class="discover-radio-badge"><Radio :size="14" /> 个人电台</span>
          </div>
          <div class="discover-radio-copy">
            <span>{{ isAuthenticated ? '私人 FM' : '灵感电台 · 预览' }}</span>
            <h3>{{ personalFmSong?.name || '电台正在准备' }}</h3>
            <p>{{ personalFmSong?.artists.map((artist) => artist.name).join(' / ') || '登录后获得不间断的个性播放' }}</p>
          </div>
          <button
            class="discover-radio-play"
            type="button"
            :disabled="!personalFmSong"
            aria-label="播放个人电台"
            @click="personalFmSong && playSong(personalFmSong)"
          ><Play :size="19" fill="currentColor" /></button>
        </article>
      </div>
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
      <div class="discover-new-song-grid">
        <button
          v-for="song in newSongsPreview"
          :key="song.id"
          type="button"
          @click="playSong(song)"
        >
          <Cover :src="song.album?.artworkUrl" :alt="song.name" size="compact" :show-play-button="false" />
          <span><strong>{{ song.name }}</strong><small>{{ song.artists.map((artist) => artist.name).join(' / ') }}</small></span>
          <Play :size="14" fill="currentColor" />
        </button>
      </div>
    </MusicSection>

    <MusicSection
      section-id="recommended-artists"
      title="歌手推荐"
      description="从热门歌手继续延展今天的播放。"
      :state="artistsSection.state"
      :error-text="artistsSection.error"
      empty-text="暂时没有推荐歌手。"
      @retry="loadRecommendedArtists"
    >
      <div class="discover-artist-grid">
        <button v-for="artist in artistsSection.data.slice(0, 8)" :key="artist.id" type="button" @click="openArtist(artist)">
          <Cover :src="artist.artworkUrl" :alt="artist.name" size="card" shape="circle" :show-play-button="false" />
          <strong>{{ artist.name }}</strong>
          <span>{{ artist.alias.join(' / ') || '歌手' }}</span>
        </button>
      </div>
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

.discover-profile-recommendations {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 16px;
}

.discover-profile-recommendations > button {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 0;
  border: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.discover-profile-recommendations strong,
.discover-profile-recommendations span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discover-profile-recommendations strong {
  margin-top: 5px;
  font-size: 12px;
}

.discover-profile-recommendations span {
  color: var(--ncx-color-text-secondary);
  font-size: 10px;
}

.discover-personal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, .85fr);
  gap: var(--ncx-space-5);
}

.discover-taste-card,
.discover-radio-card {
  position: relative;
  overflow: hidden;
  min-height: 260px;
  border-radius: var(--ncx-radius-xl);
  background: var(--ncx-color-surface);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ncx-color-text-primary) 7%, transparent);
}

.discover-taste-card {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 280px;
  align-items: center;
  padding: 30px;
  background:
    radial-gradient(circle at 85% 12%, color-mix(in srgb, var(--ncx-color-accent) 28%, transparent), transparent 44%),
    var(--ncx-color-surface);
}

.discover-taste-copy > span,
.discover-radio-copy > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 750;
}

.discover-taste-copy h3,
.discover-taste-copy p,
.discover-radio-copy h3,
.discover-radio-copy p {
  margin: 0;
}

.discover-taste-copy h3 {
  margin-top: 9px;
  font-size: 28px;
  line-height: 1.08;
  letter-spacing: -.025em;
}

.discover-taste-copy p {
  max-width: 34ch;
  margin-top: 9px;
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.discover-taste-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.discover-cover-stack {
  position: relative;
  width: 250px;
  height: 166px;
  justify-self: end;
}

.discover-cover-stack :deep(.ncx-cover) {
  position: absolute;
  top: 22px;
  left: 0;
  z-index: calc(5 - var(--stack-index));
  transform: translateX(calc(var(--stack-index) * 48px)) rotate(calc((var(--stack-index) - 1) * 4deg));
  transition: transform .34s cubic-bezier(.2, .8, .2, 1);
}

.discover-cover-stack :deep(.ncx-cover:hover) {
  transform: translateX(calc(var(--stack-index) * 52px)) translateY(-8px);
}

.discover-radio-card {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) auto;
  align-items: end;
  gap: 16px;
  padding: 22px;
  background: color-mix(in srgb, var(--ncx-color-surface) 84%, var(--ncx-color-accent) 16%);
}

.discover-radio-art {
  position: absolute;
  inset: 0;
}

.discover-radio-art::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 10%, color-mix(in srgb, #000 76%, transparent) 100%);
  content: '';
}

.discover-radio-art :deep(.ncx-cover),
.discover-radio-art :deep(.ncx-cover-media) {
  width: 100%;
  height: 100%;
  border-radius: 0;
}

.discover-radio-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 999px;
  color: #fff;
  background: rgba(20, 20, 22, .42);
  backdrop-filter: blur(16px) saturate(160%);
  font-size: 11px;
  font-weight: 700;
}

.discover-radio-copy,
.discover-radio-play {
  position: relative;
  z-index: 2;
}

.discover-radio-copy {
  grid-column: 1 / 3;
  min-width: 0;
  color: #fff;
}

.discover-radio-copy > span {
  color: rgba(255, 255, 255, .72);
}

.discover-radio-copy h3 {
  margin-top: 6px;
  overflow: hidden;
  font-size: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discover-radio-copy p {
  margin-top: 4px;
  overflow: hidden;
  color: rgba(255, 255, 255, .72);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discover-radio-play {
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--ncx-color-accent);
  background: rgba(255, 255, 255, .94);
  cursor: pointer;
}

.discover-radio-play:active {
  transform: scale(.93);
}

.discover-new-song-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}

.discover-new-song-grid > button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 0;
  border-radius: 14px;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.discover-new-song-grid > button:hover {
  background: color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent);
}

.discover-new-song-grid > button:active {
  transform: scale(.985);
}

.discover-new-song-grid > button > span {
  display: grid;
  min-width: 0;
}

.discover-new-song-grid strong,
.discover-new-song-grid small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discover-new-song-grid strong {
  font-size: 13px;
}

.discover-new-song-grid small {
  margin-top: 4px;
  color: var(--ncx-color-text-secondary);
  font-size: 11px;
}

.discover-artist-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 18px;
}

.discover-artist-grid > button {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  color: inherit;
  text-align: center;
  background: transparent;
  cursor: pointer;
}

.discover-artist-grid strong,
.discover-artist-grid span {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discover-artist-grid strong {
  margin-top: 8px;
  font-size: 13px;
}

.discover-artist-grid span {
  color: var(--ncx-color-text-secondary);
  font-size: 11px;
}

@media (width < 1180px) {
  .discover-card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .discover-artist-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .discover-profile-recommendations {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (width < 920px) {
  .discover-personal-grid,
  .discover-taste-card {
    grid-template-columns: 1fr;
  }

  .discover-cover-stack {
    display: none;
  }

  .discover-artist-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .discover-profile-recommendations {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (width < 680px) {
  .discover-new-song-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .discover-page button,
  .discover-cover-stack :deep(.ncx-cover) {
    transition: none !important;
  }

  .discover-page button:active,
  .discover-cover-stack :deep(.ncx-cover:hover) {
    transform: none;
  }
}
</style>
