import { z } from 'zod'

// ========= 变量 =========

/** Dynamic Skill 稳定 slug。 */
export const SkillNameSchema = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/u)

/** Skill 工具名；Host 内工具会加 `skill.<name>.` 命名空间。 */
export const SkillToolNameSchema = z.string().regex(/^[a-z][a-z0-9_-]{1,62}$/u)

/** MCP Server 稳定 ID。 */
export const McpServerIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/u)

/** MCP Tool 原始名称。 */
export const McpToolNameSchema = z.string().trim().min(1).max(128)

/** 不可信扩展输入 Schema 的有限 JSON 对象。 */
export const ExtensionJsonSchema = z.record(z.string(), z.unknown())

/** Skill 来源类型。 */
export const SkillSourceTypeSchema = z.enum(['appdata', 'folder', 'zip', 'git'])

/** Skill 生命周期状态。 */
export const SkillStateSchema = z.enum(['disabled', 'enabled', 'error', 'trashed'])

/** MCP 市场描述展示上限，避免远程长文案拖垮设置页响应。 */
const MCP_MARKET_DESCRIPTION_LIMIT = 2_000

/** Skill manifest 中声明的单个工具。 */
export const SkillToolManifestSchema = z.strictObject({
  name: SkillToolNameSchema,
  description: z.string().trim().min(1).max(500),
  inputSchema: ExtensionJsonSchema.optional()
})

/** Renderer 可见且不含可执行路径的 Skill 快照。 */
export const SkillSnapshotSchema = z.strictObject({
  name: SkillNameSchema,
  version: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  sourceType: SkillSourceTypeSchema,
  sourceLabel: z.string().trim().min(1).max(500),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  gitCommit: z.string().regex(/^[a-f0-9]{7,64}$/u).optional(),
  state: SkillStateSchema,
  hasJavaScript: z.boolean(),
  tools: z.array(SkillToolManifestSchema).max(32),
  installedAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  previousVersionAvailable: z.boolean(),
  trashExpiresAt: z.number().int().positive().optional(),
  error: z.string().max(500).optional()
})

/** Utility/SkillHost 可消费的已验证 Skill 描述。 */
export const SkillRuntimeDescriptorSchema = z.strictObject({
  name: SkillNameSchema,
  version: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  rootPath: z.string().trim().min(1).max(2_048),
  entryPath: z.string().trim().min(1).max(2_048).optional(),
  prompt: z.string().max(100_000),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  enabled: z.boolean(),
  tools: z.array(SkillToolManifestSchema).max(32)
})

/** MCP 首版唯一支持的传输。 */
export const McpTransportSchema = z.enum(['stdio', 'streamable_http'])

/** MCP 实际工具的最小可信快照。 */
export const McpToolSnapshotSchema = z.strictObject({
  name: McpToolNameSchema,
  description: z.string().max(1_000).optional(),
  inputSchema: ExtensionJsonSchema,
  annotations: ExtensionJsonSchema.optional()
})

/** Renderer 编辑 MCP Server 时使用的无秘密配置。 */
export const McpServerEditableSchema = z.strictObject({
  serverId: McpServerIdSchema,
  displayName: z.string().trim().min(1).max(120),
  transport: McpTransportSchema,
  command: z.string().trim().min(1).max(1_024).optional(),
  args: z.array(z.string().max(2_048)).max(64).default([]),
  cwd: z.string().trim().min(1).max(2_048).optional(),
  url: z.url().max(2_048).optional(),
  environmentNames: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u)).max(32).default([]),
  headerNames: z.array(z.string().regex(/^[A-Za-z0-9-]{1,128}$/u)).max(32).default([]),
  enabled: z.boolean().default(false)
}).superRefine((value, context) => {
  if (value.transport === 'stdio' && !value.command) {
    context.addIssue({ code: 'custom', path: ['command'], message: 'stdio Server 需要 command。' })
  }
  if (value.transport === 'streamable_http' && !value.url) {
    context.addIssue({ code: 'custom', path: ['url'], message: 'Streamable HTTP Server 需要 URL。' })
  }
  if (value.url && !/^https?:\/\//iu.test(value.url)) {
    context.addIssue({ code: 'custom', path: ['url'], message: 'MCP URL 只允许 HTTP 或 HTTPS。' })
  }
})

