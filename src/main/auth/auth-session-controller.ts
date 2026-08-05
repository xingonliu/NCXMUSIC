import type { Session } from 'electron'

import type { RuntimeStatus } from '../../shared/contracts/control-plane'
import type { AuthWindowHandle } from './auth-window'
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

  async openLogin(accountSwitch = false): Promise<void> {
    if (this.authWindow && !this.authWindow.window.isDestroyed()) {
      this.authWindow.window.focus()
      return
    }
    if (accountSwitch) {
      await this.prepareAccountSwitch()
    } else {
      this.machine.beginLogin()
    }
    const { createAuthWindow } = await import('./auth-window')
    this.authWindow = createAuthWindow(
      this.electronSession,
      () => this.scheduleCookieInspection(),
      () => this.machine.markLoginWindowReady(),
      () => {
        this.authWindow = undefined
        this.machine.cancelLogin()
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
    const state = this.machine.snapshot().state
    if (
      (state === 'authenticated' || state === 'validation_failed') &&
      !this.coordinator.currentLease()
    ) {
      try {
        await this.restore('utility-restart')
      } catch {
        this.machine.markValidationFailed()
      }
    }
  }

  snapshot(): AuthSessionSnapshot {
    return this.machine.snapshot()
  }

  closeLoginWindow(): void {
    const handle = this.authWindow
    this.authWindow = undefined
    if (handle && !handle.window.isDestroyed()) handle.window.close()
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
      const snapshot =
        source === 'utility-restart' && this.machine.snapshot().state === 'authenticated'
          ? this.machine.expire()
          : this.machine.logout()
      return this.publish({
        source,
        outcome: 'guest',
        snapshot,
        cookieCount: inspection.cookieCount
      })
    }
    if (inspection.kind === 'invalid') {
      await this.invalidate(inspection)
      return this.publish({
        source,
        outcome: 'invalid',
        snapshot: this.machine.snapshot(),
        cookieCount: inspection.cookieCount
      })
    }

    this.machine.beginValidation()
    const cookieHeader = inspection.cookieHeader
    try {
      const probe = await this.coordinator.probe(cookieHeader, this.machine.currentGeneration())
      if (!probe.valid || !probe.accountId) {
        if (probe.reason === 'remote-unavailable') {
          this.machine.markValidationFailed()
          return this.publish(this.safeResult(source, 'remote-unavailable', inspection, false))
        }
        await this.invalidate(inspection)
        return this.publish(this.safeResult(source, 'invalid', inspection, false))
      }

      const accepted = this.machine.acceptAccount(probe.accountId)
      try {
        await this.coordinator.grant(
          cookieHeader,
          probe.accountId,
          accepted.accountGeneration
        )
      } catch {
        this.machine.markValidationFailed()
        return this.publish(this.safeResult(source, 'remote-unavailable', inspection, false))
      }
      this.machine.markLeaseActive(true)
      const result = this.publish(
        this.safeResult(source, 'authenticated', inspection, probe.detailVerified)
      )
      if (source === 'login-window') this.closeLoginWindow()
      return result
    } finally {
      inspection.cookieHeader = ''
    }
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

  private publish(result: EstablishResult): EstablishResult {
    this.resultListener?.(result)
    return result
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
      void this.restore('login-window').catch(() => this.machine.markValidationFailed())
    }, 500)
  }
}
