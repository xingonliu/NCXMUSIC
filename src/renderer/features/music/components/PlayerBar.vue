<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────────────
// PlayerBar：播放控制条
//
// 只订阅 snapshot 并发送命令，不拥有播放引擎，也不猜测播放状态。
// 所有按钮可用性由 snapshot 推导，不做本地乐观更新。
// ─────────────────────────────────────────────────────────────────────────────

import { computed } from 'vue'

import type { PlayMode } from '../../../../domains/player/types'
import { zhCN } from '../../../locales/zh-CN'
import { usePlayer } from '../use-player'

// ========= 变量 =========

const player = usePlayer()
const snapshot = player.snapshot
const notice = player.notice
const text = zhCN.player

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

// ======== 函数 ======

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

/** 拖动进度条：直接投递 seek 命令，不本地改状态 */
function onSeek(event: Event): void {
  const target = event.target as HTMLInputElement
  player.seek(Number(target.value))
}

/** 调整音量 */
function onVolume(event: Event): void {
  const target = event.target as HTMLInputElement
  player.setVolume(Number(target.value) / 100)
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
    <div class="player-transport">
      <button
        type="button"
        class="player-button"
        :disabled="!hasQueue"
        :aria-label="text.previous"
        @click="player.previous()"
      >
        ⏮
      </button>
      <button
        type="button"
        class="player-button player-button-primary"
        :disabled="!track"
        :aria-label="showPause ? text.pause : text.play"
        @click="player.toggle()"
      >
        <span
          v-if="busy"
          class="player-busy"
          aria-hidden="true"
        >⋯</span>
        <span v-else>{{ showPause ? '⏸' : '▶' }}</span>
      </button>
      <button
        type="button"
        class="player-button"
        :disabled="!hasQueue"
        :aria-label="text.next"
        @click="player.next()"
      >
        ⏭
      </button>
      <button
        type="button"
        class="player-button"
        :aria-label="text.mode[snapshot.queue.mode]"
        :title="text.mode[snapshot.queue.mode]"
        @click="player.setMode(nextMode)"
      >
        {{ snapshot.queue.mode === 'shuffle' ? '🔀' : snapshot.queue.mode === 'loop-one' ? '🔂' : '🔁' }}
      </button>
    </div>

    <!-- 进度 -->
    <div class="player-progress">
      <span class="player-time">{{ formatTime(snapshot.playback.positionMs) }}</span>
      <input
        class="player-slider"
        type="range"
        min="0"
        :max="durationMs"
        :value="snapshot.playback.positionMs"
        :disabled="!track"
        :aria-label="text.progress"
        @change="onSeek"
      >
      <span class="player-time">{{ formatTime(durationMs) }}</span>
    </div>

    <!-- 音量与状态 -->
    <div class="player-output">
      <button
        type="button"
        class="player-button"
        :aria-label="snapshot.playback.muted ? text.unmute : text.mute"
        @click="player.setMuted(!snapshot.playback.muted)"
      >
        {{ snapshot.playback.muted ? '🔇' : '🔊' }}
      </button>
      <input
        class="player-slider player-slider-volume"
        type="range"
        min="0"
        max="100"
        :value="Math.round(snapshot.playback.volume * 100)"
        :aria-label="text.volume"
        @input="onVolume"
      >
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
      <button
        type="button"
        class="player-notice-close"
        :aria-label="text.dismiss"
        @click="player.dismissNotice()"
      >
        ✕
      </button>
    </p>
  </footer>
</template>

<style scoped>
.player-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 2fr) auto;
  gap: 16px;
  align-items: center;
  padding: 12px 20px;
  border-top: var(--ncx-glass-liquid-border);
  background: var(--ncx-glass-liquid-shine), var(--ncx-color-surface-raised, rgb(20 20 24 / 85%));
  backdrop-filter: var(--ncx-glass-backdrop-deep);
  box-shadow: var(--ncx-glass-specular-light);
}

.player-track {
  min-width: 0;
}

.player-track-name {
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-track-meta {
  display: flex;
  gap: 8px;
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 12px;
  color: var(--ncx-text-muted, rgb(255 255 255 / 60%));
  white-space: nowrap;
}

.player-quality {
  padding: 0 6px;
  border: 1px solid currentcolor;
  border-radius: 3px;
  font-size: 10px;
  line-height: 16px;
}

.player-transport {
  display: flex;
  gap: 4px;
  align-items: center;
}

.player-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
}

.player-button:hover:not(:disabled) {
  background: var(--ncx-surface-hover, rgb(255 255 255 / 10%));
}

.player-button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.player-button-primary {
  width: 36px;
  height: 36px;
  background: var(--ncx-accent, rgb(255 255 255 / 16%));
}

.player-busy {
  animation: player-pulse 1s ease-in-out infinite;
}

.player-progress,
.player-output {
  display: flex;
  gap: 8px;
  align-items: center;
}

.player-time,
.player-status {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ncx-text-muted, rgb(255 255 255 / 60%));
}

.player-slider {
  flex: 1;
  min-width: 0;
  accent-color: var(--ncx-accent-strong, rgb(255 255 255 / 80%));
}

.player-slider-volume {
  flex: none;
  width: 72px;
}

.player-notice {
  display: flex;
  grid-column: 1 / -1;
  gap: 8px;
  align-items: center;
  margin: 0;
  font-size: 12px;
  color: var(--ncx-text-warning, rgb(255 196 120));
}

.player-notice-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

@keyframes player-pulse {
  50% {
    opacity: 0.4;
  }
}
</style>
