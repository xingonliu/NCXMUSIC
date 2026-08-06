import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// 常量区
// ─────────────────────────────────────────────────────────────────────────────

/** Shell 单通道最多保留的内存字节数。 */
export const SHELL_OUTPUT_CHANNEL_LIMIT_BYTES = 1_024 * 1_024

/** 单次返回给模型的文本结果上限。 */
export const SHELL_MODEL_RESULT_LIMIT_BYTES = 64 * 1_024

/** 模型结果超限时保留的开头字节数。 */
export const SHELL_MODEL_RESULT_HEAD_BYTES = 16 * 1_024

/** 模型结果超限时保留的结尾字节数。 */
export const SHELL_MODEL_RESULT_TAIL_BYTES = 48 * 1_024

/** Shell Tool 默认超时时间。 */
export const SHELL_DEFAULT_TIMEOUT_MS = 120_000

/** Shell Tool 可请求的最长超时时间。 */
export const SHELL_MAX_TIMEOUT_MS = 600_000

// ─────────────────────────────────────────────────────────────────────────────
// Schema 区
// ─────────────────────────────────────────────────────────────────────────────

/** 用户可配置的 Shell 安全等级。 */
export const ShellSafetyLevelSchema = z.enum(['S1', 'S2', 'S3', 'S4'])

/** Shell 执行器的终态集合。 */
export const ShellExecutionStatusSchema = z.enum([
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
  'rejected',
  'unavailable'
])

/** Shell 命令的确定性分类动作。 */
export const ShellPolicyActionSchema = z.enum(['allow', 'ask', 'deny'])

/** Shell 命令的风险标签。 */
export const ShellCommandTagSchema = z.enum([
  'read',
  'write',
  'delete',
  'build',
  'test',
  'network',
  'install',
  'publish',
  'vcs',
  'process',
  'unknown'
])

/** Shell Tool 的输入契约。 */
export const ExecuteShellInputSchema = z.strictObject({
  command: z.string().trim().min(1).max(8_192),
  workspaceId: z.string().trim().min(1).max(128).optional(),
  cwd: z.string().trim().min(1).max(512).optional(),
  timeoutMs: z.number().int().min(1_000).max(SHELL_MAX_TIMEOUT_MS).optional(),
  purpose: z.string().trim().min(1).max(300)
})

/** Shell Tool 的输出契约。 */
export const ExecuteShellResultSchema = z.strictObject({
  status: ShellExecutionStatusSchema,
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  durationMs: z.number().int().nonnegative(),
  stdout: z.string(),
  stderr: z.string(),
  stdoutTruncated: z.boolean(),
  stderrTruncated: z.boolean()
})

/** Shell 流式输出事件契约。 */
export const ShellOutputEventSchema = z.strictObject({
  kind: z.literal('shell.output'),
  commandId: z.uuid(),
  sequence: z.number().int().positive(),
  stream: z.enum(['stdout', 'stderr']),
  chunk: z.string(),
  truncated: z.boolean()
})

/** Shell 策略判定结果契约。 */
export const ShellPolicyDecisionSchema = z.strictObject({
  action: ShellPolicyActionSchema,
  reason: z.string().min(1).max(300),
  tags: z.array(ShellCommandTagSchema).min(1).max(12),
  executable: z.string().min(1).max(120),
  normalizedCommand: z.string().min(1).max(8_192)
})

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export type ShellSafetyLevel = z.infer<typeof ShellSafetyLevelSchema>
export type ShellExecutionStatus = z.infer<typeof ShellExecutionStatusSchema>
export type ShellPolicyAction = z.infer<typeof ShellPolicyActionSchema>
export type ShellCommandTag = z.infer<typeof ShellCommandTagSchema>
export type ExecuteShellInput = z.infer<typeof ExecuteShellInputSchema>
export type ExecuteShellResult = z.infer<typeof ExecuteShellResultSchema>
export type ShellOutputEvent = z.infer<typeof ShellOutputEventSchema>
export type ShellPolicyDecision = z.infer<typeof ShellPolicyDecisionSchema>
