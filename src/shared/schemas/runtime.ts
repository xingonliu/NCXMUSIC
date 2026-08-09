import { z } from 'zod'

import {
  MusicReadPayloadSchema,
  MusicReadResultSchema,
  ResolveTrackUrlPayloadSchema,
  ResolvedMediaSourceSchema
} from './music'
import { ExecuteShellInputSchema, ExecuteShellResultSchema } from './shell'
import {
  PlaybackSnapshotLoadPayloadSchema,
  PlaybackSnapshotLoadResultSchema,
  PlaybackSnapshotSavePayloadSchema,
  PlaybackSnapshotSaveResultSchema
} from './playback-persistence'

export const PROTOCOL_VERSION = 1 as const

export const ProtocolErrorCodeSchema = z.enum([
  'PROTOCOL_INVALID_MESSAGE',
  'PROTOCOL_VERSION_MISMATCH',
  'CONNECTION_REPLACED',
  'REQUEST_TIMEOUT',
  'REQUEST_CANCELLED',
  'UPSTREAM_ERROR',
  'UTILITY_UNAVAILABLE',
  'CAPABILITY_UNAVAILABLE'
])

export const ProtocolErrorSchema = z.strictObject({
  code: ProtocolErrorCodeSchema,
  message: z.string().min(1).max(200),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional()
})

export type ProtocolError = z.infer<typeof ProtocolErrorSchema>

export type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProtocolError }

const MessageBaseShape = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  connectionId: z.uuid(),
  messageId: z.uuid(),
  sentAt: z.number().int().nonnegative()
}

export const HelloPayloadSchema = z.strictObject({
  role: z.enum(['preload', 'utility']),
  appVersion: z.string().min(1).max(64),
  capabilities: z
    .array(z.enum([
      'system.ping',
      'system.snapshot',
      'music.read',
      'music.resolve-url',
      'playback.snapshot.load',
      'playback.snapshot.save',
      'shell.execute'
    ]))
    .max(8)
})

export const HelloEnvelopeSchema = z.strictObject({
  ...MessageBaseShape,
  kind: z.literal('event'),
  name: z.literal('system.hello'),
  eventId: z.uuid(),
  payload: HelloPayloadSchema
})

export const PingPayloadSchema = z.strictObject({
  delayMs: z.number().int().min(0).max(10_000).default(0)
})

export const PingResultSchema = z.strictObject({
  utilityGeneration: z.number().int().positive(),
  receivedAt: z.number().int().nonnegative(),
  respondedAt: z.number().int().nonnegative()
})

export type PingResult = z.infer<typeof PingResultSchema>

export const UtilitySnapshotSchema = z.strictObject({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  connectionId: z.uuid(),
  utilityGeneration: z.number().int().positive(),
  startedAt: z.number().int().nonnegative(),
  handledRequests: z.number().int().nonnegative(),
  pendingRequestIds: z.array(z.uuid())
})

export type UtilitySnapshot = z.infer<typeof UtilitySnapshotSchema>

const RequestBaseShape = {
  ...MessageBaseShape,
  kind: z.literal('request'),
  requestId: z.uuid(),
  deadlineAt: z.number().int().positive().optional()
}

export const PingRequestEnvelopeSchema = z.strictObject({
  ...RequestBaseShape,
  name: z.literal('system.ping'),
  payload: PingPayloadSchema
})

export const SnapshotRequestEnvelopeSchema = z.strictObject({
  ...RequestBaseShape,
  name: z.literal('system.snapshot'),
  payload: z.strictObject({})
})

/** Renderer/Agent → Utility：读取标准音乐实体和搜索结果 */
export const MusicReadRequestEnvelopeSchema = z.strictObject({
  ...RequestBaseShape,
  name: z.literal('music.read'),
  payload: MusicReadPayloadSchema
})

/** Renderer → Utility：解析指定曲目的可播放 HTTPS URL */
export const ResolveTrackUrlRequestEnvelopeSchema = z.strictObject({
  ...RequestBaseShape,
  name: z.literal('music.resolve-url'),
  payload: ResolveTrackUrlPayloadSchema
})

/** Renderer → Utility：读取当前账户播放快照。 */
export const PlaybackSnapshotLoadRequestEnvelopeSchema = z.strictObject({
  ...RequestBaseShape,
  name: z.literal('playback.snapshot.load'),
  payload: PlaybackSnapshotLoadPayloadSchema
})

/** Renderer → Utility：保存当前账户播放快照。 */
export const PlaybackSnapshotSaveRequestEnvelopeSchema = z.strictObject({
  ...RequestBaseShape,
  name: z.literal('playback.snapshot.save'),
  payload: PlaybackSnapshotSavePayloadSchema
})

/** Renderer/Agent → Utility：执行经过策略网关判定的 Shell 命令 */
export const ExecuteShellRequestEnvelopeSchema = z.strictObject({
  ...RequestBaseShape,
  name: z.literal('shell.execute'),
  payload: ExecuteShellInputSchema
})

