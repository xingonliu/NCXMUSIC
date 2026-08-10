import { z } from 'zod'

import { AccountIdSchema } from './account'

// ========= 变量 =========

/** 账户数据请求的账户隔离基线字段。 */
const AccountDataScopeShape = {
  accountId: AccountIdSchema,
  accountGeneration: z.number().int().nonnegative()
}

/** 可持久化偏好值，限制为 JSON 并约束序列化尺寸。 */
const PreferenceValueSchema = z.json().refine(
  (value) => JSON.stringify(value).length <= 20_000,
  '偏好值不得超过 20KB'
)

/** 账户数据操作请求。 */
export const AccountDataRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ ...AccountDataScopeShape, operation: z.literal('getStats') }),
  z.strictObject({ ...AccountDataScopeShape, operation: z.literal('getPreferences') }),
  z.strictObject({
    ...AccountDataScopeShape,
    operation: z.literal('setPreference'),
    key: z.string().trim().min(1).max(80),
    value: PreferenceValueSchema
  }),
  z.strictObject({
    ...AccountDataScopeShape,
    operation: z.literal('appendJournal'),
    eventType: z.string().regex(/^[a-z][a-z0-9.-]{1,79}$/u),
    payload: z.record(z.string(), z.json()).refine(
      (value) => JSON.stringify(value).length <= 20_000,
      '事件载荷不得超过 20KB'
    )
  }),
  z.strictObject({ ...AccountDataScopeShape, operation: z.literal('clearCache') }),
  z.strictObject({ ...AccountDataScopeShape, operation: z.literal('deleteLocalData') })
])

/** 账户数据操作结果。 */
export const AccountDataResultSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('getStats'),
    databaseBytes: z.number().int().nonnegative(),
    cacheBytes: z.number().int().nonnegative(),
    journalEvents: z.number().int().nonnegative()
  }),
  z.strictObject({
    operation: z.literal('getPreferences'),
    preferences: z.record(z.string(), z.json())
  }),
  z.strictObject({ operation: z.literal('setPreference'), key: z.string() }),
  z.strictObject({ operation: z.literal('appendJournal'), eventId: z.number().int().positive() }),
  z.strictObject({ operation: z.literal('clearCache'), clearedBytes: z.number().int().nonnegative() }),
  z.strictObject({ operation: z.literal('deleteLocalData'), deleted: z.literal(true) })
])

// ========= 类型 =========

/** 账户数据操作请求类型。 */
export type AccountDataRequest = z.infer<typeof AccountDataRequestSchema>

/** 账户数据操作结果类型。 */
export type AccountDataResult = z.infer<typeof AccountDataResultSchema>
