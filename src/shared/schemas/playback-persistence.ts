import { z } from 'zod'

import { AccountIdSchema } from './account'
import { MusicQualityPreferenceSchema } from './music'

// ========= 变量 =========

/** 播放快照队列来源 Schema。 */
const PersistedQueueSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('search') }),
  z.strictObject({ kind: z.literal('discover') }),
  z.strictObject({ kind: z.literal('liked') }),
  z.strictObject({ kind: z.literal('artist'), artistId: z.string().regex(/^\d{1,20}$/u) }),
  z.strictObject({ kind: z.literal('playlist'), playlistId: z.string().min(1) }),
  z.strictObject({ kind: z.literal('album'), albumId: z.string().min(1) }),
  z.strictObject({ kind: z.literal('agent') }),
  z.strictObject({ kind: z.literal('resume') })
])

/** 播放快照封面 Schema。 */
const PersistedTrackArtworkSchema = z.strictObject({
  src: z.string().url(),
  sizes: z.string().optional(),
  type: z.string().optional()
})

/** 播放快照曲目摘要 Schema。 */
const PersistedTrackSummarySchema = z.strictObject({
  trackId: z.string().regex(/^\d{1,20}$/u),
  name: z.string().min(1).max(200),
  artists: z.array(z.string().min(1).max(160)).default([]),
  album: z.string().max(200),
  artwork: z.array(PersistedTrackArtworkSchema).optional(),
  durationMs: z.number().int().nonnegative().nullable()
})

/** 播放快照队列项 Schema。 */
const PersistedQueueItemSchema = z.strictObject({
  queueItemId: z.string().min(1),
  track: PersistedTrackSummarySchema,
  source: PersistedQueueSourceSchema,
  addedAt: z.number().int().nonnegative()
})

/** 播放快照队列 Schema。 */
const PersistedQueueSnapshotSchema = z.strictObject({
  items: z.array(PersistedQueueItemSchema).default([]),
  currentItemId: z.string().min(1).nullable(),
  mode: z.enum(['loop', 'loop-one', 'shuffle']),
  revision: z.number().int().nonnegative()
})

/** Utility SQLite 保存的播放器快照 Schema。 */
export const PersistedPlaybackSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  accountId: AccountIdSchema,
  accountGeneration: z.number().int().nonnegative(),
  savedAt: z.number().int().nonnegative(),
  queue: PersistedQueueSnapshotSchema,
  quality: MusicQualityPreferenceSchema,
  positionMs: z.number().int().nonnegative(),
  volume: z.number().min(0).max(1),
  muted: z.boolean()
})

/** Renderer → Utility：读取当前账户播放快照。 */
export const PlaybackSnapshotLoadPayloadSchema = z.strictObject({
  accountId: AccountIdSchema,
  accountGeneration: z.number().int().nonnegative()
})

/** Utility → Renderer：账户播放快照读取结果。 */
export const PlaybackSnapshotLoadResultSchema = z.strictObject({
  snapshot: PersistedPlaybackSnapshotSchema.nullable()
})

/** Renderer → Utility：保存当前账户播放快照。 */
export const PlaybackSnapshotSavePayloadSchema = z.strictObject({
  snapshot: PersistedPlaybackSnapshotSchema
})

/** Utility → Renderer：播放快照保存确认。 */
export const PlaybackSnapshotSaveResultSchema = z.strictObject({
  savedAt: z.number().int().nonnegative()
})

// ========= 类型 =========

/** Utility SQLite 保存的播放器快照。 */
export type PersistedPlaybackSnapshot = z.infer<typeof PersistedPlaybackSnapshotSchema>

/** 播放快照读取请求。 */
export type PlaybackSnapshotLoadPayload = z.infer<typeof PlaybackSnapshotLoadPayloadSchema>

/** 播放快照读取结果。 */
export type PlaybackSnapshotLoadResult = z.infer<typeof PlaybackSnapshotLoadResultSchema>

/** 播放快照保存请求。 */
export type PlaybackSnapshotSavePayload = z.infer<typeof PlaybackSnapshotSavePayloadSchema>

/** 播放快照保存结果。 */
export type PlaybackSnapshotSaveResult = z.infer<typeof PlaybackSnapshotSaveResultSchema>
