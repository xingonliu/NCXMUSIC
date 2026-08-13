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
  /** 已合并强调峰值与最终悬浮位置的单一垂直位移。 */
  liftOffsetEm: number
}

/** 缓存后的逐字渲染节点，避免动画帧内反复查询和解析 DOM。 */
interface WordRenderEntry {
  /** 当前字或音节的 DOM。 */
  element: HTMLElement
  /** 当前字或音节的时间数据。 */
  word: StandardLyricsWord
  /** 上一帧写入的填充进度。 */
  fillValue?: string
  /** 上一帧写入的垂直位移。 */
  liftValue?: string
  /** 上一帧写入的时态。 */
  state?: WordVisualState['state']
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
  /** 当前封面提亮后的歌词播放前沿色。 */
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

/** 歌词面板使用的封面前沿色 CSS 变量。 */
const lyricAccentStyle = computed<Record<string, string>>(() => ({
  '--lyric-accent-color': props.accentColor
}))

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

/** 播放时钟锚点对应的媒体位置。 */
let playbackClockAnchorPositionMs = props.positionMs

/** 播放时钟锚点对应的高精度页面时间。 */
let playbackClockAnchorAt = 0

/** 最近一次播放器推送的权威位置，用于识别 seek。 */
let latestPlayerPositionMs = props.positionMs

/** 最近一次实际用于歌词渲染的位置，播放期间只允许单调递增。 */
let lastRenderedPlaybackPositionMs = props.positionMs

/** 按歌词行缓存的逐字渲染节点。 */
const wordRenderEntriesByLine = new Map<number, WordRenderEntry[]>()

/** 上一帧仍保持逐字悬浮的歌词行。 */
let previouslyPresentedWordLineIndexes: number[] = []

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
const ACTIVE_LINE_FOCUS_RATIO = 0.42

/** 插入虚拟间奏节点所需的最短空白时长。 */
const INSTRUMENTAL_GAP_THRESHOLD_MS = 8_000

/** 自动恢复跟随前的用户闲置时长。 */
const AUTO_FOLLOW_RESUME_DELAY_MS = 4_000

/** Apple Music 风格的基础悬浮高度，约等于沉浸字号下的 1.5 至 1.8px。 */
const WORD_BASE_FLOAT_EM = 0.05

/** 起音强调额外叠加的短促抬升高度。 */
const WORD_EMPHASIS_FLOAT_EM = 0.032

/** 起音强调的最短完整周期，确保在 60Hz 屏幕上能看见连续运动。 */
const WORD_EMPHASIS_MIN_DURATION_MS = 420

/** 起音强调的最长完整周期，避免长音节持续放大过久。 */
const WORD_EMPHASIS_MAX_DURATION_MS = 900

/** 沉浸歌词中只用于区分左右声部、不应作为正文展示的行首标签。 */
const VOCAL_ROLE_PREFIX_PATTERN = /^\s*(?:男|女|男声|女声|和声|伴唱|合唱)\s*[:：]\s*/u

/** 沉浸歌词中包含声部或演唱者信息的行首括号标签。 */
const VOCAL_METADATA_PREFIX_PATTERN = /^\s*[（(]\s*(?:男|女|男声|女声|和声|伴唱|合唱)(?:\s*[:：][^）)]*)?\s*[）)]\s*/u

/** 弹簧质量参数。 */
const SPRING_MASS = 1

/** 弹簧刚度参数（调整为低频 Apple 阻尼弹簧）。 */
const SPRING_STIFFNESS = 115

/** 弹簧阻尼参数（调整为厚重流体滑移感）。 */
const SPRING_DAMPING = 22

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

/** 返回歌词行真实的收音时间，兼容行时长与最后一个音节不完全一致。 */
function lyricLineEndMs(line: StandardLyricsLine): number {
  const lastWordEndMs = lineWords(line).reduce(
    (latestEndMs, word) => Math.max(latestEndMs, word.startMs + word.durationMs),
    line.lineStartMs
  )
  return Math.max(line.lineStartMs + line.lineDurationMs, lastWordEndMs)
}

/** 歌词加载时一次性计算的收音时间，动画帧内不再遍历每个音节。 */
const lyricLineEndTimes = computed<number[]>(() => (
  displayLines.value.map((line) => lyricLineEndMs(line))
))

