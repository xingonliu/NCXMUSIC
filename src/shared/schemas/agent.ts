import { z } from 'zod'

import {
  StandardAlbumSchema,
  StandardArtistSchema,
  StandardPlaylistSchema,
  StandardSongSchema
} from './music'
import { PlayerCommandActionSchema, PlayerCommandTrackSchema } from './player-command'
import {
  EMPTY_MUSIC_PERSONALIZATION_SNAPSHOT,
  MusicPersonalizationSnapshotSchema
} from './personalization'

// ========= 变量 =========

/** 音乐代操作安全等级。 */
export const MusicSafetyLevelSchema = z.enum(['M1', 'M2', 'M3', 'M4'])

/** Shell 命令安全等级。 */
export const CommandSafetyLevelSchema = z.enum(['S1', 'S2', 'S3', 'S4'])

/** Agent Turn 终止原因。 */
export const AgentTurnEndReasonSchema = z.enum([
  'completed',
  'user_stopped',
  'superseded_by_user_message',
  'account_switch',
  'app_exit',
  'runtime_failure',
  'provider_error',
  'limit_reached'
])

/** Agent Turn 状态。 */
export const AgentTurnStatusSchema = z.enum([
  'idle',
  'building_context',
  'requesting_model',
  'streaming_model',
  'scheduling_tools',
  'awaiting_approval',
  'awaiting_selection',
  'executing_tools',
  'completed',
  'cancelled',
  'failed'
])

/** 对话消息。 */
export const AgentMessageSchema = z.strictObject({
  messageId: z.uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(200_000),
  /** 当前 Assistant 消息实际发起的 Tool Call，用于把工具卡稳定挂回会话时间线。 */
  toolCallIds: z.array(z.uuid()).max(24).default([]),
  createdAt: z.number().int().nonnegative(),
  streaming: z.boolean().default(false),
  interrupted: z.boolean().default(false)
})

/** Tool 卡片状态。 */
export const ToolExecutionStatusSchema = z.enum([
  'queued',
  'awaiting_approval',
  'awaiting_selection',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'rejected',
  'expired'
])

/** Renderer 可见的脱敏 Tool 执行卡。 */
export const ToolExecutionCardSnapshotSchema = z.strictObject({
  toolCallId: z.uuid(),
  toolName: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  category: z.enum(['music', 'player', 'account', 'interaction', 'gateway']),
  status: ToolExecutionStatusSchema,
  parameterSummary: z.string().max(500),
  resultSummary: z.string().max(1_000).optional(),
  errorCode: z.string().max(80).optional(),
  startedAt: z.number().int().nonnegative().optional(),
  endedAt: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional()
})

/** 审批卡快照。 */
export const ApprovalSnapshotSchema = z.strictObject({
  approvalId: z.uuid(),
  toolCallId: z.uuid(),
  title: z.string().min(1).max(120),
  impact: z.string().min(1).max(500),
  riskReason: z.string().min(1).max(500),
  expiresAt: z.number().int().positive(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired', 'cancelled'])
})

/** SelectionCard 可引用的标准实体。 */
export const SelectionEntitySchema = z.union([
  StandardSongSchema,
  StandardArtistSchema,
  StandardAlbumSchema,
  StandardPlaylistSchema
])

/** SelectionCard 选项。 */
export const SelectionOptionSnapshotSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('entity'),
    optionKey: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/u),
    entity: SelectionEntitySchema
  }),
  z.strictObject({
    kind: z.literal('text'),
    optionKey: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/u),
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).optional()
  })
])

/** 选择卡快照。 */
export const SelectionSnapshotSchema = z.strictObject({
  selectionId: z.uuid(),
  toolCallId: z.uuid(),
  prompt: z.string().trim().min(1).max(500),
  mode: z.enum(['single', 'multiple']),
  options: z.array(SelectionOptionSnapshotSchema).min(2).max(5),
  selectedOptionKeys: z.array(z.string()).max(5),
  expiresAt: z.number().int().positive(),
  status: z.enum(['pending', 'selected', 'cancelled', 'expired'])
})

/** 小云完整可恢复快照。 */
export const AgentSnapshotSchema = z.strictObject({
  configured: z.boolean(),
  activeProfileId: z.uuid().optional(),
  turnId: z.uuid().optional(),
  turnStatus: AgentTurnStatusSchema,
  endReason: AgentTurnEndReasonSchema.optional(),
  messages: z.array(AgentMessageSchema),
  tools: z.array(ToolExecutionCardSnapshotSchema),
  approvals: z.array(ApprovalSnapshotSchema),
  selections: z.array(SelectionSnapshotSchema),
  toolRounds: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  musicSafetyLevel: MusicSafetyLevelSchema,
  commandSafetyLevel: CommandSafetyLevelSchema,
  shellToolEnabled: z.boolean(),
  personalization: MusicPersonalizationSnapshotSchema.default(EMPTY_MUSIC_PERSONALIZATION_SNAPSHOT),
  updatedAt: z.number().int().nonnegative()
})

