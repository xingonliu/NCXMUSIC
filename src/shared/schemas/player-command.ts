import { z } from 'zod'

import { MusicQualityPreferenceSchema } from './music'

// ========= 变量 =========

/** 播放命令中的曲目封面。 */
const PlayerCommandArtworkSchema = z.strictObject({
  src: z.string().url(),
  sizes: z.string().optional(),
  type: z.string().optional()
})

/** 播放命令中的曲目摘要，不包含播放 URL。 */
const PlayerCommandTrackSchema = z.strictObject({
  trackId: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  artists: z.array(z.string().min(1).max(160)).max(30),
  album: z.string().max(200),
  artwork: z.array(PlayerCommandArtworkSchema).max(10).optional(),
  durationMs: z.number().int().nonnegative().nullable()
})

/** 播放命令中的队列来源。 */
const PlayerCommandQueueSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('search') }),
  z.strictObject({ kind: z.literal('discover') }),
  z.strictObject({ kind: z.literal('liked') }),
  z.strictObject({ kind: z.literal('artist'), artistId: z.string().min(1).max(40) }),
  z.strictObject({ kind: z.literal('playlist'), playlistId: z.string().min(1).max(40) }),
  z.strictObject({ kind: z.literal('album'), albumId: z.string().min(1).max(40) }),
  z.strictObject({ kind: z.literal('agent') }),
  z.strictObject({ kind: z.literal('resume') })
])

/** 所有入口共用的播放器命令载荷。 */
const PlayerCommandActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('player.play-context'),
    tracks: z.array(PlayerCommandTrackSchema).max(5_000),
    source: PlayerCommandQueueSourceSchema,
    startIndex: z.number().int().nonnegative().optional()
  }),
  z.strictObject({
    type: z.literal('player.play-track'),
    track: PlayerCommandTrackSchema,
    source: PlayerCommandQueueSourceSchema
  }),
  z.strictObject({ type: z.literal('player.play-queue-item'), queueItemId: z.string().min(1) }),
  z.strictObject({ type: z.literal('player.play') }),
  z.strictObject({ type: z.literal('player.pause') }),
  z.strictObject({ type: z.literal('player.toggle') }),
  z.strictObject({ type: z.literal('player.next') }),
  z.strictObject({ type: z.literal('player.previous') }),
  z.strictObject({ type: z.literal('player.seek'), positionMs: z.number().int().nonnegative() }),
  z.strictObject({ type: z.literal('player.set-volume'), volume: z.number().min(0).max(1) }),
  z.strictObject({ type: z.literal('player.set-muted'), muted: z.boolean() }),
  z.strictObject({ type: z.literal('player.set-mode'), mode: z.enum(['loop', 'loop-one', 'shuffle']) }),
  z.strictObject({ type: z.literal('player.set-quality'), quality: MusicQualityPreferenceSchema }),
  z.strictObject({
    type: z.literal('player.enqueue'),
    tracks: z.array(PlayerCommandTrackSchema).min(1).max(5_000),
    source: PlayerCommandQueueSourceSchema
  }),
  z.strictObject({
    type: z.literal('player.play-next'),
    tracks: z.array(PlayerCommandTrackSchema).min(1).max(5_000),
    source: PlayerCommandQueueSourceSchema
  }),
  z.strictObject({
    type: z.literal('player.reorder'),
    queueItemId: z.string().min(1),
    toIndex: z.number().int().nonnegative()
  }),
  z.strictObject({ type: z.literal('player.remove'), queueItemId: z.string().min(1) }),
  z.strictObject({ type: z.literal('player.clear') })
])

/** 共享 PlayerCommand 契约。 */
export const PlayerCommandSchema = z.strictObject({
  commandId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  issuedAt: z.number().int().nonnegative(),
  timeoutMs: z.number().int().min(100).max(10_000).default(5_000),
  action: PlayerCommandActionSchema
})

/** 播放命令稳定结果码。 */
export const PlayerCommandResultCodeSchema = z.enum([
  'applied',
  'revision-conflict',
  'timeout',
  'invalid-command',
  'execution-failed'
])

/** 共享 PlayerCommand 回执；snapshot 由 Renderer 使用 PlayerSnapshot 进一步类型化。 */
export const PlayerCommandResultSchema = z.strictObject({
  commandId: z.uuid(),
  ok: z.boolean(),
  code: PlayerCommandResultCodeSchema,
  latestRevision: z.number().int().nonnegative(),
  snapshot: z.unknown()
})

// ========= 类型 =========

/** 统一播放器命令。 */
export type PlayerCommand = z.infer<typeof PlayerCommandSchema>

/** 统一播放器命令动作。 */
export type PlayerCommandAction = z.infer<typeof PlayerCommandActionSchema>

/** 统一播放器命令回执。 */
export type PlayerCommandResult = z.infer<typeof PlayerCommandResultSchema>
