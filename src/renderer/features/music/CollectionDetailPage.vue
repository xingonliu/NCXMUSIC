<script setup lang="ts">
import { Heart, ListPlus, Play } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
import { showToast } from '../../design-system/use-toast'
import Cover from './components/Cover.vue'
import AddTrackToPlaylistDialog from './components/AddTrackToPlaylistDialog.vue'
import MusicCommentsSection from './components/MusicCommentsSection.vue'
import VirtualTrackList from './components/VirtualTrackList.vue'
import { useAccountSessionStore } from '../account/account-session-store'
import { mutateMusic, playSongNext } from './music-actions'
import {
  collectionSongs,
  standardSongToTrackSummary,
  standardSongsToTrackSummaries,
  type PlayableCollection
} from './music-entity'
import './music-content-pages.css'
import { usePlayer } from './use-player'

// ========= 类型 =========

/** 当前详情页实体类型。 */
type CollectionKind = 'album' | 'playlist'

// ========= 变量 =========

/** 当前路由对象。 */
const route = useRoute()

/** Router 实例，用于歌曲详情和小云上下文导航。 */
const router = useRouter()

/** 播放器接口。 */
const player = usePlayer()

/** 当前账户公开状态，用于判断歌单编辑权限。 */
const account = useAccountSessionStore()

/** 当前加载状态。 */
const loading = ref<boolean>(false)

/** 当前错误文案。 */
const errorMessage = ref<string>('')

/** 当前集合实体。 */
const collection = ref<PlayableCollection | null>(null)

/** 最近一次请求 ID。 */
let latestRequestId = ''

/** 是否正在提交歌单歌曲排序。 */
const reorderBusy = ref<boolean>(false)

/** 正在移除的歌单歌曲 ID。 */
const removingTrackId = ref<string | null>(null)

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

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

