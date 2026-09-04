<script setup lang="ts">
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type {
  DesktopPlatform,
  WindowCommand,
  WindowSnapshot
} from '../../../shared/contracts/window-controls'
import type {
  StandardLyrics,
  StandardLyricsLine
} from '../../../shared/schemas/music'
import { translatePublicError } from '../../i18n'
import { useAppPreferences } from '../settings/app-preferences'
import {
  buildCinematicSpline,
  depthOfFieldForPoint,
  EMPTY_MOUNTED_WINDOW,
  nextMountedLineWindow,
  restSplineAnchors,
  spatialPointForIndex,
  type CinematicSplineSegment,
  type MountedLineWindow,
  type SpatialPoint
} from './cinematic-lyrics-space'
import { usePlayer } from './use-player'

// -- Type Definitions

/** 单个歌词字符及其演唱时间。 */
interface CinematicCharacter {
  readonly id: string
  readonly text: string
  readonly startMs: number
  readonly durationMs: number
}

/** 影院歌词渲染行。 */
interface CinematicLine {
  readonly id: string
  readonly index: number
  readonly text: string
  readonly translation?: string
  readonly startMs: number
  readonly endMs: number
  readonly characters: readonly CinematicCharacter[]
  readonly point: SpatialPoint
}

// -- Inputs and Outputs

/** 影院歌词页事件定义。 */
const emit = defineEmits<{
  /** 请求关闭沉浸播放展示层。 */
  (event: 'close'): void
}>()

// -- Constants

/** HUD 频谱采样数量。 */
const WAVEFORM_SAMPLE_COUNT = 64

/** 字号预设对应的影院主歌词流体字号。 */
const CINEMATIC_FONT_SIZES = {
  compact: 'clamp(30px, 5.2vmin, 62px)',
  standard: 'clamp(38px, 6.4vmin, 78px)',
  large: 'clamp(44px, 7.4vmin, 90px)',
  extraLarge: 'clamp(50px, 8.4vmin, 104px)'
} as const

/** 字重预设对应的 CSS 数值。 */
const CINEMATIC_FONT_WEIGHTS = {
  light: '300',
  regular: '400',
  semibold: '600',
  bold: '700',
  heavy: '800'
} as const

/** 默认窗口快照。 */
const DEFAULT_WINDOW_SNAPSHOT: WindowSnapshot = {
  platform: window.ncx.platform as DesktopPlatform,
  maximized: false,
  fullscreen: false,
  focused: true
}

// -- State and Variables

/** 影院歌词页根元素。 */
const pageRoot = ref<HTMLElement | null>(null)

/** 应用唯一播放器。 */
const player = usePlayer()

/** 播放器只读快照。 */
const snapshot = player.snapshot

/** 应用歌词展示偏好。 */
const appPreferences = useAppPreferences()

/** 当前曲目的标准歌词。 */
const lyrics = ref<StandardLyrics | null>(null)

/** 当前歌词是否正在读取。 */
const loading = ref<boolean>(false)

/** 当前歌词读取错误。 */
const errorMessage = ref<string>('')

/** 60fps 连续视觉时钟。 */
const visualPositionMs = ref<number>(snapshot.value.playback.positionMs)

/** 经过平滑后的 HUD 频谱。 */
const waveform = ref<number[]>(Array.from({ length: WAVEFORM_SAMPLE_COUNT }, () => 0))

/** Main 进程公布的真实窗口状态。 */
const windowSnapshot = ref<WindowSnapshot>(DEFAULT_WINDOW_SNAPSHOT)

/** 系统是否要求减少动态效果。 */
const systemReducedMotion = ref<boolean>(false)

/** 带卸载滞后的三维画布挂载窗口。 */
const mountedWindow = ref<MountedLineWindow>(EMPTY_MOUNTED_WINDOW)

/** 当前歌词请求标识。 */
let latestRequestId = ''

/** 视觉时钟的媒体位置锚点。 */
let clockAnchorPositionMs = snapshot.value.playback.positionMs

/** 视觉时钟的高精度页面时间锚点。 */
let clockAnchorAt = performance.now()

/** 60fps 动画任务。 */
let animationFrameId: number | undefined

/** 系统减少动态效果查询。 */
let reducedMotionQuery: MediaQueryList | undefined

