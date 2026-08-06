<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────────────
// PlayerBar：播放控制条
//
// 只订阅 snapshot 并发送命令，不拥有播放引擎，也不猜测播放状态。
// 所有按钮可用性由 snapshot 推导，不做本地乐观更新。
// 所有交互按钮统一基于通用组件 CommonIconButton 渲染。
// ─────────────────────────────────────────────────────────────────────────────

import {
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X
} from '@lucide/vue'
import { computed, ref } from 'vue'

import type { PlayMode } from '../../../../domains/player/types'
import {
  CommonButtonGroup,
  CommonIconButton,
  CommonProgress,
  CommonSlider,
  CommonSpinner
} from '../../../design-system/components'
import { zhCN } from '../../../locales/zh-CN'
import { usePlayer } from '../use-player'
import QueueDrawer from './QueueDrawer.vue'

// ========= 变量 =========

/** 播放器组合式接口，只发送命令并读取快照。 */
const player = usePlayer()

/** 播放器只读快照引用。 */
const snapshot = player.snapshot

/** 当前播放域轻提示文案。 */
const notice = player.notice

/** PlayerBar 本地化文案集合。 */
const text = zhCN.player

/** 播放队列抽屉开闭状态。 */
const isQueueOpen = ref<boolean>(false)

/** 当前曲目摘要 */
const track = computed(() => snapshot.value.playback.track)

/** 队列中是否有内容可操作 */
const hasQueue = computed(() => snapshot.value.queue.items.length > 0)

/** 是否正在装载或缓冲 */
const busy = computed(() => {
  const status = snapshot.value.playback.status
  return status === 'loading' || status === 'buffering'
})

/** 播放按钮显示为暂停图标的条件：意图是播放 */
const showPause = computed(() => snapshot.value.playback.intent === 'play')

/** 进度条最大值；时长未知时用当前位置兜底，避免滑块跳动 */
const durationMs = computed(
  () => snapshot.value.playback.durationMs ?? snapshot.value.playback.positionMs
)

/** 当前播放进度百分比，供通用 Progress 组件展示。 */
const progressPercent = computed(() => {
  if (durationMs.value <= 0) return 0
  return Math.min(100, Math.max(0, (snapshot.value.playback.positionMs / durationMs.value) * 100))
})

/** 状态文案 */
const statusLabel = computed(() => text.status[snapshot.value.playback.status])

/** 音质标签；降级时追加提示 */
const qualityLabel = computed(() => {
  const playback = snapshot.value.playback
  if (!playback.actualQuality) return null
  const name = text.quality[playback.actualQuality]
  return playback.downgraded ? `${name}${text.downgradedSuffix}` : name
})

/** 播放模式循环顺序 */
const MODE_CYCLE: PlayMode[] = ['loop', 'loop-one', 'shuffle']

/** 下一个播放模式 */
const nextMode = computed<PlayMode>(() => {
  const current = snapshot.value.queue.mode
  const index = MODE_CYCLE.indexOf(current)
  return MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? 'loop'
})

// ========= 函数 =========

/**
 * 把毫秒格式化为 m:ss。
 *
 * @param value 毫秒数；非有限值按 0 处理
 */
