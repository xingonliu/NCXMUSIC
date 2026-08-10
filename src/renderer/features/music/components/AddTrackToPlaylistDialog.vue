<script setup lang="ts">
import { ref, watch } from 'vue'

import type { MusicReadResult, StandardPlaylist, StandardSong } from '../../../../shared/schemas/music'
import {
  CommonDialog,
  CommonEmptyState,
  CommonSpinner
} from '../../../design-system/components'
import { showToast } from '../../../design-system/use-toast'
import { useAccountSessionStore } from '../../account/account-session-store'
import { mutateMusic } from '../music-actions'
import Cover from './Cover.vue'

// ========= 属性与事件 =========

/** 添加歌曲到歌单对话框属性。 */
const props = defineProps<{
  /** 当前等待选择目标歌单的歌曲。 */
  song: StandardSong | null
}>()

/** 添加歌曲到歌单对话框事件。 */
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'added', song: StandardSong, playlist: StandardPlaylist): void
}>()

// ========= 变量 =========

/** 当前账户公开状态。 */
const account = useAccountSessionStore()

/** 当前账户可写入的自建歌单。 */
const ownedPlaylists = ref<StandardPlaylist[]>([])

/** 自建歌单读取状态。 */
const loading = ref<boolean>(false)

/** 正在执行写入的目标歌单 ID。 */
const busyPlaylistId = ref<string | null>(null)

/** 最近一次歌单读取的 requestId。 */
let activeRequestId = ''

// ========= 函数 =========

/** 读取当前登录账户的自建歌单，并拒绝游客写入入口。 */
async function loadOwnedPlaylists(): Promise<void> {
  /** 当前等待处理的歌曲快照。 */
  const song = props.song
  if (!song) return
  await account.initialize()
  /** 最新账户公开快照。 */
  const snapshot = account.snapshot.value ?? await account.refresh()
  if (!snapshot.canMutateMusic || snapshot.activeAccount.kind !== 'netease') {
    showToast('登录网易云后才能添加到歌单。', 'warning')
    emit('close')
    return
  }

  /** 本次自建歌单读取的唯一请求 ID。 */
  const requestId = crypto.randomUUID()
  activeRequestId = requestId
  loading.value = true
  ownedPlaylists.value = []
  /** Utility 返回的标准用户歌单响应。 */
  const response = await window.ncx.runtime.getUserPlaylists({
    userId: snapshot.activeAccount.neteaseUserId,
    limit: 100,
    requestId
  })
  if (requestId !== activeRequestId) return
  loading.value = false
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    emit('close')
    return
  }
  /** 经过跨进程 Schema 校验的音乐读取结果。 */
  const result: MusicReadResult = response.data
  if (result.kind !== 'playlistCollection' || result.collection !== 'user') {
    showToast('歌单响应类型不匹配。', 'warning')
    emit('close')
    return
  }
  ownedPlaylists.value = result.playlists.filter((playlist) => playlist.owned)
}

/** 将当前歌曲添加到用户选中的自建歌单。 */
async function addToPlaylist(playlist: StandardPlaylist): Promise<void> {
  /** 对话框打开时锁定的歌曲快照。 */
  const song = props.song
  if (!song || busyPlaylistId.value) return
  busyPlaylistId.value = playlist.id
  /** 标准添加歌曲写入回执。 */
  const response = await mutateMusic({
    operation: 'updatePlaylistTracks',
    playlistId: playlist.id,
    trackIds: [song.id],
    action: 'add'
  })
  busyPlaylistId.value = null
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  showToast(`已将《${song.name}》添加到“${playlist.name}”。`, 'success')
  emit('added', song, playlist)
  emit('close')
}

// ========= 生命周期 =========

watch(
  () => props.song?.id ?? null,
  (songId, _previous, onCleanup) => {
    if (songId) void loadOwnedPlaylists()
    else {
      ownedPlaylists.value = []
      loading.value = false
    }
    onCleanup(() => {
      if (activeRequestId) window.ncx.runtime.cancel(activeRequestId)
      activeRequestId = ''
    })
  },
  { immediate: true }
)
</script>

<template>
  <CommonDialog
    :visible="Boolean(props.song)"
    title="添加到歌单"
    :subtitle="props.song?.name ?? ''"
    @close="emit('close')"
  >
    <div
      v-if="loading"
      class="playlist-picker-status"
    >
      <CommonSpinner label="正在读取歌单" />
    </div>
    <CommonEmptyState
      v-else-if="ownedPlaylists.length === 0"
      title="暂无自建歌单"
      description="请先创建一个歌单。"
    />
    <div
      v-else
      class="playlist-picker-list"
    >
      <button
        v-for="playlist in ownedPlaylists"
        :key="playlist.id"
        type="button"
        :disabled="Boolean(busyPlaylistId)"
        @click="addToPlaylist(playlist)"
      >
        <Cover
          :src="playlist.artworkUrl"
          :alt="playlist.name"
          size="thumbnail"
          :hover-effect="false"
          :show-play-button="false"
        />
        <span>{{ playlist.name }}</span>
      </button>
    </div>
  </CommonDialog>
</template>
