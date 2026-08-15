<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { StandardLyrics } from '../../../../shared/schemas/music'
import {
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../../design-system/components'
import { useAppPreferences } from '../../settings/app-preferences'
import {
  LyricPlayer,
  type LyricLineMouseEvent
} from '../lyrics-engine'
import { adaptStandardLyrics } from '../lyrics-engine/standard-lyrics-adapter'

// ========= 属性 =========

/** 歌词面板属性。 */
const props = withDefaults(defineProps<{
  /** 当前曲目 ID。 */
  trackId: string | undefined
  /** 当前播放位置（毫秒）。 */
  positionMs: number
  /** 播放器当前是否正在推进时间轴。 */
  playing?: boolean
  /** 是否使用沉浸式大字号。 */
  immersive?: boolean
  /** 当前封面提亮后的歌词与扫光颜色。 */
  accentColor?: string
}>(), {
  playing: false,
  immersive: false,
  accentColor: 'rgb(196 218 255)'
})

/** 歌词面板事件定义。 */
const emit = defineEmits<{
  /** 请求播放器跳转到指定歌词时间点。 */
  (event: 'seek', positionMs: number): void
}>()

// ========= 变量 =========

/** 应用歌词展示偏好。 */
const appPreferences = useAppPreferences()

/** 承载内置歌词视觉引擎 DOM 的元素。 */
const lyricPlayerHost = ref<HTMLDivElement | null>(null)

/** 当前标准歌词实体。 */
const lyrics = ref<StandardLyrics | null>(null)

/** 当前歌词请求是否仍在加载。 */
const loading = ref<boolean>(false)

/** 当前歌词读取错误文案。 */
const errorMessage = ref<string>('')

/** 当前是否存在可以交给视觉引擎的歌词行。 */
const hasLyrics = computed<boolean>(() => (lyrics.value?.lines.length ?? 0) > 0)

/** 是否隐藏歌词引擎并展示加载、错误或空状态。 */
const hideLyricPlayer = computed<boolean>(() => (
  loading.value || Boolean(errorMessage.value) || !hasLyrics.value
))

/** 用户级歌词焦点预设对应的 AMLL 视口高度比例。 */
const LYRIC_ALIGNMENT_POSITIONS = {
  upper: 0.35,
  center: 0.5,
  lower: 0.65
} as const

/** 用户级沉浸歌词字号预设，采用流体区间 clamp(min, preferred, max) 自适应不同屏幕与窗口尺寸。 */
const IMMERSIVE_FONT_SIZES = {
  compact: 'clamp(26px, 2.2vw, 40px)',
  standard: 'clamp(32px, 3vw, 54px)',
  large: 'clamp(38px, 3.8vw, 68px)',
  extraLarge: 'clamp(44px, 4.6vw, 82px)'
} as const

/** 非沉浸常规页面的默认自适应歌词字号区间。 */
const REGULAR_FONT_SIZE = 'clamp(16px, 1.4vw, 22px)'

/** 用户级歌词字重预设对应的 CSS 数值。 */
const LYRIC_FONT_WEIGHTS = {
  light: '300',
  regular: '400',
  semibold: '600',
  bold: '700',
  heavy: '900'
} as const

/** 传递给 AMLL 样式系统的歌词颜色、字号和字重。 */
const lyricPlayerStyle = computed<Record<string, string>>(() => ({
  '--amll-lp-color': props.accentColor,
  '--amll-lp-font-size': props.immersive
    ? IMMERSIVE_FONT_SIZES[appPreferences.preferences.value.lyricFontSize]
    : REGULAR_FONT_SIZE,
  '--amll-lp-font-weight': LYRIC_FONT_WEIGHTS[
    appPreferences.preferences.value.lyricFontWeight
  ]
}))

/** 内置的 AMLL DOM 歌词播放器实例。 */
let lyricPlayer: LyricPlayer | undefined

/** 最近一次歌词请求 ID，用于丢弃过期响应。 */
let latestRequestId = ''

/** 歌词引擎逐帧更新任务 ID。 */
let animationFrameId: number | undefined

/** 上一帧动画使用的高精度页面时间。 */
let previousFrameTime = -1

/** 播放时钟锚点对应的媒体位置。 */
let playbackClockAnchorPositionMs = props.positionMs

/** 播放时钟锚点对应的高精度页面时间。 */
let playbackClockAnchorAt = 0

/** 最近一次播放器推送的权威位置。 */
let latestPlayerPositionMs = props.positionMs

/** 最近一次交给歌词引擎的播放位置。 */
let lastRenderedPlaybackPositionMs = props.positionMs

/** 系统减少动态效果媒体查询。 */
let reducedMotionQuery: MediaQueryList | undefined

/** 组件是否已经进入销毁流程。 */
let disposed = false

// ========= 函数 =========

/** 返回当前页面是否要求减少动态效果。 */
function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false
}

