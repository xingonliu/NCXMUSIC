<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { StandardLyrics, StandardLyricsLine } from '../../../../shared/schemas/music'
import {
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../../design-system/components'
import { useAppPreferences } from '../../settings/app-preferences'

// ========= 属性 =========

/** 歌词面板属性。 */
const props = withDefaults(defineProps<{
  /** 当前曲目 ID。 */
  trackId: string | undefined
  /** 当前播放位置（毫秒）。 */
  positionMs: number
  /** 是否使用沉浸式大字号。 */
  immersive?: boolean
}>(), {
  immersive: false
})

/** 歌词面板事件定义。 */
const emit = defineEmits<{
  /** 请求播放器跳转到指定歌词时间点。 */
  (event: 'seek', positionMs: number): void
}>()

// ========= 变量 =========

/** 应用歌词展示偏好。 */
const appPreferences = useAppPreferences()

/** 当前歌词实体。 */
const lyrics = ref<StandardLyrics | null>(null)

/** 当前加载状态。 */
const loading = ref<boolean>(false)

/** 当前错误文案。 */
const errorMessage = ref<string>('')

/** 沉浸歌词滚动容器。 */
const scrollContainer = ref<HTMLElement | null>(null)

/** 用户主动浏览歌词时是否暂停自动跟随。 */
const autoFollowPaused = ref<boolean>(false)

/** 最近一次歌词请求 ID，用于丢弃迟到响应。 */
let latestRequestId = ''

/** 恢复自动跟随的延迟定时器。 */
let resumeAutoFollowTimer: number | undefined

/** 当前高亮歌词行下标。 */
const activeLineIndex = computed<number>(() => {
  const lines = lyrics.value?.lines ?? []
  if (lines.length === 0) return -1

  let index = 0
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]
    if (!line || line.timeMs > props.positionMs + 220) break
    index = cursor
  }
  return index
})

/** 可展示歌词行。 */
const displayLines = computed<StandardLyricsLine[]>(() => lyrics.value?.lines ?? [])

// ========= 函数 =========

/**
 * 拉取当前曲目的标准歌词。
 *
 * @param trackId 当前曲目 ID
 */
