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
  type MusicCommentResourceType,
  type MusicReadPayload,
  type MusicReadResult,
  type StandardAlbum,
  type StandardAlbumSummary,
  type StandardArtist,
  type StandardArtistSummary,
  type StandardLyrics,
  type StandardLyricsLine,
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

/** NeteaseCloudMusicApiEnhanced 中 Phase 2 首批只读能力。 */
export interface NeteaseMusicApi {
  search(params: Record<string, unknown>): Promise<NeteaseResponse>
  song_detail(params: Record<string, unknown>): Promise<NeteaseResponse>
  lyric_new?(params: Record<string, unknown>): Promise<NeteaseResponse>
  lyric?(params: Record<string, unknown>): Promise<NeteaseResponse>
  artists(params: Record<string, unknown>): Promise<NeteaseResponse>
  album(params: Record<string, unknown>): Promise<NeteaseResponse>
  playlist_detail(params: Record<string, unknown>): Promise<NeteaseResponse>
  user_detail(params: Record<string, unknown>): Promise<NeteaseResponse>
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
  /** 歌词时间点（毫秒）。 */
  timeMs: number
  /** 当前时间点歌词文案。 */
  text: string
}

// ========= 变量 =========

/** 网易云 API 默认超时。 */
const NETEASE_API_TIMEOUT_MS = 20_000

/** 搜索类型与响应字段映射。 */
const SEARCH_TYPES = {
  songs: '1',
  artists: '100',
  albums: '10',
  playlists: '1000'
} as const

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

/**
 * 把 lrc/yrc 歌词文本拆成标准时间轴。
 *
 * @param lyricText 网易云返回的原始歌词文本
 */
function parseLyricLines(lyricText: string | undefined): ParsedLyricLine[] {
  if (!lyricText) return []

  /** 单行中所有时间标签及其正文。 */
  const linePattern = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\][^\S\r\n]*(.*)/gu
  /** 标准化后的歌词行集合。 */
  const lines: ParsedLyricLine[] = []

  for (const rawLine of lyricText.split(/\r?\n/u)) {
    linePattern.lastIndex = 0
    const match = linePattern.exec(rawLine)
    if (!match) continue

    const minutes = Number(match[1] ?? 0)
    const seconds = Number(match[2] ?? 0)
    const fractionText = match[3] ?? '0'
    const fractionMs = Number(fractionText.padEnd(3, '0').slice(0, 3))
    const text = (match[4] ?? '').trim()
    lines.push({
      timeMs: (minutes * 60 + seconds) * 1000 + fractionMs,
      text
    })
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs)
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
    if (line.text) translationByTime.set(line.timeMs, line.text)
  }

  return originalLines.map((line) => ({
    timeMs: line.timeMs,
    text: line.text,
    ...(translationByTime.get(line.timeMs)
      ? { translation: translationByTime.get(line.timeMs) as string }
      : {})
  }))
}

/** 从歌词响应体中归一化标准歌词实体。 */
function normalizeLyrics(id: string, rawBody: UnknownRecord, api: string, observedAt: string): StandardLyrics {
  const lyricText = stringValue(record(rawBody['lrc'])?.['lyric'])
  const translatedText = stringValue(record(rawBody['tlyric'])?.['lyric'])
  const originalLines = parseLyricLines(lyricText)
  const translatedLines = parseLyricLines(translatedText)

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
  const songs = array(raw['tracks']).map((song) => normalizeSong(song, api, observedAt)).filter((item): item is StandardSong => Boolean(item))
  return {
    kind: 'playlist',
    id,
    name,
    ...(creator ? { creator } : {}),
    ...(urlValue(raw['coverImgUrl'] ?? raw['picUrl']) ? { artworkUrl: urlValue(raw['coverImgUrl'] ?? raw['picUrl']) } : {}),
    ...(numberValue(raw['trackCount']) !== undefined ? { trackCount: numberValue(raw['trackCount']) } : {}),
    ...(numberValue(raw['playCount']) !== undefined ? { playCount: numberValue(raw['playCount']) } : {}),
    ...(typeof raw['subscribed'] === 'boolean' ? { subscribed: raw['subscribed'] } : {}),
    ...(stringValue(raw['description']) ? { description: stringValue(raw['description']) } : {}),
    ...(ownerId && creator ? { owned: creator.id === ownerId } : {}),
    songs,
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 归一化用户实体。 */
function normalizeUser(rawValue: unknown, api: string, observedAt: string): StandardUser | undefined {
  const summary = normalizeUserSummary(rawValue)
  const raw = record(rawValue)
  if (!summary || !raw) return undefined
  return {
    kind: 'user',
    id: summary.id,
    nickname: summary.nickname,
    ...(summary.avatarUrl ? { avatarUrl: summary.avatarUrl } : {}),
    ...(stringValue(raw['signature']) ? { signature: stringValue(raw['signature']) } : {}),
    ...(numberValue(raw['followeds']) !== undefined ? { followeds: numberValue(raw['followeds']) } : {}),
    ...(numberValue(raw['follows']) !== undefined ? { follows: numberValue(raw['follows']) } : {}),
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

  /** 执行搜索并归一化歌曲、歌手、专辑、歌单候选。 */
  private async search(
    payload: Extract<MusicReadPayload, { operation: 'search' }>,
    cookie: string,
    signal?: AbortSignal
  ): Promise<MusicReadResult> {
    /** 已加载且满足方法契约的网易云 API。 */
    const api = await this.requiredApi()
    /** 本次读取的统一观测时间。 */
    const observedAt = new Date().toISOString()
    const callSearch = async (type: string): Promise<UnknownRecord> => {
      signal?.throwIfAborted()
      const response = await withoutThirdPartyConsole(() =>
        api.search({
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
    const [songResult, artistResult, albumResult, playlistResult] = await Promise.all([
      callSearch(SEARCH_TYPES.songs),
      callSearch(SEARCH_TYPES.artists),
      callSearch(SEARCH_TYPES.albums),
      callSearch(SEARCH_TYPES.playlists)
    ])
    return MusicReadResultSchema.parse({
      kind: 'search',
      query: payload.query,
      songs: array(songResult['songs']).map((item) => normalizeSong(item, 'ncm.search', observedAt)).filter(Boolean),
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
    const entity = normalizeUser(bodyRecord(response)['profile'], 'ncm.user_detail', observedAt)
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
    const ids = array(bodyRecord(likedResponse)['ids']).map(idValue).filter((item): item is string => Boolean(item)).slice(0, limit)
    if (ids.length === 0) {
      return MusicReadResultSchema.parse({
        kind: 'songCollection',
        collection: 'liked',
        ownerId: userId,
        songs: [],
        updatedAt: observedAt
      })
    }
    const detailResponse = await withoutThirdPartyConsole(() => api.song_detail({
      ids: ids.join(','),
      cookie,
      timeout: NETEASE_API_TIMEOUT_MS
    }))
    signal?.throwIfAborted()
    return MusicReadResultSchema.parse({
      kind: 'songCollection',
      collection: 'liked',
      ownerId: userId,
      songs: array(bodyRecord(detailResponse)['songs'])
        .map((item) => normalizeSong(item, 'ncm.song_detail', observedAt))
        .filter(Boolean),
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
