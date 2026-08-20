<script setup lang="ts">
import { Music2, Plus } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import type { MusicReadResult, StandardPlaylist } from '../../../../shared/schemas/music'
import {
  CommonAlertDialog,
  CommonButton,
  CommonContextMenu,
  CommonDialog,
  CommonIconButton,
  CommonInput,
  type CommonMenuItem
} from '../../../design-system/components'
import { showToast } from '../../../design-system/use-toast'
import { useAccountSessionStore } from '../../account/account-session-store'
import { copyText } from '../../foundation/clipboard'
import { mutateMusic } from '../music-actions'
import { adaptArtworkUrl } from '../music-entity'
import { translatePublicError } from '../../../i18n'

// ========= 变量 =========

/** 当前路由对象，用于判断歌单导航高亮。 */
const route = useRoute()

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 当前用户的歌单资产。 */
const playlists = ref<StandardPlaylist[]>([])

/** 创建歌单对话框是否显示。 */
const createDialogVisible = ref<boolean>(false)

/** 新歌单名称。 */
const createName = ref<string>('')

/** 待重命名歌单。 */
const renameTarget = ref<StandardPlaylist | null>(null)

/** 重命名输入值。 */
const renameName = ref<string>('')

/** 待删除歌单。 */
const deleteTarget = ref<StandardPlaylist | null>(null)

/** 当前网易云用户 ID。 */
const userId = computed<string | null>(() => {
  const active = account.snapshot.value?.activeAccount
  return active?.kind === 'netease' ? active.neteaseUserId : null
})

/** 当前账户是否登录。 */
const visible = computed<boolean>(() => account.snapshot.value?.state === 'authenticated' && Boolean(userId.value))

/** 侧栏展示全部歌单，并确保“我喜欢的音乐”常驻第一位。 */
const visiblePlaylists = computed<StandardPlaylist[]>(() => [...playlists.value].sort((left, right) => {
  /** 左侧歌单是否为网易云喜欢歌单。 */
  const leftLiked = left.name.includes('喜欢的音乐') || left.name.includes('我喜欢')
  /** 右侧歌单是否为网易云喜欢歌单。 */
  const rightLiked = right.name.includes('喜欢的音乐') || right.name.includes('我喜欢')
  return Number(rightLiked) - Number(leftLiked)
}))

/** 自建歌单右键菜单。 */
const ownedMenuItems: CommonMenuItem[] = [
  { value: 'rename', label: '重命名' },
  { value: 'copy-link', label: '复制网易云歌单链接' },
  { value: 'separator', type: 'separator' },
  { value: 'delete', label: '删除歌单', danger: true }
]

/** 收藏歌单右键菜单。 */
const collectedMenuItems: CommonMenuItem[] = [
  { value: 'copy-link', label: '复制网易云歌单链接' },
  { value: 'separator', type: 'separator' },
  { value: 'unsubscribe', label: '取消收藏', danger: true }
]

// ========= 函数 =========

/** 读取当前账户歌单资产。 */
async function loadPlaylists(): Promise<void> {
  playlists.value = []
  if (!userId.value) return
  const response = await window.ncx.runtime.getUserPlaylists({ userId: userId.value, limit: 100 })
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'playlistCollection' || result.collection !== 'user') {
    showToast('歌单导航响应类型不匹配。', 'warning')
    return
  }
  playlists.value = result.playlists
}

/** 创建新的自建歌单。 */
async function createPlaylist(): Promise<void> {
  const name = createName.value.trim()
  if (!name) return
  const response = await mutateMusic({ operation: 'createPlaylist', name, privacy: 'public' })
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return
  }
  createDialogVisible.value = false
  createName.value = ''
  showToast('歌单创建成功。', 'success')
  await loadPlaylists()
}

/** 打开歌单重命名对话框。 */
function openRenameDialog(playlist: StandardPlaylist): void {
  renameTarget.value = playlist
  renameName.value = playlist.name
}

/** 保存自建歌单新名称。 */
async function renamePlaylist(): Promise<void> {
  const target = renameTarget.value
  const name = renameName.value.trim()
  if (!target || !name) return
  const response = await mutateMusic({ operation: 'renamePlaylist', playlistId: target.id, name })
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return
  }
  renameTarget.value = null
  showToast('歌单已重命名。', 'success')
  await loadPlaylists()
}

/** 删除已确认的自建歌单。 */
async function deletePlaylist(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  deleteTarget.value = null
  const response = await mutateMusic({ operation: 'deletePlaylist', playlistId: target.id })
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return
  }
  showToast('歌单已删除。', 'info')
  await loadPlaylists()
}

/** 取消收藏指定歌单。 */
async function unsubscribePlaylist(playlist: StandardPlaylist): Promise<void> {
  const response = await mutateMusic({
    operation: 'subscribePlaylist',
    playlistId: playlist.id,
    subscribed: false
  })
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return
  }
  playlists.value = playlists.value.filter((item) => item.id !== playlist.id)
  showToast('已取消收藏歌单。', 'info')
}

