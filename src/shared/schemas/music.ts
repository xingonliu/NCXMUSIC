import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// 基础类型
// ─────────────────────────────────────────────────────────────────────────────

/** 网易云音乐曲目 ID（纯数字字符串，最长 20 位） */
export const TrackIdSchema = z.string().regex(/^\d{1,20}$/u, '曲目 ID 必须为纯数字')

/** 网易云歌手 ID（纯数字字符串，最长 20 位）。 */
export const ArtistIdSchema = z.string().regex(/^\d{1,20}$/u, '歌手 ID 必须为纯数字')

/** 网易云专辑 ID（纯数字字符串，最长 20 位）。 */
export const AlbumIdSchema = z.string().regex(/^\d{1,20}$/u, '专辑 ID 必须为纯数字')

/** 网易云歌单 ID（纯数字字符串，最长 20 位）。 */
export const PlaylistIdSchema = z.string().regex(/^\d{1,20}$/u, '歌单 ID 必须为纯数字')

/** 网易云用户 ID（纯数字字符串，最长 20 位）。 */
export const MusicUserIdSchema = z.string().regex(/^\d{1,20}$/u, '用户 ID 必须为纯数字')

/** 标准实体更新时间，统一使用 ISO 字符串。 */
export const EntityUpdatedAtSchema = z.string().datetime()

/**
 * 音质等级枚举
 * 与 @neteasecloudmusicapienhanced/api SoundQualityType 对齐，
 * 额外补充架构文档定义的 higher / dolby。
 */
export const MusicQualityLevelSchema = z.enum([
  'standard',
  'higher',
  'exhigh',
  'lossless',
  'hires',
  'jyeffect',
  'sky',
  'dolby',
  'jymaster'
])

/** auto = 从 jymaster 向下自动降级选择最高可播放音质 */
export const MusicQualityPreferenceSchema = z.union([
  z.literal('auto'),
  MusicQualityLevelSchema
])

// ─────────────────────────────────────────────────────────────────────────────
// 标准音乐实体
// ─────────────────────────────────────────────────────────────────────────────

/** 音乐实体事实来源。 */
export const MusicEntitySourceSchema = z.strictObject({
  api: z.string().min(1).max(80),
  observedAt: EntityUpdatedAtSchema
})

/** 曲目权益与展示标记。 */
export const TrackAccessMetaSchema = z.strictObject({
  badges: z.array(z.enum(['vip', 'paid'])).default([]),
  playableKnown: z.boolean().default(false)
})

/** 标准歌手摘要。 */
export const StandardArtistSummarySchema = z.strictObject({
  id: ArtistIdSchema,
  name: z.string().min(1).max(160),
  alias: z.array(z.string().min(1).max(160)).default([]),
  artworkUrl: z.string().url().optional()
})

/** 标准专辑摘要。 */
export const StandardAlbumSummarySchema = z.strictObject({
  id: AlbumIdSchema,
  name: z.string().min(1).max(200),
  artworkUrl: z.string().url().optional(),
  publishTime: z.number().int().nonnegative().optional()
})

/** 标准用户摘要。 */
export const StandardUserSummarySchema = z.strictObject({
  id: MusicUserIdSchema,
  nickname: z.string().min(1).max(160),
  avatarUrl: z.string().url().optional()
})

/** 标准歌曲实体。 */
export const StandardSongSchema = z.strictObject({
  kind: z.literal('song'),
  id: TrackIdSchema,
  name: z.string().min(1).max(200),
  artists: z.array(StandardArtistSummarySchema).default([]),
  album: StandardAlbumSummarySchema.optional(),
  durationMs: z.number().int().nonnegative().optional(),
  access: TrackAccessMetaSchema.default({ badges: [], playableKnown: false }),
  sources: z.array(MusicEntitySourceSchema).min(1),
  updatedAt: EntityUpdatedAtSchema
})

/** 标准歌词行。 */
export const StandardLyricsLineSchema = z.strictObject({
  timeMs: z.number().int().nonnegative(),
  text: z.string().max(500),
  translation: z.string().max(500).optional()
})

/** 标准歌词实体。 */
export const StandardLyricsSchema = z.strictObject({
  kind: z.literal('lyrics'),
  trackId: TrackIdSchema,
  lines: z.array(StandardLyricsLineSchema).default([]),
  plainText: z.string().max(50_000).optional(),
  translatedText: z.string().max(50_000).optional(),
  sources: z.array(MusicEntitySourceSchema).min(1),
  updatedAt: EntityUpdatedAtSchema
})