/** Renderer 可见的 MCP Server 状态。 */
export const McpServerSnapshotSchema = McpServerEditableSchema.extend({
  configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  approvalState: z.enum(['approved', 'reapproval_required']),
  connectionState: z.enum(['disconnected', 'connecting', 'ready', 'failed_disabled']),
  restartCount: z.number().int().min(0).max(3),
  lastKnownCapabilities: ExtensionJsonSchema.default({}),
  lastKnownTools: z.array(McpToolSnapshotSchema).max(256),
  previousConfigAvailable: z.boolean(),
  lastError: z.string().max(500).optional(),
  updatedAt: z.number().int().nonnegative()
})

/** Main → Utility 的 MCP 私有运行配置；秘密不能进入 Renderer。 */
export const McpRuntimeConfigSchema = McpServerEditableSchema.extend({
  configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  approvedFingerprint: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  environment: z.record(z.string(), z.string().max(16_384)).default({}),
  headers: z.record(z.string(), z.string().max(16_384)).default({}),
  lastKnownCapabilities: ExtensionJsonSchema.default({}),
  lastKnownTools: z.array(McpToolSnapshotSchema).max(256)
})

/** Smithery 市场公开 MCP Server 条目。 */
export const McpMarketServerSchema = z.object({
  id: z.string().trim().min(1).max(200),
  qualifiedName: z.string().trim().min(1).max(200),
  namespace: z.string().trim().max(200).nullish().transform((value) => value ?? ''),
  displayName: z.string().trim().min(1).max(200),
  description: z.string().transform(normalizeMcpMarketDescription).nullish().transform((value) => value ?? ''),
  iconUrl: z.string().trim().max(2_048).nullish().transform((value) => value ?? undefined),
  verified: z.boolean().default(false),
  useCount: z.number().int().nonnegative().default(0),
  remote: z.boolean().default(false),
  isDeployed: z.boolean().default(false),
  unlisted: z.boolean().default(false),
  inactive: z.boolean().default(false),
  createdAt: z.string().trim().max(80).nullish().transform((value) => value ?? undefined),
  homepage: z.string().trim().max(2_048).nullish().transform((value) => value ?? undefined)
})

/** Smithery 市场公开分页信息。 */
export const McpMarketPaginationSchema = z.object({
  currentPage: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
  totalPages: z.number().int().nonnegative().default(1),
  totalCount: z.number().int().nonnegative().default(0)
})

/** Smithery 市场搜索响应。 */
export const McpMarketSearchResultSchema = z.object({
  servers: z.array(McpMarketServerSchema).default([]),
  pagination: McpMarketPaginationSchema
})

/** Smithery 市场单个连接配置描述。 */
export const McpMarketConnectionSchema = z.object({
  type: z.string().trim().min(1).max(50),
  deploymentUrl: z.string().trim().max(2_048).nullish().transform((value) => value ?? undefined),
  configSchema: ExtensionJsonSchema.nullish().transform((value) => value ?? undefined)
})

/** Smithery 市场 MCP Server 详情（包含连接端点与配置 Schema）。 */
export const McpMarketServerDetailSchema = z.object({
  qualifiedName: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200),
  description: z.string().transform(normalizeMcpMarketDescription).nullish().transform((value) => value ?? ''),
  iconUrl: z.string().trim().max(2_048).nullish().transform((value) => value ?? undefined),
  remote: z.boolean().default(false),
  deploymentUrl: z.string().trim().max(2_048).nullish().transform((value) => value ?? undefined),
  connections: z.array(McpMarketConnectionSchema).default([])
})

/** 扩展设置页完整公开快照。 */
export const ExtensionSettingsSnapshotSchema = z.strictObject({
  skills: z.array(SkillSnapshotSchema),
  mcpServers: z.array(McpServerSnapshotSchema),
  updatedAt: z.number().int().nonnegative()
})