/** 每行之前最晚的收音时间，用于快速跳过不可能重叠的历史歌词。 */
const lyricLinePrefixMaxEndTimes = computed<number[]>(() => {
  let latestEndMs = Number.NEGATIVE_INFINITY
  return lyricLineEndTimes.value.map((lineEndMs) => {
    latestEndMs = Math.max(latestEndMs, lineEndMs)
    return latestEndMs
  })
})

/** 按前一行下标索引虚拟间奏，动画帧内不再线性扫描整个时间轴。 */
const instrumentalNodesByAfterLineIndex = computed<Map<number, LyricTimelineInstrumentalNode>>(() => {
  const nodesByLineIndex = new Map<number, LyricTimelineInstrumentalNode>()
  timelineNodes.value.forEach((node) => {
    if (node.kind === 'instrumental') nodesByLineIndex.set(node.afterLineIndex, node)
  })
  return nodesByLineIndex
})

/** 通过二分查找返回指定时刻最近已经开始的歌词行，不处理间奏状态。 */
function startedLineIndexAtPosition(positionMs: number): number {
  const lines = displayLines.value
  let lower = 0
  let upper = lines.length - 1
  let result = -1

  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2)
    const line = lines[middle]
    if (line && line.lineStartMs <= positionMs) {
      result = middle
      lower = middle + 1
    } else {
      upper = middle - 1
    }
  }

  return result
}

/** 返回指定时刻命中的虚拟间奏节点。 */
function instrumentalAtPosition(
  positionMs: number
): LyricTimelineInstrumentalNode | undefined {
  const startedLineIndex = startedLineIndexAtPosition(positionMs)
  const node = instrumentalNodesByAfterLineIndex.value.get(startedLineIndex)
  return node && node.startMs <= positionMs && positionMs < node.endMs
    ? node
    : undefined
}

/** 通过二分查找返回指定时刻最近已经开始的歌词行。 */
function focusedLineIndexAtPosition(positionMs: number): number {
  if (instrumentalAtPosition(positionMs)) return -1
  return startedLineIndexAtPosition(positionMs)
}

/**
 * 返回指定时刻仍处在实际演唱区间内的歌词行。
 *
 * 从最近起音行向前只检查可能重叠的邻近区间，避免每帧遍历整首歌词。
 */
function singingLineIndexesAtPosition(positionMs: number): number[] {
  const indexes: number[] = []
  const latestStartedLineIndex = startedLineIndexAtPosition(positionMs)
  for (let lineIndex = latestStartedLineIndex; lineIndex >= 0; lineIndex -= 1) {
    const line = displayLines.value[lineIndex]
    if (!line) continue
    const lineEndMs = lyricLineEndTimes.value[lineIndex] ?? line.lineStartMs
    if (line.lineStartMs <= positionMs && positionMs < lineEndMs) {
      indexes.push(lineIndex)
    }

    /** 更早歌词的最大收音时间也已过去时，可以安全结束回溯。 */
    if (lineIndex === 0 || lyricLinePrefixMaxEndTimes.value[lineIndex - 1]! <= positionMs) break
  }
  return indexes.reverse()
}

/** 当前精确命中的歌词行下标；间奏或空白时为 -1。 */
const activeLineIndex = computed<number>(() => {
  return focusedLineIndexAtPosition(animationPositionMs.value)
})

/** 当前仍处在真实演唱区间内的歌词行。 */
const singingLineIndexes = computed<number[]>(() => (
  singingLineIndexesAtPosition(animationPositionMs.value)
))

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
  return instrumentalAtPosition(animationPositionMs.value)
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

/** 平滑连接零至一，用于构造没有突变的一次性运动包络。 */
function smoothstepProgress(value: number): number {
  const progress = clampProgress(value)
  return progress * progress * (3 - 2 * progress)
}

/** 起音阶段快速但无过冲地进入峰值。 */
function easeOutCubic(value: number): number {
  const progress = clampProgress(value)
  return 1 - (1 - progress) ** 3
}

/**
 * 返回指定时刻对应的歌词或间奏焦点选择器。
 *
 * @param positionMs 需要定位的播放时刻
 */
function focusSelectorAtPosition(positionMs: number): string {
  /** 当前时刻命中的虚拟间奏节点。 */
  const instrumentalNode = instrumentalAtPosition(positionMs)
  if (instrumentalNode) {
    return `[data-instrumental-after="${instrumentalNode.afterLineIndex}"]`
  }

  /** 当前时刻命中的最后一行歌词下标。 */
  const lineIndex = focusedLineIndexAtPosition(positionMs)

  return lineIndex >= 0 ? `[data-lyric-index="${lineIndex}"]` : ''
}