/** 当前详情是否属于登录用户自己的可编辑歌单。 */
const isOwnedPlaylist = computed<boolean>(() => {
  /** 当前已加载的集合实体。 */
  const current = collection.value
  /** 当前活动账户。 */
  const active = account.snapshot.value?.activeAccount
  return current?.kind === 'playlist' &&
    active?.kind === 'netease' &&
    current.creator?.id === active.neteaseUserId
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
  showToast(`已添加 ${songs.value.length} 首歌曲到队列。`, 'info')
}

/** 收藏当前集合或取消收藏。 */
async function toggleSubscription(): Promise<void> {
  const current = collection.value
  if (!current || (current.kind === 'playlist' && isOwnedPlaylist.value)) return
  const subscribed = !current.subscribed
  const response = current.kind === 'album'
    ? await mutateMusic({ operation: 'subscribeAlbum', albumId: current.id, subscribed })
    : await mutateMusic({ operation: 'subscribePlaylist', playlistId: current.id, subscribed })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  collection.value = { ...current, subscribed }
  showToast(subscribed ? `已收藏《${current.name}》。` : `已取消收藏《${current.name}》。`, 'success')
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

/** 从当前自建歌单移除歌曲，并在成功后更新标准实体副本。 */
async function removePlaylistSong(song: StandardSong): Promise<void> {
  /** 发起移除时的歌单实体快照。 */
  const current = collection.value
  if (current?.kind !== 'playlist' || !isOwnedPlaylist.value || removingTrackId.value) return
  removingTrackId.value = song.id
  /** 标准移除歌曲写入回执。 */
  const response = await mutateMusic({
    operation: 'updatePlaylistTracks',
    playlistId: current.id,
    trackIds: [song.id],
    action: 'remove'
  })
  removingTrackId.value = null
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  if (collection.value?.id !== current.id) return
  /** 移除目标歌曲后的本地歌曲集合。 */
  const nextSongs = current.songs.filter((item) => item.id !== song.id)
  collection.value = {
    ...current,
    songs: nextSongs,
    trackCount: nextSongs.length
  }
  showToast(`已从歌单移除《${song.name}》。`, 'success')
}

/** 把自建歌单歌曲向上或向下移动一位，并回滚失败的乐观排序。 */
async function movePlaylistSong(song: StandardSong, direction: -1 | 1): Promise<void> {
  /** 发起排序时的歌单实体快照。 */
  const current = collection.value
  if (current?.kind !== 'playlist' || !isOwnedPlaylist.value || reorderBusy.value) return
  /** 当前歌曲在歌单中的原始索引。 */
  const fromIndex = current.songs.findIndex((item) => item.id === song.id)
  /** 当前歌曲移动后的目标索引。 */
  const toIndex = fromIndex + direction
  if (fromIndex < 0 || toIndex < 0 || toIndex >= current.songs.length) return

  /** 排序失败时用于回滚的歌曲顺序。 */
  const previousSongs = [...current.songs]
  /** 即时展示并提交到上游的新歌曲顺序。 */
  const nextSongs = [...previousSongs]
  /** 从旧位置取出的目标歌曲。 */
  const [movedSong] = nextSongs.splice(fromIndex, 1)
  if (!movedSong) return
  nextSongs.splice(toIndex, 0, movedSong)
  collection.value = { ...current, songs: nextSongs }
  reorderBusy.value = true
  /** 标准歌单排序写入回执。 */
  const response = await mutateMusic({
    operation: 'reorderPlaylistTracks',
    playlistId: current.id,
    trackIds: nextSongs.map((item) => item.id)
  })
  reorderBusy.value = false
  if (collection.value?.id !== current.id) return
  if (!response.ok) {
    collection.value = { ...current, songs: previousSongs }
    showToast(response.error.message, 'warning')
    return
  }
  showToast('歌单顺序已保存。', 'success')
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

watch([collectionKind, collectionId], () => {
  void loadCollection()
}, { immediate: true })

onMounted(() => {
  void account.initialize()
})
</script>

<template>
  <section
    class="collection-detail-page music-content-page"
    aria-labelledby="collection-title"
  >
    <Transition
      name="music-page-state"
      mode="out-in"
    >
      <div
        v-if="loading"
        key="loading"
        class="collection-detail-state collection-loading"
      >
        <CommonSpinner label="正在加载集合" />
        <span>正在加载集合</span>
      </div>

      <div
        v-else-if="errorMessage"
        key="error"
        class="collection-detail-state"
      >
        <CommonErrorState
          title="集合读取失败"
          :description="errorMessage"
          @retry="loadCollection"
        />
      </div>

      <div
        v-else-if="!collection"
        key="empty"
        class="collection-detail-state"
      >
        <CommonEmptyState
          title="没有找到集合"
          description="该专辑或歌单暂时不可用。"
        />
      </div>

      <div
        v-else
        key="content"
        class="collection-detail-content"
      >
        <header class="music-detail-hero music-surface">
          <Cover
            :src="collection.artworkUrl"
            :alt="collection.name"
            size="hero"
            :hover-effect="false"
            :show-play-button="false"
          />
          <div class="music-detail-hero-copy">
            <p class="music-page-eyebrow">
              {{ collection.kind === 'album' ? '专辑' : '歌单' }}
            </p>
            <h1 id="collection-title">
              {{ collection.name }}
            </h1>
            <p class="music-detail-meta">
              {{ subtitle }} · {{ songs.length }} 首
            </p>
            <p
              v-if="collection.description"
              class="music-detail-description"
            >
              {{ collection.description }}
            </p>
            <div class="music-detail-actions">
              <CommonButton
                variant="primary"
                :disabled="songs.length === 0"
                @click="playAll"
              >
                <Play
                  :size="15"
                  fill="currentColor"
                />
                播放全部
              </CommonButton>
              <CommonButton
                variant="secondary"
                :disabled="songs.length === 0"
                @click="enqueueAll"
              >
                <ListPlus :size="15" />
                加入队列
              </CommonButton>
              <CommonButton
                v-if="collection.kind === 'album' || !isOwnedPlaylist"
                variant="secondary"
                @click="toggleSubscription"
              >
                <Heart
                  :size="15"
                  :fill="collection.subscribed ? 'currentColor' : 'none'"
                />
                {{ collection.subscribed ? '已收藏' : '收藏' }}
              </CommonButton>
            </div>
          </div>
        </header>

        <section
          class="music-track-surface music-surface"
          aria-labelledby="collection-tracks-title"
        >
          <header class="music-section-heading">
            <h2 id="collection-tracks-title">
              歌曲
            </h2>
            <span>{{ songs.length }} 首{{ isOwnedPlaylist ? ' · 可管理' : '' }}</span>
          </header>
          <VirtualTrackList
            class="track-list"
            :songs="songs"
            :active-track-id="activeTrackId"
            :playlist-management="isOwnedPlaylist"
            :management-busy="reorderBusy || Boolean(removingTrackId)"
            @play="playFromSong"
            @enqueue="enqueueSong"
            @play-next="playSongNext($event, collectionKind === 'album' ? { kind: 'album', albumId: collectionId } : { kind: 'playlist', playlistId: collectionId })"
            @like="likeSong"
            @add-to-playlist="openAddToPlaylist"
            @details="openSongDetails"
            @give-agent="giveSongToAgent"
            @move-up="movePlaylistSong($event, -1)"
            @move-down="movePlaylistSong($event, 1)"
            @remove="removePlaylistSong"
          />
        </section>

        <MusicCommentsSection
          :resource-type="collection.kind"
          :resource-id="collection.id"
        />

        <AddTrackToPlaylistDialog
          :song="playlistTarget"
          @close="playlistTarget = null"
        />
      </div>
    </Transition>
  </section>
</template>