/** Renderer 主动管理 Skill/MCP 的请求。 */
export const ExtensionSettingsRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('snapshot') }),
  z.strictObject({ operation: z.literal('skill.discover') }),
  z.strictObject({
    operation: z.literal('skill.chooseImport'),
    sourceType: z.enum(['folder', 'zip']).default('folder')
  }),
  z.strictObject({ operation: z.literal('skill.installGit'), url: z.url().max(2_048) }),
  z.strictObject({
    operation: z.enum(['skill.enable', 'skill.disable', 'skill.update', 'skill.rollback', 'skill.uninstall']),
    name: SkillNameSchema
  }),
  z.strictObject({
    operation: z.literal('mcp.upsert'),
    config: McpServerEditableSchema,
    environment: z.record(z.string(), z.string().max(16_384)).default({}),
    headers: z.record(z.string(), z.string().max(16_384)).default({})
  }),
  z.strictObject({
    operation: z.enum(['mcp.enable', 'mcp.disable', 'mcp.test', 'mcp.rollback', 'mcp.delete']),
    serverId: McpServerIdSchema
  }),
  z.strictObject({
    operation: z.literal('mcp.import'),
    document: z.string().min(1).max(1_000_000),
    confirm: z.boolean().default(false),
    previewToken: z.uuid().optional()
  }),
  z.strictObject({
    operation: z.literal('mcp.market.search'),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    q: z.string().trim().min(1).max(200).optional(),
    topK: z.number().int().min(10).max(500).optional()
  }),
  z.strictObject({
    operation: z.literal('mcp.market.resolve'),
    qualifiedName: z.string().trim().min(1).max(200)
  }),
  z.strictObject({ operation: z.literal('mcp.export') })
])

/** 扩展设置请求结果。 */
export const ExtensionSettingsResultSchema = z.strictObject({
  snapshot: ExtensionSettingsSnapshotSchema,
  message: z.string().max(500).optional(),
  exportDocument: z.string().max(1_000_000).optional(),
  importPreview: z.array(McpServerEditableSchema).max(128).optional(),
  importToken: z.uuid().optional(),
  mcpMarket: McpMarketSearchResultSchema.optional(),
  marketDetail: McpMarketServerDetailSchema.optional()
})

/** Main → Utility：同步当前已验证扩展运行配置。 */
export const ExtensionRuntimeSyncSchema = z.strictObject({
  kind: z.literal('extension.runtime.sync'),
  revision: z.number().int().nonnegative(),
  skills: z.array(SkillRuntimeDescriptorSchema),
  mcpServers: z.array(McpRuntimeConfigSchema)
})

/** Main → Utility：请求一次 MCP initialize/tools list 测试。 */
export const ExtensionProbeRequestSchema = z.strictObject({
  kind: z.literal('extension.probe.request'),
  requestId: z.uuid(),
  serverId: McpServerIdSchema
})

/** Utility → Main：MCP 测试结果与实际能力。 */
export const ExtensionProbeResultSchema = z.strictObject({
  kind: z.literal('extension.probe.result'),
  requestId: z.uuid(),
  serverId: McpServerIdSchema,
  ok: z.boolean(),
  capabilities: ExtensionJsonSchema.default({}),
  tools: z.array(McpToolSnapshotSchema).max(256).default([]),
  message: z.string().max(500)
})

/** Utility → Main：MCP 连接状态变化，供设置页展示而不暴露秘密。 */
export const ExtensionRuntimeStatusEventSchema = z.strictObject({
  kind: z.literal('extension.runtime.status'),
  serverId: McpServerIdSchema,
  connectionState: z.enum(['disconnected', 'connecting', 'ready', 'failed_disabled']),
  restartCount: z.number().int().min(0).max(3),
  lastError: z.string().max(500).optional()
})

/** Utility → Main：调用前发现 MCP 实际工具范围变化。 */
export const ExtensionToolScopeChangedEventSchema = z.strictObject({
  kind: z.literal('extension.tool-scope.changed'),
  serverId: McpServerIdSchema,
  capabilities: ExtensionJsonSchema.default({}),
  tools: z.array(McpToolSnapshotSchema).max(256),
  message: z.string().max(500)
})

/** Agent 发起扩展生命周期变更时 Utility → Main 的请求。 */
export const ExtensionLifecycleRequestSchema = z.strictObject({
  kind: z.literal('extension.lifecycle.request'),
  requestId: z.uuid(),
  resource: z.enum(['skill', 'mcp']),
  action: z.enum(['install', 'enable', 'disable', 'update', 'rollback', 'uninstall', 'delete']),
  payload: z.record(z.string(), z.unknown())
})

/** Main → Utility：Agent 扩展生命周期请求终态。 */
export const ExtensionLifecycleResultSchema = z.strictObject({
  kind: z.literal('extension.lifecycle.result'),
  requestId: z.uuid(),
  ok: z.boolean(),
  code: z.string().max(80),
  message: z.string().max(500)
})

