import { describe, expect, it } from 'vitest'

import {
  CredentialControlCommandSchema,
  CredentialControlEventSchema
} from '../../src/shared/contracts/credential-lease'

describe('credential lease control contract', () => {
  it('accepts the private control commands and rejects unknown fields', () => {
    const command = {
      kind: 'auth.session.probe',
      requestId: crypto.randomUUID(),
      accountGeneration: 1,
      cookieHeader: `MUSIC_U=${'x'.repeat(96)}`
    }
    expect(CredentialControlCommandSchema.safeParse(command).success).toBe(true)
    expect(CredentialControlCommandSchema.safeParse({ ...command, extra: true }).success).toBe(
      false
    )
    expect(
      CredentialControlCommandSchema.safeParse({ ...command, cookieHeader: 'MUSIC_U=x\nInjected=y' })
        .success
    ).toBe(false)
  })

  it('never permits a credential value in Utility response events', () => {
    const event = {
      kind: 'auth.lease.ack',
      requestId: crypto.randomUUID(),
      leaseId: crypto.randomUUID(),
      accepted: true
    }
    expect(CredentialControlEventSchema.safeParse(event).success).toBe(true)
    expect(
      CredentialControlEventSchema.safeParse({ ...event, cookieHeader: 'must-not-cross' }).success
    ).toBe(false)
  })
})
