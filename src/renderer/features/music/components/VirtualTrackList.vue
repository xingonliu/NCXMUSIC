<script setup lang="ts">
import { computed, ref } from 'vue'

import type { StandardSong } from '../../../../shared/schemas/music'
import TrackRow from './TrackRow.vue'

// ========= 属性与事件 =========

/** 虚拟歌曲列表属性。 */
const props = withDefaults(defineProps<{
  /** 标准歌曲列表。 */
  songs: StandardSong[]
  /** 当前播放歌曲 ID。 */
  activeTrackId?: string | null
  /** 可视区域高度。 */
  height?: number
  /** 单行固定高度。 */
  rowHeight?: number
  /** 是否显示歌曲封面。 */
  showArtwork?: boolean
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
}>()

// ========= 变量 =========

/** 当前滚动位置。 */
const scrollTop = ref<number>(0)

/** 列表是否需要启用虚拟窗口。 */
const virtualized = computed<boolean>(() => props.songs.length * props.rowHeight > props.height * 1.5)

/** 当前虚拟窗口起始下标。 */
const startIndex = computed<number>(() => virtualized.value
  ? Math.max(0, Math.floor(scrollTop.value / props.rowHeight) - 4)
  : 0)

/** 当前虚拟窗口结束下标。 */
const endIndex = computed<number>(() => virtualized.value
  ? Math.min(props.songs.length, startIndex.value + Math.ceil(props.height / props.rowHeight) + 8)
  : props.songs.length)

/** 当前需要渲染的歌曲窗口。 */
const visibleSongs = computed<Array<{ song: StandardSong; index: number }>>(() => {
  return props.songs.slice(startIndex.value, endIndex.value).map((song, offset) => ({
    song,
    index: startIndex.value + offset
  }))
})

/** 虚拟列表完整内容高度。 */
const contentHeight = computed<number>(() => props.songs.length * props.rowHeight)

/** 可视窗口顶部位移。 */
const windowOffset = computed<number>(() => startIndex.value * props.rowHeight)

// ========= 函数 =========

/** 同步列表滚动位置。 */
function handleScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}
</script>

<template>
  <div
    class="virtual-track-list"
    :style="{ height: `${Math.min(props.height, contentHeight || props.height)}px` }"
    role="list"
    tabindex="0"
    @scroll="handleScroll"
  >
    <div class="virtual-track-list-space" :style="{ height: `${contentHeight}px` }">
      <div class="virtual-track-list-window" :style="{ transform: `translateY(${windowOffset}px)` }">
        <TrackRow
          v-for="item in visibleSongs"
          :key="`${item.song.id}-${item.index}`"
          :song="item.song"
          :index="item.index"
          :active="item.song.id === props.activeTrackId"
          :show-artwork="props.showArtwork"
          @play="emit('play', $event)"
          @enqueue="emit('enqueue', $event)"
          @play-next="emit('play-next', $event)"
          @like="emit('like', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-track-list {
  min-height: 120px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.virtual-track-list-space {
  position: relative;
}

.virtual-track-list-window {
  position: absolute;
  inset: 0 0 auto;
}
</style>
