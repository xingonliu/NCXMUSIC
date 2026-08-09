import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import {
  MusicReadPayloadSchema,
  MusicReadResultSchema,
  type MusicReadPayload,
  type MusicReadResult,
  type StandardAlbum,
  type StandardAlbumSummary,
  type StandardArtist,
  type StandardArtistSummary,
  type StandardLyrics,
  type StandardLyricsLine,
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
}

/** Music Service 底层数据源接口。 */
export interface MusicDataSource {
  read(payload: MusicReadPayload, cookie: string, signal?: AbortSignal): Promise<MusicReadResult>
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

/** 屏蔽三方 API 包的 console 输出，避免原始响应或错误串入日志。 */
async function withoutThirdPartyConsole<T>(op: () => Promise<T>): Promise<T> {
  const original = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn
  }
  const noop = (): void => {}
  console.debug = noop
  console.error = noop
  console.info = noop
  console.log = noop
  console.warn = noop
  try {
    return await op()
  } finally {
    Object.assign(console, original)
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
  return record(response.body) ?? {}
}

/** 构造实体来源描述。 */
function source(api: string, observedAt: string): [{ api: string; observedAt: string }] {
  return [{ api, observedAt }]
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
function normalizeArtist(rawValue: unknown, api: string, observedAt: string): StandardArtist | undefined {
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
    songs,
    sources: source(api, observedAt),
    updatedAt: observedAt
  }
}

/** 归一化歌单实体。 */
function normalizePlaylist(rawValue: unknown, api: string, observedAt: string): StandardPlaylist | undefined {
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
    ...(urlValue(raw['coverImgUrl']) ? { artworkUrl: urlValue(raw['coverImgUrl']) } : {}),
    ...(numberValue(raw['trackCount']) !== undefined ? { trackCount: numberValue(raw['trackCount']) } : {}),
    ...(numberValue(raw['playCount']) !== undefined ? { playCount: numberValue(raw['playCount']) } : {}),
    ...(typeof raw['subscribed'] === 'boolean' ? { subscribed: raw['subscribed'] } : {}),
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
    return this.getUser(parsed.id, cookie, signal)
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
    const api = await this.requiredApi()
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
    const entity = normalizeArtist(bodyRecord(response)['artist'], 'ncm.artists', observedAt)
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
}
