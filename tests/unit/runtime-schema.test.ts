import { describe, expect, it } from 'vitest'

import {
  RUNTIME_PROTOCOL_VERSION,
  RuntimeReadyMessageSchema
} from '../../src/shared/schemas/runtime'

describe('runtime ready contract', () => {
  it('accepts the frozen protocol message', () => {
    expect(
      RuntimeReadyMessageSchema.parse({
        kind: 'runtime.ready',
        protocolVersion: RUNTIME_PROTOCOL_VERSION,
        pid: 42
      })
    ).toEqual({
      kind: 'runtime.ready',
      protocolVersion: 1,
      pid: 42
    })
  })

  it('rejects unknown fields', () => {
    expect(
      RuntimeReadyMessageSchema.safeParse({
        kind: 'runtime.ready',
        protocolVersion: 1,
        pid: 42,
        secret: 'must not cross the boundary'
      }).success
    ).toBe(false)
  })
})
