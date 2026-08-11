import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// 变量区
// ─────────────────────────────────────────────────────────────────────────────

/** 应用配置文件当前 Schema 版本。 */
export const APP_CONFIG_SCHEMA_VERSION = 1 as const

/** 账户空间当前 SQLite Schema 版本。 */
export const ACCOUNT_SQLITE_SCHEMA_VERSION = 4 as const

/** 可选主题模式。 */
export const AppThemeSchema = z.enum(['system', 'light', 'dark'])

/** 持久化窗口配置 Schema。 */
export const WindowConfigSchema = z.strictObject({
  width: z.number().int().min(960).max(4096),
  height: z.number().int().min(640).max(2160),
  maximized: z.boolean()
})

/** 应用级配置文件 Schema，不包含 Cookie、API Key 或数据库路径。 */
export const AppConfigSchema = z.strictObject({
  schemaVersion: z.literal(APP_CONFIG_SCHEMA_VERSION),
  theme: AppThemeSchema.default('system'),
  window: WindowConfigSchema,
  closeWindowBehavior: z.enum(['minimize', 'quit']).default('minimize'),
  lastOpenedAccountId: z.string().regex(/^(guest:local|netease:\d+)$/u).default('guest:local')
})

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** 可选主题模式类型。 */
export type AppTheme = z.infer<typeof AppThemeSchema>

/** 持久化窗口配置类型。 */
export type WindowConfig = z.infer<typeof WindowConfigSchema>

/** 应用级配置文件类型。 */
export type AppConfig = z.infer<typeof AppConfigSchema>
