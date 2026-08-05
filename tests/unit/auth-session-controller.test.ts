import type { Cookie, Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { AuthSessionController } from '../../src/main/auth/auth-session-controller'
import type { CredentialLeaseCoordinator } from '../../src/main/auth/credential-lease-coordinator'

function cookie(value: string): Cookie {
  return {
    name: 'MUSIC_U',
    value,
    domain: '.music.163.com',
    hostOnly: false,
    path: '/',
    secure: true,
    httpOnly: true,
    session: false,
    sameSite: 'unspecified'
  }
}

function harness(
  cookies: Cookie[],
  probeResult: {
    valid: boolean
    accountId?: string
    detailVerified: boolean
    reason?: 'authenticated' | 'missing-account' | 'remote-unavailable'
  }
): {
  controller: AuthSessionController
  remove: ReturnType<typeof vi.fn>
  coordinator: {
    probe: ReturnType<typeof vi.fn>
    grant: ReturnType<typeof vi.fn>
    revoke: ReturnType<typeof vi.fn>
  }
} {
  const remove = vi.fn(async () => {})
  const electronSession = {
    cookies: {
      get: vi.fn(async () => cookies),
      remove,
      flushStore: vi.fn(async () => {})
    }
  } as unknown as Session
  const coordinator = {
    probe: vi.fn(async () => probeResult),
    grant: vi.fn(async () => ({
      leaseId: crypto.randomUUID(),
      accountId: probeResult.accountId ?? '0',
      accountGeneration: 1,
      utilityGeneration: 1,
      expiresAt: Date.now() + 60_000
    })),
    revoke: vi.fn(async () => {}),
    logout: vi.fn(async () => true),
    currentLease: vi.fn(() => undefined),
    shutdown: vi.fn()
  }
  return {
    controller: new AuthSessionController(
      electronSession,
      coordinator as unknown as CredentialLeaseCoordinator
    ),
    remove,
    coordinator
  }
}

describe('auth session controller', () => {
  it('restores a verified account and grants a generation-bound lease', async () => {
    const secret = 'x'.repeat(96)
    const { controller, coordinator } = harness([cookie(secret)], {
      valid: true,
      accountId: '10001',
      detailVerified: true,
      reason: 'authenticated'
    })
    const result = await controller.restore()
    expect(result).toMatchObject({
      outcome: 'authenticated',
      detailVerified: true,
      snapshot: {
        state: 'authenticated',
        accountGeneration: 1,
        hasCredentialLease: true
      }
    })
    expect(coordinator.probe).toHaveBeenCalledWith(`MUSIC_U=${secret}`, 1)
    expect(coordinator.grant).toHaveBeenCalledWith(`MUSIC_U=${secret}`, '10001', 1)
  })

  it('clears a structurally invalid credential and expires the account generation', async () => {
    const { controller, coordinator, remove } = harness([cookie('invalid')], {
      valid: false,
      detailVerified: false,
      reason: 'missing-account'
    })
    const result = await controller.restore()
    expect(result).toMatchObject({
      outcome: 'invalid',
      snapshot: { state: 'session_expired', accountGeneration: 1 }
    })
    expect(coordinator.revoke).toHaveBeenCalledWith('expired')
    expect(remove).toHaveBeenCalledOnce()
  })

  it('preserves the persistent Session when upstream validation is ambiguous', async () => {
    const { controller, coordinator, remove } = harness([cookie('x'.repeat(96))], {
      valid: false,
      detailVerified: false,
      reason: 'remote-unavailable'
    })
    const result = await controller.restore()
    expect(result).toMatchObject({
      outcome: 'remote-unavailable',
      snapshot: { state: 'validation_failed', hasCredentialLease: false }
    })
    expect(coordinator.grant).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })
})
