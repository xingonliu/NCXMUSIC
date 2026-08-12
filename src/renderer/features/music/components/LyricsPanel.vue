<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type {
  StandardLyrics,
  StandardLyricsLine,
  StandardLyricsWord
} from '../../../../shared/schemas/music'
import {
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../../design-system/components'
import { useAppPreferences } from '../../settings/app-preferences'
import InstrumentalDots from './InstrumentalDots.vue'

// ========= 类型 =========

/** 歌词行相对播放位置的三段式时态。 */
type LyricTemporalState = 'past' | 'active' | 'future'

/** 歌词时间轴中的真实歌词行节点。 */
interface LyricTimelineLineNode {
  /** 节点类型。 */
  kind: 'line'
  /** 标准歌词行。 */
  line: StandardLyricsLine
  /** 标准歌词数组中的原始下标。 */
  lineIndex: number
}

/** 歌词时间轴中自动插入的虚拟间奏节点。 */
interface LyricTimelineInstrumentalNode {
  /** 节点类型。 */
  kind: 'instrumental'
  /** 间奏开始时间（毫秒）。 */
  startMs: number
  /** 间奏结束时间（毫秒）。 */
  endMs: number
  /** 间奏前一行歌词的下标。 */
  afterLineIndex: number
}

/** 沉浸歌词可以渲染的联合时间轴节点。 */
type LyricTimelineNode = LyricTimelineLineNode | LyricTimelineInstrumentalNode

/** 单个字或音节在当前帧的完整视觉状态。 */
interface WordVisualState {
  /** 字的时态状态：已唱完 (past)、唱响中 (active)、未开始 (future)。 */
  state: 'past' | 'active' | 'future'
  /** 从左至右的白色覆盖进度。 */
  fillProgress: number
}

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
}>(), {
  playing: false,
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

/** 动画帧级播放位置，用于在播放器事件之间精确切换行与间奏状态。 */
const animationPositionMs = ref<number>(props.positionMs)

/** 最近一次歌词请求 ID，用于丢弃迟到响应。 */
let latestRequestId = ''

/** 恢复自动跟随的延迟定时器。 */
let resumeAutoFollowTimer: number | undefined

/** 逐字高亮动画帧 ID。 */
let wordProgressFrameId: number | undefined

/** 逐字动画循环代次，用于让过期的异步启动和动画帧立即失效。 */
let wordProgressLoopGeneration = 0

/** 单调递增的高精度逐字播放位置（毫秒）。 */
let smoothPositionMs = props.positionMs

/** 最近一次播放器推送的权威位置，用于识别反向 seek。 */
let latestPlayerPositionMs = props.positionMs

/** 动画循环上一帧的时钟戳（performance.now()）。 */
let wordProgressPreviousFrameAt = 0

/** 弹簧滚动动画帧 ID。 */
let springFrameId: number | undefined

/** 弹簧当前模拟位置。 */
let springPosition = 0

/** 弹簧当前速度，单位为像素每秒。 */
let springVelocity = 0

/** 弹簧目标滚动位置。 */
let springTarget = 0

/** 弹簧上一帧高精度时钟。 */
let springPreviousFrameAt = 0

/** 自动跟随的垂直黄金焦点比例。 */
const ACTIVE_LINE_FOCUS_RATIO = 0.38

/** 插入虚拟间奏节点所需的最短空白时长。 */
const INSTRUMENTAL_GAP_THRESHOLD_MS = 8_000

/** 自动恢复跟随前的用户闲置时长。 */
const AUTO_FOLLOW_RESUME_DELAY_MS = 4_000

/** 沉浸歌词中只用于区分左右声部、不应作为正文展示的行首标签。 */
const VOCAL_ROLE_PREFIX_PATTERN = /^\s*(?:男|女|男声|女声|和声|伴唱|合唱)\s*[:：]\s*/u

/** 沉浸歌词中包含声部或演唱者信息的行首括号标签。 */
const VOCAL_METADATA_PREFIX_PATTERN = /^\s*[（(]\s*(?:男|女|男声|女声|和声|伴唱|合唱)(?:\s*[:：][^）)]*)?\s*[）)]\s*/u

/** 弹簧质量参数。 */
const SPRING_MASS = 1.2

/** 弹簧刚度参数（调整为低频 Apple 阻尼弹簧）。 */
const SPRING_STIFFNESS = 95

/** 弹簧阻尼参数（调整为厚重流体滑移感）。 */
const SPRING_DAMPING = 18.5

