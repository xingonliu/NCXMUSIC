import { createHash } from 'node:crypto'

export type AuthSessionState =
  | 'logged_out'
  | 'opening_official_login'
  | 'waiting_for_cookie'
  | 'validating_cookie'
  | 'authenticated'
  | 'session_expired'
  | 'validation_failed'
  | 'cancelled'

export interface AuthSessionSnapshot {
  state: AuthSessionState
  accountGeneration: number
  hasCredentialLease: boolean
  accountFingerprint?: string
}

export class AuthSessionMachine {
  private state: AuthSessionState = 'logged_out'
  private accountGeneration = 0
  private accountId: string | undefined
  private hasCredentialLease = false

  beginLogin(accountSwitch = false): AuthSessionSnapshot {
    if (accountSwitch || this.state === 'authenticated') {
      this.advanceGeneration()
      this.accountId = undefined
      this.hasCredentialLease = false
    }
    this.state = 'opening_official_login'
    return this.snapshot()
  }

  markLoginWindowReady(): AuthSessionSnapshot {
    if (this.state === 'opening_official_login') this.state = 'waiting_for_cookie'
    return this.snapshot()
  }

  beginValidation(): AuthSessionSnapshot {
    this.state = 'validating_cookie'
    this.hasCredentialLease = false
    return this.snapshot()
  }

  acceptAccount(accountId: string): AuthSessionSnapshot {
    if (this.accountId && this.accountId !== accountId) this.advanceGeneration()
    this.accountGeneration = Math.max(1, this.accountGeneration)
    this.accountId = accountId
    this.state = 'authenticated'
    return this.snapshot()
  }

  markLeaseActive(active: boolean): AuthSessionSnapshot {
    this.hasCredentialLease = active && this.state === 'authenticated'
    return this.snapshot()
  }

  markValidationFailed(): AuthSessionSnapshot {
    this.state = 'validation_failed'
    this.hasCredentialLease = false
    return this.snapshot()
  }

  expire(): AuthSessionSnapshot {
    this.advanceGeneration()
    this.accountId = undefined
    this.hasCredentialLease = false
    this.state = 'session_expired'
    return this.snapshot()
  }

  logout(): AuthSessionSnapshot {
    if (this.accountId || this.hasCredentialLease || this.state === 'authenticated') {
      this.advanceGeneration()
    }
    this.accountId = undefined
    this.hasCredentialLease = false
    this.state = 'logged_out'
    return this.snapshot()
  }

  cancelLogin(): AuthSessionSnapshot {
    if (
      this.state === 'opening_official_login' ||
      this.state === 'waiting_for_cookie' ||
      this.state === 'validating_cookie' ||
      this.state === 'validation_failed'
    ) {
      this.state = 'cancelled'
      this.hasCredentialLease = false
    }
    return this.snapshot()
  }

  currentGeneration(): number {
    return Math.max(1, this.accountGeneration)
  }

  /** 返回当前通过验证的网易云账户 ID；未登录时为空。 */
  currentAccountId(): string | undefined {
    return this.accountId
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

  private advanceGeneration(): void {
    this.accountGeneration = Math.max(1, this.accountGeneration + 1)
  }
}