/** 把歌词播放时钟直接锚定到权威媒体位置。 */
function anchorPlaybackClock(
  positionMs: number,
  sampledAt: number = performance.now()
): void {
  playbackClockAnchorPositionMs = Math.max(0, positionMs)
  playbackClockAnchorAt = sampledAt
  latestPlayerPositionMs = positionMs
  lastRenderedPlaybackPositionMs = playbackClockAnchorPositionMs
}

/** 返回指定页面时刻对应的连续媒体位置。 */
function playbackPositionAt(frameTime: number = performance.now()): number {
  if (!props.playing) {
    lastRenderedPlaybackPositionMs = playbackClockAnchorPositionMs
    return playbackClockAnchorPositionMs
  }

  /** 从最近权威采样推导的连续媒体位置。 */
  const predictedPositionMs = Math.max(
    0,
    playbackClockAnchorPositionMs + Math.max(0, frameTime - playbackClockAnchorAt)
  )
  lastRenderedPlaybackPositionMs = Math.max(
    lastRenderedPlaybackPositionMs,
    predictedPositionMs
  )
  return lastRenderedPlaybackPositionMs
}

/**
 * 用播放器采样校准连续歌词时钟，并返回本次变化是否应按 seek 处理。
 */
function synchronizePlaybackClock(
  positionMs: number,
  sampledAt: number = performance.now()
): boolean {
  /** 接收新采样前由本地时钟预测的位置。 */
  const predictedPositionMs = playbackPositionAt(sampledAt)
  /** 权威位置是否发生明显反向移动。 */
  const movedBackward = positionMs < latestPlayerPositionMs - 48
  /** 权威采样相对连续时钟的偏差。 */
  const driftMs = positionMs - predictedPositionMs
  /** 暂停、反向跳转或超过阈值的正向跳转需要立即定位。 */
  const shouldSeek = !props.playing || movedBackward || driftMs > 240

  if (shouldSeek) {
    anchorPlaybackClock(positionMs, sampledAt)
    return true
  }

  if (driftMs > 0) {
    playbackClockAnchorPositionMs = predictedPositionMs + driftMs * 0.2
    playbackClockAnchorAt = sampledAt
  }
  latestPlayerPositionMs = positionMs
  return false
}

/** 将系统减少动态效果偏好同步给歌词视觉引擎。 */
function synchronizeMotionPreference(): void {
  if (!lyricPlayer) return
  /** 系统减少动态效果优先级高于应用内预设。 */
  const motionPreset = prefersReducedMotion()
    ? 'minimal'
    : appPreferences.preferences.value.lyricMotion
  lyricPlayer.setEnableSpring(motionPreset !== 'minimal')
  lyricPlayer.setEnableBlur(motionPreset === 'full')
  lyricPlayer.setEnableScale(motionPreset !== 'minimal')
}

/** 把用户级歌词显示预设映射到 AMLL 的完整控制接口。 */
function synchronizeDisplayPreferences(): void {
  if (!lyricPlayer) return
  /** 当前歌词焦点预设对应的视口位置。 */
  const alignPosition = LYRIC_ALIGNMENT_POSITIONS[
    appPreferences.preferences.value.lyricAlignment
  ]
  lyricPlayer.setAlignPosition(alignPosition)
  lyricPlayer.setHidePassedLines(appPreferences.preferences.value.hidePassedLyrics)
  synchronizeMotionPreference()
}

