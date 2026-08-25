import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import {
  MusicMutationPayloadSchema,
  MusicMutationResultSchema,
  MusicReadPayloadSchema,
  MusicReadResultSchema,
  type MusicMutationPayload,
  type MusicMutationResult,
  type MusicBrowseFacetGroup,
  type MusicCommentResourceType,
  type MusicReadPayload,
  type MusicReadResult,
  type StandardAlbum,
  type StandardAlbumSummary,
  type StandardArtist,
  type StandardArtistSummary,
  type StandardLyrics,
  type StandardLyricsLine,
  type StandardLyricsWord,
  type StandardMusicComment,
  type StandardPlaylist,
  type StandardSong,
  type StandardUser,
  type StandardUserSummary,
  type TrackAccessMeta
} from '../../shared/schemas/music'

// ========= 类型 =========

/** 网易云 API 通用响应。 */
interface NeteaseResponse {
  /** HTTP 状态。 */
  status?: number
  /** API 响应体。 */
  body?: unknown
}

/** 网易云上游错误的安全元数据。 */
export interface NeteaseUpstreamErrorMetadata {
  /** HTTP 状态码。 */
  httpStatus?: number
  /** 网易云响应体业务 code。 */
  upstreamCode?: number
  /** 是否适合由 UI 提供重试入口。 */
  retryable: boolean
  /** 面向用户的离散说明文本。 */
  message?: string
}

