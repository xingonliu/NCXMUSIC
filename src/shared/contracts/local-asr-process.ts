import { z } from 'zod'

import { VoiceLocalModelIdSchema, VOICE_PCM_CHUNK_MAX_SAMPLES, VOICE_PCM_SAMPLE_RATE } from '../schemas/voice-settings'

// ========= 变量 =========

/** 本地 ASR 子进程协议版本。 */
export const LOCAL_ASR_PROTOCOL_VERSION = 1 as const

/** Main 发给本地 ASR 子进程的消息。 */
export const LocalAsrCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('start'),
    protocolVersion: z.literal(LOCAL_ASR_PROTOCOL_VERSION),
    voiceSessionId: z.uuid(),
    modelId: VoiceLocalModelIdSchema,
    modelDirectory: z.string().min(1).max(4_096),
    streaming: z.boolean()
  }),
  z.strictObject({
    type: z.literal('chunk'),
    protocolVersion: z.literal(LOCAL_ASR_PROTOCOL_VERSION),
    voiceSessionId: z.uuid(),
    sampleRate: z.literal(VOICE_PCM_SAMPLE_RATE),
    samples: z.instanceof(Float32Array).refine((samples) => samples.length > 0 && samples.length <= VOICE_PCM_CHUNK_MAX_SAMPLES)
  }),
  z.strictObject({
    type: z.literal('finish'),
    protocolVersion: z.literal(LOCAL_ASR_PROTOCOL_VERSION),
    voiceSessionId: z.uuid()
  }),
  z.strictObject({
    type: z.literal('cancel'),
    protocolVersion: z.literal(LOCAL_ASR_PROTOCOL_VERSION),
    voiceSessionId: z.uuid()
  })
])

/** 本地 ASR 子进程返回 Main 的消息。 */
export const LocalAsrReportSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('ready'),
    protocolVersion: z.literal(LOCAL_ASR_PROTOCOL_VERSION),
    voiceSessionId: z.uuid(),
    modelId: VoiceLocalModelIdSchema
  }),
  z.strictObject({
    type: z.literal('transcript'),
    protocolVersion: z.literal(LOCAL_ASR_PROTOCOL_VERSION),
    voiceSessionId: z.uuid(),
    text: z.string().max(20_000),
    isFinal: z.boolean()
  }),
  z.strictObject({
    type: z.literal('error'),
    protocolVersion: z.literal(LOCAL_ASR_PROTOCOL_VERSION),
    voiceSessionId: z.uuid(),
    message: z.string().min(1).max(300)
  })
])

// ========= 类型 =========

/** Main 发给本地 ASR 子进程的消息类型。 */
export type LocalAsrCommand = z.infer<typeof LocalAsrCommandSchema>

/** 本地 ASR 子进程报告类型。 */
export type LocalAsrReport = z.infer<typeof LocalAsrReportSchema>
