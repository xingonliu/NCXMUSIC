import type { Session } from 'electron'

import type { RuntimeStatus } from '../../shared/contracts/control-plane'
import {
  AccountSessionSnapshotSchema,
  type AccountSessionSnapshot
} from '../../shared/schemas/account'
import type { AccountId } from '../../shared/schemas/account'
import type { AnonymousSessionRepository } from './anonymous-session-repository'
import type { AuthWindowHandle } from './auth-window'
import { CookieSessionRepository, type CredentialInspection } from './cookie-session-repository'
import type { CredentialLeaseCoordinator } from './credential-lease-coordinator'
import { AuthSessionMachine, type AuthSessionSnapshot } from './session-state'

export type EstablishSource = 'startup' | 'login-window' | 'utility-restart' | 'lease-renewal'

// ========= 变量 =========

/** 五分钟租约在四分钟时续租，保留一分钟网络抖动余量。 */
const LEASE_RENEWAL_INTERVAL_MS = 4 * 60 * 1_000

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
  private readonly resultListeners = new Set<(result: EstablishResult) => void>()
  private windowClosedListener: (() => void) | undefined
  /** 游客匿名凭据是否已在当前 Utility 中生效。 */
  private guestLeaseActive = false
  /** 当前受控续租计时器。 */
  private renewalTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly electronSession: Session,
    private readonly coordinator: CredentialLeaseCoordinator,
    private readonly anonymousRepository?: AnonymousSessionRepository,
    private readonly prepareAccountSpace: (
      accountId: AccountId,
      accountGeneration: number
    ) => Promise<void> = async () => {}
  ) {
    this.repository = new CookieSessionRepository(electronSession)
  }

  onResult(listener: (result: EstablishResult) => void): () => void {
    this.resultListeners.add(listener)
    return () => this.resultListeners.delete(listener)
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
    this.clearRenewalTimer()
    this.machine.beginLogin(true)
    await this.coordinator.revoke('account-switch')
    this.guestLeaseActive = false
    await this.repository.clear()
    return this.machine.snapshot()
  }

  async logout(): Promise<{ remoteAccepted: boolean; snapshot: AuthSessionSnapshot }> {
    this.clearRenewalTimer()
    const remoteAccepted = await this.coordinator.logout()
    await this.repository.clear()
    const snapshot = this.machine.logout()
    await this.ensureGuestSession().catch(() => undefined)
    return { remoteAccepted, snapshot }
  }

  async handleUtilityStatus(status: RuntimeStatus): Promise<void> {
    if (status.state !== 'ready') {
      this.machine.markLeaseActive(false)
      this.guestLeaseActive = false
      this.clearRenewalTimer()
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
      return
    }
    if (state === 'authenticated') return
    await this.ensureGuestSession()
  }

  snapshot(): AuthSessionSnapshot {
    return this.machine.snapshot()
  }

  publicSnapshot(): AccountSessionSnapshot {
    const snapshot = this.machine.snapshot()
    const accountId = this.machine.currentAccountId()
    const activeAccount = accountId && snapshot.state === 'authenticated'
      ? {
          kind: 'netease' as const,
          accountId: `netease:${accountId}`,
          neteaseUserId: accountId,
          accountFingerprint: snapshot.accountFingerprint ?? '000000000000',
          ...(snapshot.displayName ? { displayName: snapshot.displayName } : {}),
          ...(snapshot.avatarUrl ? { avatarUrl: snapshot.avatarUrl } : {})
        }
      : {
          kind: 'guest' as const,
          accountId: 'guest:local' as const,
          displayName: '游客' as const
        }

    return AccountSessionSnapshotSchema.parse({
      state: snapshot.state,
      accountGeneration: snapshot.accountGeneration,
      hasCredentialLease: snapshot.hasCredentialLease || this.guestLeaseActive,
      activeAccount,
      canLogin: !['opening_official_login', 'waiting_for_cookie', 'validating_cookie'].includes(snapshot.state),
      canLogout: snapshot.state === 'authenticated',
      canSwitchAccount: snapshot.state === 'authenticated',
      canMutateMusic: snapshot.state === 'authenticated' && snapshot.hasCredentialLease,
      rendererCanReadSecrets: false
    })
  }

  closeLoginWindow(): void {
    const handle = this.authWindow
    this.authWindow = undefined
    if (handle && !handle.window.isDestroyed()) handle.window.close()
  }

  shutdown(): void {
    this.clearRenewalTimer()
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
      await this.ensureGuestSession().catch(() => undefined)
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

      const accepted = this.machine.acceptAccount(probe.accountId, {
        ...(probe.displayName ? { displayName: probe.displayName } : {}),
        ...(probe.avatarUrl ? { avatarUrl: probe.avatarUrl } : {})
      })
      try {
        await this.prepareAccountSpace(
          `netease:${probe.accountId}` as AccountId,
          accepted.accountGeneration
        )
        await this.coordinator.grant(
          cookieHeader,
          probe.accountId,
          accepted.accountGeneration
        )
      } catch {
        this.machine.markValidationFailed()
        return this.publish(this.safeResult(source, 'remote-unavailable', inspection, false))
      }
      this.guestLeaseActive = false
      this.machine.markLeaseActive(true)
      this.scheduleRenewal()
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
    for (const listener of this.resultListeners) listener(result)
    return result
  }

  private async invalidate(inspection: CredentialInspection): Promise<void> {
    this.clearRenewalTimer()
    if (inspection.kind === 'credential') inspection.cookieHeader = ''
    await this.coordinator.revoke('expired')
    await this.repository.clear()
    this.machine.expire()
  }

  /** 建立游客账户空间与独立匿名凭据租约。 */
  private async ensureGuestSession(forceRenew = false): Promise<void> {
    if (!this.anonymousRepository) return
    /** 已经生效且尚未过期的游客租约。 */
    const currentLease = this.coordinator.currentLease()
    if (!forceRenew && currentLease?.kind === 'guest') {
      this.guestLeaseActive = true
      this.scheduleRenewal()
      return
    }

    /** 当前游客 generation，启动时允许为零。 */
    const generation = this.machine.snapshot().accountGeneration
    await this.prepareAccountSpace('guest:local', generation)
    /** 从独立持久 Session 恢复或新建的匿名 Cookie Header。 */
    const cookieHeader = await this.anonymousRepository.establish()
    await this.coordinator.grantGuest(cookieHeader, generation)
    this.guestLeaseActive = true
    this.scheduleRenewal()
  }

  /** 安排下一次正式或匿名凭据受控续租。 */
  private scheduleRenewal(): void {
    this.clearRenewalTimer()
    this.renewalTimer = setTimeout(() => {
      this.renewalTimer = undefined
      void this.renewLease()
    }, LEASE_RENEWAL_INTERVAL_MS)
    this.renewalTimer.unref?.()
  }

  /** 重新读取 Main 所有的凭据并向当前 Utility 发放新租约。 */
  private async renewLease(): Promise<void> {
    const snapshot = this.machine.snapshot()
    if (snapshot.state !== 'authenticated') {
      this.guestLeaseActive = false
      await this.ensureGuestSession(true).catch(() => undefined)
      return
    }

    /** Main Session 检查出的正式凭据，用于 finally 清除临时字符串引用。 */
    let inspection: CredentialInspection | undefined
    try {
      /** Main 登录 Session 中的最新正式凭据。 */
      inspection = await this.repository.inspect()
      if (inspection.kind !== 'credential') throw new Error('Credential is unavailable')
      /** 续租前再次验证账户身份与当前 generation。 */
      const probe = await this.coordinator.probe(
        inspection.cookieHeader,
        this.machine.currentGeneration()
      )
      /** 经续租探测确认的正式账户 ID。 */
      const accountId = probe.accountId
      if (!probe.valid || !accountId || accountId !== this.machine.currentAccountId()) {
        throw new Error('Credential renewal probe failed')
      }
      await this.coordinator.grant(
        inspection.cookieHeader,
        accountId,
        this.machine.currentGeneration()
      )
      this.machine.markLeaseActive(true)
      this.scheduleRenewal()
    } catch {
      await this.coordinator.revoke('expired')
      this.machine.expire()
      this.publish({
        source: 'lease-renewal',
        outcome: 'invalid',
        snapshot: this.machine.snapshot(),
        cookieCount: 0
      })
    } finally {
      if (inspection?.kind === 'credential') inspection.cookieHeader = ''
    }
  }

  /** 清除续租计时器。 */
  private clearRenewalTimer(): void {
    if (this.renewalTimer) clearTimeout(this.renewalTimer)
    this.renewalTimer = undefined
  }

  private scheduleCookieInspection(): void {
    if (this.cookieDebounce) clearTimeout(this.cookieDebounce)
    this.cookieDebounce = setTimeout(() => {
      this.cookieDebounce = undefined
      void this.restore('login-window').catch(() => this.machine.markValidationFailed())
    }, 500)
  }
}
