import type {
  StandardLyrics,
  StandardLyricsLine,
  StandardLyricsWord
} from '../../../../shared/schemas/music'
import type { LyricLine, LyricWord } from './interfaces'

// ========= 类型 =========

/** 标准歌词转换为视觉引擎数据时使用的展示选项。 */
export interface LyricsEngineAdapterOptions {
  /** 是否把翻译歌词交给视觉引擎渲染。 */
  showTranslation: boolean
}

/** 已识别的双声部身份和行首标签长度。 */
interface DuetVoiceMetadata {
  /** 当前歌词行声明的演唱声部。 */
  agent: string
  /** 行首声部标签占用的 Unicode 字符数。 */
  prefixLength: number
}

// ========= 变量 =========

/** 男声、女声等双声部标签；第一个身份在左侧，另一个身份在右侧。 */
const DUET_VOICE_PREFIX_PATTERN = /^\s*(男声|女声|男|女)\s*[:：]\s*/u

/** 带演唱者描述的双声部元数据标签。 */
const DUET_METADATA_PREFIX_PATTERN = /^\s*[（(]\s*(男声|女声|男|女)(?:\s*[:：][^）)]*)?\s*[）)]\s*/u

/** 和声、伴唱与合唱等背景声标签。 */
const BACKGROUND_VOICE_PREFIX_PATTERN = /^\s*(?:和声|伴唱|合唱)\s*[:：]\s*/u

/** 带描述信息的背景声元数据标签。 */
const BACKGROUND_METADATA_PREFIX_PATTERN = /^\s*[（(]\s*(?:和声|伴唱|合唱)(?:\s*[:：][^）)]*)?\s*[）)]\s*/u

// ========= 函数 =========

/** 返回字符串按 Unicode 字符计算的长度。 */
function unicodeLength(text: string): number {
  return Array.from(text).length
}

/** 从歌词行开头读取双声部身份与需要隐藏的标签长度。 */
function readDuetVoiceMetadata(text: string): DuetVoiceMetadata | undefined {
  /** 普通“男：/女：”形式的匹配结果。 */
  const directMatch = DUET_VOICE_PREFIX_PATTERN.exec(text)
  if (directMatch?.[1]) {
    return {
      agent: directMatch[1],
      prefixLength: unicodeLength(directMatch[0])
    }
  }

  /** “（女：演唱者）”形式的匹配结果。 */
  const metadataMatch = DUET_METADATA_PREFIX_PATTERN.exec(text)
  if (!metadataMatch?.[1]) return undefined
  return {
    agent: metadataMatch[1],
    prefixLength: unicodeLength(metadataMatch[0])
  }
}

/** 返回背景声标签占用的 Unicode 字符数。 */
function backgroundPrefixLength(text: string): number {
  /** 普通背景声标签或括号元数据标签。 */
  const match = BACKGROUND_VOICE_PREFIX_PATTERN.exec(text) ??
    BACKGROUND_METADATA_PREFIX_PATTERN.exec(text)
  return match ? unicodeLength(match[0]) : 0
}

/** 从文本开头删除指定数量的 Unicode 字符。 */
function removeUnicodePrefix(text: string, prefixLength: number): string {
  return Array.from(text).slice(prefixLength).join('')
}

/**
 * 从逐字时间轴中删除展示层声部标签，同时保留剩余字词的原始时间戳。
 */
function removeWordPrefix(
  words: StandardLyricsWord[],
  prefixLength: number
): StandardLyricsWord[] {
  /** 尚未从逐字文本中消费的标签字符数。 */
  let remainingPrefixLength = prefixLength
  /** 删除标签后的逐字时间轴。 */
  const visibleWords: StandardLyricsWord[] = []

  for (const word of words) {
    if (remainingPrefixLength <= 0) {
      visibleWords.push(word)
      continue
    }

    /** 当前时间块按 Unicode 字符拆分后的正文。 */
    const characters = Array.from(word.text)
    if (remainingPrefixLength >= characters.length) {
      remainingPrefixLength -= characters.length
      continue
    }

    /** 标签和正文共用时间块时保留下来的正文。 */
    const visibleText = characters.slice(remainingPrefixLength).join('')
    remainingPrefixLength = 0
    if (visibleText) visibleWords.push({ ...word, text: visibleText })
  }

  return visibleWords
}