/** 把当前标准歌词和翻译偏好同步给视觉引擎。 */
function synchronizeLyricLines(): void {
  if (!lyricPlayer) return
  /** 适配完成的完整 AMLL 歌词行模型。 */
  const engineLines = adaptStandardLyrics(lyrics.value, {
    showTranslation: appPreferences.preferences.value.showLyricTranslation
  })
  lyricPlayer.setLyricLines(engineLines, props.positionMs)
  lyricPlayer.setCurrentTime(props.positionMs, true)
}

/** 把播放/暂停状态同步给歌词视觉引擎。 */
function synchronizePlayingState(): void {
  if (!lyricPlayer) return
  anchorPlaybackClock(props.positionMs)
  lyricPlayer.setCurrentTime(props.positionMs, true)
  if (props.playing) lyricPlayer.resume()
  else lyricPlayer.pause()
}

/** 响应 AMLL 歌词行点击并请求主播放器 seek。 */
function handleLineClick(event: Event): void {
  /** AMLL 派发的歌词行鼠标事件。 */
  const lyricEvent = event as LyricLineMouseEvent
  /** 被点击歌词行在优化前的原始时间轴，避免提前高亮优化改变 seek 位置。 */
  const line = lyricPlayer?.getLyricLines()[lyricEvent.lineIndex] ?? lyricEvent.line.getLine()
  emit('seek', line.startTime)
  lyricPlayer?.resetScroll()
}

/** 驱动 AMLL 时间轴、Web Animation 与弹簧布局的一帧。 */
function runAnimationFrame(frameTime: number): void {
  if (disposed || !lyricPlayer) return
  /** 本次引擎更新距离上一帧经过的毫秒数。 */
  const deltaMs = previousFrameTime < 0 ? 0 : Math.max(0, frameTime - previousFrameTime)
  previousFrameTime = frameTime

  if (props.playing) {
    lyricPlayer.setCurrentTime(Math.round(playbackPositionAt(frameTime)))
  }
  lyricPlayer.update(deltaMs)
  animationFrameId = window.requestAnimationFrame(runAnimationFrame)
}

/** 创建并配置内置歌词视觉引擎。 */
function createLyricPlayer(): void {
  if (lyricPlayer || !lyricPlayerHost.value) return

  /** 直接从本项目源码创建的 AMLL DOM 歌词播放器。 */
  const player = new LyricPlayer()
  lyricPlayer = player
  player.getElement().setAttribute('aria-label', '同步歌词')
  player.setWordFadeWidth(0.5)
  player.setOverscanPx(300)
  player.setAlwaysPostpositionBackground(false)
  player.addEventListener('line-click', handleLineClick)
  lyricPlayerHost.value.appendChild(player.getElement())

  synchronizeDisplayPreferences()
  synchronizeLyricLines()
  synchronizePlayingState()
  previousFrameTime = -1
  animationFrameId = window.requestAnimationFrame(runAnimationFrame)
}

/** 销毁歌词视觉引擎和所有动画、观察器及事件监听。 */
function disposeLyricPlayer(): void {
  if (animationFrameId !== undefined) window.cancelAnimationFrame(animationFrameId)
  animationFrameId = undefined
  previousFrameTime = -1

  if (!lyricPlayer) return
  lyricPlayer.removeEventListener('line-click', handleLineClick)
  lyricPlayer.dispose()
  lyricPlayer = undefined
}

/**
 * 拉取当前曲目的标准歌词。
 *
 * @param trackId 当前曲目 ID
 */