/** 弹簧停止时允许的位置误差。 */
const SPRING_POSITION_EPSILON = 0.35

/** 弹簧停止时允许的速度误差。 */
const SPRING_VELOCITY_EPSILON = 4

/** 可展示歌词行。 */
const displayLines = computed<StandardLyricsLine[]>(() => lyrics.value?.lines ?? [])

/** 包含长间奏虚拟节点的完整歌词时间轴。 */
const timelineNodes = computed<LyricTimelineNode[]>(() => {
  /** 本次构建生成的真实歌词与虚拟间奏节点。 */
  const nodes: LyricTimelineNode[] = []

  displayLines.value.forEach((line, lineIndex) => {
    nodes.push({ kind: 'line', line, lineIndex })

    /** 当前行之后的下一行歌词。 */
    const nextLine = displayLines.value[lineIndex + 1]
    if (!nextLine) return

    /** 当前行按上游持续时间计算的结束点。 */
    const lineEndMs = line.lineStartMs + line.lineDurationMs
    /** 当前行结束至下一行开始之间的纯音乐时长。 */
    const instrumentalGapMs = nextLine.lineStartMs - lineEndMs
    if (instrumentalGapMs <= INSTRUMENTAL_GAP_THRESHOLD_MS) return

    nodes.push({
      kind: 'instrumental',
      startMs: lineEndMs,
      endMs: nextLine.lineStartMs,
      afterLineIndex: lineIndex
    })
  })

  return nodes
})

/** 当前精确命中的歌词行下标；间奏或空白时为 -1。 */
const activeLineIndex = computed<number>(() => {
  const lines = displayLines.value
  if (lines.length === 0) return -1

  const currentMs = animationPositionMs.value

  // 若当前落入虚拟间奏节点区间，则无歌词行处于 active 状态
  if (activeInstrumentalNode.value) {
    return -1
  }

  let activeIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const nextLine = lines[i + 1]

    if (currentMs >= line.lineStartMs) {
      if (nextLine) {
        if (currentMs < nextLine.lineStartMs) {
          activeIndex = i
          break
        }
      } else {
        activeIndex = i
        break
      }
    }
  }

  return activeIndex
})

/** 当前动画帧已经完整唱完的歌词行数量。 */
const pastLineCount = computed<number>(() => {
  const activeIdx = activeLineIndex.value
  if (activeIdx >= 0) return activeIdx
  return displayLines.value.filter((line) => (
    animationPositionMs.value >= line.lineStartMs
  )).length
})

/** 当前精确命中的虚拟间奏节点。 */
const activeInstrumentalNode = computed<LyricTimelineInstrumentalNode | undefined>(() => {
  return timelineNodes.value.find((node): node is LyricTimelineInstrumentalNode => (
    node.kind === 'instrumental' &&
    node.startMs <= animationPositionMs.value &&
    animationPositionMs.value < node.endMs
  ))
})

/** 当前动画帧已经完整播放完的最后一个虚拟间奏下标。 */
const completedInstrumentalAfterLineIndex = computed<number>(() => {
  /** 已经结束的间奏节点所对应的歌词下标。 */
  const completedIndexes = timelineNodes.value
    .filter((node): node is LyricTimelineInstrumentalNode => (
      node.kind === 'instrumental' && animationPositionMs.value >= node.endMs
    ))
    .map((node) => node.afterLineIndex)
  return completedIndexes.at(-1) ?? -1
})

/** 当前自动跟随目标的 DOM 选择器。 */
const activeFocusSelector = computed<string>(() => {
  if (activeLineIndex.value >= 0) {
    return `[data-lyric-index="${activeLineIndex.value}"]`
  }
  if (activeInstrumentalNode.value) {
    return `[data-instrumental-after="${activeInstrumentalNode.value.afterLineIndex}"]`
  }
  return ''
})

// ========= 函数 =========

/** 读取系统是否要求减少动态效果。 */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** 把任意数值约束到零至一之间。 */
function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * 返回指定时刻对应的歌词或间奏焦点选择器。
 *
 * @param positionMs 需要定位的播放时刻
 */