/** 标准歌手实体。 */
export const StandardArtistSchema = z.strictObject({
  kind: z.literal('artist'),
  id: ArtistIdSchema,
  name: z.string().min(1).max(160),
  alias: z.array(z.string().min(1).max(160)).default([]),
  artworkUrl: z.string().url().optional(),
  songCount: z.number().int().nonnegative().optional(),
  albumCount: z.number().int().nonnegative().optional(),
  sources: z.array(MusicEntitySourceSchema).min(1),
  updatedAt: EntityUpdatedAtSchema
})

/** 标准专辑实体。 */
export const StandardAlbumSchema = z.strictObject({
  kind: z.literal('album'),
  id: AlbumIdSchema,
  name: z.string().min(1).max(200),
  artist: StandardArtistSummarySchema.optional(),
  artworkUrl: z.string().url().optional(),
  publishTime: z.number().int().nonnegative().optional(),
  size: z.number().int().nonnegative().optional(),
  songs: z.array(StandardSongSchema).default([]),
  sources: z.array(MusicEntitySourceSchema).min(1),
  updatedAt: EntityUpdatedAtSchema
})

/** 标准歌单实体。 */
export const StandardPlaylistSchema = z.strictObject({
  kind: z.literal('playlist'),
  id: PlaylistIdSchema,
  name: z.string().min(1).max(200),
  creator: StandardUserSummarySchema.optional(),
  artworkUrl: z.string().url().optional(),
  trackCount: z.number().int().nonnegative().optional(),
  playCount: z.number().int().nonnegative().optional(),
  subscribed: z.boolean().optional(),
  songs: z.array(StandardSongSchema).default([]),
  sources: z.array(MusicEntitySourceSchema).min(1),
  updatedAt: EntityUpdatedAtSchema
})

/** 标准用户实体。 */
export const StandardUserSchema = z.strictObject({
  kind: z.literal('user'),
  id: MusicUserIdSchema,
  nickname: z.string().min(1).max(160),
  avatarUrl: z.string().url().optional(),
  signature: z.string().max(400).optional(),
  followeds: z.number().int().nonnegative().optional(),
  follows: z.number().int().nonnegative().optional(),
  sources: z.array(MusicEntitySourceSchema).min(1),
  updatedAt: EntityUpdatedAtSchema
})

/** 标准音乐实体联合。 */
export const StandardMusicEntitySchema = z.discriminatedUnion('kind', [
  StandardSongSchema,
  StandardArtistSchema,
  StandardAlbumSchema,
  StandardPlaylistSchema,
  StandardUserSchema
])

// ─────────────────────────────────────────────────────────────────────────────
// music.read 请求与响应
// ─────────────────────────────────────────────────────────────────────────────

/** 搜索请求载荷。 */
export const MusicSearchPayloadSchema = z.strictObject({
  operation: z.literal('search'),
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(5_000).default(0)
})

/** 歌曲详情请求载荷。 */
export const GetSongPayloadSchema = z.strictObject({
  operation: z.literal('getSong'),
  id: TrackIdSchema
})

/** 歌词详情请求载荷。 */
export const GetLyricsPayloadSchema = z.strictObject({
  operation: z.literal('getLyrics'),
  id: TrackIdSchema
})

/** 歌手详情请求载荷。 */
export const GetArtistPayloadSchema = z.strictObject({
  operation: z.literal('getArtist'),
  id: ArtistIdSchema
})

/** 专辑详情请求载荷。 */
export const GetAlbumPayloadSchema = z.strictObject({
  operation: z.literal('getAlbum'),
  id: AlbumIdSchema
})

/** 歌单详情请求载荷。 */
export const GetPlaylistPayloadSchema = z.strictObject({
  operation: z.literal('getPlaylist'),
  id: PlaylistIdSchema
})

/** 用户详情请求载荷。 */
export const GetUserPayloadSchema = z.strictObject({
  operation: z.literal('getUser'),
  id: MusicUserIdSchema
})

/** Music Service 只读请求载荷。 */
export const MusicReadPayloadSchema = z.discriminatedUnion('operation', [
  MusicSearchPayloadSchema,
  GetSongPayloadSchema,
  GetLyricsPayloadSchema,
  GetArtistPayloadSchema,
  GetAlbumPayloadSchema,
  GetPlaylistPayloadSchema,
  GetUserPayloadSchema
])

/** 搜索响应结果。 */
export const MusicSearchResultSchema = z.strictObject({
  kind: z.literal('search'),
  query: z.string().min(1).max(120),
  songs: z.array(StandardSongSchema).default([]),
  artists: z.array(StandardArtistSchema).default([]),
  albums: z.array(StandardAlbumSchema).default([]),
  playlists: z.array(StandardPlaylistSchema).default([]),
  updatedAt: EntityUpdatedAtSchema
})