/** Main 窗口状态监听清理函数。 */
let unsubscribeWindowSnapshot = (): void => {}

// -- Derived Values

/** 当前曲目。 */
const track = computed(() => snapshot.value.playback.track)

/** 当前是否正在播放。 */
const isPlaying = computed<boolean>(() => snapshot.value.playback.status === 'playing')

/** 当前运行平台是否为 Windows。 */
const isWindows = computed<boolean>(() => windowSnapshot.value.platform === 'win32')

/** 应用或系统是否要求简化动效。 */
const reducedMotion = computed<boolean>(() => (
  systemReducedMotion.value || appPreferences.preferences.value.lyricMotion === 'minimal'
))

/** 标准歌词映射成的稳定三维画布行。 */
const cinematicLines = computed<readonly CinematicLine[]>(() => {
  /** 优先展示主唱声部，避免并行和声抢占主镜头。 */
  const primaryLines = lyrics.value?.lines.filter((line) => line.vocalRole !== 'background') ?? []
  /** 只有背景声时仍提供可见歌词。 */
  const sourceLines = primaryLines.length > 0 ? primaryLines : (lyrics.value?.lines ?? [])
  return sourceLines
    .filter((line) => normalizeLyricText(line.text).length > 0)
    .map(createCinematicLine)
})

/** 当前视觉时钟命中的主歌词索引。 */
const activeLineIndex = computed<number>(() => {
  if (cinematicLines.value.length === 0) return -1
  for (let index = cinematicLines.value.length - 1; index >= 0; index -= 1) {
    const line = cinematicLines.value[index]
    if (line && visualPositionMs.value >= line.startMs) return index
  }
  return 0
})

/** 当前主镜头歌词。 */
const activeLine = computed<CinematicLine | undefined>(() => (
  cinematicLines.value[activeLineIndex.value]
))

/** 当前虚拟相机焦平面所在的世界坐标。 */
const cameraPoint = computed<SpatialPoint>(() => (
  activeLine.value?.point ?? spatialPointForIndex(0)
))

/** 主镜头周围仍挂载、并在视线深处继续消散的歌词行。 */
const visibleLines = computed<readonly CinematicLine[]>(() => (
  cinematicLines.value.slice(mountedWindow.value.start, mountedWindow.value.end)
))

/** 供空间样条穿过的当前与前后歌词锚点。 */
const splineAnchors = computed(() => {
  if (cinematicLines.value.length === 0) return restSplineAnchors()
  const start = Math.max(0, mountedWindow.value.start - 1)
  const end = Math.min(cinematicLines.value.length, mountedWindow.value.end + 1)
  return cinematicLines.value.slice(start, end).map((line) => ({
    x: line.point.x,
    y: line.point.y,
    z: line.point.z
  }))
})

/** 当前镜头位置与转角。 */
const cameraStyle = computed<Record<string, string>>(() => {
  const point = cameraPoint.value
  return {
    transform: `rotateX(${-point.tilt}deg) rotateY(${-point.pan}deg) rotateZ(${-point.roll}deg) translate3d(${-point.x}px, ${-point.y}px, ${-point.z}px)`,
    '--ncx-cinematic-camera-duration': reducedMotion.value
      ? '1ms'
      : appPreferences.preferences.value.lyricMotion === 'soft' ? '900ms' : '1400ms'
  }
})

/** 字号、字重和镜头状态对应的根层 CSS 变量。 */
const pageStyle = computed<Record<string, string>>(() => ({
  '--ncx-cinematic-lyric-size': CINEMATIC_FONT_SIZES[
    appPreferences.preferences.value.lyricFontSize
  ],
  '--ncx-cinematic-lyric-weight': CINEMATIC_FONT_WEIGHTS[
    appPreferences.preferences.value.lyricFontWeight
  ]
}))

/** 穿过当前与前后歌词的主空间样条。 */
const primarySplineSegments = computed<readonly CinematicSplineSegment[]>(() => (
  buildCinematicSpline({
    anchors: splineAnchors.value,
    ribbon: 'primary',
    camera: cameraPoint.value,
    reducedMotion: reducedMotion.value,
    motion: appPreferences.preferences.value.lyricMotion
  })
))