function focusSelectorAtPosition(positionMs: number): string {
  /** 当前时刻命中的虚拟间奏节点。 */
  const instrumentalNode = timelineNodes.value.find((node) => (
    node.kind === 'instrumental' &&
    node.startMs <= positionMs &&
    positionMs < node.endMs
  ))
  if (instrumentalNode?.kind === 'instrumental') {
    return `[data-instrumental-after="${instrumentalNode.afterLineIndex}"]`
  }

  /** 当前时刻命中的最后一行歌词下标。 */
  let lineIndex = -1
  for (let index = 0; index < displayLines.value.length; index += 1) {
    const line = displayLines.value[index]
    if (!line || positionMs < line.lineStartMs) break
    lineIndex = index
  }

  return lineIndex >= 0 ? `[data-lyric-index="${lineIndex}"]` : ''
}

/**
 * 仅在歌词焦点真正跨行时更新 Vue 响应式时间轴，避免逐帧重渲染歌词列表。
 *
 * @param positionMs 当前动画时刻
 * @param force 是否强制同步初始或换歌状态
 */
function syncTimelineFocusPosition(positionMs: number, force = false): void {
  const nextFocusSelector = focusSelectorAtPosition(positionMs)
  if (!force && nextFocusSelector === activeFocusSelector.value) return
  animationPositionMs.value = positionMs
}

/** 返回标准歌词行的逐字时间轴，并兼容旧缓存中缺少 words 的行。 */
function lineWords(line: StandardLyricsLine): StandardLyricsWord[] {
  return line.words ?? []
}

/**
 * 移除沉浸模式左右声部行首的角色或演唱者标签，仅保留实际歌词。
 *
 * @param line 当前标准歌词行
 * @param text 需要处理的歌词文本
 */
function stripImmersiveVocalLabel(line: StandardLyricsLine, text: string): string {
  if (!props.immersive || line.vocalRole !== 'background') return text
  return text
    .replace(VOCAL_METADATA_PREFIX_PATTERN, '')
    .replace(VOCAL_ROLE_PREFIX_PATTERN, '')
}

/** 返回当前模式下用于无逐字时间轴歌词行的展示正文。 */
function visibleLineText(line: StandardLyricsLine): string {
  return stripImmersiveVocalLabel(line, line.text)
}

/**
 * 返回当前模式下的逐字歌词，并从右侧声部开头删除不可见的角色或演唱者标签。
 *
 * 被保留音节继续沿用上游绝对时间，避免展示层清理文案破坏扫光时序。
 */
function visibleLineWords(line: StandardLyricsLine): StandardLyricsWord[] {
  /** 当前歌词行的原始逐字时间轴。 */
  const words = lineWords(line)
  if (!props.immersive || line.vocalRole !== 'background' || words.length === 0) {
    return words
  }

  /** 拼接后的完整逐字正文，用于计算行首标签实际占用的字符数。 */
  const fullText = words.map((word) => word.text).join('')
  /** 删除声部标签后应当展示的歌词正文。 */
  const visibleText = stripImmersiveVocalLabel(line, fullText)
  /** 只允许删除行首字符，异常文本则原样返回以避免误删歌词。 */
  let remainingPrefixLength = fullText.endsWith(visibleText)
    ? fullText.length - visibleText.length
    : 0

  return words.flatMap((word) => {
    if (remainingPrefixLength <= 0) return [word]
    if (remainingPrefixLength >= word.text.length) {
      remainingPrefixLength -= word.text.length
      return []
    }

    /** 标签与歌词共用同一时间块时，仅裁掉该时间块开头的标签字符。 */
    const visibleWordText = word.text.slice(remainingPrefixLength)
    remainingPrefixLength = 0
    return [{ ...word, text: visibleWordText }]
  })
}

/** 返回指定播放时刻下单个字或音节的填充状态。 */
function calculateWordVisualState(
  word: StandardLyricsWord,
  currentTimeMs: number
): WordVisualState {
  /** 当前字从起音到收音的线性进度，严格遵循上游音节时长。 */
  const fillProgress = word.durationMs <= 0
    ? Number(currentTimeMs >= word.startMs)
    : clampProgress((currentTimeMs - word.startMs) / word.durationMs)

  /** 当前字是否已经到达起音时刻。 */
  const started = currentTimeMs >= word.startMs
  /** 字的三段式时态状态，在起音帧立即进入 active 以触发上抬。 */
  const state: 'past' | 'active' | 'future' = started && fillProgress >= 1
    ? 'past'
    : (started ? 'active' : 'future')

  return {
    state,
    fillProgress
  }
}

