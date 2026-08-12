<script setup lang="ts">
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from '@lucide/vue'
import { computed } from 'vue'

import type {
  MusicQualityPreference,
  PlayMode
} from '../../../../domains/player/types'
import {
  CommonIconButton,
  CommonSelect,
  CommonSlider,
  CommonSpinner,
  type CommonOption
} from '../../../design-system/components'
import { zhCN } from '../../../locales/zh-CN'
import { usePlayer } from '../use-player'
import MusicProgressBar from './MusicProgressBar.vue'

// ========= 属性 =========

/** 播放控制组件属性。 */
const props = withDefaults(defineProps<{
  /** 是否采用大尺寸播放详情样式。 */
  prominent?: boolean
  /** 是否采用沉浸播放页的深色紧凑布局。 */
  immersive?: boolean
}>(), {
  prominent: false,
  immersive: false
})

// ========= 变量 =========

/** 播放器组合式接口。 */
const player = usePlayer()

/** 播放器只读快照。 */
const snapshot = player.snapshot

/** 本地化文案集合。 */
const text = zhCN.player

/** 当前是否有曲目可控制。 */
const hasTrack = computed<boolean>(() => snapshot.value.playback.track !== null)

/** 当前曲目 ID，用于切歌时重建并清理进度条的 Pointer 状态。 */
const currentTrackId = computed<string>(() => {
  return snapshot.value.playback.track?.trackId ?? 'empty-playback-progress'
})

/** 队列中是否有可切换内容。 */
const hasQueue = computed<boolean>(() => snapshot.value.queue.items.length > 0)

/** 是否正在加载或缓冲。 */
const busy = computed<boolean>(() => {
  const status = snapshot.value.playback.status
  return status === 'loading' || status === 'buffering'
})

/** 播放按钮是否展示暂停图标。 */
const showPause = computed<boolean>(() => snapshot.value.playback.intent === 'play')

/** 当前播放进度最大值。 */
const durationMs = computed<number>(() => {
  return snapshot.value.playback.durationMs ?? snapshot.value.playback.track?.durationMs ?? 0
})

/** 当前曲目是否已经具备可映射点击百分比的有效时长。 */
const canSeek = computed<boolean>(() => {
  return hasTrack.value && Number.isFinite(durationMs.value) && durationMs.value > 0
})

/** 播放模式循环顺序。 */
const MODE_CYCLE: PlayMode[] = ['loop', 'loop-one', 'shuffle']

/** 下一个播放模式。 */
const nextMode = computed<PlayMode>(() => {
  const index = MODE_CYCLE.indexOf(snapshot.value.queue.mode)
  return MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? 'loop'
})

/** 可选择的音质偏好。 */
const qualityOptions: CommonOption[] = [
  { label: '自动（最高可用）', value: 'auto' },
  { label: text.quality.standard, value: 'standard' },
  { label: text.quality.higher, value: 'higher' },
  { label: text.quality.exhigh, value: 'exhigh' },
  { label: text.quality.lossless, value: 'lossless' },
  { label: text.quality.hires, value: 'hires' },
  { label: text.quality.jyeffect, value: 'jyeffect' },
  { label: text.quality.sky, value: 'sky' },
  { label: text.quality.dolby, value: 'dolby' },
  { label: text.quality.jymaster, value: 'jymaster' }
]

// ========= 函数 =========

/**
 * 把毫秒格式化为 m:ss。
 *
 * @param value 毫秒数
 */