function formatTime(value: number): string {
  const totalSeconds = Number.isFinite(value) ? Math.max(0, Math.floor(value / 1000)) : 0
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** 调整音量。 */
function onVolume(value: number): void {
  player.setVolume(value / 100)
}

/** 切换播放队列抽屉显隐。 */
function toggleQueueDrawer(): void {
  isQueueOpen.value = !isQueueOpen.value
}
</script>

<template>
  <footer
    class="player-bar"
    :aria-label="text.regionLabel"
  >
    <!-- 曲目信息 -->
    <div class="player-track">
      <p class="player-track-name">
        {{ track?.name ?? text.emptyTrack }}
      </p>
      <p class="player-track-meta">
        <span v-if="track">{{ track.artists.join(' / ') }}</span>
        <span
          v-if="qualityLabel"
          class="player-quality"
        >{{ qualityLabel }}</span>
      </p>
    </div>

    <!-- 传输控制 -->
    <CommonButtonGroup
      class="player-transport"
      variant="segmented"
    >
      <CommonIconButton
        size="default"
        variant="ghost"
        :disabled="!hasQueue"
        :label="text.previous"
        @click="player.previous()"
      >
        <SkipBack :size="15" />
      </CommonIconButton>
      <CommonIconButton
        size="prominent"
        variant="primary"
        :disabled="!track"
        :label="showPause ? text.pause : text.play"
        @click="player.toggle()"
      >
        <CommonSpinner
          v-if="busy"
          size="compact"
          class="player-busy"
        />
        <Pause
          v-else-if="showPause"
          :size="17"
          fill="currentColor"
        />
        <Play
          v-else
          :size="17"
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
        <SkipForward :size="15" />
      </CommonIconButton>
      <CommonIconButton
        size="default"
        variant="ghost"
        :label="text.mode[snapshot.queue.mode]"
        @click="player.setMode(nextMode)"
      >
        <Shuffle
          v-if="snapshot.queue.mode === 'shuffle'"
          :size="15"
        />
        <Repeat1
          v-else-if="snapshot.queue.mode === 'loop-one'"
          :size="15"
        />
        <Repeat
          v-else
          :size="15"
        />
      </CommonIconButton>
    </CommonButtonGroup>

    <!-- 进度 -->
    <div class="player-progress">
      <span class="player-time">{{ formatTime(snapshot.playback.positionMs) }}</span>
      <div class="player-progress-control">
        <CommonProgress
          v-if="busy"
          class="player-progress-loading"
          indeterminate
          size="compact"
          :label="statusLabel"
        />
        <CommonProgress
          v-else
          class="player-progress-bar"
          :value="progressPercent"
          :label="text.progress"
          size="compact"
        />
      </div>
      <span class="player-time">{{ formatTime(durationMs) }}</span>
    </div>

    <!-- 音量与状态控制 -->
    <div class="player-output">
      <CommonIconButton
        size="default"
        variant="ghost"
        :label="snapshot.playback.muted ? text.unmute : text.mute"
        @click="player.setMuted(!snapshot.playback.muted)"
      >
        <VolumeX
          v-if="snapshot.playback.muted"
          :size="15"
        />
        <Volume2
          v-else
          :size="15"
        />
      </CommonIconButton>
      <CommonSlider
        class="player-slider player-slider-volume"
        :model-value="Math.round(snapshot.playback.volume * 100)"
        :min="0"
        :max="100"
        size="compact"
        :show-value="false"
        @update:model-value="onVolume"
      />
      <!-- 音乐队列按钮 -->
      <CommonIconButton
        size="default"
        variant="ghost"
        :selected="isQueueOpen"
        :label="text.queue"
        @click="toggleQueueDrawer"
      >
        <ListMusic :size="15" />
      </CommonIconButton>
      <span
        class="player-status"
        role="status"
      >{{ statusLabel }}</span>
    </div>

    <!-- 不可播放提示：由 Coordinator 的 track-unplayable 事件驱动 -->
    <p
      v-if="notice"
      class="player-notice"
      role="alert"
    >
      {{ notice }}
      <CommonIconButton
        class="player-notice-close"
        size="compact"
        variant="ghost"
        :label="text.dismiss"
        @click="player.dismissNotice()"
      >
        <X :size="13" />
      </CommonIconButton>
    </p>

    <!-- 播放队列抽屉 -->
    <QueueDrawer
      :visible="isQueueOpen"
      @close="isQueueOpen = false"
    />
  </footer>
</template>

<style scoped>
.player-bar {
  --ncx-player-bar-glass-fill: color-mix(in srgb, var(--ncx-color-surface-overlay) 76%, transparent);
  --ncx-player-bar-glass-edge: color-mix(in srgb, white 62%, transparent);
  --ncx-player-bar-glass-stroke: color-mix(in srgb, var(--ncx-color-text-primary) 9%, transparent);
  --ncx-player-bar-glass-shadow: 0 16px 40px rgb(20 20 24 / 14%),
    0 6px 16px rgb(20 20 24 / 6%), inset 0 1px 0 rgb(255 255 255 / 65%);
  --ncx-player-bar-track-bg: color-mix(in srgb, var(--ncx-color-text-primary) 13%, transparent);
  --ncx-player-bar-thumb-shadow: 0 2px 6px rgb(20 20 24 / 18%);

  position: fixed;
  z-index: var(--ncx-layer-player);
  bottom: 16px;
  left: calc(230px + ((100vw - 230px) / 2));
  display: grid;
  width: min(840px, calc(100vw - 290px));
  min-height: 66px;
  grid-template-columns: minmax(140px, 1.2fr) auto minmax(200px, 1.8fr) minmax(190px, auto);
  gap: var(--ncx-space-3, 12px);
  align-items: center;
  padding: 10px 16px;
  border: 1px solid var(--ncx-player-bar-glass-stroke);
  border-radius: var(--ncx-radius-full);
  color: var(--ncx-color-text-primary);
  background:
    radial-gradient(circle at 15% 8%, rgb(255 255 255 / 46%), transparent 28%),
    radial-gradient(circle at 86% 18%, rgb(255 255 255 / 30%), transparent 34%),
    linear-gradient(135deg, var(--ncx-player-bar-glass-edge), transparent 38%),
    var(--ncx-player-bar-glass-fill);
  box-shadow: var(--ncx-player-bar-glass-shadow);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  isolation: isolate;
  overflow: hidden;
  transform: translateX(-50%);
  -webkit-app-region: no-drag;
}

.player-bar::before,
.player-bar::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  content: '';
  pointer-events: none;
}

