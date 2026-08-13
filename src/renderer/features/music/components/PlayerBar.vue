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
  VolumeX
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { PlayMode } from '../../../../domains/player/types'
import {
  CommonIconButton,
  CommonSlider,
  CommonSpinner,
  CommonToast
} from '../../../design-system/components'
import LiquidGlass from '../../../design-system/components/LiquidGlass.vue'
import { zhCN } from '../../../locales/zh-CN'
import { useImmersivePlayerPresentation } from '../immersive-player-presentation'
import { adaptArtworkUrl } from '../music-entity'
import { usePlayer } from '../use-player'
import MediaArtwork from './MediaArtwork.vue'
import MusicProgressBar from './MusicProgressBar.vue'
import QueueDrawer from './QueueDrawer.vue'

// ========= 变量 =========

/** 当前路由对象，用于监听当前所属页面。 */
const route = useRoute()

/** 播放器组合式接口，只发送命令并读取快照。 */
const player = usePlayer()

/** 应用级沉浸播放展示控制器。 */
const immersivePlayer = useImmersivePlayerPresentation()

/** 沉浸播放展示层是否已打开。 */
const isImmersivePlayerOpen = immersivePlayer.isOpen

/** 播放器只读快照引用。 */
const snapshot = player.snapshot

/** 当前播放域轻提示文案。 */
const notice = player.notice

/** PlayerBar 本地化文案集合。 */
const text = zhCN.player

/** 播放队列抽屉开闭状态。 */
const isQueueOpen = ref<boolean>(false)

/** 是否处于小云 (AI 助手) 页面。 */
const isAgentPage = computed<boolean>(() => route.name === 'agent')