/** NeteaseCloudMusicApiEnhanced 中已登记的只读能力。 */
export interface NeteaseMusicApi {
  search(params: Record<string, unknown>): Promise<NeteaseResponse>
  cloudsearch?(params: Record<string, unknown>): Promise<NeteaseResponse>
  song_detail(params: Record<string, unknown>): Promise<NeteaseResponse>
  lyric_new?(params: Record<string, unknown>): Promise<NeteaseResponse>
  lyric?(params: Record<string, unknown>): Promise<NeteaseResponse>
  artists(params: Record<string, unknown>): Promise<NeteaseResponse>
  album(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_detail(params: Record<string, unknown>): Promise<NeteaseResponse>
  user_detail(params: Record<string, unknown>): Promise<NeteaseResponse>
  search_suggest?(params: Record<string, unknown>): Promise<NeteaseResponse>
  personal_fm?(params: Record<string, unknown>): Promise<NeteaseResponse>
  top_artists?(params: Record<string, unknown>): Promise<NeteaseResponse>
  top_album?(params: Record<string, unknown>): Promise<NeteaseResponse>
  toplist?(params: Record<string, unknown>): Promise<NeteaseResponse>
  top_playlist?(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_catlist?(params: Record<string, unknown>): Promise<NeteaseResponse>
  artist_list?(params: Record<string, unknown>): Promise<NeteaseResponse>
  user_record?(params: Record<string, unknown>): Promise<NeteaseResponse>
  artist_songs?(params: Record<string, unknown>): Promise<NeteaseResponse>
  personalized?(params: Record<string, unknown>): Promise<NeteaseResponse>
  personalized_newsong?(params: Record<string, unknown>): Promise<NeteaseResponse>
  recommend_songs?(params: Record<string, unknown>): Promise<NeteaseResponse>
  user_playlist?(params: Record<string, unknown>): Promise<NeteaseResponse>
  likelist?(params: Record<string, unknown>): Promise<NeteaseResponse>
  artist_album?(params: Record<string, unknown>): Promise<NeteaseResponse>
  simi_artist?(params: Record<string, unknown>): Promise<NeteaseResponse>
  like?(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_subscribe?(params: Record<string, unknown>): Promise<NeteaseResponse>
  album_sub?(params: Record<string, unknown>): Promise<NeteaseResponse>
  artist_sub?(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_create?(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_name_update?(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_delete?(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_tracks?(params: Record<string, unknown>): Promise<NeteaseResponse>
  song_order_update?(params: Record<string, unknown>): Promise<NeteaseResponse>
  comment_music?(params: Record<string, unknown>): Promise<NeteaseResponse>
  comment_album?(params: Record<string, unknown>): Promise<NeteaseResponse>
  comment_playlist?(params: Record<string, unknown>): Promise<NeteaseResponse>
  comment?(params: Record<string, unknown>): Promise<NeteaseResponse>
  comment_like?(params: Record<string, unknown>): Promise<NeteaseResponse>
  daily_signin?(params: Record<string, unknown>): Promise<NeteaseResponse>
}

/** Music Service 底层数据源接口。 */
export interface MusicDataSource {
  read(payload: MusicReadPayload, cookie: string, signal?: AbortSignal): Promise<MusicReadResult>
  mutate?(payload: MusicMutationPayload, cookie: string, signal?: AbortSignal): Promise<MusicMutationResult>
}

/** 运行期普通对象。 */
type UnknownRecord = Record<string, unknown>

/** 已解析但尚未合并翻译的歌词行。 */
interface ParsedLyricLine {
  /** 当前行的绝对起始时间（毫秒）。 */
  lineStartMs: number
  /** 上游明确提供的当前行持续时间（毫秒）。 */
  lineDurationMs?: number
  /** 当前时间点歌词文案。 */
  text: string
  /** 当前行内的字或音节时间轴。 */
  words: StandardLyricsWord[]
}

// ========= 变量 =========

/** 网易云 API 默认超时。 */
const NETEASE_API_TIMEOUT_MS = 20_000

/** 普通 LRC 末行或长间隔行的最短推断持续时间。 */
const MIN_INFERRED_LYRIC_DURATION_MS = 2_200

/** 普通 LRC 行为避免吞并间奏所使用的最长推断持续时间。 */
const MAX_INFERRED_LYRIC_DURATION_MS = 6_000

/** 搜索类型与响应字段映射。 */
const SEARCH_TYPES = {
  songs: '1',
  artists: '100',
  albums: '10',
  playlists: '1000',
  lyrics: '1006'
} as const

/** artist_list API 当前版本公开的地区 facet。 */
const ARTIST_AREA_FACETS = [
  { value: '-1', label: '全部' },
  { value: '7', label: '华语' },
  { value: '96', label: '欧美' },
  { value: '8', label: '日本' },
  { value: '16', label: '韩国' },
  { value: '0', label: '其他' }
] as const

/** artist_list API 当前版本公开的歌手类型 facet。 */
const ARTIST_TYPE_FACETS = [
  { value: '-1', label: '全部类型' },
  { value: '1', label: '男歌手' },
  { value: '2', label: '女歌手' },
  { value: '3', label: '乐队 / 组合' }
] as const

/** artist_list API 支持的 A-Z 首字母 facet，由能力层生成而非页面写死。 */
const ARTIST_INITIAL_FACETS = [
  ...Array.from({ length: 26 }, (_, index) => ({
    value: String.fromCharCode(65 + index),
    label: String.fromCharCode(65 + index)
  }))
]

/** 标准评论资源类型到网易云数字类型的稳定映射。 */
const COMMENT_RESOURCE_TYPES: Record<MusicCommentResourceType, number> = {
  song: 0,
  album: 3,
  playlist: 2
}

/** 标准评论资源类型到只读 API 方法的稳定映射。 */
const COMMENT_READ_METHODS: Record<MusicCommentResourceType, keyof NeteaseMusicApi> = {
  song: 'comment_music',
  album: 'comment_album',
  playlist: 'comment_playlist'
}

/** 当前并发执行的三方 console 屏蔽请求数。 */
let consoleSuppressionDepth = 0

/** 第一层屏蔽进入时保存的 console 方法。 */
let originalConsoleMethods: Pick<Console, 'debug' | 'error' | 'info' | 'log' | 'warn'> | undefined

// ========= 函数 =========

/** 动态加载锁定版本的 NeteaseCloudMusicApiEnhanced。 */
async function loadApi(): Promise<NeteaseMusicApi> {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  const packagedManifest = resourcesPath
    ? join(resourcesPath, 'app.asar', 'package.json')
    : undefined
  if (packagedManifest && existsSync(packagedManifest)) {
    return createRequire(packagedManifest)(
      '@neteasecloudmusicapienhanced/api'
    ) as NeteaseMusicApi
  }
  const imported = await import('@neteasecloudmusicapienhanced/api')
  return (imported.default ?? imported) as unknown as NeteaseMusicApi
}

/** 屏蔽三方 API 包的 console 输出，避免原始响应或错误串入日志，并归一化上游异常。 */
async function withoutThirdPartyConsole<T>(op: () => Promise<T>): Promise<T> {
  if (consoleSuppressionDepth === 0) {
    originalConsoleMethods = {
      debug: console.debug,
      error: console.error,
      info: console.info,
      log: console.log,
      warn: console.warn
    }
  }
  consoleSuppressionDepth += 1
  const noop = (): void => {}
  console.debug = noop
  console.error = noop
  console.info = noop
  console.log = noop
  console.warn = noop
  try {
    return await op()
  } catch (error) {
    throw normalizeUpstreamError(error)
  } finally {
    consoleSuppressionDepth -= 1
    if (consoleSuppressionDepth === 0 && originalConsoleMethods) {
      Object.assign(console, originalConsoleMethods)
      originalConsoleMethods = undefined
    }
  }
}

/** 网易云响应失败时抛出的统一上游错误。 */
export class NeteaseUpstreamError extends Error {
  /** Runtime 统一识别的错误码。 */
  readonly code = 'UPSTREAM_ERROR'

  /** HTTP 状态码。 */
  readonly httpStatus: number | undefined

  /** 网易云响应体业务 code。 */
  readonly upstreamCode: number | undefined

  /** 是否适合重试。 */
  readonly retryable: boolean

  constructor(metadata: NeteaseUpstreamErrorMetadata) {
    const statusText = metadata.httpStatus === undefined ? 'unknown' : String(metadata.httpStatus)
    const codeText = metadata.upstreamCode === undefined ? 'unknown' : String(metadata.upstreamCode)
    const defaultMsg = `网易云上游请求失败（HTTP ${statusText}, code ${codeText}）。`
    super(metadata.message || defaultMsg)
    this.name = 'NeteaseUpstreamError'
    this.httpStatus = metadata.httpStatus
    this.upstreamCode = metadata.upstreamCode
    this.retryable = metadata.retryable
  }
}

/** 判断未知值是否为普通对象。 */
function record(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined
}

/** 读取数组字段。 */
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** 读取字符串字段。 */
function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** 读取数字字段。 */
function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** 读取布尔字段。 */
function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/** 将响应 code 的数字或数字字符串形式归一为 number。 */
function responseCodeValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/u.test(value)) return Number(value)
  return undefined
}

/** 归一化三方 API 抛出的原生异常或对象为 NeteaseUpstreamError。 */
function normalizeUpstreamError(error: unknown): NeteaseUpstreamError {
  if (error instanceof NeteaseUpstreamError) return error

  const raw = record(error)
  const httpStatus = numberValue(raw?.['status'])
  const body = record(raw?.['body'])
  const upstreamCode = responseCodeValue(body?.['code'])
  const msg = stringValue(body?.['msg'] ?? body?.['message'])

  if (httpStatus === 301 || upstreamCode === 301) {
    return new NeteaseUpstreamError({
      httpStatus: httpStatus ?? 301,
      upstreamCode: upstreamCode ?? 301,
      retryable: false,
      message: msg || '登录状态已失效，请重新登录。'
    })
  }

  if (upstreamCode === -2) {
    return new NeteaseUpstreamError({
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      upstreamCode: -2,
      retryable: false,
      message: msg || '今日已重复签到。'
    })
  }

  return new NeteaseUpstreamError({
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(upstreamCode !== undefined ? { upstreamCode } : {}),
    retryable: httpStatus === 429 || (httpStatus !== undefined && httpStatus >= 500),
    ...(msg ? { message: msg } : {})
  })
}

/** 将数字或数字字符串归一为 ID 字符串。 */
function idValue(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return String(value)
  if (typeof value === 'string' && /^\d{1,20}$/u.test(value)) return value
  return undefined
}

/** 读取合法 URL 字段。 */
function urlValue(value: unknown): string | undefined {
  const text = stringValue(value)
  if (!text) return undefined
  return URL.canParse(text) ? text : undefined
}

/** 读取响应体对象。 */
function bodyRecord(response: NeteaseResponse): UnknownRecord {
  const body = record(response.body) ?? {}
  const httpStatus = response.status
  const upstreamCode = responseCodeValue(body['code'])
  const httpFailed =
    httpStatus !== undefined && (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300)
  const upstreamFailed = upstreamCode !== undefined && upstreamCode !== 200
  if (httpFailed || upstreamFailed) {
    const msg = stringValue(body['msg'] ?? body['message'])
    const customMsg =
      upstreamCode === -2
        ? msg || '今日已重复签到。'
        : upstreamCode === 301 || httpStatus === 301
          ? msg || '登录状态已失效，请重新登录。'
          : msg
    throw new NeteaseUpstreamError({
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      ...(upstreamCode !== undefined ? { upstreamCode } : {}),
      retryable: httpStatus === 429 || (httpStatus !== undefined && httpStatus >= 500),
      ...(customMsg ? { message: customMsg } : {})
    })
  }
  return body
}

/** 构造实体来源描述。 */
function source(api: string, observedAt: string): [{ api: string; observedAt: string }] {
  return [{ api, observedAt }]
}

/** 读取必须存在的网易云 API 方法。 */
function requiredApiMethod(
  api: NeteaseMusicApi,
  name: keyof NeteaseMusicApi
): (params: Record<string, unknown>) => Promise<NeteaseResponse> {
  const method = api[name]
  if (typeof method !== 'function') {
    throw Object.assign(new Error(`当前网易云 API 依赖不支持 ${String(name)}。`), {
      code: 'CAPABILITY_UNAVAILABLE'
    })
  }
  return method.bind(api)
}

/** 根据 fee 字段归一化展示标记。 */
function normalizeAccess(raw: UnknownRecord): TrackAccessMeta {
  const fee = numberValue(raw['fee'])
  const badges: Array<'vip' | 'paid'> = []
  if (fee === 1) badges.push('vip')
  if (fee === 4) badges.push('paid')
  return { badges, playableKnown: false }
}

/** 判断歌词文本是否属于可区分的和声、伴唱或括号背景声部。 */
function isBackgroundVocalText(text: string): boolean {
  /** 行首显式声部标签。 */
  const vocalPrefixPattern = /^\s*(?:(?:和声|伴唱|合唱)\s*[:：]|[（(]\s*(?:和声|伴唱|合唱)(?:\s*[:：][^）)]*)?\s*[）)])/u
  /** 整行括号文案；网易云双声部歌词常用此形式表示副唱。 */
  const parenthesizedLinePattern = /^\s*[（(][^）)]+[）)]\s*$/u
  return vocalPrefixPattern.test(text) || parenthesizedLinePattern.test(text)
}

/** 根据文本长度推断普通 LRC 行的自然演唱时长。 */
function inferNaturalLineDurationMs(text: string): number {
  /** 按 Unicode 字符数估算的当前行长度。 */
  const characterCount = Array.from(text).length
  /** 短句至少展示 2.2 秒，长句最多占用 6 秒。 */
  return Math.min(
    MAX_INFERRED_LYRIC_DURATION_MS,
    Math.max(MIN_INFERRED_LYRIC_DURATION_MS, 1_400 + characterCount * 180)
  )
}

/** 为缺少持续时间的普通 LRC 行补齐可渲染时段。 */
function completeLyricLineDurations(lines: ParsedLyricLine[]): ParsedLyricLine[] {
  return lines.map((line, index) => {
    if (line.lineDurationMs !== undefined) return line

    /** 下一行歌词，用于防止推断时段越过下一行。 */
    const nextLine = lines[index + 1]
    /** 当前行按文本长度推断的自然演唱时长。 */
    const naturalDurationMs = inferNaturalLineDurationMs(line.text)
    /** 当前行至下一行的实际间隔。 */
    const timeUntilNextLineMs = nextLine
      ? Math.max(0, nextLine.lineStartMs - line.lineStartMs)
      : naturalDurationMs

    return {
      ...line,
      lineDurationMs: Math.min(naturalDurationMs, timeUntilNextLineMs)
    }
  })
}

/**
 * 把普通 LRC 歌词文本拆成行级时间轴。
 *
 * @param lyricText 网易云返回的原始 LRC 文本
 */
function parseLrcLines(lyricText: string | undefined): ParsedLyricLine[] {
  if (!lyricText) return []

  /** 兼容出现在 LRC 字段中的 YRC 风格毫秒行头。 */
  const millisecondLinePattern = /^\s*\[(\d+)\s*,\s*(\d+)\]\s*(.*)$/u
  /** 单行中所有分钟制时间标签。 */
  const timePattern = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/gu
  /** 标准化后的歌词行集合。 */
  const lines: ParsedLyricLine[] = []

  for (const rawLine of lyricText.split(/\r?\n/u)) {
    const millisecondLineMatch = millisecondLinePattern.exec(rawLine)
    if (millisecondLineMatch) {
      lines.push({
        lineStartMs: Number(millisecondLineMatch[1] ?? 0),
        lineDurationMs: Number(millisecondLineMatch[2] ?? 0),
        text: (millisecondLineMatch[3] ?? '').trim(),
        words: []
      })
      continue
    }

    timePattern.lastIndex = 0
    /** 移除时间标签后保留的当前行正文。 */
    const text = rawLine.replace(timePattern, '').trim()
    timePattern.lastIndex = 0

    for (const match of rawLine.matchAll(timePattern)) {
      const minutes = Number(match[1] ?? 0)
      const seconds = Number(match[2] ?? 0)
      const fractionText = match[3] ?? '0'
      const fractionMs = Number(fractionText.padEnd(3, '0').slice(0, 3))
      lines.push({
        lineStartMs: (minutes * 60 + seconds) * 1000 + fractionMs,
        text,
        words: []
      })
    }
  }

  return completeLyricLineDurations(lines.sort((a, b) => a.lineStartMs - b.lineStartMs))
}

/**
 * 把 YRC 文本拆成行级与字/音节级绝对时间轴。
 *
 * @param lyricText 网易云返回的原始 YRC 文本
 */
function parseYrcLines(lyricText: string | undefined): ParsedLyricLine[] {
  if (!lyricText) return []

  /** YRC 单行的毫秒级起始时间与持续时间头。 */
  const linePattern = /^\s*\[(\d+)\s*,\s*(\d+)\](.*)$/u
  /** YRC 行内逐字时间块，正文允许保留普通括号。 */
  const wordPattern = /\(\s*(\d+)\s*,\s*(\d+)\s*,\s*\d+\s*\)(.*?)(?=\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|$)/gu
  /** 解析完成的逐字歌词行。 */
  const lines: ParsedLyricLine[] = []

  for (const rawLine of lyricText.split(/\r?\n/u)) {
    const lineMatch = linePattern.exec(rawLine)
    if (!lineMatch) continue

    const lineStartMs = Number(lineMatch[1] ?? 0)
    const lineDurationMs = Number(lineMatch[2] ?? 0)
    const encodedWords = lineMatch[3] ?? ''
    /** 当前行解析出的逐字或逐音节时间块。 */
    const words: StandardLyricsWord[] = []
    wordPattern.lastIndex = 0

    for (const wordMatch of encodedWords.matchAll(wordPattern)) {
      words.push({
        startMs: Number(wordMatch[1] ?? 0),
        durationMs: Number(wordMatch[2] ?? 0),
        text: wordMatch[3] ?? ''
      })
    }

    /** 优先拼接逐字正文，异常 YRC 则退回移除时间块后的可见文本。 */
    const text = words.length > 0
      ? words.map((word) => word.text).join('').trim()
      : encodedWords.replace(/\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gu, '').trim()

    lines.push({ lineStartMs, lineDurationMs, text, words })
  }

  return lines.sort((a, b) => a.lineStartMs - b.lineStartMs)
}

/**
 * 合并原文歌词与翻译歌词。
 *
 * @param originalLines 原文歌词时间轴
 * @param translatedLines 翻译歌词时间轴
 */
function mergeLyricLines(
  originalLines: ParsedLyricLine[],
  translatedLines: ParsedLyricLine[]
): StandardLyricsLine[] {
  /** 翻译歌词按毫秒时间点建立的快速查找表。 */
  const translationByTime = new Map<number, string>()
  for (const line of translatedLines) {
    if (line.text) translationByTime.set(line.lineStartMs, line.text)
  }

  return originalLines.map((line) => ({
    lineStartMs: line.lineStartMs,
    lineDurationMs: line.lineDurationMs ?? inferNaturalLineDurationMs(line.text),
    text: line.text,
    words: line.words,
    ...(translationByTime.get(line.lineStartMs)
      ? { translation: translationByTime.get(line.lineStartMs) as string }
      : {}),
    ...(isBackgroundVocalText(line.text) ? { vocalRole: 'background' as const } : {})
  }))
}

/** 从歌词响应体中归一化标准歌词实体。 */
function normalizeLyrics(id: string, rawBody: UnknownRecord, api: string, observedAt: string): StandardLyrics {
  const lyricText = stringValue(record(rawBody['lrc'])?.['lyric'])
  const wordTimedText = stringValue(record(rawBody['yrc'])?.['lyric'])
  const translatedText = stringValue(record(rawBody['tlyric'])?.['lyric'])
  const wordTimedLines = parseYrcLines(wordTimedText)
  const originalLines = wordTimedLines.length > 0 ? wordTimedLines : parseLrcLines(lyricText)
  const translatedLines = parseLrcLines(translatedText)

  return {
    kind: 'lyrics',
    trackId: id,
    lines: mergeLyricLines(originalLines, translatedLines),
    ...(lyricText ? { plainText: lyricText } : {}),
    ...(translatedText ? { translatedText } : {}),
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 归一化歌手摘要。 */
function normalizeArtistSummary(rawValue: unknown): StandardArtistSummary | undefined {
  const raw = record(rawValue)
  const id = idValue(raw?.['id'])
  const name = stringValue(raw?.['name'])
  if (!raw || !id || !name) return undefined
  return {
    id,
    name,
    alias: array(raw['alias'] ?? raw['alia']).map(stringValue).filter((item): item is string => Boolean(item)),
    ...(urlValue(raw['picUrl'] ?? raw['img1v1Url']) ? { artworkUrl: urlValue(raw['picUrl'] ?? raw['img1v1Url']) } : {})
  }
}

/** 归一化专辑摘要。 */
function normalizeAlbumSummary(rawValue: unknown): StandardAlbumSummary | undefined {
  const raw = record(rawValue)
  const id = idValue(raw?.['id'])
  const name = stringValue(raw?.['name'])
  if (!raw || !id || !name) return undefined
  return {
    id,
    name,
    ...(urlValue(raw['picUrl'] ?? raw['blurPicUrl']) ? { artworkUrl: urlValue(raw['picUrl'] ?? raw['blurPicUrl']) } : {}),
    ...(numberValue(raw['publishTime']) !== undefined ? { publishTime: numberValue(raw['publishTime']) } : {})
  }
}

/** 归一化用户摘要。 */
function normalizeUserSummary(rawValue: unknown): StandardUserSummary | undefined {
  const raw = record(rawValue)
  const id = idValue(raw?.['userId'] ?? raw?.['id'])
  const nickname = stringValue(raw?.['nickname'] ?? raw?.['name'])
  if (!raw || !id || !nickname) return undefined
  return {
    id,
    nickname,
    ...(urlValue(raw['avatarUrl']) ? { avatarUrl: urlValue(raw['avatarUrl']) } : {})
  }
}

/** 归一化歌曲实体。 */
function normalizeSong(rawValue: unknown, api: string, observedAt: string): StandardSong | undefined {
  const raw = record(rawValue)
  const id = idValue(raw?.['id'])
  const name = stringValue(raw?.['name'])
  if (!raw || !id || !name) return undefined
  const artists = array(raw['ar'] ?? raw['artists'])
    .map(normalizeArtistSummary)
    .filter((item): item is StandardArtistSummary => Boolean(item))
  const album = normalizeAlbumSummary(raw['al'] ?? raw['album'])
  return {
    kind: 'song',
    id,
    name,
    artists,
    ...(album ? { album } : {}),
    ...(numberValue(raw['dt'] ?? raw['duration']) !== undefined ? { durationMs: numberValue(raw['dt'] ?? raw['duration']) } : {}),
    ...(numberValue(raw['listeningCount']) !== undefined ? { listeningCount: numberValue(raw['listeningCount']) } : {}),
    access: normalizeAccess(raw),
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 归一化歌手实体。 */
function normalizeArtist(
  rawValue: unknown,
  api: string,
  observedAt: string,
  hotSongsValue: unknown = []
): StandardArtist | undefined {
  const summary = normalizeArtistSummary(rawValue)
  const raw = record(rawValue)
  if (!summary || !raw) return undefined
  return {
    kind: 'artist',
    id: summary.id,
    name: summary.name,
    alias: summary.alias,
    ...(summary.artworkUrl ? { artworkUrl: summary.artworkUrl } : {}),
    ...(urlValue(raw['cover'] ?? raw['coverUrl']) ? { coverUrl: urlValue(raw['cover'] ?? raw['coverUrl']) } : {}),
    ...(booleanValue(raw['followed']) !== undefined ? { followed: booleanValue(raw['followed']) } : {}),
    ...(numberValue(raw['musicSize'] ?? raw['songSize']) !== undefined ? { songCount: numberValue(raw['musicSize'] ?? raw['songSize']) } : {}),
    ...(numberValue(raw['albumSize']) !== undefined ? { albumCount: numberValue(raw['albumSize']) } : {}),
    ...(stringValue(raw['briefDesc'] ?? raw['desc']) ? { description: stringValue(raw['briefDesc'] ?? raw['desc']) } : {}),
    hotSongs: array(hotSongsValue)
      .map((song) => normalizeSong(song, api, observedAt))
      .filter((item): item is StandardSong => Boolean(item)),
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 归一化专辑实体。 */
function normalizeAlbum(rawValue: unknown, songsValue: unknown, api: string, observedAt: string): StandardAlbum | undefined {
  const summary = normalizeAlbumSummary(rawValue)
  const raw = record(rawValue)
  if (!summary || !raw) return undefined
  const artist = normalizeArtistSummary(raw['artist'])
  const songs = array(songsValue).map((song) => normalizeSong(song, api, observedAt)).filter((item): item is StandardSong => Boolean(item))
  return {
    kind: 'album',
    id: summary.id,
    name: summary.name,
    ...(artist ? { artist } : {}),
    ...(summary.artworkUrl ? { artworkUrl: summary.artworkUrl } : {}),
    ...(summary.publishTime !== undefined ? { publishTime: summary.publishTime } : {}),
    ...(numberValue(raw['size']) !== undefined ? { size: numberValue(raw['size']) } : {}),
    ...(stringValue(raw['description'] ?? raw['briefDesc']) ? { description: stringValue(raw['description'] ?? raw['briefDesc']) } : {}),
    ...(booleanValue(raw['subscribed']) !== undefined ? { subscribed: booleanValue(raw['subscribed']) } : {}),
    songs,
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 归一化歌单实体。 */
function normalizePlaylist(
  rawValue: unknown,
  api: string,
  observedAt: string,
  ownerId?: string
): StandardPlaylist | undefined {
  const raw = record(rawValue)
  const id = idValue(raw?.['id'])
  const name = stringValue(raw?.['name'])
  if (!raw || !id || !name) return undefined
  const creator = normalizeUserSummary(raw['creator'])
  /** 歌单详情返回的歌曲加入时间，按歌曲 ID 关联标准实体。 */
  const addedAtBySongId = new Map(array(raw['trackIds'])
    .map((item) => record(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => [idValue(item['id']), numberValue(item['at'])] as const)
    .filter((item): item is readonly [string, number] => item[0] !== undefined && item[1] !== undefined))
  /** 带当前歌单加入时间的标准歌曲。 */
  const songs = array(raw['tracks'])
    .map((song) => normalizeSong(song, api, observedAt))
    .filter((item): item is StandardSong => Boolean(item))
    .map((song) => ({
      ...song,
      ...(addedAtBySongId.get(song.id) !== undefined ? { addedAt: addedAtBySongId.get(song.id) } : {})
    }))
  return {
    kind: 'playlist',
    id,
    name,
    ...(creator ? { creator } : {}),
    ...(urlValue(raw['coverImgUrl'] ?? raw['picUrl']) ? { artworkUrl: urlValue(raw['coverImgUrl'] ?? raw['picUrl']) } : {}),
    ...(numberValue(raw['trackCount']) !== undefined ? { trackCount: numberValue(raw['trackCount']) } : {}),
    ...(numberValue(raw['playCount']) !== undefined ? { playCount: numberValue(raw['playCount']) } : {}),
    ...(numberValue(raw['subscribedCount']) !== undefined ? { subscribedCount: numberValue(raw['subscribedCount']) } : {}),
    ...(numberValue(raw['createTime']) !== undefined ? { createTime: numberValue(raw['createTime']) } : {}),
    ...(numberValue(raw['updateTime']) !== undefined ? { updateTime: numberValue(raw['updateTime']) } : {}),
    ...(numberValue(raw['privacy']) !== undefined ? { privacy: numberValue(raw['privacy']) } : {}),
    ...(stringValue(raw['updateFrequency']) ? { updateFrequency: stringValue(raw['updateFrequency']) } : {}),
    ...(typeof raw['subscribed'] === 'boolean' ? { subscribed: raw['subscribed'] } : {}),
    ...(stringValue(raw['description']) ? { description: stringValue(raw['description']) } : {}),
    ...(ownerId && creator ? { owned: creator.id === ownerId } : {}),
    songs,
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 归一化用户实体。 */
function normalizeUser(
  rawValue: unknown,
  api: string,
  observedAt: string,
  detailValue: unknown = {}
): StandardUser | undefined {
  const summary = normalizeUserSummary(rawValue)
  const raw = record(rawValue)
  const detail = record(detailValue) ?? {}
  if (!summary || !raw) return undefined
  /** API 可能直接返回属地字符串，也可能返回 ipLocation 对象。 */
  const location = stringValue(raw['location'] ?? record(raw['ipLocation'])?.['location'])
  return {
    kind: 'user',
    id: summary.id,
    nickname: summary.nickname,
    ...(summary.avatarUrl ? { avatarUrl: summary.avatarUrl } : {}),
    ...(urlValue(raw['backgroundUrl']) ? { backgroundUrl: urlValue(raw['backgroundUrl']) } : {}),
    ...(stringValue(raw['signature']) ? { signature: stringValue(raw['signature']) } : {}),
    ...(numberValue(raw['followeds']) !== undefined ? { followeds: numberValue(raw['followeds']) } : {}),
    ...(numberValue(raw['follows']) !== undefined ? { follows: numberValue(raw['follows']) } : {}),
    ...(numberValue(detail['level'] ?? raw['level']) !== undefined ? { level: numberValue(detail['level'] ?? raw['level']) } : {}),
    ...(numberValue(detail['listenSongs'] ?? raw['listenSongs']) !== undefined ? { listenSongs: numberValue(detail['listenSongs'] ?? raw['listenSongs']) } : {}),
    ...(numberValue(raw['createTime']) !== undefined ? { createTime: numberValue(raw['createTime']) } : {}),
    ...(numberValue(raw['birthday']) !== undefined ? { birthday: numberValue(raw['birthday']) } : {}),
    ...(numberValue(raw['gender']) !== undefined ? { gender: numberValue(raw['gender']) } : {}),
    ...(numberValue(raw['vipType']) !== undefined ? { vipType: numberValue(raw['vipType']) } : {}),
    ...(location ? { location } : {}),
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 把歌曲、专辑或歌单评论归一化为不含上游私有字段的标准实体。 */
function normalizeComment(
  rawValue: unknown,
  resourceType: MusicCommentResourceType,
  resourceId: string
): StandardMusicComment | undefined {
  /** 上游评论记录。 */
  const raw = record(rawValue)
  /** 归一化后的评论 ID。 */
  const id = idValue(raw?.['commentId'] ?? raw?.['id'])
  /** 归一化后的评论作者。 */
  const author = normalizeUserSummary(raw?.['user'])
  /** 优先使用纯文本评论正文。 */
  const content = stringValue(raw?.['content'] ?? raw?.['richContent'])
  /** 评论创建毫秒时间戳。 */
  const time = numberValue(raw?.['time'])
  if (!raw || !id || !author || !content || time === undefined || time < 0) return undefined

  /** 可选的公开评论属地。 */
  const location = stringValue(record(raw['ipLocation'])?.['location'])
  return {
    id,
    resourceType,
    resourceId,
    author,
    content,
    time: Math.trunc(time),
    likedCount: Math.max(0, Math.trunc(numberValue(raw['likedCount']) ?? 0)),
    liked: booleanValue(raw['liked']) ?? false,
    owner: booleanValue(raw['owner']) ?? false,
    ...(location ? { location } : {})
  }
}

// ========= 类 =========

/** 网易云音乐只读 Adapter，负责把上游响应转为标准实体。 */
export class NeteaseMusicApiAdapter implements MusicDataSource {
  /** 延迟加载的网易云 API 实例。 */
  private api: NeteaseMusicApi | undefined

  constructor(api?: NeteaseMusicApi) {
    this.api = api
  }

  /** 执行 Music Service 只读请求。 */
  async read(payload: MusicReadPayload, cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    const parsed = MusicReadPayloadSchema.parse(payload)
    signal?.throwIfAborted()
    if (parsed.operation === 'search') return this.search(parsed, cookie, signal)
    if (parsed.operation === 'getSong') return this.getSong(parsed.id, cookie, signal)
    if (parsed.operation === 'getLyrics') return this.getLyrics(parsed.id, cookie, signal)
    if (parsed.operation === 'getArtist') return this.getArtist(parsed.id, cookie, signal)
    if (parsed.operation === 'getAlbum') return this.getAlbum(parsed.id, cookie, signal)
    if (parsed.operation === 'getPlaylist') return this.getPlaylist(parsed.id, cookie, signal)
    if (parsed.operation === 'getUser') return this.getUser(parsed.id, cookie, signal)
    if (parsed.operation === 'getFeaturedPlaylists') return this.getFeaturedPlaylists(parsed.limit, cookie, signal)
    if (parsed.operation === 'getNewSongs') return this.getNewSongs(parsed.limit, cookie, signal)
    if (parsed.operation === 'getDailySongs') return this.getDailySongs(parsed.limit, cookie, signal)
    if (parsed.operation === 'getUserPlaylists') {
      return this.getUserPlaylists(parsed.userId, parsed.limit, parsed.offset, cookie, signal)
    }
    if (parsed.operation === 'getLikedSongs') return this.getLikedSongs(parsed.userId, parsed.limit, cookie, signal)
    if (parsed.operation === 'getArtistAlbums') {
      return this.getArtistAlbums(parsed.artistId, parsed.limit, parsed.offset, cookie, signal)
    }
    if (parsed.operation === 'getSimilarArtists') {
      return this.getSimilarArtists(parsed.artistId, cookie, signal)
    }
    if (parsed.operation === 'getPersonalFm') return this.getPersonalFm(parsed.limit, cookie, signal)
    if (parsed.operation === 'getRecommendedArtists') {
      return this.getRecommendedArtists(parsed.limit, parsed.offset, cookie, signal)
    }
    if (parsed.operation === 'getNewAlbums') {
      return this.getNewAlbums(parsed.area, parsed.limit, parsed.offset, cookie, signal)
    }
    if (parsed.operation === 'getCharts') return this.getCharts(cookie, signal)
    if (parsed.operation === 'getCategoryPlaylists') {
      return this.getCategoryPlaylists(parsed.category, parsed.limit, parsed.offset, cookie, signal)
    }
    if (parsed.operation === 'getArtists') {
      return this.getArtists(
        parsed.area,
        parsed.artistType,
        parsed.initial,
        parsed.limit,
        parsed.offset,
        cookie,
        signal
      )
    }
    if (parsed.operation === 'getSearchSuggestions') {
      return this.getSearchSuggestions(parsed.query, parsed.limit, cookie, signal)
    }
    if (parsed.operation === 'getHotSongs') {
      return this.getHotSongs(parsed.limit, cookie, signal)
    }
    if (parsed.operation === 'getListeningHistory') {
      return this.getListeningHistory(parsed.userId, parsed.period, parsed.limit, cookie, signal)
    }
    if (parsed.operation === 'getArtistSongs') {
      return this.getArtistSongs(parsed.artistId, parsed.order, parsed.limit, parsed.offset, cookie, signal)
    }
    if (parsed.operation === 'getBrowseFacets') return this.getBrowseFacets(cookie, signal)
    return this.getComments(
      parsed.resourceType,
      parsed.resourceId,
      parsed.limit,
      parsed.offset,
      cookie,
      signal
    )
  }

  /** 执行账户感知的显式音乐写入请求。 */
  async mutate(
    payload: MusicMutationPayload,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicMutationResult> {
    const parsed = MusicMutationPayloadSchema.parse(payload)
    const api = await this.requiredApi()
    signal?.throwIfAborted()
    let response: NeteaseResponse
    let entityId: string | undefined

    if (parsed.operation === 'likeTrack') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'like')({
        id: parsed.trackId,
        like: parsed.liked,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.trackId
    } else if (parsed.operation === 'subscribePlaylist') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'playlist_subscribe')({
        id: parsed.playlistId,
        t: parsed.subscribed ? 1 : 0,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.playlistId
    } else if (parsed.operation === 'subscribeAlbum') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'album_sub')({
        id: parsed.albumId,
        t: parsed.subscribed ? 1 : 0,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.albumId
    } else if (parsed.operation === 'subscribeArtist') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'artist_sub')({
        id: parsed.artistId,
        t: parsed.subscribed ? 1 : 0,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.artistId
    } else if (parsed.operation === 'createPlaylist') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'playlist_create')({
        name: parsed.name,
        privacy: parsed.privacy === 'private' ? 10 : 0,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = idValue(record(bodyRecord(response)['playlist'])?.['id'])
    } else if (parsed.operation === 'renamePlaylist') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'playlist_name_update')({
        id: parsed.playlistId,
        name: parsed.name,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.playlistId
    } else if (parsed.operation === 'deletePlaylist') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'playlist_delete')({
        id: parsed.playlistId,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.playlistId
    } else if (parsed.operation === 'updatePlaylistTracks') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'playlist_tracks')({
        pid: parsed.playlistId,
        tracks: parsed.trackIds.join(','),
        op: parsed.action === 'add' ? 'add' : 'del',
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.playlistId
    } else if (parsed.operation === 'reorderPlaylistTracks') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'song_order_update')({
        pid: parsed.playlistId,
        ids: parsed.trackIds.join(','),
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.playlistId
    } else if (parsed.operation === 'addComment') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'comment')({
        id: parsed.resourceId,
        type: COMMENT_RESOURCE_TYPES[parsed.resourceType],
        t: 1,
        content: parsed.content,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = idValue(record(bodyRecord(response)['comment'])?.['commentId'])
    } else if (parsed.operation === 'deleteComment') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'comment')({
        id: parsed.resourceId,
        type: COMMENT_RESOURCE_TYPES[parsed.resourceType],
        t: 0,
        commentId: parsed.commentId,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.commentId
    } else if (parsed.operation === 'likeComment') {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'comment_like')({
        id: parsed.resourceId,
        type: COMMENT_RESOURCE_TYPES[parsed.resourceType],
        t: parsed.liked ? 1 : 0,
        cid: parsed.commentId,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
      entityId = parsed.commentId
    } else {
      response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'daily_signin')({
        type: 1,
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))
    }

    signal?.throwIfAborted()
    bodyRecord(response)
    return MusicMutationResultSchema.parse({
      operation: parsed.operation,
      succeeded: true,
      ...(entityId ? { entityId } : {}),
      updatedAt: new Date().toISOString()
    })
  }

  /** 读取或加载网易云 API 实例。 */
  private async requiredApi(): Promise<NeteaseMusicApi> {
    this.api ??= await loadApi()
    return this.api
  }

  /** 执行搜索并按当前分类归一化候选；“全部”并行读取全部内容类型。 */
  private async search(
    payload: Extract<MusicReadPayload, { operation: 'search' }>,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载且满足方法契约的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次读取的统一观测时间。 */
    const observedAt = new Date().toISOString()
    /** 优先使用返回完整专辑封面字段的云搜索接口，并为旧依赖保留兼容回退。 */
    const searchMethodName: 'cloudsearch' | 'search' = typeof api.cloudsearch === 'function'
      ? 'cloudsearch'
      : 'search'
    /** 按指定内容类型调用网易云搜索接口。 */
    const callSearch = async (type: string): Promise<UnknownRecord> => {
      signal?.throwIfAborted()
      const response = await withoutThirdPartyConsole(() =>
        requiredApiMethod(api, searchMethodName)({
          keywords: payload.query,
          type,
          limit: payload.limit,
          offset: payload.offset,
          cookie,
          timeout: NETEASE_API_TIMEOUT_MS
        })
      )
      signal?.throwIfAborted()
      return record(bodyRecord(response)['result']) ?? {}
    }
    /** 未显式传入分类时保持原有的“全部”搜索语义。 */
    const searchCategory = payload.category ?? 'all'
    /** 当前分类未请求的响应使用空对象，保持标准结果结构稳定。 */
    const emptyResult: UnknownRecord = {}
    /** 单个分类是否需要向上游读取。 */
    const needs = (category: Exclude<typeof searchCategory, 'all'>): boolean =>
      searchCategory === 'all' || searchCategory === category
    /** 各分类独立响应，防止一个页面 Tab 拉取无关数据。 */
    const [songResult, artistResult, albumResult, playlistResult, lyricResult] = await Promise.all([
      needs('songs') ? callSearch(SEARCH_TYPES.songs) : Promise.resolve(emptyResult),
      needs('artists') ? callSearch(SEARCH_TYPES.artists) : Promise.resolve(emptyResult),
      needs('albums') ? callSearch(SEARCH_TYPES.albums) : Promise.resolve(emptyResult),
      needs('playlists') ? callSearch(SEARCH_TYPES.playlists) : Promise.resolve(emptyResult),
      needs('lyrics') ? callSearch(SEARCH_TYPES.lyrics) : Promise.resolve(emptyResult)
    ])
    return MusicReadResultSchema.parse({
      kind: 'search',
      query: payload.query,
      category: searchCategory,
      songs: array(songResult['songs']).map((item) => normalizeSong(item, 'ncm.search', observedAt)).filter(Boolean),
      lyrics: array(lyricResult['songs']).map((item) => normalizeSong(item, 'ncm.search', observedAt)).filter(Boolean),
      artists: array(artistResult['artists']).map((item) => normalizeArtist(item, 'ncm.search', observedAt)).filter(Boolean),
      albums: array(albumResult['albums']).map((item) => normalizeAlbum(item, [], 'ncm.search', observedAt)).filter(Boolean),
      playlists: array(playlistResult['playlists']).map((item) => normalizePlaylist(item, 'ncm.search', observedAt)).filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取歌曲详情。 */
  private async getSong(id: string, cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() =>
      api.song_detail({ ids: id, cookie, timeout: NETEASE_API_TIMEOUT_MS })
    )
    signal?.throwIfAborted()
    const entity = normalizeSong(array(bodyRecord(response)['songs'])[0], 'ncm.song_detail', observedAt)
    return MusicReadResultSchema.parse({ kind: 'song', entity: entity ?? null })
  }

  /** 读取歌词详情。 */
  private async getLyrics(id: string, cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const apiName = api.lyric_new ? 'ncm.lyric_new' : 'ncm.lyric'
    const readLyrics = api.lyric_new ?? api.lyric
    if (!readLyrics) {
      throw Object.assign(new Error('当前网易云 API 依赖不支持歌词读取。'), {
        code: 'UPSTREAM_UNAVAILABLE'
      })
    }

    const response = await withoutThirdPartyConsole(() =>
      readLyrics.call(api, { id, cookie, timeout: NETEASE_API_TIMEOUT_MS })
    )
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'lyrics',
      entity: normalizeLyrics(id, bodyRecord(response), apiName, observedAt)
    })
  }

  /** 读取歌手详情。 */
  private async getArtist(id: string, cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() =>
      api.artists({ id, cookie, timeout: NETEASE_API_TIMEOUT_MS })
    )
    signal?.throwIfAborted()
    const body = bodyRecord(response)
    const entity = normalizeArtist(body['artist'], 'ncm.artists', observedAt, body['hotSongs'])
    return MusicReadResultSchema.parse({ kind: 'artist', entity: entity ?? null })
  }

  /** 读取专辑详情。 */
  private async getAlbum(id: string, cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() =>
      api.album({ id, cookie, timeout: NETEASE_API_TIMEOUT_MS })
    )
    signal?.throwIfAborted()
    const body = bodyRecord(response)
    const entity = normalizeAlbum(body['album'], body['songs'], 'ncm.album', observedAt)
    return MusicReadResultSchema.parse({ kind: 'album', entity: entity ?? null })
  }

  /** 读取歌单详情。 */
  private async getPlaylist(id: string, cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() =>
      api.playlist_detail({ id, cookie, timeout: NETEASE_API_TIMEOUT_MS })
    )
    signal?.throwIfAborted()
    const entity = normalizePlaylist(bodyRecord(response)['playlist'], 'ncm.playlist_detail', observedAt)
    return MusicReadResultSchema.parse({ kind: 'playlist', entity: entity ?? null })
  }

  /** 读取用户详情。 */
  private async getUser(id: string, cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() =>
      api.user_detail({ uid: id, cookie, timeout: NETEASE_API_TIMEOUT_MS })
    )
    signal?.throwIfAborted()
    /** 用户详情顶层同时承载等级与累计听歌数。 */
    const body = bodyRecord(response)
    /** 个人页标准用户实体。 */
    const entity = normalizeUser(body['profile'], 'ncm.user_detail', observedAt, body)
    return MusicReadResultSchema.parse({ kind: 'user', entity: entity ?? null })
  }

  /** 读取发现页平台推荐歌单。 */
  private async getFeaturedPlaylists(
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'personalized')({
      limit,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'playlistCollection',
      collection: 'featured',
      playlists: array(bodyRecord(response)['result'])
        .map((item) => normalizePlaylist(item, 'ncm.personalized', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取发现页推荐新歌。 */
  private async getNewSongs(
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'personalized_newsong')({
      limit,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    const songs = array(bodyRecord(response)['result'])
      .map((item) => normalizeSong(record(item)?.['song'] ?? item, 'ncm.personalized_newsong', observedAt))
      .filter(Boolean)
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: 'new',
      songs,
      updatedAt: observedAt
    })
  }

  /** 读取登录用户每日推荐歌曲。 */
  private async getDailySongs(
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'recommend_songs')({
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    const body = bodyRecord(response)
    const songsValue = record(body['data'])?.['dailySongs'] ?? body['recommend']
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: 'daily',
      songs: array(songsValue)
        .slice(0, limit)
        .map((item) => normalizeSong(item, 'ncm.recommend_songs', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取指定用户的自建与收藏歌单。 */
  private async getUserPlaylists(
    userId: string,
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'user_playlist')({
      uid: userId,
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'playlistCollection',
      collection: 'user',
      ownerId: userId,
      playlists: array(bodyRecord(response)['playlist'])
        .map((item) => normalizePlaylist(item, 'ncm.user_playlist', observedAt, userId))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取指定用户喜欢歌曲列表。 */
  private async getLikedSongs(
    userId: string,
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const likedResponse = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'likelist')({
      uid: userId,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    /** 接口返回的完整喜欢歌曲 ID，用于独立于歌曲详情分页维护收藏状态。 */
    const songIds = array(bodyRecord(likedResponse)['ids'])
      .map(idValue)
      .filter((item): item is string => Boolean(item))
    /** 当前请求需要补齐详情的喜欢歌曲 ID。 */
    const ids = songIds.slice(0, limit)
    if (ids.length === 0) {
      return MusicReadResultSchema.parse({
        kind: 'songCollection',
        collection: 'liked',
        ownerId: userId,
        songIds,
        songs: [],
        updatedAt: observedAt
      })
    }
    /** 分批读取歌曲详情，避免大曲库把全部 ID 塞进单次请求。 */
    const normalizedSongs: StandardSong[] = []
    for (let offset = 0; offset < ids.length; offset += 2_000) {
      /** 当前最多四路、每路五百首的详情请求。 */
      const chunks = [0, 500, 1_000, 1_500]
        .map((chunkOffset) => ids.slice(offset + chunkOffset, offset + chunkOffset + 500))
        .filter((chunk) => chunk.length > 0)
      /** 当前批次的上游详情响应。 */
      const detailResponses = await Promise.all(chunks.map((chunk) => withoutThirdPartyConsole(() => api.song_detail({
        ids: chunk.join(','),
        cookie,
        timeout: NETEASE_API_TIMEOUT_MS
      }))))
      signal?.throwIfAborted()
      for (const detailResponse of detailResponses) {
        normalizedSongs.push(...array(bodyRecord(detailResponse)['songs'])
          .map((item) => normalizeSong(item, 'ncm.song_detail', observedAt))
          .filter((item): item is StandardSong => Boolean(item)))
      }
    }
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: 'liked',
      ownerId: userId,
      songIds,
      songs: normalizedSongs,
      updatedAt: observedAt
    })
  }

  /** 读取歌手专辑列表。 */
  private async getArtistAlbums(
    artistId: string,
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'artist_album')({
      id: artistId,
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'albumCollection',
      collection: 'artist',
      artistId,
      albums: array(bodyRecord(response)['hotAlbums'])
        .map((item) => normalizeAlbum(item, [], 'ncm.artist_album', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取相似歌手列表。 */
  private async getSimilarArtists(
    artistId: string,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'simi_artist')({
      id: artistId,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'artistCollection',
      collection: 'similar',
      artistId,
      artists: array(bodyRecord(response)['artists'])
        .map((item) => normalizeArtist(item, 'ncm.simi_artist', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取登录账户私人 FM，并保持标准歌曲集合语义。 */
  private async getPersonalFm(
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次 FM 观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 私人 FM 上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'personal_fm')({
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: 'personalFm',
      songs: array(bodyRecord(response)['data'])
        .slice(0, limit)
        .map((item) => normalizeSong(item, 'ncm.personal_fm', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取热门歌手作为首页与浏览页的稳定推荐来源。 */
  private async getRecommendedArtists(
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次歌手推荐观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 热门歌手上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'top_artists')({
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'artistCollection',
      collection: 'recommended',
      artists: array(bodyRecord(response)['artists'])
        .map((item) => normalizeArtist(item, 'ncm.top_artists', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 按地区读取最新上架专辑。 */
  private async getNewAlbums(
    area: 'ALL' | 'ZH' | 'EA' | 'KR' | 'JP',
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次最新专辑观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 新碟上架上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'top_album')({
      area,
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    /** 不同地区返回中兼容 albums、monthData 与 weekData 字段。 */
    const body = bodyRecord(response)
    /** 统一后的专辑原始数组。 */
    const albumsValue = body['albums'] ?? body['monthData'] ?? body['weekData']
    return MusicReadResultSchema.parse({
      kind: 'albumCollection',
      collection: 'new',
      area,
      albums: array(albumsValue)
        .slice(0, limit)
        .map((item) => normalizeAlbum(item, [], 'ncm.top_album', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取全部公开榜单摘要；榜单本身继续复用标准歌单详情页。 */
  private async getCharts(cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次榜单观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 榜单摘要上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'toplist')({
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'playlistCollection',
      collection: 'charts',
      playlists: array(bodyRecord(response)['list'])
        .map((item) => normalizePlaylist(item, 'ncm.toplist', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 按音乐风格、场景或情绪分类读取歌单。 */
  private async getCategoryPlaylists(
    category: string,
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次分类歌单观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 分类歌单上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'top_playlist')({
      cat: category,
      order: 'hot',
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    /** 分类歌单响应体，用于同时归一化列表与分页元数据。 */
    const body = bodyRecord(response)
    return MusicReadResultSchema.parse({
      kind: 'playlistCollection',
      collection: 'category',
      category,
      ...(numberValue(body['total']) !== undefined ? { total: numberValue(body['total']) } : {}),
      ...(booleanValue(body['more']) !== undefined ? { hasMore: booleanValue(body['more']) } : {}),
      playlists: array(body['playlists'])
        .map((item) => normalizePlaylist(item, 'ncm.top_playlist', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 按地区、歌手类型与首字母读取歌手探索列表。 */
  private async getArtists(
    area: string,
    artistType: string,
    initial: string | undefined,
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次歌手探索观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 分类歌手上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'artist_list')({
      area,
      type: artistType,
      ...(initial ? { initial } : {}),
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'artistCollection',
      collection: 'browse',
      area,
      artistType,
      ...(initial ? { initial } : {}),
      artists: array(bodyRecord(response)['artists'])
        .map((item) => normalizeArtist(item, 'ncm.artist_list', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取网易云实时搜索建议并归一化为轻量搜索结果。 */
  private async getSearchSuggestions(
    query: string,
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次建议观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 搜索建议上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'search_suggest')({
      keywords: query,
      /** web 响应包含歌曲、歌手、专辑和歌单；mobile 仅返回关键词列表。 */
      type: 'web',
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    /** 搜索建议结果对象。 */
    const result = record(bodyRecord(response)['result']) ?? {}
    return MusicReadResultSchema.parse({
      kind: 'search',
      query,
      category: 'suggestions',
      songs: array(result['songs']).slice(0, limit).map((item) => normalizeSong(item, 'ncm.search_suggest', observedAt)).filter(Boolean),
      lyrics: [],
      artists: array(result['artists']).slice(0, limit).map((item) => normalizeArtist(item, 'ncm.search_suggest', observedAt)).filter(Boolean),
      albums: array(result['albums']).slice(0, limit).map((item) => normalizeAlbum(item, [], 'ncm.search_suggest', observedAt)).filter(Boolean),
      playlists: array(result['playlists']).slice(0, limit).map((item) => normalizePlaylist(item, 'ncm.search_suggest', observedAt)).filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取热搜榜/热门歌曲（网易云官方热歌榜前 N 首）。 */
  private async getHotSongs(
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次热门歌曲观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 热歌榜歌单上游响应（网易云官方热歌榜固定 ID: 3778678）。 */
    const response = await withoutThirdPartyConsole(() =>
      api.playlist_detail({ id: '3778678', cookie, timeout: NETEASE_API_TIMEOUT_MS })
    )
    signal?.throwIfAborted()
    /** 歌单详情实体记录。 */
    const playlistRecord = record(bodyRecord(response)['playlist'])
    /** 歌单内的曲目原始数组。 */
    const rawTracks = array(playlistRecord?.['tracks'])
    /** 归一化后的热门歌曲列表。 */
    const songs = rawTracks
      .slice(0, limit)
      .map((item) => normalizeSong(item, 'ncm.playlist_detail', observedAt))
      .filter(Boolean)
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: 'hot',
      songs,
      updatedAt: observedAt
    })
  }

  /** 读取最近一周或所有时间的听歌排行，并保留个人听歌次数。 */
  private async getListeningHistory(
    userId: string,
    period: 'week' | 'all',
    limit: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次听歌排行观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 听歌排行上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'user_record')({
      uid: userId,
      type: period === 'week' ? 1 : 0,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    /** 当前周期原始排行记录。 */
    const rows = array(bodyRecord(response)[period === 'week' ? 'weekData' : 'allData']).slice(0, limit)
    /** 将排行包装字段合并到歌曲输入，避免泄露原始响应。 */
    const songs = rows
      .map((item) => {
        /** 单条听歌排行包装对象。 */
        const row = record(item)
        /** 包装内的歌曲对象。 */
        const song = record(row?.['song'])
        if (!row || !song) return undefined
        return normalizeSong(
          { ...song, listeningCount: numberValue(row['playCount']) ?? 0 },
          'ncm.user_record',
          observedAt
        )
      })
      .filter(Boolean)
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: period === 'week' ? 'historyWeek' : 'historyAll',
      ownerId: userId,
      songs,
      updatedAt: observedAt
    })
  }

  /** 读取歌手按发布时间或热度排序的作品，用于合作作品优雅降级。 */
  private async getArtistSongs(
    artistId: string,
    order: 'hot' | 'time',
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次歌手作品观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 歌手作品上游响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'artist_songs')({
      id: artistId,
      order,
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: 'artistWorks',
      artistId,
      songs: array(bodyRecord(response)['songs'])
        .map((item) => normalizeSong(item, 'ncm.artist_songs', observedAt))
        .filter(Boolean),
      updatedAt: observedAt
    })
  }

  /** 读取 API 分类树，并把歌手筛选能力一并公布给页面。 */
  private async getBrowseFacets(cookie: string, signal?: AbortSignal): Promise<MusicReadResult> {
    /** 已加载的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次 facet 观测时间。 */
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 网易云歌单分类树响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(api, 'playlist_catlist')({
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    /** 歌单分类树响应体。 */
    const body = bodyRecord(response)
    /** 分类编号到标准 facet key 的稳定映射。 */
    const playlistFacetKeys: Record<string, MusicBrowseFacetGroup['key']> = {
      '0': 'playlist-language',
      '1': 'playlist-style',
      '2': 'playlist-scene',
      '3': 'playlist-mood',
      '4': 'playlist-theme'
    }
    /** 上游分类编号到显示名称的对象。 */
    const categoryLabels = record(body['categories']) ?? {}
    /** 每个分类编号下由 API 返回的真实选项。 */
    const optionsByCategory = new Map<string, Array<{ value: string; label: string }>>()
    for (const item of array(body['sub'])) {
      /** API 返回的单个歌单分类。 */
      const raw = record(item)
      /** 分类名称同时作为 top_playlist 的 cat 参数。 */
      const name = stringValue(raw?.['name'])
      /** 分类所属分组编号。 */
      const category = String(numberValue(raw?.['category']) ?? '')
      if (!name || !playlistFacetKeys[category]) continue
      /** 当前分类分组已累计的选项。 */
      const options = optionsByCategory.get(category) ?? []
      options.push({ value: name, label: name })
      optionsByCategory.set(category, options)
    }
    /** API 返回的歌单分类分组。 */
    const playlistFacets: MusicBrowseFacetGroup[] = Object.entries(playlistFacetKeys)
      .map(([category, key]) => ({
        key,
        label: stringValue(categoryLabels[category]) ?? key,
        options: optionsByCategory.get(category) ?? []
      }))
      .filter((group) => group.options.length > 0)
    /** artist_list 参数契约公布的歌手筛选分组。 */
    const artistFacets: MusicBrowseFacetGroup[] = [
      { key: 'artist-area', label: '地区', options: [...ARTIST_AREA_FACETS] },
      { key: 'artist-type', label: '类型', options: [...ARTIST_TYPE_FACETS] },
      { key: 'artist-initial', label: '首字母', options: ARTIST_INITIAL_FACETS }
    ]
    return MusicReadResultSchema.parse({
      kind: 'playlistCollection',
      collection: 'facets',
      facets: [...playlistFacets, ...artistFacets],
      playlists: [],
      updatedAt: observedAt
    })
  }

  /** 读取并归一化歌曲、专辑或歌单评论集合。 */
  private async getComments(
    resourceType: MusicCommentResourceType,
    resourceId: string,
    limit: number,
    offset: number,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    const api = await this.requiredApi()
    const observedAt = new Date().toISOString()
    signal?.throwIfAborted()
    /** 上游评论读取响应。 */
    const response = await withoutThirdPartyConsole(() => requiredApiMethod(
      api,
      COMMENT_READ_METHODS[resourceType]
    )({
      id: resourceId,
      limit,
      offset,
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    /** 兼容 SDK body 包装后的上游响应主体。 */
    const body = bodyRecord(response)
    /** 归一化后的普通评论集合。 */
    const comments = array(body['comments'])
      .map((item) => normalizeComment(item, resourceType, resourceId))
      .filter((item): item is StandardMusicComment => Boolean(item))
    /** 归一化后的热门评论集合。 */
    const hotComments = array(body['hotComments'])
      .map((item) => normalizeComment(item, resourceType, resourceId))
      .filter((item): item is StandardMusicComment => Boolean(item))

    return MusicReadResultSchema.parse({
      kind: 'commentCollection',
      resourceType,
      resourceId,
      comments,
      hotComments,
      total: Math.max(0, Math.trunc(numberValue(body['total']) ?? comments.length)),
      more: booleanValue(body['more']) ?? comments.length === limit,
      updatedAt: observedAt
    })
  }
}