/**
 * 用播放器的新采样校准单调逐字时钟。
 *
 * 小幅落后采样通常只是原生 timeupdate 的离散延迟，直接忽略以避免回拉；
 * 前进采样、暂停和真正 seek 会重设时钟锚点，使下一帧只累计采样后的时间。
 *
 * @param positionMs 播放器推送的权威播放位置
 * @param sampledAt 本次采样对应的高精度页面时钟
 */
function syncWordProgressClock(
  positionMs: number,
  sampledAt = performance.now()
): void {
  /** 播放器位置是否发生了明显反向移动。 */
  const movedBackward = positionMs < latestPlayerPositionMs - 24
  /** 权威采样与当前逐字时钟之间的偏差。 */
  const driftMs = positionMs - smoothPositionMs
  /** 本次采样是否代表暂停、seek 或后台恢复后的时间跳变。 */
  const shouldSnap = !props.playing || movedBackward || Math.abs(driftMs) > 400
  latestPlayerPositionMs = positionMs

  if (!shouldSnap && driftMs <= 0) return
  smoothPositionMs = positionMs
  wordProgressPreviousFrameAt = sampledAt
}

/** 返回歌词行相对当前播放时刻的三段式状态。 */
function lyricLineState(lineIndex: number): LyricTemporalState {
  if (lineIndex === activeLineIndex.value) return 'active'
  if (lineIndex < pastLineCount.value) return 'past'
  return 'future'
}

/** 返回歌词行的状态与声部类名。 */
function lyricLineClass(
  line: StandardLyricsLine,
  lineIndex: number
): Record<string, boolean> {
  const state = lyricLineState(lineIndex)
  return {
    [`lyrics-line--${state}`]: true,
    'lyrics-line--background': line.vocalRole === 'background'
  }
}

/** 返回基于播放焦点距离的连续景深（模糊、不透明度与缩放）样式。 */
function lineDynamicStyle(lineIndex: number): Record<string, string> {
  if (!props.immersive) return {}
  const activeIndex = activeLineIndex.value
  if (activeIndex < 0) {
    return {
      filter: 'blur(0.8px)',
      opacity: '0.55',
      transform: 'scale(0.96)'
    }
  }
  if (lineIndex === activeIndex) {
    return {
      filter: 'blur(0px)',
      opacity: '1',
      transform: 'scale(1.08)'
    }
  }
  const distance = Math.abs(lineIndex - activeIndex)
  const blurPx = Math.min(7.5, distance * 2.1)
  const opacity = Math.max(0.18, 0.62 - distance * 0.14)
  const scale = Math.max(0.86, 1 - distance * 0.04)
  return {
    filter: `blur(${blurPx.toFixed(1)}px)`,
    opacity: opacity.toFixed(2),
    transform: `scale(${scale.toFixed(2)})`
  }
}

/** 返回虚拟间奏节点相对当前播放时刻的状态。 */
function instrumentalState(node: LyricTimelineInstrumentalNode): LyricTemporalState {
  if (activeInstrumentalNode.value?.afterLineIndex === node.afterLineIndex) return 'active'
  if (node.afterLineIndex <= completedInstrumentalAfterLineIndex.value) return 'past'
  return 'future'
}

/** 返回虚拟间奏节点基于焦点距离的连续景深样式。 */
function instrumentalDynamicStyle(afterLineIndex: number): Record<string, string> {
  if (!props.immersive) return {}
  const activeAfter = activeInstrumentalNode.value?.afterLineIndex
  if (activeAfter === afterLineIndex) {
    return {
      filter: 'blur(0px)',
      opacity: '1',
      transform: 'scale(1.08)'
    }
  }
  const activeIndex = activeLineIndex.value >= 0
    ? activeLineIndex.value
    : (activeAfter ?? 0)
  const distance = Math.abs(afterLineIndex - activeIndex)
  const blurPx = Math.min(7.5, distance * 2.1)
  const opacity = Math.max(0.18, 0.55 - distance * 0.14)
  const scale = Math.max(0.86, 1 - distance * 0.04)
  return {
    filter: `blur(${blurPx.toFixed(1)}px)`,
    opacity: opacity.toFixed(2),
    transform: `scale(${scale.toFixed(2)})`
  }
}

/** 返回虚拟间奏节点的状态类名。 */
function instrumentalClass(node: LyricTimelineInstrumentalNode): string {
  return `lyrics-instrumental--${instrumentalState(node)}`
}

/**
 * 拉取当前曲目的标准歌词。
 *
 * @param trackId 当前曲目 ID
 */