/** Utility → SkillHost：启动后只下发一次的已验证配置。 */
export const SkillHostConfigureSchema = z.strictObject({
  kind: z.literal('skill-host.configure'),
  descriptor: SkillRuntimeDescriptorSchema
})

/** SkillHost → Utility：模块载入终态。 */
export const SkillHostReadySchema = z.strictObject({
  kind: z.literal('skill-host.ready'),
  skillName: SkillNameSchema,
  ok: z.boolean(),
  message: z.string().max(500)
})

/** Utility → SkillHost：单次已审批工具调用。 */
export const SkillHostCallSchema = z.strictObject({
  kind: z.literal('skill-host.call'),
  requestId: z.uuid(),
  toolName: SkillToolNameSchema,
  arguments: ExtensionJsonSchema
})

/** Utility → SkillHost：取消单次调用。 */
export const SkillHostCancelSchema = z.strictObject({
  kind: z.literal('skill-host.cancel'),
  requestId: z.uuid()
})

/** SkillHost → Utility：单次调用终态。 */
export const SkillHostResultSchema = z.strictObject({
  kind: z.literal('skill-host.result'),
  requestId: z.uuid(),
  ok: z.boolean(),
  code: z.string().max(80),
  message: z.string().max(500),
  data: z.unknown().optional()
})

// ========= 函数 =========

/** 将 Smithery 市场长描述裁剪到 UI 展示上限。 */
function normalizeMcpMarketDescription(value: string): string {
  return value.trim().slice(0, MCP_MARKET_DESCRIPTION_LIMIT)
}

// ========= 类型 =========

/** Skill 工具声明类型。 */
export type SkillToolManifest = z.infer<typeof SkillToolManifestSchema>

/** 公开 Skill 快照类型。 */
export type SkillSnapshot = z.infer<typeof SkillSnapshotSchema>

/** Utility 可消费的 Skill 描述。 */
export type SkillRuntimeDescriptor = z.infer<typeof SkillRuntimeDescriptorSchema>

/** MCP 可编辑公开配置类型。 */
export type McpServerEditable = z.infer<typeof McpServerEditableSchema>

/** MCP 公开快照类型。 */
export type McpServerSnapshot = z.infer<typeof McpServerSnapshotSchema>

/** MCP 私有运行配置类型。 */
export type McpRuntimeConfig = z.infer<typeof McpRuntimeConfigSchema>

/** MCP 工具快照类型。 */
export type McpToolSnapshot = z.infer<typeof McpToolSnapshotSchema>

/** MCP 市场公开条目类型。 */
export type McpMarketServer = z.infer<typeof McpMarketServerSchema>

/** MCP 市场单个连接类型。 */
export type McpMarketConnection = z.infer<typeof McpMarketConnectionSchema>

/** MCP 市场条目详情类型。 */
export type McpMarketServerDetail = z.infer<typeof McpMarketServerDetailSchema>

/** MCP 市场搜索结果类型。 */
export type McpMarketSearchResult = z.infer<typeof McpMarketSearchResultSchema>

/** 扩展公开设置快照类型。 */
export type ExtensionSettingsSnapshot = z.infer<typeof ExtensionSettingsSnapshotSchema>

/** 扩展设置请求类型。 */
export type ExtensionSettingsRequest = z.infer<typeof ExtensionSettingsRequestSchema>

/** 扩展设置结果类型。 */
export type ExtensionSettingsResult = z.infer<typeof ExtensionSettingsResultSchema>

/** Main → Utility 扩展同步类型。 */
export type ExtensionRuntimeSync = z.infer<typeof ExtensionRuntimeSyncSchema>

/** Utility 报告的 MCP 连接状态。 */
export type ExtensionRuntimeStatusEvent = z.infer<typeof ExtensionRuntimeStatusEventSchema>

/** Agent 扩展生命周期请求类型。 */
export type ExtensionLifecycleRequest = z.infer<typeof ExtensionLifecycleRequestSchema>

/** Utility 下发的 SkillHost 调用。 */
export type SkillHostCall = z.infer<typeof SkillHostCallSchema>

/** SkillHost 返回的工具结果。 */
export type SkillHostResult = z.infer<typeof SkillHostResultSchema>