/** PlayerBar 外层 Glass 容器的响应式定位与尺寸样式。 */
const playerBarStyle = computed(() => {
  if (isAgentPage.value) {
    return {
      position: 'fixed',
      bottom: '18px',
      right: '28px',
      left: 'auto',
      transform: 'none',
      width: '56px',
      height: '56px',
      zIndex: 'var(--ncx-layer-player)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }

  return {
    position: 'fixed',
    bottom: '18px',
    left: 'calc(230px + ((100vw - 230px) / 2))',
    right: 'auto',
    transform: 'translateX(-50%)',
    width: 'min(860px, calc(100vw - 288px))',
    height: 'auto',
    zIndex: 'var(--ncx-layer-player)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }
})

/** 当前曲目摘要 */
const track = computed(() => snapshot.value.playback.track)

/** 当前曲目封面 URL，直接使用高清封面（与沉浸歌词页一致）。 */
const coverUrl = computed<string | undefined>(() => track.value?.artwork?.at(-1)?.src ?? track.value?.artwork?.[0]?.src)

/** 队列中是否有内容可操作 */
const hasQueue = computed(() => snapshot.value.queue.items.length > 0)

/** 是否正在装载或缓冲 */
const busy = computed(() => {
  const status = snapshot.value.playback.status
  return status === 'loading' || status === 'buffering'
})

/** 播放按钮显示为暂停图标的条件：意图是播放 */
const showPause = computed(() => snapshot.value.playback.intent === 'play')

/** 进度条最大值；未知时长不能用当前位置冒充总时长。 */
const durationMs = computed<number>(() => {
  return snapshot.value.playback.durationMs ?? track.value?.durationMs ?? 0
})

/** 当前曲目是否已经具备可映射点击百分比的有效时长。 */
const canSeek = computed<boolean>(() => {
  return Boolean(track.value) && Number.isFinite(durationMs.value) && durationMs.value > 0
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

/** 调整播放进度。 */
function onSeek(value: number): void {
  player.seek(value)
}

/** 切换播放队列抽屉显隐。 */
function toggleQueueDrawer(): void {
  isQueueOpen.value = !isQueueOpen.value
}

/**
 * 从 PlayerBar 封面打开沉浸播放展示层。
 *
 * @param event 封面按钮点击事件
 */
function openImmersivePlayer(event: MouseEvent): void {
  if (!track.value) return
  /** 沉浸页需要预热的高清封面地址。 */
  const heroArtworkUrl = adaptArtworkUrl(coverUrl.value, 'hero')
  /** 关闭展示层后需要恢复焦点的封面按钮。 */
  const trigger = event.currentTarget as HTMLElement | null
  void immersivePlayer.open(heroArtworkUrl, trigger)
}
</script>

<template>
  <div
    class="player-bar-root"
    :inert="isImmersivePlayerOpen"
    :aria-hidden="isImmersivePlayerOpen ? 'true' : undefined"
  >
    <LiquidGlass
      container-class="player-bar-glass"
      role="contentinfo"
      :aria-label="text.regionLabel"
      :radius="28"
      :border="0.07"
      :displace="0.05"
      :scale="-150"
      :r-offset="0"
      :g-offset="5"
      :b-offset="8"
      :blur="10"
      :frost="0.52"
      :lightness="72"
      :alpha="0.9"
      :style="playerBarStyle"
    >
      <div
        class="player-bar-content"
        :class="{ 'is-compact': isAgentPage }"
      >
        <!-- 曲目信息 -->
        <div
          class="player-track"
          :class="{ 'is-compact': isAgentPage }"
        >
          <button
            class="player-track-cover-button"
            type="button"
            :disabled="!track"
            :aria-label="track ? `展开《${track.name}》沉浸播放页` : text.emptyTrack"
            @click="openImmersivePlayer"
          >
            <MediaArtwork
              :src="coverUrl"
              :alt="track?.name ?? text.emptyTrack"
              size="thumbnail"
              :adapt-source="false"
              class="player-track-cover"
              :style="{
                viewTransitionName: isImmersivePlayerOpen ? 'none' : 'ncx-now-playing-artwork'
              }"
            />
          </button>
          <div
            v-if="!isAgentPage"
            class="player-track-info"
          >
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
        </div>

        <!-- 传输控制区域：小云页隐藏 -->
        <div
          v-if="!isAgentPage"
          class="player-transport"
          role="group"
          :aria-label="text.regionLabel"
        >
          <CommonIconButton
            size="default"
            variant="ghost"
            tooltip-placement="right"
            :label="text.mode[snapshot.queue.mode]"
            @click="player.setMode(nextMode)"
          >
            <Shuffle
              v-if="snapshot.queue.mode === 'shuffle'"
              :size="16"
            />
            <Repeat1
              v-else-if="snapshot.queue.mode === 'loop-one'"
              :size="16"
            />
            <Repeat
              v-else
              :size="16"
            />
          </CommonIconButton>
          <CommonIconButton
            size="default"
            variant="ghost"
            tooltip-placement="right"
            :disabled="!hasQueue"
            :label="text.previous"
            @click="player.previous()"
          >
            <SkipBack :size="16" />
          </CommonIconButton>
          <CommonIconButton
            size="prominent"
            variant="primary"
            tooltip-placement="left"
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
            tooltip-placement="left"
            :disabled="!hasQueue"
            :label="text.next"
            @click="player.next()"
          >
            <SkipForward :size="16" />
          </CommonIconButton>
        </div>

        <!-- 进度：小云页隐藏 -->
        <div
          v-if="!isAgentPage"
          class="player-progress"
        >
          <span class="player-time">{{ formatTime(snapshot.playback.positionMs) }}</span>
          <div class="player-progress-control">
            <MusicProgressBar
              :key="track?.trackId ?? 'empty-player-progress'"
              class="player-slider player-slider-progress"
              :model-value="snapshot.playback.positionMs"
              :min="0"
              :max="Math.max(durationMs, 1)"
              :step="1000"
              :disabled="!canSeek"
              :busy="busy"
              :label="statusLabel"
              @change="onSeek"
            />
          </div>
          <span class="player-time">{{ formatTime(durationMs) }}</span>
        </div>

        <!-- 音量与状态控制：小云页隐藏 -->
        <div
          v-if="!isAgentPage"
          class="player-output"
        >
          <CommonIconButton
            size="default"
            variant="ghost"
            tooltip-placement="left"
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
            tooltip-placement="left"
            :selected="isQueueOpen"
            :label="text.queue"
            @click="toggleQueueDrawer"
          >
            <ListMusic :size="15" />
          </CommonIconButton>
        </div>
      </div>
    </LiquidGlass>

    <!-- 不可播放等音乐控制 bar 提示：使用 CommonToast 替代内联消息 -->
    <CommonToast
      :visible="!!notice"
      type="warning"
      :title="text.noticeTitle"
      :message="notice ?? ''"
      :duration="4000"
      @close="player.dismissNotice()"
    />

    <!-- 播放队列抽屉不放入玻璃材质，避免受其尺寸和层叠上下文影响。 -->
    <QueueDrawer
      :visible="isQueueOpen"
      @close="isQueueOpen = false"
    />
  </div>
</template>

<style scoped>
.player-bar-glass {
  --ncx-player-bar-track-bg: color-mix(in srgb, var(--ncx-color-text-primary) 11%, transparent);
  --ncx-player-bar-thumb-shadow:
    0 2px 8px rgb(20 20 24 / 18%),
    0 0 0 3px rgb(255 255 255 / 42%);
  --ncx-player-bar-shadow:
    0 0 2px 1px rgb(255 255 255 / 88%) inset,
    0 0 10px 4px rgb(255 255 255 / 58%) inset,
    0 6px 18px rgb(35 38 45 / 12%),
    0 4px 16px rgb(255 255 255 / 42%) inset,
    0 8px 24px rgb(255 255 255 / 24%) inset;

  color: var(--ncx-color-text-primary);
  isolation: isolate;
  -webkit-app-region: no-drag;
}

:deep(.player-bar-glass.effect),
.player-bar-glass {
  box-shadow: var(--ncx-player-bar-shadow) !important;
}

.player-bar-content {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 54px;
  padding: 8px 18px;
  box-sizing: border-box;
  grid-template-areas: "track transport progress output";
  grid-template-columns: minmax(170px, 1.15fr) auto minmax(190px, 1.45fr) minmax(164px, 0.9fr);
  column-gap: var(--ncx-space-4, 16px);
  row-gap: 0;
  align-items: center;
  transition: padding 0.3s ease;
}

.player-bar-content.is-compact {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  min-height: 56px;
  height: 56px;
  grid-template-areas: none;
  grid-template-columns: none;
}

.player-track {
  display: flex;
  min-height: 40px;
  flex-direction: row;
  align-items: center;
  gap: var(--ncx-space-2-5, 10px);
  grid-area: track;
  min-width: 0;
}

.player-track.is-compact {
  justify-content: center;
  width: 100%;
  gap: 0;
}

.player-track-cover {
  width: 40px;
  height: 40px;
  border-radius: var(--ncx-radius-md, 8px);
  flex-shrink: 0;
}

.player-track-cover-button {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--ncx-radius-md, 8px);
  background: transparent;
  cursor: pointer;
}

.player-track-cover-button:disabled {
  cursor: default;
}

.player-track-cover-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--ncx-color-accent) 72%, white);
  outline-offset: 3px;
}