async function loadLyrics(trackId: string | undefined): Promise<void> {
  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  lyrics.value = null
  errorMessage.value = ''
  loading.value = Boolean(trackId)
  autoFollowPaused.value = false
  cancelSpringScroll()

  if (!trackId) return

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
  } catch {
    if (requestId === latestRequestId) errorMessage.value = '歌词读取失败，请稍后重试。'
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

/** 重试读取歌词。 */
function retryLyrics(): void {
  void loadLyrics(props.trackId)
}

/** 取消仍在运行的弹簧滚动。 */
function cancelSpringScroll(): void {
  if (springFrameId !== undefined) window.cancelAnimationFrame(springFrameId)
  springFrameId = undefined
  springVelocity = 0
  springPreviousFrameAt = 0
}

/** 驱动一帧基于质量、刚度与阻尼的滚动弹簧。 */
function runSpringFrame(frameTime: number): void {
  const container = scrollContainer.value
  if (!container || autoFollowPaused.value) {
    cancelSpringScroll()
    return
  }

  /** 本帧积分时间，限制上限以避免窗口挂起后弹簧失稳。 */
  const deltaSeconds = springPreviousFrameAt > 0
    ? Math.min((frameTime - springPreviousFrameAt) / 1_000, 0.032)
    : 1 / 60
  springPreviousFrameAt = frameTime

  /** 当前弹簧相对目标点的位移。 */
  const displacement = springPosition - springTarget
  /** 胡克力与阻尼力共同产生的加速度。 */
  const acceleration = (
    -SPRING_STIFFNESS * displacement - SPRING_DAMPING * springVelocity
  ) / SPRING_MASS

  springVelocity += acceleration * deltaSeconds
  springPosition += springVelocity * deltaSeconds
  container.scrollTop = springPosition

  const settled =
    Math.abs(springTarget - springPosition) <= SPRING_POSITION_EPSILON &&
    Math.abs(springVelocity) <= SPRING_VELOCITY_EPSILON
  if (settled) {
    container.scrollTop = springTarget
    springFrameId = undefined
    springVelocity = 0
    springPreviousFrameAt = 0
    return
  }

  springFrameId = window.requestAnimationFrame(runSpringFrame)
}

/** 把指定节点弹簧滚动至容器 38% 高度的焦点区。 */
function springScrollToElement(element: HTMLElement): void {
  if (!props.immersive) return

  const container = scrollContainer.value
  if (!container) return

  /** 浏览器允许的最大垂直滚动位置。 */
  const maximumScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  /** 目标节点对齐至黄金焦点后的合法滚动位置。 */
  const targetTop = Math.min(
    maximumScrollTop,
    Math.max(0, element.offsetTop - container.clientHeight * ACTIVE_LINE_FOCUS_RATIO)
  )

  cancelSpringScroll()
  if (prefersReducedMotion()) {
    container.scrollTop = targetTop
    return
  }

  springPosition = container.scrollTop
  springTarget = targetTop
  springFrameId = window.requestAnimationFrame(runSpringFrame)
}

/** 将当前歌词或间奏弹簧移动到沉浸面板焦点区。 */
function scrollToActiveLine(): void {
  if (!props.immersive || autoFollowPaused.value || !activeFocusSelector.value) return

  const container = scrollContainer.value
  const activeElement = container?.querySelector<HTMLElement>(activeFocusSelector.value)
  if (activeElement) springScrollToElement(activeElement)
}

/** 用户主动浏览歌词时暂时停止自动跟随。 */
function pauseAutoFollow(): void {
  if (!props.immersive) return
  autoFollowPaused.value = true
  cancelSpringScroll()
  window.clearTimeout(resumeAutoFollowTimer)
  resumeAutoFollowTimer = window.setTimeout(() => {
    autoFollowPaused.value = false
    void nextTick(scrollToActiveLine)
  }, AUTO_FOLLOW_RESUME_DELAY_MS)
}

/**
 * 点击歌词行后跳转播放进度并立即恢复自动跟随。
 *
 * @param line 被点击的标准歌词行
 * @param lineIndex 被点击歌词行的下标
 */
function seekToLyric(line: StandardLyricsLine, lineIndex: number): void {
  window.clearTimeout(resumeAutoFollowTimer)
  autoFollowPaused.value = false
  emit('seek', line.lineStartMs)
  void nextTick(() => {
    const target = scrollContainer.value?.querySelector<HTMLElement>(
      `[data-lyric-index="${lineIndex}"]`
    )
    if (target) springScrollToElement(target)
  })
}

/** 把当前时刻的逐字进度直接写入 CSS 变量，避免每帧触发 Vue 整树渲染。 */
function writeWordProgress(currentTimeMs: number, activeOnly = false): void {
  const container = scrollContainer.value
  if (!container) return

  /**
   * activeOnly 为 true 时选择激活行与已唱完行，保证切行时 past 行全量补满至 100%，
   * 且对已处于 past 且填充完成的节点跳过重复计算以保障高帧率。
   */
  const selector = activeOnly
    ? '.lyrics-line--active .lyric-word, .lyrics-line--past .lyric-word'
    : '.lyric-word'
  const wordElements = container.querySelectorAll<HTMLElement>(selector)
  wordElements.forEach((element) => {
    if (
      activeOnly &&
      element.dataset['state'] === 'past' &&
      element.style.getPropertyValue('--word-unfilled') === '0.000%'
    ) {
      return
    }

    const startMs = Number(element.dataset['wordStartMs'] ?? 0)
    const durationMs = Number(element.dataset['wordDurationMs'] ?? 0)
    /** 由 DOM 时间数据构造的当前字时间块。 */
    const word: StandardLyricsWord = { text: element.textContent ?? '', startMs, durationMs }
    /** 当前动画帧的填充状态。 */
    const visualState = calculateWordVisualState(word, currentTimeMs)
    /** 白色覆盖层右侧尚未显示的裁切比例。 */
    const unfilledValue = `${((1 - visualState.fillProgress) * 100).toFixed(3)}%`
    if (element.style.getPropertyValue('--word-unfilled') !== unfilledValue) {
      element.style.setProperty('--word-unfilled', unfilledValue)
    }
    /** 起音后保持不变的上抬标记，避免 active → past 时中断短音节动画。 */
    const liftedState = visualState.state === 'future' ? 'false' : 'true'
    if (element.dataset['lifted'] !== liftedState) {
      element.dataset['lifted'] = liftedState
    }
    if (element.dataset['state'] !== visualState.state) {
      element.dataset['state'] = visualState.state
    }
  })
}

/**
 * 驱动一帧逐字遮罩进度并在播放期间持续调度。
 *
 * @param frameTime 当前动画帧的高精度时钟
 * @param generation 当前动画循环代次
 */
function runWordProgressFrame(frameTime: number, generation: number): void {
  if (generation !== wordProgressLoopGeneration) return

  /** 距离上一帧经过的秒数，上限约束至 50ms 避免切后台后突变。 */
  const deltaSeconds = wordProgressPreviousFrameAt > 0
    ? Math.min((frameTime - wordProgressPreviousFrameAt) / 1_000, 0.05)
    : 1 / 60
  wordProgressPreviousFrameAt = frameTime

  if (props.playing) {
    /** 播放状态下按真实物理时间单调推进毫秒数。 */
    smoothPositionMs += deltaSeconds * 1_000
  } else {
    smoothPositionMs = props.positionMs
  }

  syncTimelineFocusPosition(smoothPositionMs)
  writeWordProgress(smoothPositionMs, true)

  if (!props.immersive || !props.playing) {
    wordProgressFrameId = undefined
    wordProgressPreviousFrameAt = 0
    return
  }
  wordProgressFrameId = window.requestAnimationFrame((nextFrameTime) => {
    runWordProgressFrame(nextFrameTime, generation)
  })
}

/** 取消逐字遮罩动画帧。 */
function cancelWordProgressLoop(): void {
  wordProgressLoopGeneration += 1
  if (wordProgressFrameId !== undefined) window.cancelAnimationFrame(wordProgressFrameId)
  wordProgressFrameId = undefined
  wordProgressPreviousFrameAt = 0
}

/** 在 DOM 更新后刷新逐字遮罩，并按播放状态决定是否持续运行。 */
async function refreshWordProgressLoop(): Promise<void> {
  cancelWordProgressLoop()
  /** 本次启动拥有的动画循环代次。 */
  const generation = wordProgressLoopGeneration
  await nextTick()
  if (generation !== wordProgressLoopGeneration) return
  smoothPositionMs = props.positionMs
  latestPlayerPositionMs = props.positionMs
  wordProgressPreviousFrameAt = performance.now()
  syncTimelineFocusPosition(props.positionMs, true)
  writeWordProgress(props.positionMs)
  if (props.immersive && props.playing) {
    wordProgressFrameId = window.requestAnimationFrame((frameTime) => {
      runWordProgressFrame(frameTime, generation)
    })
  }
}

// ========= 生命周期 =========

watch(() => props.trackId, (trackId) => {
  void loadLyrics(trackId)
}, { immediate: true })

watch(activeFocusSelector, async () => {
  await nextTick()
  scrollToActiveLine()
})

watch(() => props.positionMs, () => {
  syncWordProgressClock(props.positionMs)
  syncTimelineFocusPosition(smoothPositionMs)
  writeWordProgress(smoothPositionMs)
}, { flush: 'post' })

watch([
  () => props.playing,
  () => props.immersive,
  displayLines
], () => {
  void refreshWordProgressLoop()
}, { immediate: true })

onBeforeUnmount(() => {
  latestRequestId = ''
  window.clearTimeout(resumeAutoFollowTimer)
  cancelSpringScroll()
  cancelWordProgressLoop()
})
</script>

<template>
  <section
    ref="scrollContainer"
    class="lyrics-panel"
    :class="{
      'lyrics-panel--immersive': props.immersive,
      'lyrics-panel--manual': autoFollowPaused
    }"
    aria-label="歌词"
    @wheel.passive="pauseAutoFollow"
    @touchstart.passive="pauseAutoFollow"
    @touchmove.passive="pauseAutoFollow"
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
      <template
        v-for="node in timelineNodes"
        :key="node.kind === 'line'
          ? `line-${node.line.lineStartMs}-${node.lineIndex}`
          : `instrumental-${node.afterLineIndex}`"
      >
        <li
          v-if="node.kind === 'line'"
          class="lyrics-line"
          :class="lyricLineClass(node.line, node.lineIndex)"
          :style="lineDynamicStyle(node.lineIndex)"
          :data-lyric-index="node.lineIndex"
          :data-state="lyricLineState(node.lineIndex)"
          :aria-current="node.lineIndex === activeLineIndex ? 'true' : undefined"
        >
          <button
            type="button"
            :aria-label="visibleLineText(node.line) || '无词吟唱'"
            @click="seekToLyric(node.line, node.lineIndex)"
          >
            <span class="lyric-line-primary">
              <template v-if="visibleLineWords(node.line).length > 0">
                <span
                  v-for="(word, wordIndex) in visibleLineWords(node.line)"
                  :key="`${word.startMs}-${wordIndex}`"
                  class="lyric-word"
                  :data-word-start-ms="word.startMs"
                  :data-word-duration-ms="word.durationMs"
                  :data-word-text="word.text"
                >{{ word.text }}</span>
              </template>
              <span
                v-else
                class="lyric-line-text"
              >{{ visibleLineText(node.line) || '…' }}</span>
            </span>
            <small v-if="node.line.translation && appPreferences.preferences.value.showLyricTranslation">
              {{ node.line.translation }}
            </small>
          </button>
        </li>

        <li
          v-else
          class="lyrics-instrumental"
          :class="instrumentalClass(node)"
          :style="instrumentalDynamicStyle(node.afterLineIndex)"
          :data-instrumental-after="node.afterLineIndex"
          :data-state="instrumentalState(node)"
        >
          <InstrumentalDots :active="instrumentalState(node) === 'active'" />
        </li>
      </template>
    </ol>
  </section>