/** 反向穿插的第二条空间样条。 */
const secondarySplineSegments = computed<readonly CinematicSplineSegment[]>(() => (
  buildCinematicSpline({
    anchors: splineAnchors.value,
    ribbon: 'secondary',
    camera: cameraPoint.value,
    reducedMotion: reducedMotion.value,
    motion: appPreferences.preferences.value.lyricMotion
  })
))

/** HUD 频谱的连续 SVG 路径。 */
const waveformPath = computed<string>(() => {
  const centerY = 18
  const width = 320
  return waveform.value.map((magnitude, index) => {
    const x = index * width / Math.max(1, waveform.value.length - 1)
    const direction = index % 2 === 0 ? -1 : 1
    const y = centerY + direction * Math.min(1, magnitude) * 15
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
})

/** HUD 显示的当前时间。 */
const currentTimeText = computed<string>(() => formatTime(visualPositionMs.value))

/** HUD 显示的总时长。 */
const durationText = computed<string>(() => formatTime(snapshot.value.playback.durationMs ?? 0))

/** 当前歌词在总行数中的位置。 */
const lyricSequenceText = computed<string>(() => {
  const total = cinematicLines.value.length
  if (total === 0 || activeLineIndex.value < 0) return '00 / 00'
  return `${String(activeLineIndex.value + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
})

// -- Functions

/** 移除上游可能携带的声部前缀。 */
function normalizeLyricText(text: string): string {
  return text.replace(/^(?:男|女|和声)\s*[:：]\s*/u, '').trim()
}

/** 把逐字时间轴展开为单字符时间轴。 */
function createTimedCharacters(
  line: StandardLyricsLine,
  text: string,
  lineIndex: number
): readonly CinematicCharacter[] {
  /** 上游逐字文案与当前可见行完全一致时保留真实演唱时间。 */
  const timedText = line.words.map((word) => word.text).join('')
  if (line.words.length > 0 && timedText === text) {
    return line.words.flatMap((word, wordIndex) => {
      const characters = Array.from(word.text)
      const characterDuration = word.durationMs / Math.max(1, characters.length)
      return characters.map((character, characterIndex) => ({
        id: `${lineIndex}-${wordIndex}-${characterIndex}`,
        text: character,
        startMs: word.startMs + characterDuration * characterIndex,
        durationMs: Math.max(120, characterDuration)
      }))
    })
  }

  /** 普通 LRC 或清理过前缀的歌词按行持续时间均匀分配字符节奏。 */
  const characters = Array.from(text)
  const characterDuration = line.lineDurationMs / Math.max(1, characters.length)
  return characters.map((character, characterIndex) => ({
    id: `${lineIndex}-line-${characterIndex}`,
    text: character,
    startMs: line.lineStartMs + characterDuration * characterIndex,
    durationMs: Math.max(120, characterDuration)
  }))
}

/** 把单行标准歌词转换为影院画布行。 */
function createCinematicLine(line: StandardLyricsLine, index: number): CinematicLine {
  const text = normalizeLyricText(line.text)
  const translation = line.translation?.trim()
  const wordEndMs = line.words.reduce(
    (latest, word) => Math.max(latest, word.startMs + word.durationMs),
    line.lineStartMs
  )
  return {
    id: `${line.lineStartMs}-${index}`,
    index,
    text,
    ...(translation ? { translation } : {}),
    startMs: line.lineStartMs,
    endMs: Math.max(line.lineStartMs + line.lineDurationMs, wordEndMs),
    characters: createTimedCharacters(line, text, index),
    point: spatialPointForIndex(index)
  }
}

/** 返回歌词行在三维画布中的布局，并按焦平面 Z 距写入连续景深。 */
function lineStyle(line: CinematicLine): Record<string, string> {
  const depth = depthOfFieldForPoint(line.point, cameraPoint.value, {
    reducedMotion: reducedMotion.value,
    motion: appPreferences.preferences.value.lyricMotion
  })
  return {
    transform: `translate3d(${line.point.x}px, ${line.point.y}px, ${line.point.z}px) translate(-50%, -50%) rotateZ(${line.point.roll}deg) scale(${depth.scale.toFixed(4)})`,
    opacity: depth.opacity.toFixed(3),
    filter: `blur(${depth.blurPx.toFixed(2)}px)`
  }
}

/** 返回一段世界空间样条的定向与散焦样式。 */
function splineSegmentStyle(segment: CinematicSplineSegment): Record<string, string> {
  return {
    width: `${segment.length.toFixed(2)}px`,
    transform: segment.transform,
    opacity: segment.opacity.toFixed(3),
    filter: `blur(${segment.blurPx.toFixed(2)}px)`
  }
}

/** 返回歌词行相对主镜头的状态类。 */
function lineStateClass(line: CinematicLine): string {
  if (line.index === activeLineIndex.value) return 'cinematic-lyric-line--active'
  return line.index < activeLineIndex.value
    ? 'cinematic-lyric-line--past'
    : 'cinematic-lyric-line--future'
}

/** 返回单字符逐帧反向高斯模糊与位移样式。 */
function characterStyle(character: CinematicCharacter, line: CinematicLine): Record<string, string> {
  if (line.index !== activeLineIndex.value) {
    return { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' }
  }
  const revealDuration = Math.min(420, Math.max(140, character.durationMs))
  const progress = Math.max(
    0,
    Math.min(1, (visualPositionMs.value - character.startMs) / revealDuration)
  )
  const blurRange = reducedMotion.value
    ? 0
    : appPreferences.preferences.value.lyricMotion === 'soft' ? 6 : 20
  return {
    opacity: progress.toFixed(3),
    filter: `blur(${((1 - progress) * blurRange).toFixed(2)}px)`,
    transform: `translateY(${((1 - progress) * 8).toFixed(2)}px)`
  }
}

/** 返回翻译行跟随主歌词进入的样式。 */
function translationStyle(line: CinematicLine): Record<string, string> {
  const progress = line.index === activeLineIndex.value
    ? Math.max(0, Math.min(1, (visualPositionMs.value - line.startMs - 120) / 480))
    : 1
  return {
    opacity: progress.toFixed(3),
    filter: `blur(${((1 - progress) * (reducedMotion.value ? 0 : 10)).toFixed(2)}px)`,
    transform: `translateY(${((1 - progress) * 8).toFixed(2)}px)`
  }
}

/** 把毫秒格式化为播放器时间。 */
function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** 将连续视觉时钟锚定到播放器权威位置。 */
function anchorVisualClock(positionMs: number): void {
  clockAnchorPositionMs = Math.max(0, positionMs)
  clockAnchorAt = performance.now()
  visualPositionMs.value = clockAnchorPositionMs
}

/** 平滑频谱的起音与释放。 */
function updateWaveform(): void {
  const nextSpectrum = player.getAudioSpectrum(WAVEFORM_SAMPLE_COUNT)
  waveform.value = waveform.value.map((current, index) => {
    const next = nextSpectrum[index] ?? 0
    const response = next > current ? 0.62 : 0.14
    const smoothed = current + (next - current) * response
    return smoothed < 0.006 ? 0 : smoothed
  })
}

/** 驱动连续媒体时钟与 HUD 频谱。 */
function runVisualFrame(frameTime: number): void {
  if (isPlaying.value) {
    const durationMs = snapshot.value.playback.durationMs ?? Number.POSITIVE_INFINITY
    visualPositionMs.value = Math.min(
      durationMs,
      clockAnchorPositionMs + Math.max(0, frameTime - clockAnchorAt)
    )
  }
  updateWaveform()
  animationFrameId = window.requestAnimationFrame(runVisualFrame)
}

/** 读取当前曲目的标准歌词。 */
async function loadLyrics(trackId: string | undefined): Promise<void> {
  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  lyrics.value = null
  errorMessage.value = ''
  loading.value = Boolean(trackId)
  if (!trackId) return

  try {
    const result = await window.ncx.runtime.getLyrics({ id: trackId, requestId })
    if (requestId !== latestRequestId) return
    if (!result.ok) {
      errorMessage.value = translatePublicError(result.error)
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

/** 重新读取当前歌词。 */
function retryLyrics(): void {
  void loadLyrics(track.value?.trackId)
}

/** 从频谱时间轴点击位置执行精确 seek。 */
function seekFromWaveform(event: MouseEvent): void {
  const durationMs = snapshot.value.playback.durationMs
  if (!durationMs) return
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const progress = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
  player.seek(durationMs * progress)
}

/** 关闭沉浸播放展示层。 */
function closeCinematicLyrics(): void {
  emit('close')
}

/** 发送窗口控制命令。 */
async function runWindowCommand(command: WindowCommand): Promise<void> {
  windowSnapshot.value = await window.ncx.windowControls.send(command)
}

/** Escape 优先关闭影院歌词页。 */
function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  closeCinematicLyrics()
}

/** 同步系统减少动态效果状态。 */
function synchronizeReducedMotion(): void {
  systemReducedMotion.value = reducedMotionQuery?.matches ?? false
}

// -- Listeners

watch(() => track.value?.trackId, (trackId) => {
  mountedWindow.value = EMPTY_MOUNTED_WINDOW
  anchorVisualClock(snapshot.value.playback.positionMs)
  void loadLyrics(trackId)
}, { immediate: true })

watch([
  () => snapshot.value.playback.positionMs,
  () => snapshot.value.playback.status
], ([positionMs]) => {
  anchorVisualClock(positionMs)
})

watch(
  [activeLineIndex, () => cinematicLines.value.length],
  ([activeIndex, total]) => {
    mountedWindow.value = nextMountedLineWindow(mountedWindow.value, activeIndex, total)
  },
  { immediate: true }
)

// -- Lifecycle Hooks

onMounted(async () => {
  window.addEventListener('keydown', handleWindowKeydown)
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  synchronizeReducedMotion()
  reducedMotionQuery?.addEventListener('change', synchronizeReducedMotion)
  unsubscribeWindowSnapshot = window.ncx.windowControls.onSnapshot((nextSnapshot) => {
    windowSnapshot.value = nextSnapshot
  })
  windowSnapshot.value = await window.ncx.windowControls.snapshot()
  pageRoot.value?.focus({ preventScroll: true })
  animationFrameId = window.requestAnimationFrame(runVisualFrame)
})

onBeforeUnmount(() => {
  latestRequestId = ''
  window.removeEventListener('keydown', handleWindowKeydown)
  reducedMotionQuery?.removeEventListener('change', synchronizeReducedMotion)
  reducedMotionQuery = undefined
  unsubscribeWindowSnapshot()
  if (animationFrameId !== undefined) window.cancelAnimationFrame(animationFrameId)
  animationFrameId = undefined
})
</script>

<template>
  <section
    ref="pageRoot"
    class="cinematic-lyrics-page"
    :class="[
      isWindows ? 'cinematic-lyrics-page--windows' : 'cinematic-lyrics-page--macos',
      windowSnapshot.fullscreen ? 'cinematic-lyrics-page--fullscreen' : '',
      reducedMotion ? 'cinematic-lyrics-page--reduced-motion' : ''
    ]"
    :style="pageStyle"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cinematic-track-title"
    tabindex="-1"
  >
    <div
      class="cinematic-vignette"
      aria-hidden="true"
    />

    <header class="cinematic-header">
      <div class="cinematic-track-meta">
        <span class="cinematic-kicker">NCX / IMMERSIVE TYPE</span>
        <strong id="cinematic-track-title">{{ track?.name ?? $tSource('还没有播放内容') }}</strong>
        <span v-if="track">{{ track.artists.join(' / ') }}</span>
      </div>

      <button
        type="button"
        class="cinematic-close-button"
        :aria-label="$tSource('收起沉浸播放页')"
        @click="closeCinematicLyrics"
      >
        <ChevronDown
          :size="18"
          :stroke-width="1.5"
        />
      </button>

      <div class="cinematic-header-output">
        <span
          class="cinematic-sequence"
          aria-hidden="true"
        >{{ lyricSequenceText }}</span>
        <div
          v-if="isWindows"
          class="cinematic-window-controls"
        >
          <button
            type="button"
            :aria-label="$tSource('最小化')"
            @click="runWindowCommand({ type: 'window.minimize' })"
          >
            <Minus :size="14" />
          </button>
          <button
            type="button"
            :aria-label="$tSource(windowSnapshot.maximized ? '还原窗口' : '最大化窗口')"
            @click="runWindowCommand({ type: 'window.toggleMaximize' })"
          >
            <Minimize2
              v-if="windowSnapshot.maximized"
              :size="13"
            />
            <Maximize2
              v-else
              :size="13"
            />
          </button>
          <button
            type="button"
            :aria-label="$tSource('关闭窗口')"
            @click="runWindowCommand({ type: 'window.requestClose' })"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
    </header>

    <main class="cinematic-stage">
      <div
        class="cinematic-world"
        aria-hidden="true"
      >
        <div
          class="cinematic-camera"
          :style="cameraStyle"
        >
          <div class="cinematic-spline cinematic-spline--primary">
            <span
              v-for="segment in primarySplineSegments"
              :key="segment.id"
              class="cinematic-spline-segment"
              :style="splineSegmentStyle(segment)"
            />
          </div>
          <div class="cinematic-spline cinematic-spline--secondary">
            <span
              v-for="segment in secondarySplineSegments"
              :key="segment.id"
              class="cinematic-spline-segment"
              :style="splineSegmentStyle(segment)"
            />
          </div>

          <button
            v-for="line in visibleLines"
            :key="line.id"
            type="button"
            class="cinematic-lyric-line"
            :class="lineStateClass(line)"
            :style="lineStyle(line)"
            tabindex="-1"
            @click="player.seek(line.startMs)"
          >
            <span class="cinematic-primary-lyric">
              <span
                v-for="character in line.characters"
                :key="character.id"
                class="cinematic-character"
                :style="characterStyle(character, line)"
              >{{ character.text }}</span>
            </span>
            <span
              v-if="line.translation && appPreferences.preferences.value.showLyricTranslation"
              class="cinematic-translation"
              :style="translationStyle(line)"
            >{{ line.translation }}</span>
          </button>
        </div>
      </div>

      <div
        v-if="!track || visibleLines.length === 0"
        class="cinematic-state"
      >
        <template v-if="!track">
          <span>NO SIGNAL</span>
          <strong>{{ $tSource('还没有播放内容') }}</strong>
          <p>{{ $tSource('收起页面并选择一首歌曲开始播放。') }}</p>
        </template>
        <template v-else-if="loading">
          <span>LOADING / LYRICS</span>
          <strong>{{ $tSource('正在加载歌词') }}</strong>
        </template>
        <template v-else-if="errorMessage">
          <span>LYRICS / ERROR</span>
          <strong>{{ $tSource('歌词读取失败') }}</strong>
          <p>{{ errorMessage }}</p>
          <button
            type="button"
            @click="retryLyrics"
          >
            {{ $tSource('重试') }}
          </button>
        </template>
        <template v-else>
          <span>LYRICS / EMPTY</span>
          <strong>{{ $tSource('暂无歌词') }}</strong>
          <p>{{ $tSource('当前歌曲没有可展示的时间轴歌词。') }}</p>
        </template>
      </div>

      <p
        class="cinematic-live-lyric"
        aria-live="polite"
      >
        {{ activeLine?.text }}
        <span v-if="activeLine?.translation && appPreferences.preferences.value.showLyricTranslation">
          {{ activeLine.translation }}
        </span>
      </p>
    </main>

    <footer class="cinematic-hud">
      <div class="cinematic-transport">
        <button
          type="button"
          :aria-label="$tSource('上一首')"
          @click="player.previous()"
        >
          <SkipBack
            :size="15"
            :stroke-width="1.6"
          />
        </button>
        <button
          type="button"
          :aria-label="$tSource(isPlaying ? '暂停' : '播放')"
          @click="player.toggle()"
        >
          <Pause
            v-if="isPlaying"
            :size="15"
            :stroke-width="1.6"
          />
          <Play
            v-else
            :size="15"
            :stroke-width="1.6"
          />
        </button>
        <button
          type="button"
          :aria-label="$tSource('下一首')"
          @click="player.next()"
        >
          <SkipForward
            :size="15"
            :stroke-width="1.6"
          />
        </button>
      </div>

      <button
        type="button"
        class="cinematic-waveform"
        :aria-label="$tSource('音乐播放进度')"
        :disabled="!snapshot.playback.durationMs"
        @click="seekFromWaveform"
      >
        <svg
          viewBox="0 0 320 36"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="18"
            x2="320"
            y2="18"
          />
          <path :d="waveformPath" />
        </svg>
      </button>

      <div
        class="cinematic-time"
        aria-hidden="true"
      >
        <span>{{ currentTimeText }}</span>
        <span>{{ durationText }}</span>
      </div>
    </footer>
  </section>
</template>

<style scoped src="./cinematic-lyrics-page.css"></style>
