import type { Session } from 'electron'

import type { RuntimeStatus } from '../../shared/contracts/control-plane'
import { createAuthWindow, type AuthWindowHandle } from './auth-window'
import { CookieSessionRepository, type CredentialInspection } from './cookie-session-repository'
import type { CredentialLeaseCoordinator } from './credential-lease-coordinator'
import { AuthSessionMachine, type AuthSessionSnapshot } from './session-state'

export type EstablishSource = 'startup' | 'login-window' | 'utility-restart'

export interface EstablishResult {
  source: EstablishSource
  outcome: 'guest' | 'authenticated' | 'invalid' | 'remote-unavailable'
  snapshot: AuthSessionSnapshot
  cookieCount: number
  persistentCookieCount?: number
  detailVerified?: boolean
}

export class AuthSessionController {
  private readonly repository: CookieSessionRepository
  private readonly machine = new AuthSessionMachine()
  private authWindow: AuthWindowHandle | undefined
  private establishPromise: Promise<EstablishResult> | undefined
  private cookieDebounce: ReturnType<typeof setTimeout> | undefined
  private resultListener: ((result: EstablishResult) => void) | undefined
  private windowClosedListener: (() => void) | undefined

  constructor(
    private readonly electronSession: Session,
    private readonly coordinator: CredentialLeaseCoordinator
  ) {
    this.repository = new CookieSessionRepository(electronSession)
  }

  onResult(listener: (result: EstablishResult) => void): void {
    this.resultListener = listener
  }

  onLoginWindowClosed(listener: () => void): void {
    this.windowClosedListener = listener
  }

  restore(source: EstablishSource = 'startup'): Promise<EstablishResult> {
    if (!this.establishPromise) {
      this.establishPromise = this.establish(source).finally(() => {
        this.establishPromise = undefined
      })
    }
    return this.establishPromise
  }

  openLogin(accountSwitch = false): void {
    if (this.authWindow && !this.authWindow.window.isDestroyed()) {
      this.authWindow.window.focus()
      return
    }
    this.machine.beginLogin(accountSwitch)
    this.authWindow = createAuthWindow(
      this.electronSession,
      () => this.scheduleCookieInspection(),
      () => {
        this.authWindow = undefined
        this.machine.closeLoginWindow()
        this.windowClosedListener?.()
      }
    )
  }

  async prepareAccountSwitch(): Promise<AuthSessionSnapshot> {
    this.machine.beginLogin(true)
    await this.coordinator.revoke('account-switch')
    await this.repository.clear()
    return this.machine.snapshot()
  }

  async logout(): Promise<{ remoteAccepted: boolean; snapshot: AuthSessionSnapshot }> {
    const remoteAccepted = await this.coordinator.logout()
    await this.repository.clear()
    return { remoteAccepted, snapshot: this.machine.logout() }
  }

  async handleUtilityStatus(status: RuntimeStatus): Promise<void> {
    if (status.state !== 'ready') {
      this.machine.markLeaseActive(false)
      return
    }
    if (this.machine.snapshot().state === 'authenticated' && !this.coordinator.currentLease()) {
      try {
        await this.restore('utility-restart')
      } catch {
        this.machine.markLeaseActive(false)
      }
    }
  }

  snapshot(): AuthSessionSnapshot {
    return this.machine.snapshot()
  }

  closeLoginWindow(): void {
    const handle = this.authWindow
    this.authWindow = undefined
    if (handle && !handle.window.isDestroyed()) {
      handle.window.close()
    }
  }

  shutdown(): void {
    if (this.cookieDebounce) clearTimeout(this.cookieDebounce)
    this.closeLoginWindow()
    this.coordinator.shutdown()
  }

  private async establish(source: EstablishSource): Promise<EstablishResult> {
    await this.repository.flush()
    const inspection = await this.repository.inspect()
    if (inspection.kind === 'guest') {
      const result = {
        source,
        outcome: 'guest' as const,
        snapshot: this.machine.logout(),
        cookieCount: inspection.cookieCount
      }
      this.resultListener?.(result)
      return result
    }
    if (inspection.kind === 'invalid') {
      await this.invalidate(inspection)
      const result = {
        source,
        outcome: 'invalid' as const,
        snapshot: this.machine.snapshot(),
        cookieCount: inspection.cookieCount
      }
      this.resultListener?.(result)
      return result
    }

    const generation = this.machine.currentGeneration()
    const probe = await this.coordinator.probe(inspection.cookieHeader, generation)
    if (!probe.valid || !probe.accountId) {
      if (probe.reason === 'remote-unavailable') {
        const result = this.safeResult(source, 'remote-unavailable', inspection, false)
        this.resultListener?.(result)
        return result
      }
      await this.invalidate(inspection)
      const result = this.safeResult(source, 'invalid', inspection, false)
      this.resultListener?.(result)
      return result
    }

    const accepted = this.machine.acceptAccount(probe.accountId)
    await this.coordinator.grant(
      inspection.cookieHeader,
      probe.accountId,
      accepted.accountGeneration
    )
    this.machine.markLeaseActive(true)
    const result = this.safeResult(source, 'authenticated', inspection, probe.detailVerified)
    this.resultListener?.(result)
    if (source === 'login-window') this.closeLoginWindow()
    return result
  }

  private safeResult(
    source: EstablishSource,
    outcome: EstablishResult['outcome'],
    inspection: Extract<CredentialInspection, { kind: 'credential' }>,
    detailVerified: boolean
  ): EstablishResult {
    return {
      source,
      outcome,
      snapshot: this.machine.snapshot(),
      cookieCount: inspection.cookieCount,
      persistentCookieCount: inspection.persistentCookieCount,
      detailVerified
    }
  }

  private async invalidate(inspection: CredentialInspection): Promise<void> {
    if (inspection.kind === 'credential') inspection.cookieHeader = ''
    await this.coordinator.revoke('expired')
    await this.repository.clear()
    this.machine.expire()
  }

  private scheduleCookieInspection(): void {
    if (this.cookieDebounce) clearTimeout(this.cookieDebounce)
    this.cookieDebounce = setTimeout(() => {
      this.cookieDebounce = undefined
      void this.restore('login-window').catch(() => {
        this.machine.markLeaseActive(false)
      })
    }, 500)
  }
}