function formatTime(value: number): string {
  const totalSeconds = Number.isFinite(value) ? Math.max(0, Math.floor(value / 1000)) : 0
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** 调整播放进度。 */
function handleSeek(value: number): void {
  player.seek(value)
}

/** 调整音量。 */
function handleVolume(value: number): void {
  player.setVolume(value / 100)
}

/** 调整全局音质偏好。 */
function handleQuality(value: string | number): void {
  void player.setQuality(String(value) as MusicQualityPreference)
}
</script>

<template>
  <section
    class="playback-controls"
    :class="{
      'playback-controls--prominent': props.prominent,
      'playback-controls--immersive': props.immersive
    }"
    aria-label="播放控制"
  >
    <div class="playback-controls-transport">
      <CommonIconButton
        size="default"
        variant="ghost"
        :label="text.mode[snapshot.queue.mode]"
        @click="player.setMode(nextMode)"
      >
        <Shuffle
          v-if="snapshot.queue.mode === 'shuffle'"
          :size="17"
        />
        <Repeat1
          v-else-if="snapshot.queue.mode === 'loop-one'"
          :size="17"
        />
        <Repeat
          v-else
          :size="17"
        />
      </CommonIconButton>

      <CommonIconButton
        size="default"
        variant="ghost"
        :disabled="!hasQueue"
        :label="text.previous"
        @click="player.previous()"
      >
        <SkipBack :size="18" />
      </CommonIconButton>

      <CommonIconButton
        :size="props.prominent ? 'prominent' : 'default'"
        :variant="props.immersive ? 'ghost' : 'primary'"
        :disabled="!hasTrack"
        :label="showPause ? text.pause : text.play"
        @click="player.toggle()"
      >
        <CommonSpinner
          v-if="busy"
          size="compact"
        />
        <Pause
          v-else-if="showPause"
          :size="18"
          fill="currentColor"
        />
        <Play
          v-else
          :size="18"
          fill="currentColor"
        />
      </CommonIconButton>

      <CommonIconButton
        size="default"
        variant="ghost"
        :disabled="!hasQueue"
        :label="text.next"
        @click="player.next()"
      >
        <SkipForward :size="18" />
      </CommonIconButton>
    </div>

    <div class="playback-controls-progress">
      <span>{{ formatTime(snapshot.playback.positionMs) }}</span>
      <MusicProgressBar
        :key="currentTrackId"
        class="playback-controls-slider"
        :model-value="snapshot.playback.positionMs"
        :min="0"
        :max="Math.max(durationMs, 1)"
        :step="1000"
        :disabled="!canSeek"
        :busy="busy"
        @change="handleSeek"
      />
      <span>{{ formatTime(durationMs) }}</span>
    </div>

    <div
      v-if="!props.immersive"
      class="playback-controls-output"
    >
      <CommonIconButton
        size="default"
        variant="ghost"
        :label="snapshot.playback.muted ? text.unmute : text.mute"
        @click="player.setMuted(!snapshot.playback.muted)"
      >
        <VolumeX
          v-if="snapshot.playback.muted"
          :size="16"
        />
        <Volume2
          v-else
          :size="16"
        />
      </CommonIconButton>
      <CommonSlider
        class="playback-controls-volume"
        :model-value="Math.round(snapshot.playback.volume * 100)"
        :min="0"
        :max="100"
        :show-value="false"
        label="音量"
        @update:model-value="handleVolume"
      />
      <CommonSelect
        class="playback-controls-quality"
        :model-value="snapshot.quality"
        :options="qualityOptions"
        size="compact"
        @update:model-value="handleQuality"
      />
    </div>
  </section>
</template>

<style scoped>
.playback-controls {
  display: grid;
  gap: var(--ncx-space-4);
}

.playback-controls-transport,
.playback-controls-output,
.playback-controls-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ncx-space-3);
}

.playback-controls-progress span {
  min-width: 44px;
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.playback-controls-slider {
  width: min(520px, 100%);
}

.playback-controls-volume {
  width: 104px;
}

.playback-controls-quality {
  width: 168px;
}

.playback-controls--prominent {
  gap: var(--ncx-space-5);
}

.playback-controls--immersive {
  gap: var(--ncx-space-3);
  color: white;
}

.playback-controls--immersive .playback-controls-progress {
  order: -1;
}

.playback-controls--immersive .playback-controls-transport {
  justify-content: space-between;
  padding: 0 4px;
}

.playback-controls--immersive .playback-controls-progress span {
  color: rgb(255 255 255 / 62%);
}

.playback-controls--immersive :deep(.ncx-common-icon-button) {
  color: white;
}

.playback-controls--immersive :deep(.ncx-common-slider-rail) {
  background: rgb(255 255 255 / 24%);
}

.playback-controls--immersive :deep(.ncx-common-slider-fill),
.playback-controls--immersive :deep(.ncx-common-slider-thumb) {
  background: white;
}
</style>