export const CancelEnvelopeSchema = z.strictObject({
  ...MessageBaseShape,
  kind: z.literal('cancel'),
  name: z.enum([
    'system.ping',
    'system.snapshot',
    'music.read',
    'music.resolve-url',
    'playback.snapshot.load',
    'playback.snapshot.save',
    'shell.execute'
  ]),
  requestId: z.uuid(),
  reason: z.enum(['user', 'timeout', 'navigation', 'shutdown'])
})

const SuccessResultSchema = z.strictObject({
  ok: z.literal(true),
  data: z.unknown()
})

const FailureResultSchema = z.strictObject({
  ok: z.literal(false),
  error: ProtocolErrorSchema
})

export const ResponseEnvelopeSchema = z.strictObject({
  ...MessageBaseShape,
  kind: z.literal('response'),
  name: z.enum([
    'system.ping',
    'system.snapshot',
    'music.read',
    'music.resolve-url',
    'playback.snapshot.load',
    'playback.snapshot.save',
    'shell.execute'
  ]),
  requestId: z.uuid(),
  result: z.discriminatedUnion('ok', [SuccessResultSchema, FailureResultSchema])
})

export const RuntimeInboundEnvelopeSchema = z.union([
  HelloEnvelopeSchema,
  PingRequestEnvelopeSchema,
  SnapshotRequestEnvelopeSchema,
  MusicReadRequestEnvelopeSchema,
  ResolveTrackUrlRequestEnvelopeSchema,
  PlaybackSnapshotLoadRequestEnvelopeSchema,
  PlaybackSnapshotSaveRequestEnvelopeSchema,
  ExecuteShellRequestEnvelopeSchema,
  CancelEnvelopeSchema
])

export const RuntimeOutboundEnvelopeSchema = z.union([
  HelloEnvelopeSchema,
  ResponseEnvelopeSchema
])

export type PingRequestEnvelope = z.infer<typeof PingRequestEnvelopeSchema>
export type SnapshotRequestEnvelope = z.infer<typeof SnapshotRequestEnvelopeSchema>
export type MusicReadRequestEnvelope = z.infer<typeof MusicReadRequestEnvelopeSchema>
export type ResolveTrackUrlRequestEnvelope = z.infer<typeof ResolveTrackUrlRequestEnvelopeSchema>
export type PlaybackSnapshotLoadRequestEnvelope = z.infer<typeof PlaybackSnapshotLoadRequestEnvelopeSchema>
export type PlaybackSnapshotSaveRequestEnvelope = z.infer<typeof PlaybackSnapshotSaveRequestEnvelopeSchema>
export type ExecuteShellRequestEnvelope = z.infer<typeof ExecuteShellRequestEnvelopeSchema>
export type CancelEnvelope = z.infer<typeof CancelEnvelopeSchema>

export const contractRegistry = {
  'system.ping': {
    direction: 'renderer-to-utility',
    payloadSchema: PingPayloadSchema,
    resultSchema: PingResultSchema,
    defaultTimeoutMs: 12_000,
    retryable: true
  },
  'system.snapshot': {
    direction: 'renderer-to-utility',
    payloadSchema: z.strictObject({}),
    resultSchema: UtilitySnapshotSchema,
    defaultTimeoutMs: 5_000,
    retryable: true
  },
  'music.read': {
    direction: 'renderer-to-utility',
    payloadSchema: MusicReadPayloadSchema,
    resultSchema: MusicReadResultSchema,
    defaultTimeoutMs: 20_000,
    retryable: true
  },
  'music.resolve-url': {
    direction: 'renderer-to-utility',
    payloadSchema: ResolveTrackUrlPayloadSchema,
    resultSchema: ResolvedMediaSourceSchema,
    /** URL 解析需要网络请求，超时设长一些 */
    defaultTimeoutMs: 20_000,
    retryable: false
  },
  'playback.snapshot.load': {
    direction: 'renderer-to-utility',
    payloadSchema: PlaybackSnapshotLoadPayloadSchema,
    resultSchema: PlaybackSnapshotLoadResultSchema,
    defaultTimeoutMs: 5_000,
    retryable: true
  },
  'playback.snapshot.save': {
    direction: 'renderer-to-utility',
    payloadSchema: PlaybackSnapshotSavePayloadSchema,
    resultSchema: PlaybackSnapshotSaveResultSchema,
    defaultTimeoutMs: 5_000,
    retryable: true
  },
  'shell.execute': {
    direction: 'renderer-to-utility',
    payloadSchema: ExecuteShellInputSchema,
    resultSchema: ExecuteShellResultSchema,
    /** Shell 自身默认超时由执行器读取；协议层保留略长的硬超时。 */
    defaultTimeoutMs: 610_000,
    retryable: false
  }
} as const

export function messageBase(connectionId: string): {
  protocolVersion: typeof PROTOCOL_VERSION
  connectionId: string
  messageId: string
  sentAt: number
} {
  return {
    protocolVersion: PROTOCOL_VERSION,
    connectionId,
    messageId: crypto.randomUUID(),
    sentAt: Date.now()
  }
}

export function protocolFailure(
  code: ProtocolError['code'],
  message: string,
  retryable = false
): RuntimeResult<never> {
  return {
    ok: false,
    error: { code, message, retryable }
  }
}