.player-track-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  flex: 1;
}

.player-track-name {
  margin: 0;
  overflow: hidden;
  color: var(--ncx-color-text-primary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-track-meta {
  display: flex;
  gap: var(--ncx-space-1-5, 6px);
  margin: var(--ncx-space-1, 4px) 0 0;
  overflow: hidden;
  font-size: 11px;
  color: var(--ncx-color-text-secondary);
  line-height: 16px;
  white-space: nowrap;
}

.player-track-meta:empty {
  display: none;
}

.player-quality {
  flex: none;
  padding: 0 var(--ncx-space-1-5, 6px);
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
  grid-area: transport;
  gap: var(--ncx-space-2, 8px);
  align-items: center;
  justify-content: center;
}

.player-busy {
  animation: player-pulse 1s ease-in-out infinite;
}

.player-progress {
  display: flex;
  grid-area: progress;
  gap: var(--ncx-space-2, 8px);
  align-items: center;
  min-width: 0;
}

.player-output {
  display: flex;
  grid-area: output;
  gap: var(--ncx-space-2, 8px);
  align-items: center;
  min-width: 0;
  justify-self: end;
  justify-content: flex-end;
  width: 100%;
}

.player-progress-control {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.player-time,
.player-status {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ncx-color-text-secondary);
  line-height: 16px;
}

.player-time {
  min-width: 36px;
  text-align: center;
}

.player-status {
  min-width: 36px;
  text-align: right;
  font-size: 11px;
}

.player-slider {
  flex: 1;
  align-self: center;
  min-width: 0;
}

.player-slider-volume {
  flex: none;
  width: 72px;
  min-width: 0;
}

.player-slider-progress {
  width: 100%;
}

.player-slider :deep(.ncx-common-slider-track-container),
.player-progress-loading :deep(.ncx-common-progress-track) {
  filter: none;
}

.player-progress-loading,
.player-output :deep(.ncx-common-icon-button),
.player-transport :deep(.ncx-common-icon-button) {
  align-self: center;
}

.player-slider :deep(.ncx-common-slider-rail),
.player-progress-loading :deep(.ncx-common-progress-track) {
  background: var(--ncx-player-bar-track-bg);
  box-shadow: inset 0 1px 1px rgb(0 0 0 / 7%);
}

.player-slider :deep(.ncx-common-slider-fill),
.player-progress-loading :deep(.ncx-common-progress-bar) {
  background: color-mix(in srgb, var(--ncx-color-accent) 78%, white 10%);
}

.player-slider :deep(.ncx-common-slider-thumb) {
  width: 12px;
  height: 12px;
  background: color-mix(in srgb, var(--ncx-color-accent) 92%, white 8%);
  box-shadow: var(--ncx-player-bar-thumb-shadow);
}


:root[data-theme='dark'] .player-bar-glass {
  --ncx-player-bar-track-bg: color-mix(in srgb, white 15%, transparent);
  --ncx-player-bar-thumb-shadow:
    0 2px 8px rgb(0 0 0 / 32%),
    0 0 0 3px rgb(255 255 255 / 14%);
  --ncx-player-bar-shadow:
    0 0 2px 1px rgb(255 255 255 / 12%) inset,
    0 0 10px 4px rgb(255 255 255 / 5%) inset,
    0 8px 32px rgb(0 0 0 / 45%),
    0 1px 1px rgb(255 255 255 / 15%) inset;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .player-bar-glass {
    --ncx-player-bar-track-bg: color-mix(in srgb, white 15%, transparent);
    --ncx-player-bar-thumb-shadow:
      0 2px 8px rgb(0 0 0 / 32%),
      0 0 0 3px rgb(255 255 255 / 14%);
    --ncx-player-bar-shadow:
      0 0 2px 1px rgb(255 255 255 / 12%) inset,
      0 0 10px 4px rgb(255 255 255 / 5%) inset,
      0 8px 32px rgb(0 0 0 / 45%),
      0 1px 1px rgb(255 255 255 / 15%) inset;
  }
}

@media (width < 1100px) {
  .player-bar-content {
    grid-template-areas: "track transport progress";
    grid-template-columns: minmax(150px, 1fr) auto minmax(150px, 1.2fr);
    column-gap: var(--ncx-space-2, 8px);
    row-gap: 0;
    padding-inline: var(--ncx-space-3, 12px);
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