/** 实体详情响应结果。 */
export const MusicEntityResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('song'), entity: StandardSongSchema.nullable() }),
  z.strictObject({ kind: z.literal('lyrics'), entity: StandardLyricsSchema.nullable() }),
  z.strictObject({ kind: z.literal('artist'), entity: StandardArtistSchema.nullable() }),
  z.strictObject({ kind: z.literal('album'), entity: StandardAlbumSchema.nullable() }),
  z.strictObject({ kind: z.literal('playlist'), entity: StandardPlaylistSchema.nullable() }),
  z.strictObject({ kind: z.literal('user'), entity: StandardUserSchema.nullable() })
])

/** Music Service 只读响应结果。 */
export const MusicReadResultSchema = z.union([
  MusicSearchResultSchema,
  MusicEntityResultSchema
])

// ─────────────────────────────────────────────────────────────────────────────
// music.resolve-url 请求载荷
// ─────────────────────────────────────────────────────────────────────────────

/** Renderer → Utility：解析指定曲目的可播放 URL */
export const ResolveTrackUrlPayloadSchema = z.strictObject({
  trackId: TrackIdSchema,
  /** 期望音质，默认走自动降级链 */
  quality: MusicQualityPreferenceSchema.default('auto')
})

// ─────────────────────────────────────────────────────────────────────────────
// music.resolve-url 响应结果
// ─────────────────────────────────────────────────────────────────────────────

/** Utility → Renderer：解析成功后的媒体源描述（不含 Cookie 或签名 Header） */
export const ResolvedMediaSourceSchema = z.strictObject({
  /** 短期有效的 HTTPS 播放 URL，不持久化、不写日志 */
  url: z.string().url(),
  requestedQuality: MusicQualityPreferenceSchema,
  actualQuality: MusicQualityLevelSchema,
  /** 本次解析过程中尝试过的音质列表（从高到低） */
  attemptedQualities: z.array(MusicQualityLevelSchema),
  downgraded: z.boolean(),
  downgradeReason: z
    .enum([
      'track-unavailable',
      'account-unavailable',
      'device-unsupported',
      'upstream-fallback'
    ])
    .optional(),
  /** 实际码率 bps */
  bitrate: z.number().int().nonnegative().optional(),
  /** 文件格式，如 mp3 / flac / aac */
  format: z.string().max(16).optional(),
  /** 文件大小（字节） */
  size: z.number().int().nonnegative().optional()
})

// ─────────────────────────────────────────────────────────────────────────────
// 类型导出
// ─────────────────────────────────────────────────────────────────────────────

export type TrackId = z.infer<typeof TrackIdSchema>
export type ArtistId = z.infer<typeof ArtistIdSchema>
export type AlbumId = z.infer<typeof AlbumIdSchema>
export type PlaylistId = z.infer<typeof PlaylistIdSchema>
export type MusicUserId = z.infer<typeof MusicUserIdSchema>
export type MusicQualityLevel = z.infer<typeof MusicQualityLevelSchema>
export type MusicQualityPreference = z.infer<typeof MusicQualityPreferenceSchema>
export type MusicEntitySource = z.infer<typeof MusicEntitySourceSchema>
export type TrackAccessMeta = z.infer<typeof TrackAccessMetaSchema>
export type StandardArtistSummary = z.infer<typeof StandardArtistSummarySchema>
export type StandardAlbumSummary = z.infer<typeof StandardAlbumSummarySchema>
export type StandardUserSummary = z.infer<typeof StandardUserSummarySchema>
export type StandardSong = z.infer<typeof StandardSongSchema>
export type StandardLyricsLine = z.infer<typeof StandardLyricsLineSchema>
export type StandardLyrics = z.infer<typeof StandardLyricsSchema>
export type StandardArtist = z.infer<typeof StandardArtistSchema>
export type StandardAlbum = z.infer<typeof StandardAlbumSchema>
export type StandardPlaylist = z.infer<typeof StandardPlaylistSchema>
export type StandardUser = z.infer<typeof StandardUserSchema>
export type StandardMusicEntity = z.infer<typeof StandardMusicEntitySchema>
export type MusicReadPayload = z.infer<typeof MusicReadPayloadSchema>
export type MusicReadResult = z.infer<typeof MusicReadResultSchema>
export type ResolveTrackUrlPayload = z.infer<typeof ResolveTrackUrlPayloadSchema>
export type ResolvedMediaSource = z.infer<typeof ResolvedMediaSourceSchema>
