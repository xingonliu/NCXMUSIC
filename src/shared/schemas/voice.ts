import { z } from 'zod'

// ========= 变量 =========

/** 单次语音录音允许进入 Utility Process 的最大字节数。 */
export const VOICE_AUDIO_MAX_BYTES = 20 * 1_024 * 1_024

/** 全局按住说话允许配置的按键集合。 */
export const VoiceShortcutKeySchema = z.enum([
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'ShiftLeft',
  'ShiftRight',
  'Space'
])

/** 全局语音快捷键的可用状态。 */
export const VoiceShortcutAvailabilitySchema = z.enum([
  'disabled',
  'registering',
  'ready',
  'conflict',
  'permission_denied',
  'hook_failed'
])

/** 当前 Provider Profile 的 ASR 能力状态。 */
export const VoiceAsrCapabilitySchema = z.enum(['unknown', 'supported', 'unsupported'])

/** Renderer 可见的全局快捷键安全快照。 */
export const VoiceShortcutSnapshotSchema = z.strictObject({
  enabled: z.boolean(),
  chord: z.array(VoiceShortcutKeySchema).min(1).max(4),
  accelerator: z.string().min(1).max(80),
  availability: VoiceShortcutAvailabilitySchema,
  reason: z.string().max(300).optional(),
  generation: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
})

/** Main 发给 Renderer 的最小语音快捷键事件。 */
export const VoiceShortcutEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('status'),
    snapshot: VoiceShortcutSnapshotSchema
  }),
  z.strictObject({
    type: z.enum(['pressed', 'released', 'cancelled']),
    generation: z.number().int().nonnegative(),
    reason: z.string().max(300).optional()
  })
])

/** Renderer 对全局语音快捷键的配置命令。 */
export const VoiceShortcutCommandSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('snapshot') }),
  z.strictObject({
    operation: z.literal('configure'),
    enabled: z.boolean(),
    chord: z.array(VoiceShortcutKeySchema).min(1).max(4)
  }),
  z.strictObject({ operation: z.literal('openPermissionSettings') })
])

/** 语音 Runtime 请求；原始音频只允许作为受限 Uint8Array 进入 Utility。 */
export const VoiceRuntimeRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('status') }),
  z.strictObject({
    operation: z.literal('transcribe'),
    voiceSessionId: z.uuid(),
    mimeType: z.string().trim().min(1).max(120),
    audio: z.instanceof(Uint8Array).refine(
      (value) => value.byteLength > 0 && value.byteLength <= VOICE_AUDIO_MAX_BYTES,
      '语音数据为空或超过 20 MiB 上限。'
    )
  })
])

/** 语音 Runtime 公开结果。 */
export const VoiceRuntimeResultSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('status'),
    configured: z.boolean(),
    capability: VoiceAsrCapabilitySchema,
    message: z.string().max(500).optional()
  }),
  z.strictObject({
    operation: z.literal('transcribe'),
    status: z.enum(['transcribed', 'unsupported']),
    text: z.string().max(20_000).optional(),
    message: z.string().max(500).optional()
  })
])

// ========= 类型 =========

/** 全局快捷键按键类型。 */
export type VoiceShortcutKey = z.infer<typeof VoiceShortcutKeySchema>

/** 全局快捷键快照类型。 */
export type VoiceShortcutSnapshot = z.infer<typeof VoiceShortcutSnapshotSchema>

/** 全局快捷键事件类型。 */
export type VoiceShortcutEvent = z.infer<typeof VoiceShortcutEventSchema>

/** 全局快捷键命令类型。 */
export type VoiceShortcutCommand = z.infer<typeof VoiceShortcutCommandSchema>

/** 语音 Runtime 请求类型。 */
export type VoiceRuntimeRequest = z.infer<typeof VoiceRuntimeRequestSchema>

/** 语音 Runtime 结果类型。 */
export type VoiceRuntimeResult = z.infer<typeof VoiceRuntimeResultSchema>
