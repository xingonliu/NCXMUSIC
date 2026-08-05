import { z } from 'zod'

export const RUNTIME_PROTOCOL_VERSION = 1 as const

export const RuntimeReadyMessageSchema = z.strictObject({
  kind: z.literal('runtime.ready'),
  protocolVersion: z.literal(RUNTIME_PROTOCOL_VERSION),
  pid: z.number().int().positive()
})

export type RuntimeReadyMessage = z.infer<typeof RuntimeReadyMessageSchema>
