import { z } from 'zod'

import { AppThemeSchema } from './storage'
import { VOICE_AUDIO_MAX_BYTES } from './voice'

// ========= 变量 =========

/** 本地识别统一接收的 PCM 采样率。 */
export const VOICE_PCM_SAMPLE_RATE = 16_000 as const

/** 单个跨进程 PCM 块允许的最大样本数。 */
export const VOICE_PCM_CHUNK_MAX_SAMPLES = 32_000 as const

/** 可选语音识别来源。 */
export const VoiceRecognitionSourceSchema = z.enum(['local', 'cloud', 'conversation'])

/** 内置本地模型。 */
export const VoiceLocalModelIdSchema = z.enum(['light', 'accurate'])

/** 本地模型内存生命周期。 */
export const VoiceLocalLoadModeSchema = z.enum(['on-demand', 'resident'])

/** 独立云端 ASR 支持的协议。 */
export const VoiceCloudProtocolSchema = z.enum(['openai-transcriptions'])

/** 本地模型安装状态。 */
export const VoiceModelInstallStateSchema = z.enum([
  'not-installed',
  'downloading',
  'installed',
  'failed'
])

/** 本地识别进程公开状态。 */
export const VoiceLocalRuntimeStateSchema = z.enum([
  'stopped',
  'starting',
  'ready',
  'recognizing',
  'failed'
])

/** Renderer 可见的本地模型元数据与安装状态。 */
export const VoiceLocalModelSnapshotSchema = z.strictObject({
  id: VoiceLocalModelIdSchema,
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  version: z.string().min(1).max(80),
  languages: z.array(z.string().min(1).max(40)).min(1).max(8),
  streamMode: z.enum(['true-streaming', 'vad-segmented']),
  downloadBytes: z.number().int().positive(),
  installedBytes: z.number().int().positive(),
  estimatedMemoryMiB: z.number().int().positive(),
  licenseName: z.string().min(1).max(120),
  licenseUrl: z.url().max(2_048),
  installState: VoiceModelInstallStateSchema,
  progress: z.number().min(0).max(100).optional(),
  downloadedBytes: z.number().int().nonnegative().optional(),
  error: z.string().max(300).optional()
})

/** Renderer 可见的本地识别设置。 */
export const VoiceLocalSettingsSnapshotSchema = z.strictObject({
  modelId: VoiceLocalModelIdSchema,
  streaming: z.boolean(),
  loadMode: VoiceLocalLoadModeSchema
})

/** Renderer 可见的独立云端 ASR 设置，不包含秘密值。 */
export const VoiceCloudSettingsSnapshotSchema = z.strictObject({
  protocol: VoiceCloudProtocolSchema,
  baseUrl: z.url().max(2_048),
  modelId: z.string().trim().min(1).max(200),
  streaming: z.boolean(),
  streamingSupported: z.boolean(),
  hasApiKey: z.boolean(),
  headerNames: z.array(z.string().min(1).max(80)).max(16)
})

/** 语音设置页与录音入口共用的公开快照。 */
export const VoiceSettingsSnapshotSchema = z.strictObject({
  source: VoiceRecognitionSourceSchema,
  totalMemoryGiB: z.number().nonnegative(),
  recommendedLocalModelId: VoiceLocalModelIdSchema,
  local: VoiceLocalSettingsSnapshotSchema,
  cloud: VoiceCloudSettingsSnapshotSchema,
  conversationStreaming: z.literal(false),
  models: z.array(VoiceLocalModelSnapshotSchema).length(2),
  localRuntime: z.strictObject({
    state: VoiceLocalRuntimeStateSchema,
    modelId: VoiceLocalModelIdSchema.optional(),
    message: z.string().max(300).optional()
  })
})

/** 独立云端 ASR 保存输入；空 API Key 表示清除，缺省表示保留。 */
export const VoiceCloudSettingsInputSchema = z.strictObject({
  protocol: VoiceCloudProtocolSchema,
  baseUrl: z.url().max(2_048),
  modelId: z.string().trim().min(1).max(200),
  apiKey: z.string().max(8_192).optional(),
  customHeaders: z.record(
    z.string().regex(/^[A-Za-z0-9-]{1,80}$/u),
    z.string().max(8_192)
  ).refine((headers) => Object.keys(headers).length <= 16, '自定义 Header 最多 16 项'),
  streaming: z.boolean()
})

/** Renderer 对语音设置与模型安装的白名单请求。 */
export const VoiceSettingsRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('snapshot') }),
  z.strictObject({
    operation: z.literal('setSource'),
    source: VoiceRecognitionSourceSchema
  }),
  z.strictObject({
    operation: z.literal('setLocal'),
    modelId: VoiceLocalModelIdSchema,
    streaming: z.boolean(),
    loadMode: VoiceLocalLoadModeSchema
  }),
  z.strictObject({
    operation: z.literal('saveCloud'),
    cloud: VoiceCloudSettingsInputSchema
  }),
  z.strictObject({ operation: z.literal('installModel'), modelId: VoiceLocalModelIdSchema }),
  z.strictObject({ operation: z.literal('cancelModelInstall'), modelId: VoiceLocalModelIdSchema }),
  z.strictObject({ operation: z.literal('removeModel'), modelId: VoiceLocalModelIdSchema })
])

