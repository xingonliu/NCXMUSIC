import { z } from 'zod'

// ========= 变量 =========

/** 音乐人格画像持久化结构版本。 */
export const MUSIC_PROFILE_SCHEMA_VERSION = 1 as const

/** Working Memory 持久化结构版本。 */
export const WORKING_MEMORY_SCHEMA_VERSION = 1 as const

/** Phase 6 冻结的音乐画像生命周期状态。 */
export const MusicProfileStatusSchema = z.enum([
  'unavailable',
  'collecting',
  'ready_local',
  'analyzing',
  'ready',
  'stale',
  'paused',
  'failed'
])

/** 画像结论分类；所有分类都必须能由音乐证据支持。 */
export const MusicProfileInsightCategorySchema = z.enum([
  'artist',
  'genre',
  'language',
  'era',
  'mood',
  'scene',
  'exploration'
])

/** 单条画像结论。 */
export const MusicProfileInsightSchema = z.strictObject({
  insightId: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/u),
  category: MusicProfileInsightCategorySchema,
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(300),
  evidence: z.array(z.string().trim().min(1).max(240)).max(12),
  coverage: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1)
})

/** 用户显式画像修正；其优先级高于模型结论。 */
export const MusicProfileOverrideSchema = z.strictObject({
  overrideId: z.uuid(),
  insightId: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/u).optional(),
  kind: z.enum(['correction', 'hidden', 'supplement']),
  value: z.string().trim().min(1).max(500).optional(),
  updatedAt: z.number().int().nonnegative()
}).superRefine((override, context) => {
  if (override.kind === 'hidden' && !override.insightId) {
    context.addIssue({ code: 'custom', path: ['insightId'], message: '隐藏结论需要 insightId。' })
  }
  if (override.kind !== 'hidden' && !override.value) {
    context.addIssue({ code: 'custom', path: ['value'], message: '纠正或补充需要文本值。' })
  }
})

/** 画像分析的数据覆盖范围。 */
export const MusicProfileCoverageSchema = z.strictObject({
  likedSongs: z.number().int().nonnegative(),
  createdPlaylists: z.number().int().nonnegative(),
  createdPlaylistSongs: z.number().int().nonnegative(),
  subscribedPlaylists: z.number().int().nonnegative(),
  listeningHistorySongs: z.number().int().nonnegative(),
  uniqueSongs: z.number().int().nonnegative()
})

/** 只由网易云标准用户实体明确字段生成的账户基础资料。 */
export const MusicBasicProfileSchema = z.strictObject({
  nickname: z.string().trim().min(1).max(160),
  gender: z.number().int().min(0).max(2).nullable(),
  birthday: z.number().int().nonnegative().nullable(),
  sourceApi: z.string().trim().min(1).max(120),
  updatedAt: z.number().int().nonnegative()
})

/** 上次成功画像对应的精确去重集合基线。 */
export const MusicProfileBaselineSchema = z.strictObject({
  likedSongIds: z.array(z.string().regex(/^\d{1,20}$/u)).max(100_000),
  createdPlaylistSongIds: z.array(z.string().regex(/^\d{1,20}$/u)).max(100_000),
  capturedAt: z.number().int().nonnegative()
})

/** 画像模型必须返回的结构化结果。 */
export const MusicProfileAnalysisSchema = z.strictObject({
  summary: z.string().trim().min(1).max(2_000),
  agentPrompt: z.string().trim().min(1).max(3_000),
  insights: z.array(MusicProfileInsightSchema).min(1).max(16),
  recentChanges: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  recommendationSeeds: z.array(z.string().trim().min(1).max(120)).max(12).default([])
})

/** 已成功生成并可继续使用的画像内容。 */
export const MusicProfileDocumentSchema = MusicProfileAnalysisSchema.extend({
  schemaVersion: z.literal(MUSIC_PROFILE_SCHEMA_VERSION),
  version: z.number().int().positive(),
  generatedAt: z.number().int().nonnegative(),
  coverage: MusicProfileCoverageSchema
})

/** 画像提示状态。 */
export const MusicProfilePromptSchema = z.strictObject({
  kind: z.enum(['none', 'initialize', 'update']),
  visible: z.boolean(),
  changeScore: z.number().nonnegative(),
  dismissedUntil: z.number().int().nonnegative().optional()
})

