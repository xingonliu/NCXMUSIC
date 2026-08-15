import { z } from 'zod'

import { CommandSafetyLevelSchema, MusicSafetyLevelSchema } from './agent'

// ========= 变量 =========

/** Agent 安全设置持久偏好 Schema。 */
export const AgentSafetyPreferencesSchema = z.strictObject({
  musicSafetyLevel: MusicSafetyLevelSchema,
  commandSafetyLevel: CommandSafetyLevelSchema,
  shellToolEnabled: z.boolean()
})

/** Renderer 管理 Agent 安全设置的请求 Schema。 */
export const AgentSafetySettingsRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('snapshot') }),
  z.strictObject({
    operation: z.literal('setSafety'),
    musicSafetyLevel: MusicSafetyLevelSchema.optional(),
    commandSafetyLevel: CommandSafetyLevelSchema.optional(),
    shellToolEnabled: z.boolean().optional()
  })
])

/** Main 返回给 Renderer 的 Agent 安全设置结果 Schema。 */
export const AgentSafetySettingsResultSchema = z.strictObject({
  preferences: AgentSafetyPreferencesSchema
})

/** Main 同步给 Utility 的 Agent 安全设置消息 Schema。 */
export const AgentSafetyRuntimeSyncSchema = z.strictObject({
  kind: z.literal('agent.safety.sync'),
  preferences: AgentSafetyPreferencesSchema
})

// ========= 类型 =========

/** Agent 安全设置持久偏好类型。 */
export type AgentSafetyPreferences = z.infer<typeof AgentSafetyPreferencesSchema>

/** Renderer 管理 Agent 安全设置的请求类型。 */
export type AgentSafetySettingsRequest = z.infer<typeof AgentSafetySettingsRequestSchema>

/** Main 返回给 Renderer 的 Agent 安全设置结果类型。 */
export type AgentSafetySettingsResult = z.infer<typeof AgentSafetySettingsResultSchema>