/** 语音设置请求结果。 */
export const VoiceSettingsResultSchema = z.strictObject({
  snapshot: VoiceSettingsSnapshotSchema,
  message: z.string().max(300).optional()
})

/** 本地 PCM 会话启动输入。 */
export const VoiceLocalSessionStartSchema = z.strictObject({
  voiceSessionId: z.uuid(),
  modelId: VoiceLocalModelIdSchema,
  streaming: z.boolean()
})

/** Renderer 发送给本地语音进程的单个 PCM 块。 */
export const VoiceLocalPcmChunkSchema = z.strictObject({
  voiceSessionId: z.uuid(),
  sampleRate: z.literal(VOICE_PCM_SAMPLE_RATE),
  samples: z.instanceof(Float32Array).refine(
    (samples) => samples.length > 0 && samples.length <= VOICE_PCM_CHUNK_MAX_SAMPLES,
    'PCM 块为空或超过 2 秒上限。'
  )
})

/** 本地语音会话终止输入。 */
export const VoiceLocalSessionEndSchema = z.strictObject({
  voiceSessionId: z.uuid()
})

/** 独立云端 ASR 的完整内存录音输入。 */
export const VoiceCloudTranscriptionInputSchema = z.strictObject({
  voiceSessionId: z.uuid(),
  mimeType: z.string().trim().min(1).max(120),
  audio: z.instanceof(Uint8Array).refine(
    (audio) => audio.byteLength > 0 && audio.byteLength <= VOICE_AUDIO_MAX_BYTES,
    '语音数据为空或超过 20 MiB 上限。'
  )
})

/** 本地或独立云端识别终态。 */
export const VoiceTranscriptionResultSchema = z.strictObject({
  voiceSessionId: z.uuid(),
  text: z.string().max(20_000)
})

/** Renderer 提交给 Main 外置胶囊窗的纯展示状态。 */
export const VoiceOverlayStateSchema = z.strictObject({
  phase: z.enum(['idle', 'starting', 'listening', 'transcribing', 'reviewing']),
  text: z.string().max(500),
  waveform: z.array(z.number().min(0).max(1)).length(12),
  theme: AppThemeSchema
})

/** Agent 完成后创建原生通知的受限文案。 */
export const VoiceAgentNotificationInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(240)
})

/** Main 向 Renderer 发布的模型状态或增量转写事件。 */
export const VoiceServiceEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('snapshot'),
    snapshot: VoiceSettingsSnapshotSchema
  }),
  z.strictObject({
    type: z.literal('transcript'),
    voiceSessionId: z.uuid(),
    text: z.string().max(20_000),
    isFinal: z.boolean()
  }),
  z.strictObject({
    type: z.literal('open-agent')
  })
])

// ========= 类型 =========

/** 语音识别来源类型。 */
export type VoiceRecognitionSource = z.infer<typeof VoiceRecognitionSourceSchema>

/** 本地模型 ID 类型。 */
export type VoiceLocalModelId = z.infer<typeof VoiceLocalModelIdSchema>

/** 本地模型元数据快照类型。 */
export type VoiceLocalModelSnapshot = z.infer<typeof VoiceLocalModelSnapshotSchema>

/** 本地模型加载策略类型。 */
export type VoiceLocalLoadMode = z.infer<typeof VoiceLocalLoadModeSchema>

/** 独立云端协议类型。 */
export type VoiceCloudProtocol = z.infer<typeof VoiceCloudProtocolSchema>

/** 语音公开设置快照类型。 */
export type VoiceSettingsSnapshot = z.infer<typeof VoiceSettingsSnapshotSchema>

/** 独立云端设置输入类型。 */
export type VoiceCloudSettingsInput = z.infer<typeof VoiceCloudSettingsInputSchema>

/** 语音设置请求类型。 */
export type VoiceSettingsRequest = z.infer<typeof VoiceSettingsRequestSchema>

/** 语音设置结果类型。 */
export type VoiceSettingsResult = z.infer<typeof VoiceSettingsResultSchema>

/** 本地语音会话启动类型。 */
export type VoiceLocalSessionStart = z.infer<typeof VoiceLocalSessionStartSchema>

/** 本地 PCM 块类型。 */
export type VoiceLocalPcmChunk = z.infer<typeof VoiceLocalPcmChunkSchema>

/** 本地语音会话终止类型。 */
export type VoiceLocalSessionEnd = z.infer<typeof VoiceLocalSessionEndSchema>

/** 独立云端转写输入类型。 */
export type VoiceCloudTranscriptionInput = z.infer<typeof VoiceCloudTranscriptionInputSchema>

/** 识别终态类型。 */
export type VoiceTranscriptionResult = z.infer<typeof VoiceTranscriptionResultSchema>

/** 外置胶囊窗展示状态类型。 */
export type VoiceOverlayState = z.infer<typeof VoiceOverlayStateSchema>

/** 原生 Agent 完成通知输入类型。 */
export type VoiceAgentNotificationInput = z.infer<typeof VoiceAgentNotificationInputSchema>

/** 语音服务事件类型。 */
export type VoiceServiceEvent = z.infer<typeof VoiceServiceEventSchema>