/** 将标准逐字时间块转换为 AMLL 视觉引擎使用的绝对起止时间。 */
function adaptWord(word: StandardLyricsWord): LyricWord {
  return {
    word: word.text,
    startTime: word.startMs,
    endTime: word.startMs + word.durationMs
  }
}

/** 返回一行歌词可靠的结束时间。 */
function lineEndTime(line: StandardLyricsLine, words: StandardLyricsWord[]): number {
  /** 行级时间轴声明的结束时间。 */
  const declaredEndTime = line.lineStartMs + line.lineDurationMs
  /** 逐字时间轴中最晚的结束时间。 */
  const latestWordEndTime = words.reduce(
    (latestEndTime, word) => Math.max(latestEndTime, word.startMs + word.durationMs),
    line.lineStartMs
  )
  return Math.max(line.lineStartMs, declaredEndTime, latestWordEndTime)
}

/** 把单行标准歌词转换为完整的 AMLL 歌词行。 */
function adaptLine(
  line: StandardLyricsLine,
  options: LyricsEngineAdapterOptions,
  primaryDuetAgent: string | undefined
): { line: LyricLine; discoveredPrimaryAgent?: string } {
  /** 从正文中识别出的双声部元数据。 */
  const duetMetadata = readDuetVoiceMetadata(line.text)
  /** 当前行背景声标签占用的字符数。 */
  const bgPrefixLength = duetMetadata ? 0 : backgroundPrefixLength(line.text)
  /** 当前行需要从展示正文中删除的标签字符数。 */
  const visiblePrefixLength = duetMetadata?.prefixLength ?? bgPrefixLength
  /** 删除声部标签后的可见正文。 */
  const visibleText = removeUnicodePrefix(line.text, visiblePrefixLength)
  /** 删除声部标签后的原始逐字时间轴。 */
  const visibleTimedWords = removeWordPrefix(line.words ?? [], visiblePrefixLength)
  /** 当前行可靠的结束时间。 */
  const endTime = lineEndTime(line, visibleTimedWords)
  /** 普通 LRC 行使用单个整行时间块，以触发 AMLL 的非逐字渲染模式。 */
  const engineWords = visibleTimedWords.length > 0
    ? visibleTimedWords.map(adaptWord)
    : [{ word: visibleText || line.text || '…', startTime: line.lineStartMs, endTime }]
  /** 当前行是否属于第二个主唱声部。 */
  const isDuet = Boolean(
    duetMetadata && primaryDuetAgent && duetMetadata.agent !== primaryDuetAgent
  )
  /** 男/女主唱标签不能沿用旧数据里误判的 background 标记。 */
  const isBackground = !duetMetadata && line.vocalRole === 'background'

  return {
    line: {
      words: engineWords,
      translatedLyric: options.showTranslation ? (line.translation ?? '') : '',
      romanLyric: '',
      startTime: line.lineStartMs,
      endTime,
      isBG: isBackground,
      isDuet
    },
    ...(!primaryDuetAgent && duetMetadata
      ? { discoveredPrimaryAgent: duetMetadata.agent }
      : {})
  }
}

/**
 * 把 NcxMusic 标准歌词转换为内置 AMLL 视觉/动效引擎的完整数据模型。
 */
export function adaptStandardLyrics(
  lyrics: StandardLyrics | null,
  options: LyricsEngineAdapterOptions
): LyricLine[] {
  if (!lyrics) return []

  /** 首个显式双声部身份，作为左侧主声部。 */
  let primaryDuetAgent: string | undefined
  /** 转换完成的歌词视觉时间轴。 */
  const engineLines: LyricLine[] = []

  for (const sourceLine of lyrics.lines) {
    /** 当前标准歌词行的转换结果。 */
    const adapted = adaptLine(sourceLine, options, primaryDuetAgent)
    primaryDuetAgent ??= adapted.discoveredPrimaryAgent
    engineLines.push(adapted.line)
  }

  return engineLines
}
