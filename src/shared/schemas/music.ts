import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// 基础类型
// ─────────────────────────────────────────────────────────────────────────────

/** 网易云音乐曲目 ID（纯数字字符串，最长 20 位） */
export const TrackIdSchema = z.string().regex(/^\d{1,20}$/u, '曲目 ID 必须为纯数字')

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
export type MusicQualityLevel = z.infer<typeof MusicQualityLevelSchema>
export type MusicQualityPreference = z.infer<typeof MusicQualityPreferenceSchema>
export type ResolveTrackUrlPayload = z.infer<typeof ResolveTrackUrlPayloadSchema>
export type ResolvedMediaSource = z.infer<typeof ResolvedMediaSourceSchema>
