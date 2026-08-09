import { z } from 'zod'

import { AccountIdSchema } from '../schemas/account'

// ========= 变量 =========

/** Main → Utility：切换当前账户 SQLite 单写者。 */
export const AccountStoreOpenCommandSchema = z.strictObject({
  kind: z.literal('account-store.open'),
  accountId: AccountIdSchema,
  accountGeneration: z.number().int().nonnegative()
})

// ========= 类型 =========

/** Main → Utility 的账户存储切换命令。 */
export type AccountStoreOpenCommand = z.infer<typeof AccountStoreOpenCommandSchema>
