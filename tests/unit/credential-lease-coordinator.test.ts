import { describe, expect, it } from 'vitest'

import {
  CredentialLeaseCoordinator,
  type CredentialControlTransport
} from '../../src/main/auth/credential-lease-coordinator'
import type { RuntimeStatus } from '../../src/shared/contracts/control-plane'
import type {
  CredentialControlCommand,
  CredentialControlEvent
} from '../../src/shared/contracts/credential-lease'

class FakeTransport implements CredentialControlTransport {
  generation: number | undefined = 4
  private readonly messageListeners = new Set<(message: unknown) => void>()
  private readonly statusListeners = new Set<(status: RuntimeStatus) => void>()

  currentGeneration(): number | undefined {
    return this.generation
  }

  postControl(command: CredentialControlCommand): boolean {
    if (!this.generation) return false
    let event: CredentialControlEvent
    if (command.kind === 'auth.session.probe') {
      event = {
        kind: 'auth.session.probe-result',
        requestId: command.requestId,
        valid: true,
        accountId: '10001',
        detailVerified: true,
        reason: 'authenticated'
      }
    } else if (command.kind === 'auth.logout') {
      event = {
        kind: 'auth.logout-result',
        requestId: command.requestId,
        remoteAccepted: true
      }
    } else {
      event = {
        kind: 'auth.lease.ack',
        requestId: command.requestId,
        ...(command.kind === 'auth.lease.grant' ? { leaseId: command.leaseId } : {}),
        accepted: true
      }
    }
    queueMicrotask(() => {
      for (const listener of this.messageListeners) listener(event)
    })
    return true
  }

  onControlMessage(listener: (message: unknown) => void): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  onStatus(listener: (status: RuntimeStatus) => void): () => void {
    this.statusListeners.add(listener)
    listener({ state: 'ready', generation: 4, restartAttempt: 0 })
    return () => this.statusListeners.delete(listener)
  }

  exit(): void {
    this.generation = undefined
    for (const listener of this.statusListeners) {
      listener({ state: 'restarting', generation: 4, restartAttempt: 1, nextRetryMs: 1_000 })
    }
  }
}

describe('Main credential lease coordinator', () => {
  it('binds a validated lease to the Utility generation and reclaims it on exit', async () => {
    const transport = new FakeTransport()
    const coordinator = new CredentialLeaseCoordinator(transport)
    const cookieHeader = `MUSIC_U=${'x'.repeat(96)}`
    const probe = await coordinator.probe(cookieHeader, 2)
    expect(probe).toMatchObject({ valid: true, accountId: '10001', detailVerified: true })

    const lease = await coordinator.grant(cookieHeader, '10001', 2)
    expect(lease).toMatchObject({
      accountId: '10001',
      accountGeneration: 2,
      utilityGeneration: 4
    })
    expect(coordinator.currentLease()).toBeDefined()

    transport.exit()
    expect(coordinator.currentLease()).toBeUndefined()
    coordinator.shutdown()
  })

  it('does not issue control commands while Utility is unavailable', async () => {
    const transport = new FakeTransport()
    transport.generation = undefined
    const coordinator = new CredentialLeaseCoordinator(transport)
    await expect(coordinator.probe(`MUSIC_U=${'x'.repeat(96)}`, 1)).rejects.toThrow(
      'Utility is unavailable'
    )
    coordinator.shutdown()
  })
})
