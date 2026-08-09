<script setup lang="ts">
import { Heart, ListPlus, Play } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type {
  MusicReadResult,
  StandardAlbum,
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
  collectionSongs,
  standardSongToTrackSummary,
  standardSongsToTrackSummaries,
  type PlayableCollection
} from './music-entity'
import { usePlayer } from './use-player'

// ========= 类型 =========

/** 当前详情页实体类型。 */
type CollectionKind = 'album' | 'playlist'

// ========= 变量 =========

/** 当前路由对象。 */
const route = useRoute()

/** 播放器接口。 */
const player = usePlayer()

/** 当前加载状态。 */
const loading = ref<boolean>(false)

/** 当前错误文案。 */
const errorMessage = ref<string>('')

/** 当前集合实体。 */
const collection = ref<PlayableCollection | null>(null)

/** 页面操作提示。 */
const notice = ref<string>('')

/** 最近一次请求 ID。 */
let latestRequestId = ''

/** 当前集合类型。 */
const collectionKind = computed<CollectionKind>(() => {
  return route.name === 'album-detail' ? 'album' : 'playlist'
})

/** 当前集合 ID。 */
const collectionId = computed<string>(() => {
  const key = collectionKind.value === 'album' ? 'albumId' : 'playlistId'
  return String(route.params[key] ?? '')
})

/** 当前集合歌曲列表。 */
const songs = computed<StandardSong[]>(() => collection.value ? collectionSongs(collection.value) : [])

/** 当前播放曲目 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

/** 当前实体副标题。 */
const subtitle = computed<string>(() => {
  if (!collection.value) return ''
  if (collection.value.kind === 'album') return collection.value.artist?.name ?? '专辑'
  return collection.value.creator?.nickname ?? '歌单'
})

// ========= 函数 =========

/** 拉取集合详情。 */
async function loadCollection(): Promise<void> {
  collection.value = null
  errorMessage.value = ''

  if (!collectionId.value) return

  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  loading.value = true

  try {
    const response = collectionKind.value === 'album'
      ? await window.ncx.runtime.getAlbum({ id: collectionId.value, requestId })
      : await window.ncx.runtime.getPlaylist({ id: collectionId.value, requestId })
    if (requestId !== latestRequestId) return
    if (!response.ok) {
      errorMessage.value = response.error.message
      return
    }
    collection.value = normalizeCollectionResponse(response.data)
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

/** 校验并读取集合响应实体。 */
function normalizeCollectionResponse(data: MusicReadResult): PlayableCollection | null {
  if (collectionKind.value === 'album' && data.kind === 'album') return data.entity as StandardAlbum | null
  if (collectionKind.value === 'playlist' && data.kind === 'playlist') return data.entity as StandardPlaylist | null
  errorMessage.value = '集合响应类型不匹配。'
  return null
}

/** 从指定歌曲开始播放整个集合。 */
async function playFromSong(song: StandardSong): Promise<void> {
  const startIndex = songs.value.findIndex((item) => item.id === song.id)
  await player.playContext({
    tracks: standardSongsToTrackSummaries(songs.value),
    source: collectionKind.value === 'album'
      ? { kind: 'album', albumId: collectionId.value }
      : { kind: 'playlist', playlistId: collectionId.value },
    startIndex: Math.max(0, startIndex)
  })
}

/** 从第一首开始播放整个集合。 */
async function playAll(): Promise<void> {
  if (songs.value.length === 0) return
  await playFromSong(songs.value[0] as StandardSong)
}

/** 把歌曲追加到队列。 */
function enqueueSong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], collectionKind.value === 'album'
    ? { kind: 'album', albumId: collectionId.value }
    : { kind: 'playlist', playlistId: collectionId.value })
}

/** 把当前集合全部歌曲追加到队列末尾。 */
function enqueueAll(): void {
  if (songs.value.length === 0) return
  player.enqueue(standardSongsToTrackSummaries(songs.value), collectionKind.value === 'album'
    ? { kind: 'album', albumId: collectionId.value }
    : { kind: 'playlist', playlistId: collectionId.value })
  notice.value = `已添加 ${songs.value.length} 首歌曲到队列。`
}

