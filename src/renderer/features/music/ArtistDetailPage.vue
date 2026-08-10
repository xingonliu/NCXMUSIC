<script setup lang="ts">
import { Play, Radio } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type {
  MusicReadResult,
  StandardAlbum,
  StandardArtist,
  StandardSong
} from '../../../shared/schemas/music'
import {
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import EntityCard from './components/EntityCard.vue'
import AddTrackToPlaylistDialog from './components/AddTrackToPlaylistDialog.vue'
import Cover from './components/Cover.vue'
import MusicSection from './components/MusicSection.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { mutateMusic, playSongNext } from './music-actions'
import {
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'

// ========= 类型 =========

/** 页面独立列表 Section 状态。 */
interface ListSection<T> {
  /** Section 当前状态。 */
  state: 'loading' | 'empty' | 'error' | 'ready'
  /** Section 实体列表。 */
  items: T[]
  /** Section 错误文案。 */
  error: string
}

// ========= 变量 =========

/** 当前路由对象。 */
const route = useRoute()

/** Router 实例。 */
const router = useRouter()

/** 应用播放器接口。 */
const player = usePlayer()

/** 歌手主实体。 */
const artist = ref<StandardArtist | null>(null)

/** 歌手主实体加载状态。 */
const loading = ref<boolean>(true)

/** 歌手主实体错误文案。 */
const errorMessage = ref<string>('')

/** 歌手专辑 Section。 */
const albumsSection = ref<ListSection<StandardAlbum>>({ state: 'loading', items: [], error: '' })

/** 相似歌手 Section。 */
const similarSection = ref<ListSection<StandardArtist>>({ state: 'loading', items: [], error: '' })

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 当前歌手 ID。 */
const artistId = computed<string>(() => String(route.params['artistId'] ?? ''))

/** 当前播放歌曲 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 歌手热门歌曲。 */
const hotSongs = computed<StandardSong[]>(() => artist.value?.hotSongs ?? [])

// ========= 函数 =========

/** 读取歌手主实体和热门歌曲。 */
async function loadArtist(): Promise<void> {
  artist.value = null
  errorMessage.value = ''
  loading.value = true
  const response = await window.ncx.runtime.getArtist({ id: artistId.value })
  loading.value = false
  if (!response.ok) {
    errorMessage.value = response.error.message
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'artist') {
    errorMessage.value = '歌手响应类型不匹配。'
    return
  }
  artist.value = result.entity
}

/** 读取歌手专辑独立 Section。 */
async function loadArtistAlbums(): Promise<void> {
  albumsSection.value.state = 'loading'
  const response = await window.ncx.runtime.getArtistAlbums({ artistId: artistId.value, limit: 16 })
  if (!response.ok) {
    albumsSection.value = { state: 'error', items: [], error: response.error.message }
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'albumCollection') {
    albumsSection.value = { state: 'error', items: [], error: '歌手专辑响应类型不匹配。' }
    return
  }
  albumsSection.value = {
    state: result.albums.length === 0 ? 'empty' : 'ready',
    items: result.albums,
    error: ''
  }
}

/** 读取相似歌手独立 Section。 */
async function loadSimilarArtists(): Promise<void> {
  similarSection.value.state = 'loading'
  const response = await window.ncx.runtime.getSimilarArtists({ artistId: artistId.value })
  if (!response.ok) {
    similarSection.value = { state: 'error', items: [], error: response.error.message }
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'artistCollection') {
    similarSection.value = { state: 'error', items: [], error: '相似歌手响应类型不匹配。' }
    return
  }
  similarSection.value = {
    state: result.artists.length === 0 ? 'empty' : 'ready',
    items: result.artists,
    error: ''
  }
}

/** 从热门歌曲中的指定位置播放集合。 */
async function playSong(song: StandardSong): Promise<void> {
  const startIndex = hotSongs.value.findIndex((item) => item.id === song.id)
  await player.playContext({
    tracks: standardSongsToTrackSummaries(hotSongs.value),
    source: { kind: 'artist', artistId: artistId.value },
    startIndex: Math.max(0, startIndex)
  })
}

/** 播放全部热门歌曲。 */
async function playAll(): Promise<void> {
  const first = hotSongs.value[0]
  if (first) await playSong(first)
}

/** 追加热门歌曲到队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'artist', artistId: artistId.value })
}

/** 收藏当前歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  showToast(`已收藏《${song.name}》。`, 'success')
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

/** 打开指定专辑。 */
function openAlbum(album: StandardAlbum): void {
  void router.push({ name: 'album-detail', params: { albumId: album.id } })
}

/** 打开指定相似歌手。 */
function openArtist(item: StandardArtist): void {
  void router.push({ name: 'artist-detail', params: { artistId: item.id } })
}

/** 读取歌手页全部独立数据区块。 */
async function loadPage(): Promise<void> {
  await Promise.all([loadArtist(), loadArtistAlbums(), loadSimilarArtists()])
}

// ========= 生命周期 =========

watch(artistId, () => {
  void loadPage()
}, { immediate: true })
</script>

<template>
  <section
    class="artist-page music-content-page"
    aria-labelledby="artist-title"
  >
    <Transition
      name="music-page-state"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="loading"
        class="artist-page-state artist-loading"
      >
        <CommonSpinner label="正在加载歌手" />
        <span>正在加载歌手</span>
      </div>

      <div
        v-else-if="errorMessage"
        key="error"
        class="artist-page-state"
      >
        <CommonErrorState
          title="歌手读取失败"
          :description="errorMessage"
          @retry="loadArtist"
        />
      </div>

      <div
        v-else-if="!artist"
        key="empty"
        class="artist-page-state"
      >
        <CommonEmptyState
          title="没有找到歌手"
          description="该歌手暂时不可用。"
        />
      </div>

      <div
        v-else
        key="content"
        class="artist-page-content"
      >
        <header class="music-detail-hero music-surface">
          <Cover
            :src="artist.artworkUrl"
            :alt="artist.name"
            size="hero"
            shape="circle"
            :hover-effect="false"
            :show-play-button="false"
          />
          <div class="music-detail-hero-copy">
            <p class="music-page-eyebrow">
              <Radio :size="13" /> 歌手
            </p>
            <h1 id="artist-title">
              {{ artist.name }}
            </h1>
            <p class="music-detail-description">
              {{ artist.alias.join(' / ') || artist.description || '网易云音乐歌手' }}
            </p>
            <p class="music-detail-meta">
              {{ artist.songCount ?? hotSongs.length }} 首歌曲 · {{ artist.albumCount ?? albumsSection.items.length }} 张专辑
            </p>
            <div class="music-detail-actions">
              <CommonButton
                variant="primary"
                :disabled="hotSongs.length === 0"
                @click="playAll"
              >
                <Play
                  :size="15"
                  fill="currentColor"
                />
                播放热门歌曲
              </CommonButton>
            </div>
          </div>
        </header>

        <MusicSection
          section-id="artist-hot-songs"
          title="热门歌曲"
          :state="hotSongs.length > 0 ? 'ready' : 'empty'"
          empty-text="暂时没有热门歌曲。"
        >
          <VirtualTrackList
            :songs="hotSongs"
            :active-track-id="activeTrackId"
            @play="playSong"
            @enqueue="enqueueSong"
            @play-next="playSongNext($event, { kind: 'artist', artistId })"
            @like="likeSong"
            @add-to-playlist="openAddToPlaylist"
            @details="openSongDetails"
            @give-agent="giveSongToAgent"
          />
        </MusicSection>

        <MusicSection
          section-id="artist-albums"
          title="专辑"
          :state="albumsSection.state"
          :error-text="albumsSection.error"
          empty-text="暂时没有专辑。"
          @retry="loadArtistAlbums"
        >
          <div class="artist-card-grid">
            <EntityCard
              v-for="album in albumsSection.items"
              :key="album.id"
              :title="album.name"
              :subtitle="album.publishTime ? new Date(album.publishTime).getFullYear().toString() : '专辑'"
              :artwork-url="album.artworkUrl"
              @activate="openAlbum(album)"
            />
          </div>
        </MusicSection>

        <MusicSection
          section-id="similar-artists"
          title="相似歌手"
          :state="similarSection.state"
          :error-text="similarSection.error"
          empty-text="暂时没有相似歌手。"
          @retry="loadSimilarArtists"
        >
          <div class="artist-card-grid">
            <EntityCard
              v-for="item in similarSection.items"
              :key="item.id"
              :title="item.name"
              :subtitle="item.alias.join(' / ') || '歌手'"
              :artwork-url="item.artworkUrl"
              @activate="openArtist(item)"
            />
          </div>
        </MusicSection>

        <AddTrackToPlaylistDialog
          :song="playlistTarget"
          @close="playlistTarget = null"
        />
      </div>
    </Transition>
  </section>
</template>
