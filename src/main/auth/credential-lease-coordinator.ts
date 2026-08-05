import type { RuntimeStatus } from '../../shared/contracts/control-plane'
import {
  CredentialControlEventSchema,
  type CredentialControlCommand,
  type CredentialControlEvent
} from '../../shared/contracts/credential-lease'

const MAX_LEASE_LIFETIME_MS = 5 * 60 * 1_000

export interface CredentialControlTransport {
  currentGeneration(): number | undefined
  postControl(message: CredentialControlCommand): boolean
  onControlMessage(listener: (message: unknown) => void): () => void
  onStatus(listener: (status: RuntimeStatus) => void): () => void
}

interface PendingControlRequest {
  utilityGeneration: number
  resolve: (event: CredentialControlEvent) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface ActiveLeaseMetadata {
  leaseId: string
  accountId: string
  accountGeneration: number
  utilityGeneration: number
  expiresAt: number
}

export class CredentialLeaseCoordinator {
  private readonly pending = new Map<string, PendingControlRequest>()
  private activeLease: ActiveLeaseMetadata | undefined
  private expiryTimer: ReturnType<typeof setTimeout> | undefined
  private readonly unsubscribeMessage: () => void
  private readonly unsubscribeStatus: () => void

  constructor(
    private readonly transport: CredentialControlTransport,
    private readonly now: () => number = Date.now
  ) {
    this.unsubscribeMessage = transport.onControlMessage((message) => this.handleMessage(message))
    this.unsubscribeStatus = transport.onStatus((status) => {
      if (status.state !== 'ready') this.reclaimAfterUtilityExit()
    })
  }

  async probe(cookieHeader: string, accountGeneration: number): Promise<{
    valid: boolean
    accountId?: string
    detailVerified: boolean
    reason?: 'authenticated' | 'missing-account' | 'remote-unavailable'
  }> {
    const command: CredentialControlCommand = {
      kind: 'auth.session.probe',
      requestId: crypto.randomUUID(),
      accountGeneration,
      cookieHeader
    }
    try {
      const event = await this.request(command, 50_000)
      if (event.kind !== 'auth.session.probe-result') {
        throw new Error('Utility rejected the credential probe')
      }
      return {
        valid: event.valid,
        detailVerified: event.detailVerified,
        ...(event.accountId ? { accountId: event.accountId } : {}),
        ...(event.reason ? { reason: event.reason } : {})
      }
    } finally {
      command.cookieHeader = ''
    }
  }

  async grant(
    cookieHeader: string,
    accountId: string,
    accountGeneration: number,
    lifetimeMs = MAX_LEASE_LIFETIME_MS
  ): Promise<ActiveLeaseMetadata> {
    const utilityGeneration = this.transport.currentGeneration()
    if (!utilityGeneration) throw new Error('Utility is unavailable')

    const leaseId = crypto.randomUUID()
    const expiresAt = this.now() + Math.min(Math.max(1_000, lifetimeMs), MAX_LEASE_LIFETIME_MS)
    const command: CredentialControlCommand = {
      kind: 'auth.lease.grant',
      requestId: crypto.randomUUID(),
      leaseId,
      accountId,
      accountGeneration,
      expiresAt,
      cookieHeader
    }
    try {
      const event = await this.request(command, 5_000)
      if (event.kind !== 'auth.lease.ack' || !event.accepted || event.leaseId !== leaseId) {
        throw new Error('Utility rejected the credential lease')
      }
    } finally {
      command.cookieHeader = ''
    }

    const metadata = {
      leaseId,
      accountId,
      accountGeneration,
      utilityGeneration,
      expiresAt
    }
    this.setActiveLease(metadata)
    return metadata
  }

  async revoke(
    reason: Extract<CredentialControlCommand, { kind: 'auth.lease.revoke' }>['reason']
  ): Promise<void> {
    const lease = this.activeLease
    this.clearActiveLease()
    if (!this.transport.currentGeneration()) return

    const command: CredentialControlCommand = {
      kind: 'auth.lease.revoke',
      requestId: crypto.randomUUID(),
      ...(lease ? { leaseId: lease.leaseId } : {}),
      reason
    }
    try {
      await this.request(command, 5_000)
    } catch {
      // Process exit is itself a hard memory revocation boundary.
    }
  }

  async logout(): Promise<boolean> {
    const lease = this.currentLease()
    if (!lease) return false
    this.clearActiveLease()
    const command: CredentialControlCommand = {
      kind: 'auth.logout',
      requestId: crypto.randomUUID(),
      leaseId: lease.leaseId,
      accountGeneration: lease.accountGeneration
    }
    try {
      const event = await this.request(command, 20_000)
      return event.kind === 'auth.logout-result' && event.remoteAccepted
    } catch {
      return false
    }
  }

  currentLease(): ActiveLeaseMetadata | undefined {
    if (!this.activeLease || this.activeLease.expiresAt <= this.now()) {
      this.clearActiveLease()
      return undefined
    }
    return { ...this.activeLease }
  }

  shutdown(): void {
    this.unsubscribeMessage()
    this.unsubscribeStatus()
    this.reclaimAfterUtilityExit()
  }

  private request(
    command: CredentialControlCommand,
    timeoutMs: number
  ): Promise<CredentialControlEvent> {
    const utilityGeneration = this.transport.currentGeneration()
    if (!utilityGeneration) return Promise.reject(new Error('Utility is unavailable'))

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.requestId)
        reject(new Error('Utility credential control timed out'))
      }, timeoutMs)
      this.pending.set(command.requestId, { utilityGeneration, resolve, reject, timer })
      if (!this.transport.postControl(command)) {
        clearTimeout(timer)
        this.pending.delete(command.requestId)
        reject(new Error('Utility is unavailable'))
      }
    })
  }

  private handleMessage(message: unknown): void {
    const parsed = CredentialControlEventSchema.safeParse(message)
    if (!parsed.success) return
    const pending = this.pending.get(parsed.data.requestId)
    if (!pending) return
    if (pending.utilityGeneration !== this.transport.currentGeneration()) {
      clearTimeout(pending.timer)
      this.pending.delete(parsed.data.requestId)
      pending.reject(new Error('Utility generation changed during credential control'))
      return
    }
    clearTimeout(pending.timer)
    this.pending.delete(parsed.data.requestId)
    pending.resolve(parsed.data)
  }

  private setActiveLease(metadata: ActiveLeaseMetadata): void {
    this.clearActiveLease()
    this.activeLease = metadata
    this.expiryTimer = setTimeout(
      () => this.clearActiveLease(),
      Math.max(0, metadata.expiresAt - this.now())
    )
  }

  private clearActiveLease(): void {
    this.activeLease = undefined
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = undefined
  }

  private reclaimAfterUtilityExit(): void {
    this.clearActiveLease()
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Utility exited before credential control completed'))
    }
    this.pending.clear()
  }
}
