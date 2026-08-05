import { z } from 'zod'

export const CONTROL_CHANNELS = {
  connect: 'ncx:runtime-connect',
  port: 'ncx:runtime-port',
  retry: 'ncx:runtime-retry',
  status: 'ncx:runtime-status'
} as const

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
  protocolVersion: z.literal(1),
  appVersion: z.string().min(1).max(64),
  utilityGeneration: z.number().int().positive()
})

export type RuntimeConnectionMetadata = z.infer<typeof RuntimeConnectionMetadataSchema>
