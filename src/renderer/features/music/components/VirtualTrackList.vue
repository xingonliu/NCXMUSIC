<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { StandardSong } from '../../../../shared/schemas/music'
import TrackRow from './TrackRow.vue'

// ========= 属性与事件 =========

/** 歌曲列表属性。 */
const props = withDefaults(defineProps<{
  /** 标准歌曲列表。 */
  songs: StandardSong[]
  /** 当前播放歌曲 ID。 */
  activeTrackId?: string | null
  /** 是否显示歌曲封面。 */
  showArtwork?: boolean
  /** 单行高度。 */
  rowHeight?: number
  /** 是否展示自建歌单歌曲管理动作。 */
  playlistManagement?: boolean
  /** 是否暂时禁用歌单管理动作。 */
  managementBusy?: boolean
}>(), {
  activeTrackId: null,
  rowHeight: 60,
  showArtwork: true,
  playlistManagement: false,
  managementBusy: false
})

/** 歌曲列表事件。 */
const emit = defineEmits<{
  (event: 'play', song: StandardSong): void
  (event: 'enqueue', song: StandardSong): void
  (event: 'play-next', song: StandardSong): void
  (event: 'like', song: StandardSong): void
  (event: 'add-to-playlist', song: StandardSong): void
  (event: 'details', song: StandardSong): void
  (event: 'give-agent', song: StandardSong): void
  (event: 'move-up', song: StandardSong): void
  (event: 'move-down', song: StandardSong): void
  (event: 'remove', song: StandardSong): void
}>()

// ========= 变量 =========

/** 列表容器引用。 */
const container = ref<HTMLElement | null>(null)

/** 键盘导航的当前绝对行索引。 */
const keyboardIndex = ref<number>(0)

// ========= 函数 =========

/** 聚焦指定绝对索引行，并保证该行已平滑滚入页面视口。 */
async function focusRow(index: number): Promise<void> {
  if (props.songs.length === 0) return
  keyboardIndex.value = Math.min(props.songs.length - 1, Math.max(0, index))
  await nextTick()
  const target = container.value?.querySelector<HTMLElement>(`[data-track-index="${keyboardIndex.value}"] .track-row`)
  if (target) {
    target.focus()
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

/** 处理列表级方向键、Home 与 End 导航。 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') void focusRow(keyboardIndex.value + 1)
  else if (event.key === 'ArrowUp') void focusRow(keyboardIndex.value - 1)
  else if (event.key === 'Home') void focusRow(0)
  else if (event.key === 'End') void focusRow(props.songs.length - 1)
  else return
  event.preventDefault()
}
</script>

<template>
  <div
    ref="container"
    class="virtual-track-list"
    role="list"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <div
      v-for="(song, index) in props.songs"
      :key="`${song.id}-${index}`"
      role="listitem"
      :data-track-index="index"
    >
      <TrackRow
        :song="song"
        :index="index"
        :active="song.id === props.activeTrackId"
        :show-artwork="props.showArtwork"
        :playlist-management="props.playlistManagement"
        :management-busy="props.managementBusy"
        :first-in-playlist="index === 0"
        :last-in-playlist="index === props.songs.length - 1"
        @focusin="keyboardIndex = index"
        @play="emit('play', $event)"
        @enqueue="emit('enqueue', $event)"
        @play-next="emit('play-next', $event)"
        @like="emit('like', $event)"
        @add-to-playlist="emit('add-to-playlist', $event)"
        @details="emit('details', $event)"
        @give-agent="emit('give-agent', $event)"
        @move-up="emit('move-up', $event)"
        @move-down="emit('move-down', $event)"
        @remove="emit('remove', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.virtual-track-list {
  display: flex;
  flex-direction: column;
  outline: none;
}
</style>