/** 处理歌单入口右键动作。 */
function handlePlaylistAction(playlist: StandardPlaylist, rawAction: string | number): void {
  const action = String(rawAction)
  if (action === 'rename') openRenameDialog(playlist)
  else if (action === 'delete') deleteTarget.value = playlist
  else if (action === 'unsubscribe') void unsubscribePlaylist(playlist)
  else if (action === 'copy-link') {
    void copyText(
      `https://music.163.com/playlist?id=${playlist.id}`,
      '歌单链接已复制。'
    )
  }
}

/** 判断指定歌单条目是否为当前高亮路由。 */
function isPlaylistActive(playlist: StandardPlaylist): boolean {
  if (route.name === 'playlist-detail') {
    return String(route.params.playlistId) === String(playlist.id)
  }
  if (route.name === 'liked-songs') {
    return playlist.name.includes('喜欢的音乐') || playlist.name.includes('我喜欢')
  }
  return false
}

// ========= 生命周期 =========

onMounted(async () => {
  await account.initialize()
  await loadPlaylists()
})

watch(() => account.snapshot.value?.accountGeneration, () => {
  void loadPlaylists()
})
</script>

<template>
  <div
    v-if="visible"
    class="ncx-playlist-nav-wrapper"
  >
    <nav
      class="ncx-playlist-nav"
      :aria-label="$tSource('歌单导航')"
    >
      <section class="ncx-nav-section ncx-playlist-group">
        <div class="ncx-playlist-group-heading">
          <p class="ncx-nav-section-title">
            {{ $tSource("我的歌单") }}
          </p>
          <CommonIconButton
            size="compact"
            variant="ghost"
            :label="$tSource('创建歌单')"
            @click="createDialogVisible = true"
          >
            <Plus :size="13" />
          </CommonIconButton>
        </div>
        <CommonContextMenu
          v-for="playlist in visiblePlaylists"
          :key="playlist.id"
          :items="playlist.owned ? ownedMenuItems : collectedMenuItems"
          @select="handlePlaylistAction(playlist, $event)"
        >
          <RouterLink
            class="ncx-nav-item"
            :class="{ 'ncx-nav-item--sub-active': isPlaylistActive(playlist) }"
            :to="{ name: 'playlist-detail', params: { playlistId: playlist.id } }"
          >
            <span
              class="ncx-playlist-cover"
              aria-hidden="true"
            >
              <img
                v-if="playlist.artworkUrl"
                :src="adaptArtworkUrl(playlist.artworkUrl, 'thumbnail')"
                alt=""
                loading="lazy"
              >
              <Music2
                v-else
                :size="13"
              />
            </span>
            <span>{{ playlist.name }}</span>
          </RouterLink>
        </CommonContextMenu>
      </section>
    </nav>
    <div
      class="ncx-playlist-nav-mask"
      aria-hidden="true"
    />

    <CommonDialog
      :visible="createDialogVisible"
      :title="$tSource('创建歌单')"
      @close="createDialogVisible = false"
    >
      <CommonInput
        v-model="createName"
        :label="$tSource('歌单名称')"
        :placeholder="$tSource('输入歌单名称')"
      />
      <template #actions>
        <CommonButton
          variant="secondary"
          @click="createDialogVisible = false"
        >
          {{ $tSource("取消") }}
        </CommonButton>
        <CommonButton
          variant="primary"
          :disabled="!createName.trim()"
          @click="createPlaylist"
        >
          {{ $tSource("创建") }}
        </CommonButton>
      </template>
    </CommonDialog>

    <CommonDialog
      :visible="Boolean(renameTarget)"
      :title="$tSource('重命名歌单')"
      @close="renameTarget = null"
    >
      <CommonInput
        v-model="renameName"
        :label="$tSource('歌单名称')"
      />
      <template #actions>
        <CommonButton
          variant="secondary"
          @click="renameTarget = null"
        >
          {{ $tSource("取消") }}
        </CommonButton>
        <CommonButton
          variant="primary"
          :disabled="!renameName.trim()"
          @click="renamePlaylist"
        >
          {{ $tSource("保存") }}
        </CommonButton>
      </template>
    </CommonDialog>

    <CommonAlertDialog
      :visible="Boolean(deleteTarget)"
      :title="$tSource('删除这个歌单？')"
      :description="$tSource(deleteTarget ? `“${deleteTarget.name}”删除后无法恢复。` : '')"
      :confirm-text="$tSource('删除')"
      @cancel="deleteTarget = null"
      @confirm="deletePlaylist"
    />
  </div>
</template>

<style scoped>
.ncx-playlist-cover {
  display: inline-flex;
  overflow: hidden;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: var(--ncx-color-text-tertiary);
  background: color-mix(in srgb, var(--ncx-color-text-primary) 7%, transparent);
}

.ncx-playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
