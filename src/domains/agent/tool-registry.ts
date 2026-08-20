import { z } from 'zod'

import type { MusicRiskAction } from '../security/agent-policy'

// ========= 类型 =========

/** 内置 Tool 名。 */
export type CoreAgentToolName =
  | 'smart_search_and_play'
  | 'control_player'
  | 'queue_manager'
  | 'playlist_manager'
  | 'library_manager'
  | 'music_explorer'
  | 'comments_and_social'
  | 'account_manager'
  | 'user_profile_memory'
  | 'request_user_selection'
  | 'find_music_api_capabilities'
  | 'call_music_api'

/** 模型可见工具定义。 */
export interface AgentProviderToolDefinition {
  /** 注册工具名。 */
  readonly name: CoreAgentToolName
  /** 简体中文工具说明。 */
  readonly description: string
  /** 最小 JSON Schema。 */
  readonly parameters: Readonly<Record<string, unknown>>
}

/** 归一化 Tool 操作。 */
export interface ClassifiedToolOperation {
  /** 本次操作副作用类型。 */
  readonly effect: 'read' | 'interaction' | 'write' | 'player'
  /** 音乐权限动作；纯读取和交互无需该字段。 */
  readonly riskAction?: MusicRiskAction
  /** 确定性冲突域。 */
  readonly conflictKeys: readonly string[]
  /** 用户可理解标题。 */
  readonly title: string
}

/** 内置工具注册项。 */
export interface AgentToolDefinition {
  /** 模型可见定义。 */
  readonly provider: AgentProviderToolDefinition
  /** Runtime 参数 Schema。 */
  readonly inputSchema: z.ZodType
  /** 按经 Schema 校验的 action 分类。 */
  readonly classify: (input: Record<string, unknown>) => ClassifiedToolOperation
}

// ========= Schema =========

/** 智能搜播输入。 */
const SmartSearchAndPlayInputSchema = z.strictObject({
  action: z.enum(['search', 'play']).default('play'),
  query: z.string().trim().min(1).max(120).optional(),
  entityRef: z.string().regex(/^song:\d{1,20}$/u).optional()
}).superRefine((input, context) => {
  if (!input.query && !input.entityRef) {
    context.addIssue({ code: 'custom', message: 'query 与 entityRef 必须提供一个。' })
  }
  if (input.query && input.entityRef) {
    context.addIssue({ code: 'custom', message: 'query 与 entityRef 不能同时提供。' })
  }
  if (input.action === 'search' && !input.query) {
    context.addIssue({ code: 'custom', path: ['query'], message: 'search 需要 query。' })
  }
})

/** 播放器控制输入。 */
const ControlPlayerInputSchema = z.strictObject({
  action: z.enum(['get_state', 'play', 'pause', 'next', 'previous', 'toggle', 'set_volume', 'set_mode']),
  volume: z.number().min(0).max(1).optional(),
  mode: z.enum(['loop', 'loop-one', 'shuffle']).optional()
}).superRefine((input, context) => {
  if (input.action === 'set_volume' && input.volume === undefined) {
    context.addIssue({ code: 'custom', path: ['volume'], message: 'set_volume 需要 volume。' })
  }
  if (input.action === 'set_mode' && input.mode === undefined) {
    context.addIssue({ code: 'custom', path: ['mode'], message: 'set_mode 需要 mode。' })
  }
})

/** 队列管理输入。 */
const QueueManagerInputSchema = z.strictObject({
  action: z.enum(['get', 'enqueue', 'play_next', 'remove', 'reorder', 'replace', 'clear']),
  entityRefs: z.array(z.string().regex(/^song:\d{1,20}$/u)).min(1).max(500).optional(),
  queueItemId: z.string().min(1).max(120).optional(),
  toIndex: z.number().int().nonnegative().optional()
}).superRefine((input, context) => {
  if (['enqueue', 'play_next', 'replace'].includes(input.action) && !input.entityRefs) {
    context.addIssue({ code: 'custom', path: ['entityRefs'], message: '当前队列动作需要 entityRefs。' })
  }
  if (['remove', 'reorder'].includes(input.action) && !input.queueItemId) {
    context.addIssue({ code: 'custom', path: ['queueItemId'], message: '当前队列动作需要 queueItemId。' })
  }
  if (input.action === 'reorder' && input.toIndex === undefined) {
    context.addIssue({ code: 'custom', path: ['toIndex'], message: 'reorder 需要 toIndex。' })
  }
})

