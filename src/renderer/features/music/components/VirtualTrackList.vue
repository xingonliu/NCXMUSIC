<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { StandardSong } from '../../../../shared/schemas/music'
import TrackRow from './TrackRow.vue'

// ========= 属性与事件 =========

/** 虚拟歌曲列表属性。 */
const props = withDefaults(defineProps<{
  /** 标准歌曲列表。 */
  songs: StandardSong[]
  /** 当前播放歌曲 ID。 */
  activeTrackId?: string | null
  /** 是否显示歌曲封面。 */
  showArtwork?: boolean
  /** 可滚动视口高度。 */
  height?: number
  /** 单行冻结高度。 */
  rowHeight?: number
}>(), {
  activeTrackId: null,
  height: 520,
  rowHeight: 60,
  showArtwork: true
})

/** 虚拟歌曲列表事件。 */
const emit = defineEmits<{
  (event: 'play', song: StandardSong): void
  (event: 'enqueue', song: StandardSong): void
  (event: 'play-next', song: StandardSong): void
  (event: 'like', song: StandardSong): void
  (event: 'add-to-playlist', song: StandardSong): void
  (event: 'details', song: StandardSong): void
  (event: 'give-agent', song: StandardSong): void
}>()

// ========= 变量 =========

/** 列表滚动容器。 */
const viewport = ref<HTMLElement | null>(null)

/** 当前垂直滚动位置。 */
const scrollTop = ref<number>(0)

/** 键盘导航的当前绝对行索引。 */
const keyboardIndex = ref<number>(0)

/** 上下各额外渲染的行数，避免滚动边缘闪烁。 */
const OVERSCAN_ROWS = 4

/** 列表完整内容高度。 */
const totalHeight = computed<number>(() => props.songs.length * props.rowHeight)

/** 真实视口高度；短列表不制造多余空白。 */
const viewportHeight = computed<number>(() => Math.min(props.height, Math.max(props.rowHeight, totalHeight.value)))

/** 当前窗口第一行索引。 */
const startIndex = computed<number>(() => Math.max(0, Math.floor(scrollTop.value / props.rowHeight) - OVERSCAN_ROWS))

/** 当前窗口最后一行之后的索引。 */
const endIndex = computed<number>(() => Math.min(
  props.songs.length,
  Math.ceil((scrollTop.value + viewportHeight.value) / props.rowHeight) + OVERSCAN_ROWS
))

/** 当前实际挂载的窗口行。 */
const visibleRows = computed(() => props.songs.slice(startIndex.value, endIndex.value).map((song, offset) => ({
  song,
  index: startIndex.value + offset
})))

// ========= 函数 =========

/** 更新滚动位置并驱动可见窗口重算。 */
function handleScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

/** 聚焦指定绝对索引行，并保证该行已滚入窗口。 */
async function focusRow(index: number): Promise<void> {
  if (props.songs.length === 0) return
  keyboardIndex.value = Math.min(props.songs.length - 1, Math.max(0, index))
  viewport.value?.scrollTo({
    top: keyboardIndex.value * props.rowHeight,
    behavior: 'auto'
  })
  await nextTick()
  viewport.value?.querySelector<HTMLElement>(`[data-track-index="${keyboardIndex.value}"] .track-row`)?.focus()
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
    class="virtual-track-list"
    role="list"
    tabindex="0"
    ref="viewport"
    :style="{ height: `${viewportHeight}px` }"
    @scroll="handleScroll"
    @keydown="handleKeydown"
  >
    <div class="virtual-track-list-spacer" :style="{ height: `${totalHeight}px` }">
      <div
        class="virtual-track-list-window"
        :style="{ transform: `translateY(${startIndex * props.rowHeight}px)` }"
      >
        <div
          v-for="row in visibleRows"
          :key="`${row.song.id}-${row.index}`"
          role="listitem"
          :data-track-index="row.index"
          :style="{ height: `${props.rowHeight}px` }"
        >
          <TrackRow
            :song="row.song"
            :index="row.index"
            :active="row.song.id === props.activeTrackId"
            :show-artwork="props.showArtwork"
            @focusin="keyboardIndex = row.index"
            @play="emit('play', $event)"
            @enqueue="emit('enqueue', $event)"
            @play-next="emit('play-next', $event)"
            @like="emit('like', $event)"
            @add-to-playlist="emit('add-to-playlist', $event)"
            @details="emit('details', $event)"
            @give-agent="emit('give-agent', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-track-list {
  min-height: 120px;
  overflow-y: auto;
  overscroll-behavior: contain;
  outline: none;
}

.virtual-track-list-spacer {
  position: relative;
}

.virtual-track-list-window {
  position: absolute;
  inset: 0 0 auto;
  will-change: transform;
}
</style>