/** 收藏当前集合或取消收藏。 */
async function toggleSubscription(): Promise<void> {
  const current = collection.value
  if (!current) return
  const subscribed = !current.subscribed
  const response = current.kind === 'album'
    ? await mutateMusic({ operation: 'subscribeAlbum', albumId: current.id, subscribed })
    : await mutateMusic({ operation: 'subscribePlaylist', playlistId: current.id, subscribed })
  if (!response.ok) {
    notice.value = response.error.message
    return
  }
  collection.value = { ...current, subscribed }
  notice.value = subscribed ? `已收藏《${current.name}》。` : `已取消收藏《${current.name}》。`
}

/** 收藏当前歌曲。 */
async function likeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  notice.value = response.ok ? `已收藏《${song.name}》。` : response.error.message
}

// ========= 生命周期 =========

watch([collectionKind, collectionId], () => {
  void loadCollection()
}, { immediate: true })
</script>

<template>
  <section class="collection-detail-page" aria-labelledby="collection-title">
    <div v-if="loading" class="collection-loading">
      <CommonSpinner label="正在加载集合" />
      <span>正在加载集合</span>
    </div>

    <CommonErrorState
      v-else-if="errorMessage"
      title="集合读取失败"
      :description="errorMessage"
      @retry="loadCollection"
    />

    <CommonEmptyState
      v-else-if="!collection"
      title="没有找到集合"
      description="该专辑或歌单暂时不可用。"
    />

    <template v-else>
      <header class="collection-hero">
        <MediaArtwork :src="collection.artworkUrl" :alt="collection.name" size="hero" />
        <div class="collection-hero-copy">
          <p class="music-page-eyebrow">{{ collection.kind === 'album' ? '专辑' : '歌单' }}</p>
          <h1 id="collection-title">{{ collection.name }}</h1>
          <p>{{ subtitle }} · {{ songs.length }} 首</p>
          <p v-if="collection.description" class="collection-description">{{ collection.description }}</p>
          <div class="collection-actions">
            <CommonButton variant="primary" :disabled="songs.length === 0" @click="playAll">
              <Play :size="15" fill="currentColor" />
              播放全部
            </CommonButton>
            <CommonButton variant="secondary" :disabled="songs.length === 0" @click="enqueueAll">
              <ListPlus :size="15" />
              加入队列
            </CommonButton>
            <CommonButton variant="secondary" @click="toggleSubscription">
              <Heart :size="15" :fill="collection.subscribed ? 'currentColor' : 'none'" />
              {{ collection.subscribed ? '已收藏' : '收藏' }}
            </CommonButton>
          </div>
        </div>
      </header>

      <p v-if="notice" class="collection-notice" role="status">{{ notice }}</p>

      <VirtualTrackList
        class="track-list"
        :songs="songs"
        :active-track-id="activeTrackId"
        :height="620"
        @play="playFromSong"
        @enqueue="enqueueSong"
        @play-next="playSongNext($event, collectionKind === 'album' ? { kind: 'album', albumId: collectionId } : { kind: 'playlist', playlistId: collectionId })"
        @like="likeSong"
      />
    </template>
  </section>
</template>

<style scoped>
.collection-detail-page {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  padding: 72px 0 132px;
}

.collection-loading {
  display: inline-flex;
  align-items: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
}

.collection-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--ncx-space-8);
  align-items: end;
}

.collection-hero-copy {
  display: grid;
  gap: var(--ncx-space-3);
  justify-items: start;
}

.music-page-eyebrow {
  margin: 0;
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.collection-hero h1 {
  margin: 0;
  font-size: 44px;
  line-height: 1.08;
}

.collection-hero p:not(.music-page-eyebrow) {
  margin: 0;
  color: var(--ncx-color-text-secondary);
}

.collection-description {
  display: -webkit-box;
  max-width: 680px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-height: 1.55;
}

.collection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ncx-space-2);
}

.collection-notice {
  margin: var(--ncx-space-6) 0 calc(var(--ncx-space-6) * -1);
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
}

.track-list {
  margin-top: var(--ncx-space-10);
}
</style>
