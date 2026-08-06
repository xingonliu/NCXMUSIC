import { z } from 'zod'

// ========= 常量 =========
/** InputHookHost 与 Main 之间的消息协议版本。 */
export const INPUT_HOOK_PROTOCOL_VERSION = 1 as const

/** Host 只允许向 Main 汇报状态转换，不允许跨进程传递原始按键流。 */
export const InputHookStatusSchema = z.enum([
  'pressed',
  'released',
  'permission_denied',
  'hook_failed',
  'stopped'
])

/** Phase 0 固定验证 Alt+Space，先限制为明确白名单按键。 */
export const InputHookKeySchema = z.enum(['AltLeft', 'AltRight', 'Space'])

/** 纯逻辑匹配器可消费的最小原生事件类型。 */
export const InputHookEventTypeSchema = z.enum(['keydown', 'keyup', 'disconnect'])

// ========= Schema =========
/** Main 下发给 InputHookHost 的当前快捷键配置。 */
export const InputHookConfigSchema = z.strictObject({
  protocolVersion: z.literal(INPUT_HOOK_PROTOCOL_VERSION),
  chord: z.array(InputHookKeySchema).min(1).max(4),
  sessionGeneration: z.number().int().nonnegative()
})

/** InputHookHost 上报给 Main 的安全状态报告。 */
export const InputHookReportSchema = z.strictObject({
  protocolVersion: z.literal(INPUT_HOOK_PROTOCOL_VERSION),
  status: InputHookStatusSchema,
  sessionGeneration: z.number().int().nonnegative(),
  reason: z.string().max(200).optional()
})

/** Host 内部归一化后的按键事件，禁止包含原始 keycode 等字段。 */
export const InputHookNativeEventSchema = z.strictObject({
  type: InputHookEventTypeSchema,
  key: InputHookKeySchema.optional(),
  repeat: z.boolean().optional()
})

// ========= 类型 =========
/** InputHookHost 启动或重配时使用的快捷键配置。 */
export type InputHookConfig = z.infer<typeof InputHookConfigSchema>
/** InputHookHost 发给 Main 的状态报告。 */
export type InputHookReport = z.infer<typeof InputHookReportSchema>
/** 匹配器内部消费的最小按键事件。 */
export type InputHookNativeEvent = z.infer<typeof InputHookNativeEventSchema>
/** InputHookHost 可上报的状态集合。 */
export type InputHookStatus = z.infer<typeof InputHookStatusSchema>
/** 当前快捷键白名单中的按键名。 */
export type InputHookKey = z.infer<typeof InputHookKeySchema>
