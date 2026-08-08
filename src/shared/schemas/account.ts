import { z } from 'zod'

// ========= 基础类型 =========

/** 网易云数字用户 ID。 */
export const NeteaseUserIdSchema = z.string().regex(/^\d{1,20}$/u, '网易云用户 ID 必须为纯数字')

/** 应用内部账户引用，禁止承载文件路径或凭据。 */
export const AccountIdSchema = z.union([
  z.literal('guest:local'),
  z.string().regex(/^netease:\d{1,20}$/u, '网易云账户引用必须形如 netease:<数字ID>')
])

/** 登录 Session 状态，与 Main 侧状态机保持同名。 */
export const AccountSessionStateSchema = z.enum([
  'logged_out',
  'opening_official_login',
  'waiting_for_cookie',
  'validating_cookie',
  'authenticated',
  'session_expired',
  'validation_failed',
  'cancelled'
])

/** 游客账户的公开描述。 */
export const GuestAccountRefSchema = z.strictObject({
  kind: z.literal('guest'),
  accountId: z.literal('guest:local'),
  displayName: z.literal('游客')
})

/** 网易云账户的公开描述，不包含 Cookie、Session 或本地路径。 */
export const NeteaseAccountRefSchema = z.strictObject({
  kind: z.literal('netease'),
  accountId: z.string().regex(/^netease:\d{1,20}$/u),
  neteaseUserId: NeteaseUserIdSchema,
  accountFingerprint: z.string().regex(/^[a-f0-9]{12}$/u),
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional()
})

/** 当前账户的公开引用。 */
export const PublicAccountRefSchema = z.discriminatedUnion('kind', [
  GuestAccountRefSchema,
  NeteaseAccountRefSchema
])

/** Renderer 可见的账户 Session 快照。 */
export const AccountSessionSnapshotSchema = z.strictObject({
  state: AccountSessionStateSchema,
  accountGeneration: z.number().int().nonnegative(),
  hasCredentialLease: z.boolean(),
  activeAccount: PublicAccountRefSchema,
  canLogin: z.boolean(),
  canLogout: z.boolean(),
  canSwitchAccount: z.boolean(),
  rendererCanReadSecrets: z.literal(false)
})

// ========= 类型导出 =========

/** 网易云数字用户 ID 类型。 */
export type NeteaseUserId = z.infer<typeof NeteaseUserIdSchema>

/** 应用内部账户引用类型。 */
export type AccountId = z.infer<typeof AccountIdSchema>

/** 登录 Session 状态类型。 */
export type AccountSessionState = z.infer<typeof AccountSessionStateSchema>

/** 当前账户的公开引用类型。 */
export type PublicAccountRef = z.infer<typeof PublicAccountRefSchema>

/** Renderer 可见的账户 Session 快照类型。 */
export type AccountSessionSnapshot = z.infer<typeof AccountSessionSnapshotSchema>
