import { z } from 'zod'

import { AccountIdSchema } from '../schemas/account'

// ========= 变量 =========

/** Main → Utility：切换当前账户 SQLite 单写者。 */
export const AccountStoreOpenCommandSchema = z.strictObject({
  kind: z.literal('account-store.open'),
  requestId: z.uuid(),
  accountId: AccountIdSchema,
  accountGeneration: z.number().int().nonnegative()
})

/** Utility → Main：账户 SQLite 已完成切换并可安全执行请求。 */
export const AccountStoreReadyEventSchema = z.strictObject({
  kind: z.literal('account-store.ready'),
  requestId: z.uuid(),
  accountId: AccountIdSchema,
  accountGeneration: z.number().int().nonnegative(),
  accepted: z.boolean()
})

// ========= 类型 =========

/** Main → Utility 的账户存储切换命令。 */
export type AccountStoreOpenCommand = z.infer<typeof AccountStoreOpenCommandSchema>

/** Utility 完成账户空间切换后的确认事件。 */
export type AccountStoreReadyEvent = z.infer<typeof AccountStoreReadyEventSchema>