async function loadLyrics(trackId: string | undefined): Promise<void> {
  lyrics.value = null
  errorMessage.value = ''

  if (!trackId) return

  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  loading.value = true

  try {
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
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

/** 重试读取歌词。 */
function retryLyrics(): void {
  void loadLyrics(props.trackId)
}

/**
 * 返回歌词行相对当前行的视觉层次类名。
 *
 * @param index 歌词行下标
 */
function lyricLineClass(index: number): Record<string, boolean> {
  /** 歌词行与当前行的下标距离。 */
  const distance = Math.abs(index - activeLineIndex.value)
  return {
    'lyrics-line--active': distance === 0,
    'lyrics-line--near': distance === 1,
    'lyrics-line--medium': distance === 2,
    'lyrics-line--far': distance >= 3
  }
}

/**
 * 将当前歌词平滑移动到沉浸面板垂直中心附近。
 *
 * @param behavior 浏览器滚动行为
 */
function scrollToActiveLine(behavior: ScrollBehavior = 'smooth'): void {
  if (!props.immersive || autoFollowPaused.value || activeLineIndex.value < 0) return

  /** 当前沉浸歌词滚动容器。 */
  const container = scrollContainer.value
  if (!container) return

  /** 当前高亮歌词对应的 DOM 元素。 */
  const activeLine = container.querySelector<HTMLElement>(
    `[data-lyric-index="${activeLineIndex.value}"]`
  )
  if (!activeLine) return

  /** 让当前行中心落在容器 46% 高度处的目标滚动位置。 */
  const targetTop = activeLine.offsetTop - container.clientHeight * 0.46
  container.scrollTo({
    top: Math.max(0, targetTop),
    behavior
  })
}

/** 用户主动浏览歌词时暂时停止自动跟随。 */
function pauseAutoFollow(): void {
  if (!props.immersive) return
  autoFollowPaused.value = true
  window.clearTimeout(resumeAutoFollowTimer)
  resumeAutoFollowTimer = window.setTimeout(() => {
    autoFollowPaused.value = false
    scrollToActiveLine()
  }, 4_000)
}

/**
 * 点击歌词行后跳转播放进度并立即恢复自动跟随。
 *
 * @param line 被点击的标准歌词行
 */
function seekToLyric(line: StandardLyricsLine): void {
  window.clearTimeout(resumeAutoFollowTimer)
  autoFollowPaused.value = false
  emit('seek', line.timeMs)
  void nextTick(() => scrollToActiveLine())
}

// ========= 生命周期 =========

watch(() => props.trackId, (trackId) => {
  void loadLyrics(trackId)
}, { immediate: true })

watch(activeLineIndex, async () => {
  await nextTick()
  scrollToActiveLine()
})

onBeforeUnmount(() => {
  window.clearTimeout(resumeAutoFollowTimer)
})
</script>

<template>
  <section
    ref="scrollContainer"
    class="lyrics-panel"
    :class="{ 'lyrics-panel--immersive': props.immersive }"
    aria-label="歌词"
    @wheel.passive="pauseAutoFollow"
    @touchstart.passive="pauseAutoFollow"
  >
    <div
      v-if="loading"
      class="lyrics-panel-loading"
    >
      <CommonSpinner
        size="default"
        label="正在加载歌词"
      />
      <span>正在加载歌词</span>
    </div>

    <CommonErrorState
      v-else-if="errorMessage"
      title="歌词读取失败"
      :description="errorMessage"
      @retry="retryLyrics"
    />

    <CommonEmptyState
      v-else-if="displayLines.length === 0"
      title="暂无歌词"
      description="当前歌曲没有可展示的时间轴歌词。"
    />

    <ol
      v-else
      class="lyrics-lines"
    >
      <li
        v-for="(line, index) in displayLines"
        :key="`${line.timeMs}-${index}`"
        class="lyrics-line"
        :class="lyricLineClass(index)"
        :data-lyric-index="index"
        :aria-current="index === activeLineIndex ? 'true' : undefined"
      >
        <button
          type="button"
          @click="seekToLyric(line)"
        >
          <span>{{ line.text || '…' }}</span>
          <small v-if="line.translation && appPreferences.preferences.value.showLyricTranslation">{{ line.translation }}</small>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.lyrics-panel {
  display: flex;
  min-height: 280px;
  flex-direction: column;
  justify-content: center;
}

.lyrics-panel-loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
}

.lyrics-lines {
  display: grid;
  gap: var(--ncx-space-4);
  margin: 0;
  padding: var(--ncx-space-4) 0;
  list-style: none;
}

.lyrics-line {
  color: var(--ncx-color-text-tertiary);
  font-size: 18px;
  line-height: 1.35;
  transition:
    color var(--ncx-motion-normal),
    filter var(--ncx-motion-normal),
    opacity var(--ncx-motion-normal),
    transform var(--ncx-motion-normal);
}

.lyrics-line button {
  display: grid;
  width: 100%;
  gap: var(--ncx-space-1);
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.lyrics-line button:focus-visible {
  border-radius: var(--ncx-radius-xs);
  outline: 2px solid currentcolor;
  outline-offset: 6px;
}

.lyrics-line small {
  color: inherit;
  font-size: 13px;
  opacity: 0.72;
}

.lyrics-line--active {
  color: var(--ncx-color-text-primary);
  font-weight: 700;
  transform: translateX(4px);
}

.lyrics-panel--immersive {
  display: block;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  scrollbar-color: rgb(255 255 255 / 24%) transparent;
  scrollbar-width: thin;
}

.lyrics-panel--immersive .lyrics-lines {
  gap: clamp(32px, 4vh, 46px);
  min-height: 100%;
  padding: 42% 16px 42% 8px;
}

.lyrics-panel--immersive .lyrics-line {
  color: white;
  font-size: clamp(30px, 2.4vw, 36px);
  font-weight: 900;
  -webkit-font-smoothing: antialiased;
  -webkit-text-stroke: 0.5px currentColor;
  opacity: 0.32;
  filter: blur(1.5px);
  line-height: 1.32;
  transform: scale(0.88);
  transform-origin: left center;
  will-change: transform, opacity, filter;
  transition:
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.lyrics-panel--immersive .lyrics-line button {
  transform-origin: left center;
  will-change: transform, opacity, filter;
  transition:
    transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.lyrics-panel--immersive .lyrics-line button:hover {
  opacity: 0.9;
  filter: blur(0px);
  transform: scale(1.03);
  transform-origin: left center;
}

.lyrics-panel--immersive .lyrics-line small {
  display: block;
  margin-top: 6px;
  color: inherit;
  font-size: clamp(18px, 1.4vw, 22px);
  font-weight: 700;
  -webkit-text-stroke: 0.2px currentColor;
  opacity: 0.6;
  transition:
    opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.lyrics-panel--immersive .lyrics-line--active {
  color: #ffffff;
  font-weight: 900;
  -webkit-text-stroke: 0.6px currentColor;
  letter-spacing: -0.02em;
  opacity: 1;
  filter: blur(0px);
  transform: scale(1.36);
  transform-origin: left center;
  text-shadow: 0 0 1px currentColor, 0 4px 24px rgb(0 0 0 / 40%);
}

.lyrics-panel--immersive .lyrics-line--active button:hover {
  opacity: 1;
  filter: blur(0px);
  transform: scale(1.04);
  transform-origin: left center;
}

.lyrics-panel--immersive .lyrics-line--active small {
  color: inherit;
  font-size: clamp(18px, 1.4vw, 22px);
  font-weight: 700;
  -webkit-text-stroke: 0.3px currentColor;
  opacity: 0.88;
}

.lyrics-panel--immersive .lyrics-line--near {
  font-weight: 900;
  -webkit-text-stroke: 0.5px currentColor;
  opacity: 0.55;
  filter: blur(1px);
  transform: scale(1.06);
  transform-origin: left center;
}

.lyrics-panel--immersive .lyrics-line--medium {
  font-weight: 900;
  -webkit-text-stroke: 0.4px currentColor;
  opacity: 0.32;
  filter: blur(1.8px);
  transform: scale(0.94);
  transform-origin: left center;
}

.lyrics-panel--immersive .lyrics-line--far {
  font-weight: 900;
  -webkit-text-stroke: 0.3px currentColor;
  opacity: 0.16;
  filter: blur(2.5px);
  transform: scale(0.86);
  transform-origin: left center;
}

@media (height < 720px) {
  .lyrics-panel--immersive .lyrics-lines {
    gap: 28px;
  }

  .lyrics-panel--immersive .lyrics-line--active {
    transform: scale(1.22);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-panel--immersive,
  .lyrics-line {
    scroll-behavior: auto;
    transition: none;
  }
}
</style>