/** 歌单管理输入。 */
const PlaylistManagerInputSchema = z.strictObject({
  action: z.enum(['get', 'create', 'rename', 'delete', 'add_tracks', 'remove_tracks', 'reorder_tracks']),
  playlistId: z.string().regex(/^\d{1,20}$/u).optional(),
  name: z.string().trim().min(1).max(40).optional(),
  trackIds: z.array(z.string().regex(/^\d{1,20}$/u)).min(1).max(500).optional()
}).superRefine((input, context) => {
  if (input.action !== 'create' && !input.playlistId) {
    context.addIssue({ code: 'custom', path: ['playlistId'], message: '当前歌单动作需要 playlistId。' })
  }
  if (['create', 'rename'].includes(input.action) && !input.name) {
    context.addIssue({ code: 'custom', path: ['name'], message: '当前歌单动作需要 name。' })
  }
  if (['add_tracks', 'remove_tracks', 'reorder_tracks'].includes(input.action) && !input.trackIds) {
    context.addIssue({ code: 'custom', path: ['trackIds'], message: '当前歌单动作需要 trackIds。' })
  }
})

/** 音乐库管理输入。 */
const LibraryManagerInputSchema = z.strictObject({
  action: z.enum(['like_track', 'subscribe_playlist', 'subscribe_album']),
  entityId: z.string().regex(/^\d{1,20}$/u),
  enabled: z.boolean()
})

/** 音乐探索输入。 */
const MusicExplorerInputSchema = z.strictObject({
  action: z.enum([
    'search',
    'get_song',
    'get_artist',
    'get_album',
    'get_playlist',
    'get_lyrics',
    'get_featured_playlists',
    'get_new_songs',
    'get_daily_songs',
    'get_artist_albums',
    'get_similar_artists'
  ]),
  query: z.string().trim().min(1).max(120).optional(),
  entityId: z.string().regex(/^\d{1,20}$/u).optional(),
  limit: z.number().int().min(1).max(30).optional()
}).superRefine((input, context) => {
  if (input.action === 'search' && !input.query) {
    context.addIssue({ code: 'custom', path: ['query'], message: 'search 需要 query。' })
  }
  if ([
    'get_song',
    'get_artist',
    'get_album',
    'get_playlist',
    'get_lyrics',
    'get_artist_albums',
    'get_similar_artists'
  ].includes(input.action) && !input.entityId) {
    context.addIssue({ code: 'custom', path: ['entityId'], message: '当前探索动作需要 entityId。' })
  }
})

/** 评论与社交输入。 */
const CommentsAndSocialInputSchema = z.strictObject({
  action: z.enum(['get_comments', 'add_comment', 'delete_comment', 'like_comment']),
  resourceType: z.enum(['song', 'album', 'playlist']),
  resourceId: z.string().regex(/^\d{1,20}$/u),
  commentId: z.string().regex(/^\d{1,20}$/u).optional(),
  content: z.string().trim().min(1).max(1_000).optional(),
  enabled: z.boolean().optional()
}).superRefine((input, context) => {
  if (input.action === 'add_comment' && !input.content) {
    context.addIssue({ code: 'custom', path: ['content'], message: 'add_comment 需要 content。' })
  }
  if (['delete_comment', 'like_comment'].includes(input.action) && !input.commentId) {
    context.addIssue({ code: 'custom', path: ['commentId'], message: '当前评论动作需要 commentId。' })
  }
  if (input.action === 'like_comment' && input.enabled === undefined) {
    context.addIssue({ code: 'custom', path: ['enabled'], message: 'like_comment 需要 enabled。' })
  }
})

/** 账户工具输入。 */
const AccountManagerInputSchema = z.strictObject({
  action: z.enum(['get_status', 'daily_signin'])
})

