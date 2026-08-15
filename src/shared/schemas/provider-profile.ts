import { z } from 'zod'

// ========= 变量 =========

/** 首版支持的模型协议。 */
export const ProviderProtocolSchema = z.enum([
  'openai-compatible',
  'anthropic-messages',
  'gemini-generate-content'
])

/** Provider 实测能力快照。 */
export const ProviderCapabilitySnapshotSchema = z.strictObject({
  text: z.boolean(),
  streaming: z.boolean(),
  toolCalls: z.boolean(),
  modelListing: z.boolean(),
  latencyMs: z.number().int().nonnegative().optional()
})

/** Renderer 可见且不包含秘密的 Provider Profile。 */
export const PublicProviderProfileSchema = z.strictObject({
  profileId: z.uuid(),
  displayName: z.string().trim().min(1).max(80),
  protocol: ProviderProtocolSchema,
  baseUrl: z.url().max(2_048),
  modelId: z.string().trim().min(1).max(200),
  icon: z.string().trim().max(500).optional(),
  headerNames: z.array(z.string().min(1).max(80)).max(16),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  hasCredential: z.boolean(),
  capabilitySnapshot: ProviderCapabilitySnapshotSchema.optional(),
  lastVerifiedAt: z.number().int().positive().optional()
})

/** 新增或编辑 Profile 时允许 Renderer 提交的值；秘密只发送到 Main。 */
export const ProviderProfileInputSchema = z.strictObject({
  profileId: z.uuid().optional(),
  displayName: z.string().trim().min(1).max(80),
  protocol: ProviderProtocolSchema,
  baseUrl: z.url().max(2_048),
  modelId: z.string().trim().min(1).max(200),
  icon: z.string().trim().max(500).optional(),
  apiKey: z.string().max(8_192).optional(),
  customHeaders: z.record(
    z.string().regex(/^[A-Za-z0-9-]{1,80}$/u),
    z.string().max(8_192)
  ).refine((headers) => Object.keys(headers).length <= 16, '自定义 Header 最多 16 项'),
  enabled: z.boolean()
})

/** OpenRouter 目录中供设置页选择的模型摘要。 */
export const ProviderCatalogModelSchema = z.strictObject({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  created: z.number().int().nonnegative()
})

/** 从 OpenRouter 模型条目归并出的供应商。 */
export const ProviderCatalogVendorSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  priorityRank: z.number().int().nonnegative().optional(),
  models: z.array(ProviderCatalogModelSchema).min(1)
})

/** Renderer 可见的 OpenRouter 供应商与模型目录。 */
export const ProviderModelCatalogSchema = z.strictObject({
  source: z.literal('openrouter'),
  baseUrl: z.literal('https://openrouter.ai/api/v1'),
  modelCount: z.number().int().nonnegative(),
  fetchedAt: z.number().int().positive(),
  vendors: z.array(ProviderCatalogVendorSchema)
})

/** Provider Profile 管理请求。 */
export const ProviderProfileRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('list') }),
  z.strictObject({ operation: z.literal('catalog') }),
  z.strictObject({ operation: z.literal('save'), profile: ProviderProfileInputSchema }),
  z.strictObject({ operation: z.literal('delete'), profileId: z.uuid() }),
  z.strictObject({ operation: z.literal('setDefault'), profileId: z.uuid() }),
  z.strictObject({ operation: z.literal('verify'), profileId: z.uuid() })
])

/** Provider Profile 管理结果。 */
export const ProviderProfileResultSchema = z.strictObject({
  profiles: z.array(PublicProviderProfileSchema),
  activeProfileId: z.uuid().optional(),
  verificationMessage: z.string().max(240).optional(),
  catalog: ProviderModelCatalogSchema.optional()
})

/** Main 私有注入 Utility 的可执行 Profile；不得转发 Renderer。 */
export const ProviderRuntimeProfileSchema = z.strictObject({
  profileId: z.uuid(),
  protocol: ProviderProtocolSchema,
  model: z.string().min(1).max(200),
  baseUrl: z.url().max(2_048),
  headers: z.record(z.string(), z.string()).optional(),
  credentialFingerprint: z.string().min(1).max(128).optional(),
  capabilitySnapshot: ProviderCapabilitySnapshotSchema.optional()
})

/** Main → Utility 的 Provider 配置控制命令。 */
export const ProviderRuntimeControlSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('agent.provider.configure'),
    profile: ProviderRuntimeProfileSchema
  }),
  z.strictObject({ kind: z.literal('agent.provider.clear') })
])

/** 内置最小 Provider 预设；不包含凭据和能力猜测。 */
export const PROVIDER_PRESETS = [
  { label: 'OpenAI Compatible', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
  { label: 'Anthropic', protocol: 'anthropic-messages', baseUrl: 'https://api.anthropic.com/v1' },
  { label: 'Google Gemini', protocol: 'gemini-generate-content', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { label: 'DeepSeek', protocol: 'openai-compatible', baseUrl: 'https://api.deepseek.com' }
] as const

// ========= 类型 =========

/** 首版 Provider 协议类型。 */
export type ProviderProtocol = z.infer<typeof ProviderProtocolSchema>

/** Provider 实测能力快照类型。 */
export type ProviderCapabilitySnapshot = z.infer<typeof ProviderCapabilitySnapshotSchema>

/** Renderer 可见 Profile 类型。 */
export type PublicProviderProfile = z.infer<typeof PublicProviderProfileSchema>

/** Profile 编辑输入类型。 */
export type ProviderProfileInput = z.infer<typeof ProviderProfileInputSchema>

/** OpenRouter 目录模型摘要类型。 */
export type ProviderCatalogModel = z.infer<typeof ProviderCatalogModelSchema>

/** OpenRouter 目录供应商类型。 */
export type ProviderCatalogVendor = z.infer<typeof ProviderCatalogVendorSchema>

/** OpenRouter 模型目录类型。 */
export type ProviderModelCatalog = z.infer<typeof ProviderModelCatalogSchema>

/** Profile 管理请求类型。 */
export type ProviderProfileRequest = z.infer<typeof ProviderProfileRequestSchema>

/** Profile 管理结果类型。 */
export type ProviderProfileResult = z.infer<typeof ProviderProfileResultSchema>

/** Utility 内存中的可执行 Profile 类型。 */
export type ProviderRuntimeProfile = z.infer<typeof ProviderRuntimeProfileSchema>