/** Agent 可消费的脱敏播放器与队列状态。 */
export const AgentPlayerStateSchema = z.strictObject({
  playbackStatus: z.enum(['idle', 'loading', 'ready', 'playing', 'paused', 'buffering', 'error']),
  currentTrack: PlayerCommandTrackSchema.nullable(),
  positionMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  mode: z.enum(['loop', 'loop-one', 'shuffle']),
  revision: z.number().int().nonnegative(),
  queue: z.array(z.strictObject({
    queueItemId: z.string().min(1).max(120),
    track: PlayerCommandTrackSchema
  })).max(5_000)
})

/** Renderer → Utility 的 Agent 命令。 */
export const AgentCommandSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('snapshot') }),
  z.strictObject({
    operation: z.literal('sendMessage'),
    content: z.string().trim().min(1).max(20_000),
    context: z.strictObject({
      routeName: z.string().max(80).optional(),
      entityKind: z.enum(['song', 'artist', 'album', 'playlist']).optional(),
      entityId: z.string().max(80).optional(),
      entityName: z.string().max(240).optional()
    }).optional()
  }),
  z.strictObject({ operation: z.literal('stop') }),
  z.strictObject({ operation: z.literal('flushConversation') }),
  z.strictObject({
    operation: z.literal('respondApproval'),
    approvalId: z.uuid(),
    decision: z.enum(['approve', 'reject'])
  }),
  z.strictObject({
    operation: z.literal('respondSelection'),
    selectionId: z.uuid(),
    selectedOptionKeys: z.array(z.string()).min(1).max(5)
  }),
  z.strictObject({ operation: z.literal('cancelSelection'), selectionId: z.uuid() }),
  z.strictObject({
    operation: z.literal('startProfileAnalysis'),
    mode: z.enum(['initialize', 'update', 'regenerate'])
  }),
  z.strictObject({ operation: z.literal('dismissProfilePrompt') }),
  z.strictObject({ operation: z.literal('pauseProfile') }),
  z.strictObject({ operation: z.literal('resumeProfile') }),
  z.strictObject({ operation: z.literal('deleteProfile') }),
  z.strictObject({
    operation: z.literal('setProfileOverride'),
    kind: z.enum(['correction', 'hidden', 'supplement']),
    insightId: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/u).optional(),
    value: z.string().trim().min(1).max(500).optional()
  }),
  z.strictObject({ operation: z.literal('removeProfileOverride'), overrideId: z.uuid() }),
  z.strictObject({
    operation: z.literal('setSafety'),
    musicSafetyLevel: MusicSafetyLevelSchema.optional(),
    commandSafetyLevel: CommandSafetyLevelSchema.optional(),
    shellToolEnabled: z.boolean().optional()
  }),
  z.strictObject({
    operation: z.literal('playerCommandResult'),
    toolCallId: z.uuid(),
    ok: z.boolean(),
    summary: z.string().max(500),
    latestRevision: z.number().int().nonnegative().optional()
  }),
  z.strictObject({
    operation: z.literal('playerStateResult'),
    toolCallId: z.uuid(),
    state: AgentPlayerStateSchema
  })
])

/** Renderer 自动执行的类型化播放命令请求。 */
export const AgentPlayerCommandRequestSchema = z.strictObject({
  toolCallId: z.uuid(),
  action: PlayerCommandActionSchema
})

/** Utility 请求 Renderer 读取真实播放器状态。 */
export const AgentPlayerStateRequestSchema = z.strictObject({
  toolCallId: z.uuid(),
  scope: z.enum(['player', 'queue'])
})

/** Utility 推送给 Renderer 的 Agent 事件。 */
export const AgentRuntimeEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('snapshot'), snapshot: AgentSnapshotSchema }),
  z.strictObject({ type: z.literal('player-command'), request: AgentPlayerCommandRequestSchema }),
  z.strictObject({ type: z.literal('player-state-request'), request: AgentPlayerStateRequestSchema })
])

// ========= 类型 =========

/** 音乐安全等级类型。 */
export type MusicSafetyLevel = z.infer<typeof MusicSafetyLevelSchema>

/** 命令安全等级类型。 */
export type CommandSafetyLevel = z.infer<typeof CommandSafetyLevelSchema>

/** Agent Turn 状态类型。 */
export type AgentTurnStatus = z.infer<typeof AgentTurnStatusSchema>

/** Agent Turn 终止原因类型。 */
export type AgentTurnEndReason = z.infer<typeof AgentTurnEndReasonSchema>

/** Agent 对话消息类型。 */
export type AgentMessage = z.infer<typeof AgentMessageSchema>

/** Agent Tool 卡片类型。 */
export type ToolExecutionCardSnapshot = z.infer<typeof ToolExecutionCardSnapshotSchema>

/** Agent 审批卡类型。 */
export type ApprovalSnapshot = z.infer<typeof ApprovalSnapshotSchema>

/** Agent 选择卡类型。 */
export type SelectionSnapshot = z.infer<typeof SelectionSnapshotSchema>

/** Agent 可恢复快照类型。 */
export type AgentSnapshot = z.infer<typeof AgentSnapshotSchema>

/** Agent 可消费的播放器状态类型。 */
export type AgentPlayerState = z.infer<typeof AgentPlayerStateSchema>

/** Agent 命令类型。 */
export type AgentCommand = z.infer<typeof AgentCommandSchema>

/** Agent 流式事件类型。 */
export type AgentRuntimeEvent = z.infer<typeof AgentRuntimeEventSchema>