/**
 * 仅在歌词焦点真正跨行时更新 Vue 响应式时间轴，避免逐帧重渲染歌词列表。
 *
 * @param positionMs 当前动画时刻
 * @param force 是否强制同步初始或换歌状态
 */
function syncTimelinePresentationPosition(positionMs: number, force = false): void {
  const nextFocusSelector = focusSelectorAtPosition(positionMs)
  const nextSingingIndexes = singingLineIndexesAtPosition(positionMs).join(',')
  const currentSingingIndexes = singingLineIndexes.value.join(',')
  if (
    !force &&
    nextFocusSelector === activeFocusSelector.value &&
    nextSingingIndexes === currentSingingIndexes
  ) return
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

/** 返回指定播放时刻下单个字或音节的填充与两层运动状态。 */
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

  /** 当前音节已经经过的媒体时间。 */
  const elapsedMs = currentTimeMs - word.startMs

  /**
   * 起音强调随音节长度自适应，并通过单一轨迹完成抬起与稳定。
   * 抬起至少跨越约六帧，避免短 YRC 音节在屏幕上表现为瞬移。
   */
  const pulseDurationMs = Math.max(
    WORD_EMPHASIS_MIN_DURATION_MS,
    Math.min(WORD_EMPHASIS_MAX_DURATION_MS, word.durationMs)
  )
  const attackDurationMs = Math.max(100, Math.min(140, pulseDurationMs * 0.28))
  const peakLiftEm = WORD_BASE_FLOAT_EM + WORD_EMPHASIS_FLOAT_EM
  let liftOffsetEm = 0
  if (started && elapsedMs <= attackDurationMs) {
    /** 第一段只向上运动：原位平滑抵达强调峰值。 */
    liftOffsetEm = -peakLiftEm * easeOutCubic(elapsedMs / attackDurationMs)
  } else if (started && elapsedMs < pulseDurationMs) {
    /** 第二段只向下运动：从峰值平滑落到最终悬浮位，不再与另一条上升曲线竞争。 */
    const settleProgress = smoothstepProgress(
      (elapsedMs - attackDurationMs) / (pulseDurationMs - attackDurationMs)
    )
    liftOffsetEm = -peakLiftEm + WORD_EMPHASIS_FLOAT_EM * settleProgress
  } else if (started) {
    liftOffsetEm = -WORD_BASE_FLOAT_EM
  }

  return {
    state,
    fillProgress,
    liftOffsetEm
  }
}

/**
 * 返回指定高精度页面时间对应的媒体位置。
 *
 * 位置永远从最近的媒体采样锚点计算，不按帧累加；因此掉帧不会让歌词时钟落后。
 */
function playbackPositionAt(frameTime = performance.now()): number {
  if (!props.playing) {
    lastRenderedPlaybackPositionMs = playbackClockAnchorPositionMs
    return playbackClockAnchorPositionMs
  }
  const predictedPositionMs = Math.max(
    0,
    playbackClockAnchorPositionMs + Math.max(0, frameTime - playbackClockAnchorAt)
  )
  /** 离散 timeupdate 的迟到采样不得让正在播放的逐字运动倒退。 */
  lastRenderedPlaybackPositionMs = Math.max(
    lastRenderedPlaybackPositionMs,
    predictedPositionMs
  )
  return lastRenderedPlaybackPositionMs
}

/** 把播放时钟直接锚定到指定媒体采样。 */
function anchorPlaybackClock(positionMs: number, sampledAt = performance.now()): void {
  playbackClockAnchorPositionMs = Math.max(0, positionMs)
  playbackClockAnchorAt = sampledAt
  latestPlayerPositionMs = positionMs
  lastRenderedPlaybackPositionMs = playbackClockAnchorPositionMs
}

/**
 * 用播放器的新采样校准逐字时钟。
 *
 * 普通 timeupdate 对小误差做对称的温和校正，暂停和 seek 则立即对齐。
 *
 * @param positionMs 播放器推送的权威播放位置
 * @param sampledAt 本次采样对应的高精度页面时钟
 * @returns 本次采样是否被识别为需要全量重绘的时间跳变
 */