</template>

<style scoped>
.lyrics-panel {
  --lyric-color-active: var(--ncx-color-text-primary);
  --lyric-color-unplayed: var(--ncx-color-text-tertiary);
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

.lyric-line-primary {
  display: block;
  max-width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
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
  --lyric-color-active: #ffffff;
  --lyric-color-unplayed: rgb(255 255 255 / 38%);
  display: block;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: auto;
  scrollbar-color: rgb(255 255 255 / 18%) transparent;
  scrollbar-width: thin;
}

.lyrics-panel--immersive.lyrics-panel--manual {
  scrollbar-color: rgb(255 255 255 / 44%) transparent;
}

.lyrics-panel--immersive .lyrics-lines {
  gap: clamp(34px, 4.5vh, 56px);
  min-height: 100%;
  padding: 30vh 34px 38vh 12px;
}

.lyrics-panel--immersive .lyrics-line {
  width: calc(100% / 1.08);
  max-width: 100%;
  color: #ffffff;
  font-size: clamp(38px, 2.6vw + 1.2vh, 52px);
  font-weight: 800;
  -webkit-font-smoothing: antialiased;
  line-height: 1.24;
  letter-spacing: -0.02em;
  transform-origin: left center;
  will-change: transform, opacity, filter;
  transition:
    transform 420ms cubic-bezier(0.25, 1, 0.5, 1),
    opacity 360ms cubic-bezier(0.25, 1, 0.5, 1),
    filter 360ms cubic-bezier(0.25, 1, 0.5, 1),
    color 360ms cubic-bezier(0.25, 1, 0.5, 1);
}

.lyrics-panel--immersive .lyrics-line button {
  min-width: 0;
  max-width: 100%;
  transform-origin: inherit;
  transition: opacity 180ms ease, text-shadow 280ms ease;
}

.lyrics-panel--immersive .lyrics-line button:hover {
  opacity: 0.88;
}

.lyrics-panel--immersive .lyrics-line small {
  display: block;
  margin-top: 8px;
  color: inherit;
  font-size: clamp(20px, 1.4vw + 0.6vh, 28px);
  font-weight: 750;
  opacity: 0.68;
}

.lyrics-panel--immersive .lyrics-line--past {
  font-weight: 750;
  opacity: 0.35;
  filter: blur(1.5px);
  transform: scale(0.88);
}

.lyrics-panel--immersive .lyrics-line--past button {
  font-size: 0.9em;
}

.lyrics-panel--immersive .lyrics-line--active {
  color: #ffffff;
  font-weight: 900;
  letter-spacing: -0.024em;
  opacity: 1;
  filter: blur(0);
  transform: scale(1.08);
  text-shadow: 0 4px 28px rgb(0 0 0 / 42%);
}

.lyrics-panel--immersive .lyrics-line--active button:hover {
  opacity: 1;
}

.lyrics-panel--immersive .lyrics-line--active small {
  opacity: 0.84;
}

.lyrics-panel--immersive .lyrics-line--future {
  font-weight: 750;
  opacity: 0.55;
  filter: blur(0.8px);
  transform: scale(0.96);
}

.lyric-word {
  position: relative;
  display: inline-block;
  max-width: 100%;
  vertical-align: baseline;
  color: var(--lyric-color-unplayed);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  filter: drop-shadow(0 0 0 rgb(255 255 255 / 0%));
  transform: translate3d(0, 0, 0) scale(1);
  transform-origin: center bottom;
  transition:
    transform 600ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 600ms ease;
  will-change: transform;
}

.lyric-word::after {
  position: absolute;
  inset: 0;
  color: var(--lyric-color-active);
  clip-path: inset(0 var(--word-unfilled, 100%) 0 0);
  content: attr(data-word-text);
  pointer-events: none;
  white-space: inherit;
  word-break: inherit;
  overflow-wrap: inherit;
}

.lyric-word[data-lifted="true"] {
  transform: translate3d(0, -1.5px, 0) scale(1.02);
}

.lyric-word[data-state="active"] {
  filter: drop-shadow(0 3px 8px rgb(255 255 255 / 50%));
}

.lyric-word[data-state="active"]::after {
  will-change: clip-path;
}

.lyric-word[data-state="past"] {
  color: var(--lyric-color-active);
  filter: drop-shadow(0 2px 6px rgb(255 255 255 / 30%));
}

.lyrics-line--background {
  transform-origin: right center;
}

.lyrics-panel--immersive .lyrics-line--background {
  margin-left: auto;
}

.lyrics-line--background button {
  width: 82%;
  margin-left: auto;
  text-align: right;
}

.lyrics-line--background .lyric-line-primary {
  font-size: 0.82em;
  opacity: 0.82;
}

.lyrics-line--background small {
  font-size: 0.66em;
}

.lyrics-instrumental {
  display: flex;
  min-height: 58px;
  align-items: center;
  color: #ffffff;
  transform-origin: left center;
  transition:
    transform 480ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 380ms ease,
    filter 380ms ease;
}

.lyrics-instrumental--past {
  opacity: 0.28;
  filter: blur(1.5px);
  transform: scale(0.88);
}

.lyrics-instrumental--active {
  opacity: 1;
  filter: blur(0);
  transform: scale(1.08);
}

.lyrics-instrumental--future {
  opacity: 0.5;
  filter: blur(0.8px);
  transform: scale(0.96);
}

@media (height < 720px) {
  .lyrics-panel--immersive .lyrics-lines {
    gap: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-panel--immersive .lyrics-line,
  .lyrics-instrumental,
  .lyric-word {
    animation: none;
    transition: none;
  }
}
</style>