/** Renderer 与 Agent 可见的脱敏个性化快照。 */
export const MusicPersonalizationSnapshotSchema = z.strictObject({
  status: MusicProfileStatusSchema,
  eligible: z.boolean(),
  usable: z.boolean(),
  paused: z.boolean(),
  version: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().optional(),
  progress: z.number().int().min(0).max(100),
  stageLabel: z.string().max(120),
  summary: z.string().max(2_000).optional(),
  agentPrompt: z.string().max(3_000).optional(),
  coverage: MusicProfileCoverageSchema.optional(),
  insights: z.array(MusicProfileInsightSchema).max(16),
  recentChanges: z.array(z.string().max(240)).max(8),
  recommendationSeeds: z.array(z.string().max(120)).max(12),
  overrides: z.array(MusicProfileOverrideSchema).max(100),
  prompt: MusicProfilePromptSchema,
  errorMessage: z.string().max(500).optional()
})

/** 空的个性化快照，供游客、启动阶段和旧快照兼容使用。 */
export const EMPTY_MUSIC_PERSONALIZATION_SNAPSHOT = MusicPersonalizationSnapshotSchema.parse({
  status: 'unavailable',
  eligible: false,
  usable: false,
  paused: false,
  version: 0,
  progress: 0,
  stageLabel: '',
  insights: [],
  recentChanges: [],
  recommendationSeeds: [],
  overrides: [],
  prompt: { kind: 'none', visible: false, changeScore: 0 }
})

/** 长期记忆搜索命中。 */
export const MemorySearchHitSchema = z.strictObject({
  blockId: z.number().int().positive(),
  summary: z.string().max(2_000),
  excerpt: z.string().max(800),
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative(),
  importance: z.number().min(0).max(1)
})

/** 当前账户 Working Memory 权威快照。 */
export const WorkingMemorySnapshotSchema = z.strictObject({
  schemaVersion: z.literal(WORKING_MEMORY_SCHEMA_VERSION),
  currentGoal: z.string().max(2_000),
  selectedMemories: z.array(MemorySearchHitSchema).max(8),
  updatedAt: z.number().int().nonnegative()
})

/** 长期记忆公开状态。 */
export const MemoryStatusSchema = z.strictObject({
  conversationBlocks: z.number().int().nonnegative(),
  indexedBlocks: z.number().int().nonnegative(),
  selectedMemories: z.number().int().nonnegative(),
  workingMemoryUpdatedAt: z.number().int().nonnegative().optional()
})

/** 画像更新提示评估入参。 */
export const ProfilePromptEvaluationInputSchema = z.strictObject({
  changeScore: z.number().nonnegative(),
  now: z.number().int().nonnegative(),
  dismissedAt: z.number().int().nonnegative().optional(),
  dismissedScore: z.number().nonnegative().optional()
})

// ========= 类型 =========

/** 音乐画像生命周期状态类型。 */
export type MusicProfileStatus = z.infer<typeof MusicProfileStatusSchema>

/** 单条音乐画像结论类型。 */
export type MusicProfileInsight = z.infer<typeof MusicProfileInsightSchema>

/** 用户画像显式修正类型。 */
export type MusicProfileOverride = z.infer<typeof MusicProfileOverrideSchema>

/** 音乐画像覆盖范围类型。 */
export type MusicProfileCoverage = z.infer<typeof MusicProfileCoverageSchema>

/** API 明确返回的账户基础资料类型。 */
export type MusicBasicProfile = z.infer<typeof MusicBasicProfileSchema>

/** 音乐画像精确变化基线类型。 */
export type MusicProfileBaseline = z.infer<typeof MusicProfileBaselineSchema>

/** 模型生成的音乐画像分析类型。 */
export type MusicProfileAnalysis = z.infer<typeof MusicProfileAnalysisSchema>

/** 可使用的音乐画像文档类型。 */
export type MusicProfileDocument = z.infer<typeof MusicProfileDocumentSchema>

/** Renderer 可见的音乐个性化快照类型。 */
export type MusicPersonalizationSnapshot = z.infer<typeof MusicPersonalizationSnapshotSchema>

/** 长期记忆搜索命中类型。 */
export type MemorySearchHit = z.infer<typeof MemorySearchHitSchema>

/** Working Memory 快照类型。 */
export type WorkingMemorySnapshot = z.infer<typeof WorkingMemorySnapshotSchema>

/** 长期记忆公开状态类型。 */
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>

/** 画像提示规则评估入参类型。 */
export type ProfilePromptEvaluationInput = z.infer<typeof ProfilePromptEvaluationInputSchema>
