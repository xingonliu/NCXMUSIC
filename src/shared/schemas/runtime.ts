import { z } from 'zod'

export const PROTOCOL_VERSION = 1 as const

export const ProtocolErrorCodeSchema = z.enum([
  'PROTOCOL_INVALID_MESSAGE',
  'PROTOCOL_VERSION_MISMATCH',
  'CONNECTION_REPLACED',
  'REQUEST_TIMEOUT',
  'REQUEST_CANCELLED',
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
  capabilities: z.array(z.enum(['system.ping', 'system.snapshot'])).max(8)
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

export const CancelEnvelopeSchema = z.strictObject({
  ...MessageBaseShape,
  kind: z.literal('cancel'),
  name: z.enum(['system.ping', 'system.snapshot']),
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
  name: z.enum(['system.ping', 'system.snapshot']),
  requestId: z.uuid(),
  result: z.discriminatedUnion('ok', [SuccessResultSchema, FailureResultSchema])
})

export const RuntimeInboundEnvelopeSchema = z.union([
  HelloEnvelopeSchema,
  PingRequestEnvelopeSchema,
  SnapshotRequestEnvelopeSchema,
  CancelEnvelopeSchema
])

export const RuntimeOutboundEnvelopeSchema = z.union([
  HelloEnvelopeSchema,
  ResponseEnvelopeSchema
])

export type PingRequestEnvelope = z.infer<typeof PingRequestEnvelopeSchema>
export type SnapshotRequestEnvelope = z.infer<typeof SnapshotRequestEnvelopeSchema>
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
