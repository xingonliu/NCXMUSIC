<script setup lang="ts">
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

</script>

<template>
  <div
    class="virtual-track-list"
    role="list"
    tabindex="0"
  >
    <TrackRow
      v-for="(song, index) in props.songs"
      :key="`${song.id}-${index}`"
      :song="song"
      :index="index"
      :active="song.id === props.activeTrackId"
      :show-artwork="props.showArtwork"
      @play="emit('play', $event)"
      @enqueue="emit('enqueue', $event)"
      @play-next="emit('play-next', $event)"
      @like="emit('like', $event)"
    />
  </div>
</template>

<style scoped>
.virtual-track-list {
  min-height: 120px;
  display: grid;
  gap: 2px;
}
</style>