/** 画像与长期记忆只读输入。 */
const UserProfileMemoryInputSchema = z.strictObject({
  action: z.enum(['get_status', 'get_profile', 'search_memory']),
  query: z.string().trim().min(1).max(240).optional()
}).superRefine((input, context) => {
  if (input.action === 'search_memory' && !input.query) {
    context.addIssue({ code: 'custom', path: ['query'], message: 'search_memory 需要 query。' })
  }
})

/** SelectionCard 选项输入。 */
const SelectionOptionInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('entity'),
    optionKey: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/u),
    entityRef: z.string().regex(/^(song|artist|album|playlist):\d{1,20}$/u)
  }),
  z.strictObject({
    kind: z.literal('text'),
    optionKey: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/u),
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).optional()
  })
])

/** 用户选择输入。 */
const RequestUserSelectionInputSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(500),
  mode: z.enum(['single', 'multiple']),
  options: z.array(SelectionOptionInputSchema).min(2).max(5)
}).superRefine((value, context) => {
  /** 去重后的 optionKey 数。 */
  const uniqueKeys = new Set(value.options.map((option) => option.optionKey))
  if (uniqueKeys.size !== value.options.length) {
    context.addIssue({ code: 'custom', message: 'optionKey 不得重复。' })
  }
})

/** 能力目录检索输入。 */
const FindCapabilitiesInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(120)
})

/** 冷门能力调用输入。 */
const CallCapabilityInputSchema = z.strictObject({
  capabilityId: z.string().regex(/^music\.[a-z0-9._-]{2,80}$/u),
  params: z.record(z.string(), z.unknown())
})

// ========= 变量 =========