function syncWordProgressClock(
  positionMs: number,
  sampledAt = performance.now()
): boolean {
  const predictedPositionMs = playbackPositionAt(sampledAt)
  /** 播放器位置是否发生了明显反向移动。 */
  const movedBackward = positionMs < latestPlayerPositionMs - 48
  /** 权威采样与锚点推导位置之间的偏差。 */
  const driftMs = positionMs - predictedPositionMs
  /** 暂停、明确的反向 seek 或大幅向前跳转必须立刻对齐。 */
  const shouldSnap = !props.playing || movedBackward || driftMs > 240

  if (shouldSnap) {
    anchorPlaybackClock(positionMs, sampledAt)
    return true
  }

  /**
   * 普通负偏差来自离散采样延迟，不能反向拖动动画时钟。
   * 只有权威位置略微领先时才做温和的正向校准。
   */
  if (driftMs > 0) {
    playbackClockAnchorPositionMs = predictedPositionMs + driftMs * 0.2
    playbackClockAnchorAt = sampledAt
  }
  latestPlayerPositionMs = positionMs
  return false
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
    'lyrics-line--singing': singingLineIndexes.value.includes(lineIndex),
    'lyrics-line--word-timed': lineWords(line).length > 0,
    'lyrics-line--line-timed': lineWords(line).length === 0,
    'lyrics-line--background': line.vocalRole === 'background'
  }
}

