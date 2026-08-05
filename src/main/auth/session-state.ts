import { createHash } from 'node:crypto'

export type AuthSessionState = 'guest' | 'authenticating' | 'authenticated' | 'expired'

export interface AuthSessionSnapshot {
  state: AuthSessionState
  accountGeneration: number
  hasCredentialLease: boolean
  accountFingerprint?: string
}

export class AuthSessionMachine {
  private state: AuthSessionState = 'guest'
  private accountGeneration = 0
  private accountId: string | undefined
  private hasCredentialLease = false

  beginLogin(accountSwitch = false): AuthSessionSnapshot {
    if (accountSwitch || this.state === 'authenticated') {
      this.accountGeneration = Math.max(1, this.accountGeneration + 1)
      this.accountId = undefined
      this.hasCredentialLease = false
    }
    this.state = 'authenticating'
    return this.snapshot()
  }

  acceptAccount(accountId: string): AuthSessionSnapshot {
    if (this.accountId && this.accountId !== accountId) {
      this.accountGeneration += 1
      this.hasCredentialLease = false
    }
    this.accountGeneration = Math.max(1, this.accountGeneration)
    this.accountId = accountId
    this.state = 'authenticated'
    return this.snapshot()
  }

  markLeaseActive(active: boolean): AuthSessionSnapshot {
    this.hasCredentialLease = active && this.state === 'authenticated'
    return this.snapshot()
  }

  expire(): AuthSessionSnapshot {
    this.accountGeneration = Math.max(1, this.accountGeneration + 1)
    this.accountId = undefined
    this.hasCredentialLease = false
    this.state = 'expired'
    return this.snapshot()
  }

  logout(): AuthSessionSnapshot {
    if (this.state !== 'guest' || this.accountId || this.hasCredentialLease) {
      this.accountGeneration = Math.max(1, this.accountGeneration + 1)
    }
    this.accountId = undefined
    this.hasCredentialLease = false
    this.state = 'guest'
    return this.snapshot()
  }

  closeLoginWindow(): AuthSessionSnapshot {
    if (this.state === 'authenticating') {
      this.state = 'guest'
    }
    return this.snapshot()
  }

  currentAccountId(): string | undefined {
    return this.accountId
  }

  currentGeneration(): number {
    return Math.max(1, this.accountGeneration)
  }

  snapshot(): AuthSessionSnapshot {
    return {
      state: this.state,
      accountGeneration: this.accountGeneration,
      hasCredentialLease: this.hasCredentialLease,
      ...(this.accountId
        ? {
            accountFingerprint: createHash('sha256')
              .update(this.accountId)
              .digest('hex')
              .slice(0, 12)
          }
        : {})
    }
  }
}
