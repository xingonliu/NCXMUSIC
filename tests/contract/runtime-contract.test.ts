import { describe, expect, it } from 'vitest'

import {
  PingRequestEnvelopeSchema,
  RuntimeInboundEnvelopeSchema,
  UtilitySnapshotSchema,
  messageBase
} from '../../src/shared/schemas/runtime'

describe('runtime contract', () => {
  it('accepts a registered strict ping request', () => {
    const connectionId = crypto.randomUUID()
    const request = {
      ...messageBase(connectionId),
      kind: 'request',
      name: 'system.ping',
      requestId: crypto.randomUUID(),
      deadlineAt: Date.now() + 5_000,
      payload: { delayMs: 0 }
    }

    expect(PingRequestEnvelopeSchema.parse(request)).toEqual(request)
  })

  it('rejects unknown fields and unregistered names', () => {
    const request = {
      ...messageBase(crypto.randomUUID()),
      kind: 'request',
      name: 'system.arbitrary',
      requestId: crypto.randomUUID(),
      payload: {},
      cookie: 'must-not-cross-process'
    }

    expect(RuntimeInboundEnvelopeSchema.safeParse(request).success).toBe(false)
  })

  it('requires a complete snapshot shape', () => {
    expect(
      UtilitySnapshotSchema.safeParse({
        protocolVersion: 1,
        connectionId: crypto.randomUUID(),
        utilityGeneration: 1,
        startedAt: Date.now(),
        handledRequests: 0
      }).success
    ).toBe(false)
  })
})
