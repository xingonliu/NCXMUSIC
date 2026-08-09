<script setup lang="ts">
import { Play } from '@lucide/vue'
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
import TrackRow from './components/TrackRow.vue'
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
          <CommonButton variant="primary" :disabled="songs.length === 0" @click="playAll">
            <Play :size="15" fill="currentColor" />
            播放全部
          </CommonButton>
        </div>
      </header>

      <div class="track-list">
        <TrackRow
          v-for="(song, index) in songs"
          :key="`${song.id}-${index}`"
          :song="song"
          :index="index"
          :active="song.id === activeTrackId"
          @play="playFromSong"
          @enqueue="enqueueSong"
        />
      </div>
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

.track-list {
  display: grid;
  gap: var(--ncx-space-1);
  margin-top: var(--ncx-space-10);
}
</style>
