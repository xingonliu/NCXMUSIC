import { describe, expect, it, vi } from 'vitest'

import type { CredentialControlEvent } from '../../src/shared/contracts/credential-lease'
import {
  CredentialLeaseService,
  type NeteaseAuthApi
} from '../../src/utility/credential-lease-service'

function api(overrides: Partial<NeteaseAuthApi> = {}): NeteaseAuthApi {
  return {
    login_status: vi.fn(async () => ({
      body: { data: { code: 200, account: { id: 10001 }, profile: {} } }
    })),
    user_account: vi.fn(async () => ({ body: { code: 200, account: { id: 10001 } } })),
    user_detail: vi.fn(async () => ({ body: { code: 200, profile: { userId: 10001 } } })),
    logout: vi.fn(async () => ({ body: { code: 200 } })),
    ...overrides
  }
}

describe('Utility credential leases', () => {
  it('requires a successful probe, binds the lease, and revokes it after logout', async () => {
    const events: CredentialControlEvent[] = []
    const client = api()
    const service = new CredentialLeaseService((event) => events.push(event), async () => client)
    const secret = `MUSIC_U=${'x'.repeat(96)}; NMTID=fixture`
    const generation = 3

    await service.handle({
      kind: 'auth.session.probe',
      requestId: crypto.randomUUID(),
      accountGeneration: generation,
      cookieHeader: secret
    })
    expect(events.at(-1)).toMatchObject({
      kind: 'auth.session.probe-result',
      valid: true,
      accountId: '10001',
      detailVerified: true
    })

    const leaseId = crypto.randomUUID()
    await service.handle({
      kind: 'auth.lease.grant',
      requestId: crypto.randomUUID(),
      leaseId,
      accountId: '10001',
      accountGeneration: generation,
      expiresAt: Date.now() + 60_000,
      cookieHeader: secret
    })
    expect(service.hasActiveLease()).toBe(true)
    expect(events.at(-1)).toMatchObject({ kind: 'auth.lease.ack', accepted: true, leaseId })

    await service.handle({
      kind: 'auth.logout',
      requestId: crypto.randomUUID(),
      leaseId,
      accountGeneration: generation
    })
    expect(events.at(-1)).toMatchObject({ kind: 'auth.logout-result', remoteAccepted: true })
    expect(service.hasActiveLease()).toBe(false)
  })

  it('rejects a lease whose secret does not match the validated probe', async () => {
    const events: CredentialControlEvent[] = []
    const service = new CredentialLeaseService((event) => events.push(event), async () => api())
    const secret = `MUSIC_U=${'a'.repeat(96)}`
    await service.handle({
      kind: 'auth.session.probe',
      requestId: crypto.randomUUID(),
      accountGeneration: 1,
      cookieHeader: secret
    })
    await service.handle({
      kind: 'auth.lease.grant',
      requestId: crypto.randomUUID(),
      leaseId: crypto.randomUUID(),
      accountId: '10001',
      accountGeneration: 1,
      expiresAt: Date.now() + 60_000,
      cookieHeader: `${secret}-different`
    })
    expect(events.at(-1)).toMatchObject({ kind: 'auth.lease.ack', accepted: false })
    expect(service.hasActiveLease()).toBe(false)
  })

  it('does not forward third-party output or thrown response details', async () => {
    const events: CredentialControlEvent[] = []
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const client = api({
      login_status: vi.fn(async () => {
        console.log('Cookie: should-not-leave-utility')
        throw new Error('remote response contains credentials')
      })
    })
    const service = new CredentialLeaseService((event) => events.push(event), async () => client)
    await service.handle({
      kind: 'auth.session.probe',
      requestId: crypto.randomUUID(),
      accountGeneration: 1,
      cookieHeader: `MUSIC_U=${'z'.repeat(96)}`
    })
    expect(log).not.toHaveBeenCalled()
    expect(events.at(-1)).toMatchObject({
      kind: 'auth.session.probe-result',
      valid: false,
      reason: 'remote-unavailable'
    })
    log.mockRestore()
  })
})
