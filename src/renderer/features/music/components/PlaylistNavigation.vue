<script setup lang="ts">
import { ChevronDown, ChevronRight, Heart, ListMusic, Plus } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

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
import { mutateMusic } from '../music-actions'

// ========= 变量 =========

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 当前用户的歌单资产。 */
const playlists = ref<StandardPlaylist[]>([])

/** 收藏歌单分组是否展开。 */
const collectedExpanded = ref<boolean>(false)

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

/** 当前账户自建歌单，最多展示最近五个。 */
const ownedPlaylists = computed<StandardPlaylist[]>(() => playlists.value.filter((item) => item.owned).slice(0, 5))

/** 当前账户收藏歌单，最多展示最近五个。 */
const collectedPlaylists = computed<StandardPlaylist[]>(() => playlists.value.filter((item) => !item.owned).slice(0, 5))

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
    showToast(response.error.message, 'warning')
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
    showToast(response.error.message, 'warning')
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
    showToast(response.error.message, 'warning')
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
    showToast(response.error.message, 'warning')
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
    showToast(response.error.message, 'warning')
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
    void navigator.clipboard.writeText(`https://music.163.com/playlist?id=${playlist.id}`)
  }
}

/** 切换收藏歌单分组显隐。 */
function toggleCollected(): void {
  collectedExpanded.value = !collectedExpanded.value
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
  <nav v-if="visible" class="ncx-playlist-nav" aria-label="歌单导航">
    <section class="ncx-nav-section">
      <p class="ncx-nav-section-title">我的音乐</p>
      <RouterLink class="ncx-nav-item" :to="{ name: 'liked-songs' }">
        <Heart :size="17" />
        <span>我喜欢</span>
      </RouterLink>
    </section>

    <section class="ncx-nav-section ncx-playlist-group">
      <div class="ncx-playlist-group-heading">
        <p class="ncx-nav-section-title">创建的歌单</p>
        <CommonIconButton
          size="compact"
          variant="ghost"
          label="创建歌单"
          @click="createDialogVisible = true"
        >
          <Plus :size="13" />
        </CommonIconButton>
      </div>
      <CommonContextMenu
        v-for="playlist in ownedPlaylists"
        :key="playlist.id"
        :items="ownedMenuItems"
        @select="handlePlaylistAction(playlist, $event)"
      >
        <RouterLink
          class="ncx-nav-item"
          :to="{ name: 'playlist-detail', params: { playlistId: playlist.id } }"
        >
          <ListMusic :size="16" />
          <span>{{ playlist.name }}</span>
        </RouterLink>
      </CommonContextMenu>
    </section>

    <section v-if="collectedPlaylists.length > 0" class="ncx-nav-section ncx-playlist-group">
      <button class="ncx-playlist-group-heading ncx-playlist-group-toggle" type="button" @click="toggleCollected">
        <p class="ncx-nav-section-title">收藏的歌单</p>
        <ChevronDown v-if="collectedExpanded" :size="13" />
        <ChevronRight v-else :size="13" />
      </button>
      <template v-if="collectedExpanded">
        <CommonContextMenu
          v-for="playlist in collectedPlaylists"
          :key="playlist.id"
          :items="collectedMenuItems"
          @select="handlePlaylistAction(playlist, $event)"
        >
          <RouterLink
            class="ncx-nav-item"
            :to="{ name: 'playlist-detail', params: { playlistId: playlist.id } }"
          >
            <ListMusic :size="16" />
            <span>{{ playlist.name }}</span>
          </RouterLink>
        </CommonContextMenu>
      </template>
    </section>

    <CommonDialog
      :visible="createDialogVisible"
      title="创建歌单"
      @close="createDialogVisible = false"
    >
      <CommonInput v-model="createName" label="歌单名称" placeholder="输入歌单名称" />
      <template #actions>
        <CommonButton variant="secondary" @click="createDialogVisible = false">取消</CommonButton>
        <CommonButton variant="primary" :disabled="!createName.trim()" @click="createPlaylist">创建</CommonButton>
      </template>
    </CommonDialog>

    <CommonDialog
      :visible="Boolean(renameTarget)"
      title="重命名歌单"
      @close="renameTarget = null"
    >
      <CommonInput v-model="renameName" label="歌单名称" />
      <template #actions>
        <CommonButton variant="secondary" @click="renameTarget = null">取消</CommonButton>
        <CommonButton variant="primary" :disabled="!renameName.trim()" @click="renamePlaylist">保存</CommonButton>
      </template>
    </CommonDialog>

    <CommonAlertDialog
      :visible="Boolean(deleteTarget)"
      title="删除这个歌单？"
      :description="deleteTarget ? `“${deleteTarget.name}”删除后无法恢复。` : ''"
      confirm-text="删除"
      @cancel="deleteTarget = null"
      @confirm="deletePlaylist"
    />
  </nav>
</template>