/** 返回基于播放焦点距离的连续景深样式，只使用合成友好的透明度与缩放。 */
function lineDynamicStyle(lineIndex: number): Record<string, string> {
  if (!props.immersive) return {}
  const activeIndex = activeLineIndex.value
  if (activeIndex < 0) {
    return {
      opacity: '0.42',
      transform: 'scale(0.965)'
    }
  }
  if (lineIndex === activeIndex) {
    return {
      opacity: '1',
      transform: 'scale(1.035)'
    }
  }
  const distance = Math.abs(lineIndex - activeIndex)
  const opacity = Math.max(0.16, 0.56 - distance * 0.12)
  const scale = Math.max(0.91, 0.985 - distance * 0.022)
  return {
    opacity: opacity.toFixed(2),
    transform: `scale(${scale.toFixed(3)})`
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
      opacity: '1',
      transform: 'scale(1.035)'
    }
  }
  const activeIndex = activeLineIndex.value >= 0
    ? activeLineIndex.value
    : (activeAfter ?? 0)
  const distance = Math.abs(afterLineIndex - activeIndex)
  const opacity = Math.max(0.16, 0.5 - distance * 0.12)
  const scale = Math.max(0.91, 0.98 - distance * 0.022)
  return {
    opacity: opacity.toFixed(2),
    transform: `scale(${scale.toFixed(3)})`
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

/** 把指定节点中心弹簧滚动至容器 42% 高度的焦点区。 */
function springScrollToElement(element: HTMLElement): void {
  if (!props.immersive) return

  const container = scrollContainer.value
  if (!container) return

  /** 浏览器允许的最大垂直滚动位置。 */
  const maximumScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  /** 目标节点对齐至黄金焦点后的合法滚动位置。 */
  const targetTop = Math.min(
    maximumScrollTop,
    Math.max(
      0,
      element.offsetTop + element.offsetHeight / 2 -
        container.clientHeight * ACTIVE_LINE_FOCUS_RATIO
    )
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

/** 在歌词 DOM 更新后建立一次逐字节点缓存。 */
function cacheWordRenderEntries(): void {
  const container = scrollContainer.value
  wordRenderEntriesByLine.clear()
  previouslyPresentedWordLineIndexes = []
  if (!container) return

  container.querySelectorAll<HTMLElement>('.lyrics-line[data-lyric-index]').forEach((lineElement) => {
    const lineIndex = Number(lineElement.dataset['lyricIndex'] ?? -1)
    if (!Number.isInteger(lineIndex) || lineIndex < 0) return

    /** 当前行只在 DOM 初始化时解析一次的逐字渲染节点。 */
    const entries = Array.from(lineElement.querySelectorAll<HTMLElement>('.lyric-word'))
      .map((element): WordRenderEntry => ({
        element,
        word: {
          text: element.dataset['wordText'] ?? element.textContent ?? '',
          startMs: Number(element.dataset['wordStartMs'] ?? 0),
          durationMs: Number(element.dataset['wordDurationMs'] ?? 0)
        }
      }))
    if (entries.length > 0) wordRenderEntriesByLine.set(lineIndex, entries)
  })
}

/** 把单个音节当前帧的状态写入缓存 DOM。 */
function renderWordEntry(
  entry: WordRenderEntry,
  currentTimeMs: number,
  maintainFloat: boolean
): void {
  const visualState = calculateWordVisualState(entry.word, currentTimeMs)
  const fillValue = `${(visualState.fillProgress * 100).toFixed(3)}%`
  /** 单一位移轨迹保持至换行；不再叠加会互相抵消的多条 transform 曲线。 */
  const liftEm = maintainFloat ? visualState.liftOffsetEm : 0
  const liftValue = `${liftEm.toFixed(4)}em`

  if (entry.fillValue !== fillValue) {
    entry.element.style.setProperty('--word-fill', fillValue)
    entry.fillValue = fillValue
  }
  if (entry.liftValue !== liftValue) {
    entry.element.style.setProperty('--word-lift', liftValue)
    entry.liftValue = liftValue
  }
  if (entry.state !== visualState.state) {
    entry.element.dataset['state'] = visualState.state
    entry.state = visualState.state
  }
}

/** 渲染指定逐字歌词行。 */
function renderWordLine(
  lineIndex: number,
  currentTimeMs: number,
  maintainFloat: boolean
): void {
  wordRenderEntriesByLine.get(lineIndex)?.forEach((entry) => {
    renderWordEntry(entry, currentTimeMs, maintainFloat)
  })
}

/**
 * 返回当前仍应保持逐字悬浮的行。
 *
 * 当前焦点行在收音后仍保持抬起，直到下一行接管；重叠声部则在演唱期间同时保留。
 */
function presentedWordLineIndexesAtPosition(currentTimeMs: number): number[] {
  const indexes = new Set(singingLineIndexesAtPosition(currentTimeMs))
  const focusedLineIndex = focusedLineIndexAtPosition(currentTimeMs)
  if (focusedLineIndex >= 0) indexes.add(focusedLineIndex)
  return [...indexes].filter((lineIndex) => wordRenderEntriesByLine.has(lineIndex))
}

/** 在初始化、暂停或 seek 后一次性恢复所有逐字节点。 */
function renderAllWordStates(currentTimeMs: number): void {
  const presentedLineIndexSet = new Set(presentedWordLineIndexesAtPosition(currentTimeMs))
  wordRenderEntriesByLine.forEach((_entries, lineIndex) => {
    renderWordLine(lineIndex, currentTimeMs, presentedLineIndexSet.has(lineIndex))
  })
  previouslyPresentedWordLineIndexes = [...presentedLineIndexSet]
}

/** 播放期间只更新当前展示行，并在换行时清除上一行的基础悬浮。 */
function renderAnimatedWordStates(currentTimeMs: number): void {
  const presentedLineIndexes = presentedWordLineIndexesAtPosition(currentTimeMs)
  const presentedLineIndexSet = new Set(presentedLineIndexes)

  previouslyPresentedWordLineIndexes.forEach((lineIndex) => {
    if (!presentedLineIndexSet.has(lineIndex)) renderWordLine(lineIndex, currentTimeMs, false)
  })
  presentedLineIndexes.forEach((lineIndex) => renderWordLine(lineIndex, currentTimeMs, true))
  previouslyPresentedWordLineIndexes = presentedLineIndexes
}

/**
 * 驱动一帧逐字柔边遮罩并在播放期间持续调度。
 *
 * @param frameTime 当前动画帧的高精度时钟
 * @param generation 当前动画循环代次
 */
function runWordProgressFrame(frameTime: number, generation: number): void {
  if (generation !== wordProgressLoopGeneration) return

  /** 直接从媒体锚点求值，丢帧后下一帧仍与音频处在同一时刻。 */
  const currentTimeMs = playbackPositionAt(frameTime)
  syncTimelinePresentationPosition(currentTimeMs)
  renderAnimatedWordStates(currentTimeMs)

  if (!props.immersive || !props.playing) {
    wordProgressFrameId = undefined
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
}

/** 在 DOM 更新后刷新逐字遮罩，并按播放状态决定是否持续运行。 */
async function refreshWordProgressLoop(): Promise<void> {
  cancelWordProgressLoop()
  /** 本次启动拥有的动画循环代次。 */
  const generation = wordProgressLoopGeneration
  await nextTick()
  if (generation !== wordProgressLoopGeneration) return
  cacheWordRenderEntries()
  anchorPlaybackClock(props.positionMs)
  syncTimelinePresentationPosition(props.positionMs, true)
  renderAllWordStates(props.positionMs)
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
  const discontinuity = syncWordProgressClock(props.positionMs)
  const currentTimeMs = playbackPositionAt()
  syncTimelinePresentationPosition(currentTimeMs, discontinuity)
  if (discontinuity) {
    renderAllWordStates(currentTimeMs)
  } else {
    renderAnimatedWordStates(currentTimeMs)
  }
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
  wordRenderEntriesByLine.clear()
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
    :style="lyricAccentStyle"
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
  --lyric-accent-color: rgb(196 218 255);
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
  font-weight: 620;
  line-height: 1.35;
  transition:
    color var(--ncx-motion-normal),
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
}

.lyrics-line--line-timed.lyrics-line--singing .lyric-line-primary {
  text-shadow: 0 1px 18px rgb(255 255 255 / 12%);
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
  gap: clamp(28px, 3.7vh, 42px);
  min-height: 100%;
  padding: 42% 36px 50% 12px;
}

.lyrics-panel--immersive .lyrics-line {
  width: 96.5%;
  max-width: 100%;
  color: #ffffff;
  font-size: clamp(30px, 2.4vw, 36px);
  font-weight: 660;
  -webkit-font-smoothing: antialiased;
  line-height: 1.28;
  transform-origin: left center;
  transition:
    transform 460ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
    color 240ms ease;
}

.lyrics-panel--immersive .lyrics-line button {
  min-width: 0;
  max-width: 100%;
  transform-origin: inherit;
  transition: opacity 160ms ease;
}

.lyrics-panel--immersive .lyrics-line button:hover {
  opacity: 0.88;
}

.lyrics-panel--immersive .lyrics-line small {
  display: block;
  margin-top: 7px;
  color: inherit;
  font-size: clamp(17px, 1.25vw, 20px);
  font-weight: 600;
  opacity: 0.64;
}

.lyrics-panel--immersive .lyrics-line--past {
  opacity: 0.35;
}

.lyrics-panel--immersive .lyrics-line--active {
  color: #ffffff;
  opacity: 1;
  text-shadow: 0 2px 18px rgb(0 0 0 / 24%);
}

.lyrics-panel--immersive .lyrics-line--active button:hover {
  opacity: 1;
}

.lyrics-panel--immersive .lyrics-line--active small {
  opacity: 0.82;
}

.lyrics-panel--immersive .lyrics-line--future {
  opacity: 0.55;
}

.lyric-word {
  --word-fill: 0%;
  --word-lift: 0px;
  position: relative;
  display: inline-block;
  max-width: 100%;
  vertical-align: baseline;
  color: var(--lyric-color-unplayed);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  transform: translate3d(0, var(--word-lift), 0);
  transform-origin: center bottom;
}

.lyric-word::after {
  position: absolute;
  inset: 0;
  color: transparent;
  content: attr(data-word-text);
  background-image: linear-gradient(
    90deg,
    var(--lyric-color-active) 0%,
    var(--lyric-color-active) calc(var(--word-fill) - 0.2em),
    var(--lyric-accent-color) calc(var(--word-fill) + 0.04em),
    var(--lyric-accent-color) 100%
  );
  background-clip: text;
  mask-image: linear-gradient(
    90deg,
    #000 0%,
    #000 var(--word-fill),
    transparent calc(var(--word-fill) + 0.16em),
    transparent 100%
  );
  mask-repeat: no-repeat;
  pointer-events: none;
  text-shadow: 0 0 12px rgb(255 255 255 / 14%);
  transition: opacity 80ms linear;
  white-space: inherit;
  word-break: inherit;
  overflow-wrap: inherit;
  -webkit-mask-image: linear-gradient(
    90deg,
    #000 0%,
    #000 var(--word-fill),
    transparent calc(var(--word-fill) + 0.16em),
    transparent 100%
  );
  -webkit-mask-repeat: no-repeat;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.lyric-word:not([data-state])::after,
.lyric-word[data-state="future"]::after,
.lyric-word[data-state="past"]::after {
  opacity: 0;
}

/**
 * 整条当前声部在完整运动周期内保持同一合成策略。
 * 不能只绑定 active 音节，否则音节收音变成 past 时会在回落中途撤销图层并产生抖动。
 */
.lyrics-line--word-timed:is(.lyrics-line--active, .lyrics-line--singing) .lyric-word {
  will-change: transform;
}

.lyric-word[data-state="past"] {
  color: var(--lyric-color-active);
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
    opacity 320ms ease;
}

.lyrics-instrumental--past {
  opacity: 0.28;
}

.lyrics-instrumental--active {
  opacity: 1;
}

.lyrics-instrumental--future {
  opacity: 0.5;
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