async function loadLyrics(trackId: string | undefined): Promise<void> {
  /** 本次歌词读取请求的唯一 ID。 */
  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  lyrics.value = null
  errorMessage.value = ''
  loading.value = Boolean(trackId)

  if (!trackId) return

  try {
    /** Renderer Bridge 返回的标准歌词读取结果。 */
    const result = await window.ncx.runtime.getLyrics({ id: trackId, requestId })
    if (requestId !== latestRequestId) return
    if (!result.ok) {
      errorMessage.value = result.error.message
      return
    }
    if (result.data.kind !== 'lyrics') {
      errorMessage.value = '歌词响应类型不匹配。'
      return
    }
    lyrics.value = result.data.entity
  } catch {
    if (requestId === latestRequestId) errorMessage.value = '歌词读取失败，请稍后重试。'
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

/** 重试读取当前曲目的歌词。 */
function retryLyrics(): void {
  void loadLyrics(props.trackId)
}

// ========= 生命周期 =========

watch(() => props.trackId, (trackId) => {
  void loadLyrics(trackId)
}, { immediate: true })

watch([
  lyrics,
  () => appPreferences.preferences.value.showLyricTranslation
], () => {
  synchronizeLyricLines()
})

watch([
  () => appPreferences.preferences.value.lyricAlignment,
  () => appPreferences.preferences.value.lyricMotion,
  () => appPreferences.preferences.value.hidePassedLyrics
], () => {
  synchronizeDisplayPreferences()
})

watch(() => props.positionMs, (positionMs) => {
  /** 本次权威位置更新是否属于时间轴跳转。 */
  const isSeek = synchronizePlaybackClock(positionMs)
  lyricPlayer?.setCurrentTime(Math.round(playbackPositionAt()), isSeek)
})

watch(() => props.playing, () => {
  synchronizePlayingState()
})

onMounted(() => {
  reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : undefined
  reducedMotionQuery?.addEventListener('change', synchronizeMotionPreference)
  createLyricPlayer()
})

onBeforeUnmount(() => {
  disposed = true
  latestRequestId = ''
  reducedMotionQuery?.removeEventListener('change', synchronizeMotionPreference)
  reducedMotionQuery = undefined
  disposeLyricPlayer()
})
</script>

<template>
  <section
    class="lyrics-panel"
    :class="{ 'lyrics-panel--immersive': props.immersive }"
    :style="lyricPlayerStyle"
    aria-label="歌词"
  >
    <div
      ref="lyricPlayerHost"
      class="lyrics-player-host"
      :class="{ 'lyrics-player-host--hidden': hideLyricPlayer }"
      :aria-hidden="hideLyricPlayer ? 'true' : undefined"
    />

    <div
      v-if="loading"
      class="lyrics-panel-state"
    >
      <CommonSpinner
        size="default"
        label="正在加载歌词"
      />
      <span>正在加载歌词</span>
    </div>

    <div
      v-else-if="errorMessage"
      class="lyrics-panel-state"
    >
      <CommonErrorState
        title="歌词读取失败"
        :description="errorMessage"
        @retry="retryLyrics"
      />
    </div>

    <div
      v-else-if="!hasLyrics"
      class="lyrics-panel-state"
    >
      <CommonEmptyState
        title="暂无歌词"
        description="当前歌曲没有可展示的时间轴歌词。"
      />
    </div>
  </section>
</template>

<style scoped>
.lyrics-panel {
  position: relative;
  display: block;
  min-height: 280px;
  overflow: hidden;
}

.lyrics-player-host {
  width: 100%;
  height: 100%;
  min-height: 280px;
}

.lyrics-player-host--hidden {
  visibility: hidden;
  pointer-events: none;
}

.lyrics-panel-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
}

.lyrics-panel--immersive,
.lyrics-panel--immersive .lyrics-player-host {
  min-height: 0;
}

.lyrics-player-host :deep(.amll-lyric-player) {
  --amll-lp-hover-bg-color: rgb(255 255 255 / 8%);

  text-shadow: 0 2px 18px rgb(0 0 0 / 24%);
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-player-host :deep(.amll-lyric-player *) {
    scroll-behavior: auto;
    transition-duration: 1ms;
  }
}
</style>