/** 10 个核心业务 Tool 与 2 个两步兜底 Tool。 */
const TOOL_DEFINITIONS: readonly AgentToolDefinition[] = [
  definition('smart_search_and_play', '优先播放歌曲：普通播放请求会从搜索结果中直接选择原唱或最高相关候选；用户已通过选择工具确定歌曲时，必须传 selectedRefs 中的 entityRef 直接播放，不得再次搜索。', SmartSearchAndPlayInputSchema, {
    type: 'object',
    properties: {
      action: { enum: ['search', 'play'], description: 'search 只查找，play 播放；默认优先使用 play。' },
      query: { type: 'string', description: '首次搜索的歌曲名、歌手或场景描述；与 entityRef 二选一。' },
      entityRef: { type: 'string', pattern: '^song:\\d{1,20}$', description: '选择工具返回的 selectedRefs 歌曲引用；使用它可直接播放且不得再次搜索。' }
    },
    additionalProperties: false
  }, (input) => input['action'] === 'search'
    ? readOperation('搜索音乐')
    : playerOperation('搜索并播放')),
  definition('control_player', '读取或控制当前播放器，包括播放、暂停、切歌、音量与模式。', ControlPlayerInputSchema, {
    type: 'object', properties: { action: { enum: ['get_state', 'play', 'pause', 'next', 'previous', 'toggle', 'set_volume', 'set_mode'] }, volume: { type: 'number' }, mode: { enum: ['loop', 'loop-one', 'shuffle'] } }, required: ['action'], additionalProperties: false
  }, (input) => input['action'] === 'get_state' ? readOperation('读取播放状态') : playerOperation('控制播放器')),
  definition('queue_manager', '查看、插入、下一首播放、移除、排序、替换或清空当前队列。歌曲只接受事实池 entityRef。', QueueManagerInputSchema, {
    type: 'object', properties: { action: { enum: ['get', 'enqueue', 'play_next', 'remove', 'reorder', 'replace', 'clear'] }, entityRefs: { type: 'array', items: { type: 'string' } }, queueItemId: { type: 'string' }, toIndex: { type: 'integer' } }, required: ['action'], additionalProperties: false
  }, (input) => input['action'] === 'get' ? readOperation('查看播放队列') : playerOperation('管理播放队列')),
  definition('playlist_manager', '查看、创建、重命名、删除歌单，或增删和排序歌单歌曲。', PlaylistManagerInputSchema, {
    type: 'object', properties: { action: { enum: ['get', 'create', 'rename', 'delete', 'add_tracks', 'remove_tracks', 'reorder_tracks'] }, playlistId: { type: 'string' }, name: { type: 'string' }, trackIds: { type: 'array', items: { type: 'string' } } }, required: ['action'], additionalProperties: false
  }, (input) => input['action'] === 'get'
    ? readOperation('查看歌单')
    : ({ effect: 'write', riskAction: input['action'] === 'delete' ? 'music.account_high_impact' : 'music.library_playlist', conflictKeys: [`playlist:${String(input['playlistId'] ?? 'new')}`], title: '管理歌单' })),
  definition('library_manager', '喜欢歌曲，或收藏歌单、专辑。', LibraryManagerInputSchema, {
    type: 'object', properties: { action: { enum: ['like_track', 'subscribe_playlist', 'subscribe_album'] }, entityId: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['action', 'entityId', 'enabled'], additionalProperties: false
  }, () => ({ effect: 'write', riskAction: 'music.library_playlist', conflictKeys: ['account:library'], title: '管理音乐收藏' })),
  definition('music_explorer', '搜索或查看歌曲、歌手、专辑、歌单、歌词、相似内容与推荐内容。', MusicExplorerInputSchema, {
    type: 'object', properties: { action: { enum: ['search', 'get_song', 'get_artist', 'get_album', 'get_playlist', 'get_lyrics', 'get_featured_playlists', 'get_new_songs', 'get_daily_songs', 'get_artist_albums', 'get_similar_artists'] }, query: { type: 'string' }, entityId: { type: 'string' }, limit: { type: 'integer' } }, required: ['action'], additionalProperties: false
  }, () => readOperation('探索音乐')),
  definition('comments_and_social', '查看、发布、删除或点赞歌曲、专辑和歌单评论。', CommentsAndSocialInputSchema, {
    type: 'object', properties: { action: { enum: ['get_comments', 'add_comment', 'delete_comment', 'like_comment'] }, resourceType: { enum: ['song', 'album', 'playlist'] }, resourceId: { type: 'string' }, commentId: { type: 'string' }, content: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['action', 'resourceType', 'resourceId'], additionalProperties: false
  }, (input) => input['action'] === 'get_comments' ? readOperation('查看评论') : ({ effect: 'write', riskAction: 'music.public_social', conflictKeys: ['account:comments'], title: '操作评论' })),
  definition('account_manager', '读取登录状态或执行每日签到；不包含支付购买。', AccountManagerInputSchema, {
    type: 'object', properties: { action: { enum: ['get_status', 'daily_signin'] } }, required: ['action'], additionalProperties: false
  }, (input) => input['action'] === 'get_status' ? readOperation('读取账户状态') : ({ effect: 'write', riskAction: 'music.library_playlist', conflictKeys: ['account:profile'], title: '每日签到' })),
  definition('user_profile_memory', '读取当前账户音乐画像、记忆状态，或使用 SQLite FTS5 搜索与当前目标相关的长期记忆。不得替用户自动生成、更新或删除画像。', UserProfileMemoryInputSchema, {
    type: 'object',
    properties: {
      action: { enum: ['get_status', 'get_profile', 'search_memory'] },
      query: { type: 'string', description: '仅 search_memory 使用的自然语言检索目标。' }
    },
    required: ['action'],
    additionalProperties: false
  }, (input) => readOperation(input['action'] === 'search_memory' ? '检索长期记忆' : '读取画像状态')),
  definition('request_user_selection', '只在候选存在实质歧义且无法合理采用最高相关项时展示 2 到 5 个无副作用选项。实体选项必须使用此前工具结果中的 ref；选完歌曲后把 selectedRefs 交给 smart_search_and_play.entityRef 直接播放。', RequestUserSelectionInputSchema, {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '向用户说明必须选择的实质差异。' },
      mode: { enum: ['single', 'multiple'], description: '歌曲点播通常使用 single。' },
      options: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: {
          oneOf: [
            {
              type: 'object',
              properties: {
                kind: { enum: ['entity'] },
                optionKey: { type: 'string', pattern: '^[A-Za-z0-9._-]{1,80}$' },
                entityRef: { type: 'string', pattern: '^(song|artist|album|playlist):\\d{1,20}$', description: '必须来自此前工具结果的 ref。' }
              },
              required: ['kind', 'optionKey', 'entityRef'],
              additionalProperties: false
            },
            {
              type: 'object',
              properties: {
                kind: { enum: ['text'] },
                optionKey: { type: 'string', pattern: '^[A-Za-z0-9._-]{1,80}$' },
                label: { type: 'string' },
                description: { type: 'string', description: '可选的补充说明。' }
              },
              required: ['kind', 'optionKey', 'label'],
              additionalProperties: false
            }
          ]
        }
      }
    },
    required: ['prompt', 'mode', 'options'],
    additionalProperties: false
  }, () => ({ effect: 'interaction', conflictKeys: ['agent:selection'], title: '等待用户选择' })),
  definition('find_music_api_capabilities', '按意图检索少量已注册的冷门音乐能力；不调用业务接口。', FindCapabilitiesInputSchema, {
    type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false
  }, () => readOperation('检索音乐能力')),
  definition('call_music_api', '调用此前发现的已注册音乐能力 ID；不接受原始 API 路径。', CallCapabilityInputSchema, {
    type: 'object', properties: { capabilityId: { type: 'string' }, params: { type: 'object' } }, required: ['capabilityId', 'params'], additionalProperties: false
  }, (input) => input['capabilityId'] === 'music.daily-signin'
    ? {
        effect: 'write',
        riskAction: 'music.library_playlist',
        conflictKeys: ['account:profile'],
        title: '调用每日签到能力'
      }
    : readOperation('调用音乐能力'))
]

