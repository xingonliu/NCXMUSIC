import { z } from 'zod'

import { PROTOCOL_VERSION } from './runtime'

export const RuntimeStateSchema = z.enum([
  'starting',
  'ready',
  'restarting',
  'disabled',
  'stopped'
])

export const RuntimeStatusSchema = z.strictObject({
  state: RuntimeStateSchema,
  generation: z.number().int().nonnegative(),
  restartAttempt: z.number().int().min(0).max(3),
  nextRetryMs: z.number().int().nonnegative().optional(),
  reason: z.string().max(200).optional()
})

export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>

export const RuntimeConnectionMetadataSchema = z.strictObject({
  connectionId: z.uuid(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  appVersion: z.string().min(1).max(64),
  utilityGeneration: z.number().int().positive()
})

export type RuntimeConnectionMetadata = z.infer<typeof RuntimeConnectionMetadataSchema>

export const UtilityReadyMessageSchema = z.strictObject({
  kind: z.literal('utility.ready'),
  protocolVersion: z.literal(PROTOCOL_VERSION)
})