.player-bar::before {
  z-index: -1;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 34%) 0%, transparent 42%),
    linear-gradient(90deg, transparent 0%, rgb(255 255 255 / 20%) 48%, transparent 100%);
  mask-image: linear-gradient(180deg, black 0%, transparent 70%);
}

.player-bar::after {
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 28%),
    inset 0 -1px 0 rgb(0 0 0 / 5%);
}

.player-track {
  min-width: 0;
}

.player-track-name {
  margin: 0;
  overflow: hidden;
  color: var(--ncx-color-text-primary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-track-meta {
  display: flex;
  gap: 6px;
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 11px;
  color: var(--ncx-color-text-secondary);
  line-height: 16px;
  white-space: nowrap;
}

.player-quality {
  flex: none;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--ncx-color-accent) 18%, transparent);
  border-radius: var(--ncx-radius-full);
  color: var(--ncx-color-accent);
  background: color-mix(in srgb, var(--ncx-color-accent) 12%, transparent);
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.player-transport {
  display: flex;
  gap: 2px;
  align-items: center;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent);
  border-radius: var(--ncx-radius-full);
  background: color-mix(in srgb, white 24%, transparent);
}

.player-busy {
  animation: player-pulse 1s ease-in-out infinite;
}

.player-progress,
.player-output {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.player-progress-control {
  flex: 1;
  min-width: 0;
}

.player-time,
.player-status {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ncx-color-text-secondary);
}

.player-time {
  min-width: 32px;
  text-align: center;
}

.player-status {
  min-width: 38px;
  text-align: right;
  font-size: 10px;
}

.player-slider {
  flex: 1;
  min-width: 0;
}

.player-slider-volume {
  flex: none;
  width: 72px;
  min-width: 0;
}

.player-slider :deep(.ncx-common-slider-track-container),
.player-progress-bar :deep(.ncx-common-progress-track),
.player-progress-loading :deep(.ncx-common-progress-track) {
  filter: none;
}

.player-slider :deep(.ncx-common-slider-rail),
.player-progress-bar :deep(.ncx-common-progress-track),
.player-progress-loading :deep(.ncx-common-progress-track) {
  background: var(--ncx-player-bar-track-bg);
  box-shadow: inset 0 1px 1px rgb(0 0 0 / 8%);
}

.player-slider :deep(.ncx-common-slider-fill),
.player-progress-bar :deep(.ncx-common-progress-bar),
.player-progress-loading :deep(.ncx-common-progress-bar) {
  background: color-mix(in srgb, var(--ncx-color-accent) 78%, white 10%);
}

.player-slider :deep(.ncx-common-slider-thumb) {
  width: 12px;
  height: 12px;
  background: color-mix(in srgb, var(--ncx-color-accent) 92%, white 8%);
  box-shadow: var(--ncx-player-bar-thumb-shadow);
}

.player-notice {
  display: flex;
  grid-column: 1 / -1;
  gap: 8px;
  align-items: center;
  margin: -2px 2px 0;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--ncx-color-warning) 22%, transparent);
  border-radius: var(--ncx-radius-full);
  background: color-mix(in srgb, var(--ncx-color-warning) 10%, transparent);
  font-size: 12px;
  color: var(--ncx-color-warning);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .player-bar {
    background: var(--ncx-color-surface-overlay);
  }
}

@media (prefers-color-scheme: dark) {
  .player-bar {
    --ncx-player-bar-glass-fill: color-mix(in srgb, var(--ncx-color-surface-overlay) 70%, transparent);
    --ncx-player-bar-glass-edge: color-mix(in srgb, white 16%, transparent);
    --ncx-player-bar-glass-stroke: color-mix(in srgb, white 14%, transparent);
    --ncx-player-bar-glass-shadow: 0 20px 48px rgb(0 0 0 / 40%),
      0 6px 20px rgb(0 0 0 / 28%), inset 0 1px 0 rgb(255 255 255 / 12%);
    --ncx-player-bar-track-bg: color-mix(in srgb, white 16%, transparent);
  }

  .player-transport {
    background: color-mix(in srgb, white 8%, transparent);
  }
}

@media (width < 1100px) {
  .player-bar {
    bottom: 14px;
    width: calc(100vw - 280px);
    grid-template-columns: minmax(120px, 1fr) auto minmax(160px, 1.4fr);
    gap: var(--ncx-space-2, 8px);
    padding-inline: 12px;
  }

  .player-output {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .player-busy {
    animation: none;
  }
}

@keyframes player-pulse {
  50% {
    opacity: 0.4;
  }
}
</style>