// ========= 类 =========

/** 正向 Tool Registry；未知名称和未注册动作不会进入 Policy 或 Executor。 */
export class AgentToolRegistry {
  /** 按工具名索引的冻结定义。 */
  private readonly definitions = new Map<CoreAgentToolName, AgentToolDefinition>(
    TOOL_DEFINITIONS.map((item) => [item.provider.name, item])
  )

  /** 返回模型当前可见的固定核心工具与两步兜底。 */
  providerDefinitions(): AgentProviderToolDefinition[] {
    return [...this.definitions.values()].map((item) => item.provider)
  }

  /** 判断工具名是否已经注册，用于区分未知能力与已知工具参数错误。 */
  has(name: string): boolean {
    return this.definitions.has(name as CoreAgentToolName)
  }

  /** 解析并分类 Tool Call；未知名称或参数错误返回 undefined。 */
  resolve(name: string, rawInput: unknown): {
    readonly definition: AgentToolDefinition
    readonly input: Record<string, unknown>
    readonly operation: ClassifiedToolOperation
  } | undefined {
    /** 注册定义。 */
    const definition = this.definitions.get(name as CoreAgentToolName)
    if (!definition) return undefined
    /** Schema 解析结果。 */
    const parsed = definition.inputSchema.safeParse(rawInput)
    if (!parsed.success || typeof parsed.data !== 'object' || parsed.data === null) return undefined
    /** 类型安全的普通输入对象。 */
    const input = parsed.data as Record<string, unknown>
    return { definition, input, operation: definition.classify(input) }
  }
}

// ========= 函数 =========

/** 构造一个注册工具定义。 */
function definition(
  name: CoreAgentToolName,
  description: string,
  inputSchema: z.ZodType,
  parameters: Readonly<Record<string, unknown>>,
  classify: (input: Record<string, unknown>) => ClassifiedToolOperation
): AgentToolDefinition {
  return { provider: { name, description, parameters }, inputSchema, classify }
}

/** 构造无副作用只读操作。 */
function readOperation(title: string): ClassifiedToolOperation {
  return { effect: 'read', conflictKeys: [], title }
}

/** 构造播放器与队列写操作。 */
function playerOperation(title: string): ClassifiedToolOperation {
  return {
    effect: 'player',
    riskAction: 'music.playback_queue',
    conflictKeys: ['player:queue'],
    title
  }
}
