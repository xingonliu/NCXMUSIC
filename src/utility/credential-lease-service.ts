import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import type {
  CredentialControlCommand,
  CredentialControlEvent
} from '../shared/contracts/credential-lease'

const PROBE_LIFETIME_MS = 30_000
const MAX_LEASE_LIFETIME_MS = 5 * 60 * 1_000

interface NeteaseResponse {
  body?: unknown
}

export interface NeteaseAuthApi {
  login_status(params: { cookie: string; timeout: number }): Promise<NeteaseResponse>
  user_account(params: { cookie: string; timeout: number }): Promise<NeteaseResponse>
  user_detail(params: { cookie: string; timeout: number; uid: string }): Promise<NeteaseResponse>
  logout(params: { cookie: string; timeout: number }): Promise<NeteaseResponse>
}

interface ValidatedProbe {
  fingerprint: string
  accountId: string
  accountGeneration: number
  expiresAt: number
}

interface ActiveLease {
  /** 凭据槽位类型；匿名凭据不能用于写操作。 */
  kind: 'guest' | 'authenticated'
  leaseId: string
  accountId: string
  accountGeneration: number
  expiresAt: number
  secret: Buffer
  expiryTimer: ReturnType<typeof setTimeout>
}

type ApiLoader = () => Promise<NeteaseAuthApi>

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function bodyOf(value: unknown): Record<string, unknown> | undefined {
  const response = record(value)
  return record(response?.['body']) ?? response
}

function numericId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^\d{1,32}$/u.test(value)) return value
  return undefined
}

function accountIdFrom(value: unknown): string | undefined {
  const body = bodyOf(value)
  const data = record(body?.['data'])
  const candidates = [
    record(data?.['account'])?.['id'],
    record(data?.['account'])?.['userId'],
    record(body?.['account'])?.['id'],
    record(body?.['account'])?.['userId'],
    record(data?.['profile'])?.['userId'],
    record(body?.['profile'])?.['userId']
  ]
  for (const candidate of candidates) {
    const id = numericId(candidate)
    if (id) return id
  }
  return undefined
}

/** 从已验证的用户详情中读取安全昵称与头像。 */
function publicProfileFrom(value: unknown): { displayName?: string; avatarUrl?: string } {
  /** 用户详情响应体。 */
  const body = bodyOf(value)
  /** 网易云用户公开资料对象。 */
  const profile = record(body?.['profile']) ?? record(record(body?.['data'])?.['profile'])
  /** 经过长度限制的昵称。 */
  const displayName = typeof profile?.['nickname'] === 'string'
    ? profile['nickname'].trim().slice(0, 80)
    : ''
  /** 经过 URL 校验的头像地址。 */
  const rawAvatarUrl = typeof profile?.['avatarUrl'] === 'string'
    ? profile['avatarUrl'].trim()
    : ''
  /** 可安全公开的头像地址。 */
  const avatarUrl = rawAvatarUrl && URL.canParse(rawAvatarUrl) ? rawAvatarUrl : undefined
  return {
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {})
  }
}

function responseCode(value: unknown): number | undefined {
  const body = bodyOf(value)
  const data = record(body?.['data'])
  const raw = body?.['code'] ?? data?.['code']
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && /^-?\d+$/u.test(raw)) return Number(raw)
  return undefined
}

function explicitlyMissingAccount(value: unknown): boolean {
  const body = bodyOf(value)
  const data = record(body?.['data'])
  if (responseCode(value) !== 200) return false
  return (
    body?.['account'] === null ||
    body?.['profile'] === null ||
    data?.['account'] === null ||
    data?.['profile'] === null
  )
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function defaultApiLoader(): Promise<NeteaseAuthApi> {
  const resourcesPath = process.resourcesPath
  const packagedManifest = resourcesPath
    ? join(resourcesPath, 'app.asar', 'package.json')
    : undefined
  if (packagedManifest && existsSync(packagedManifest)) {
    return createRequire(packagedManifest)(
      '@neteasecloudmusicapienhanced/api'
    ) as NeteaseAuthApi
  }
  const imported = await import('@neteasecloudmusicapienhanced/api')
  return (imported.default ?? imported) as unknown as NeteaseAuthApi
}

async function withoutThirdPartyConsole<T>(operation: () => Promise<T>): Promise<T> {
  const original = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn
  }
  const muted = (): void => {}
  console.debug = muted
  console.error = muted
  console.info = muted
  console.log = muted
  console.warn = muted
  try {
    return await operation()
  } finally {
    console.debug = original.debug
    console.error = original.error
    console.info = original.info
    console.log = original.log
    console.warn = original.warn
  }
}

export class CredentialLeaseService {
  private api: NeteaseAuthApi | undefined
  private validatedProbe: ValidatedProbe | undefined
  private activeLease: ActiveLease | undefined

  constructor(
    private readonly emit: (event: CredentialControlEvent) => void,
    private readonly loadApi: ApiLoader = defaultApiLoader,
    private readonly now: () => number = Date.now
  ) {}

  async handle(command: CredentialControlCommand): Promise<void> {
    if (command.kind === 'auth.session.probe') {
      await this.probe(command)
      return
    }
    if (command.kind === 'auth.lease.grant') {
      this.grant(command)
      return
    }
    if (command.kind === 'auth.guest-lease.grant') {
      this.grantGuest(command)
      return
    }
    if (command.kind === 'auth.lease.revoke') {
      if (
        command.leaseId &&
        this.activeLease &&
        command.leaseId !== this.activeLease.leaseId
      ) {
        this.emit({
          kind: 'auth.lease.ack',
          requestId: command.requestId,
          leaseId: command.leaseId,
          accepted: false
        })
        return
      }
      this.revoke()
      this.emit({
        kind: 'auth.lease.ack',
        requestId: command.requestId,
        ...(command.leaseId ? { leaseId: command.leaseId } : {}),
        accepted: true
      })
      return
    }
    await this.logout(command)
  }

  shutdown(): void {
    this.revoke()
  }

  hasActiveLease(): boolean {
    return Boolean(this.activeLease && this.activeLease.expiresAt > this.now())
  }

  /** 当前是否持有可执行登录写操作的正式账户租约。 */
  hasAuthenticatedLease(): boolean {
    return Boolean(
      this.activeLease &&
      this.activeLease.kind === 'authenticated' &&
      this.activeLease.expiresAt > this.now()
    )
  }

  /**
   * 在持有 Cookie 的租约生命周期内执行一次 API 调用。
   * Cookie 字符串不会离开此方法的调用栈——operation 结束后立即回收引用。
   *
   * @throws 若当前没有活跃租约或租约已过期，抛出 Error
   */
  async executeWithCookie<T>(operation: (cookie: string) => Promise<T>): Promise<T> {
    const lease = this.activeLease
    if (!lease || lease.expiresAt <= this.now()) {
      throw Object.assign(new Error('No active credential lease; cannot execute API call'), {
        code: 'NO_ACTIVE_LEASE'
      })
    }
    // 读取明文仅用于单次调用，不持久化
    return operation(lease.secret.toString('utf8'))
  }

  private async requiredApi(): Promise<NeteaseAuthApi> {
    this.api ??= await this.loadApi()
    return this.api
  }

  private async probe(
    command: Extract<CredentialControlCommand, { kind: 'auth.session.probe' }>
  ): Promise<void> {
    let cookieHeader = command.cookieHeader
    command.cookieHeader = ''
    try {
      const api = await withoutThirdPartyConsole(() => this.requiredApi())
      const status = await withoutThirdPartyConsole(() =>
        api.login_status({ cookie: cookieHeader, timeout: 15_000 })
      )
      let accountId = accountIdFrom(status)
      let account: NeteaseResponse | undefined
      if (!accountId) {
        account = await withoutThirdPartyConsole(() =>
          api.user_account({ cookie: cookieHeader, timeout: 15_000 })
        )
        accountId = accountIdFrom(account)
      }
      if (!accountId) {
        this.validatedProbe = undefined
        const missing = explicitlyMissingAccount(status) || explicitlyMissingAccount(account)
        this.emit({
          kind: 'auth.session.probe-result',
          requestId: command.requestId,
          valid: false,
          detailVerified: false,
          reason: missing ? 'missing-account' : 'remote-unavailable'
        })
        return
      }

      const detail = await withoutThirdPartyConsole(() =>
        api.user_detail({ cookie: cookieHeader, timeout: 15_000, uid: accountId })
      )
      const detailVerified = responseCode(detail) === 200 && accountIdFrom(detail) === accountId
      if (!detailVerified) {
        this.validatedProbe = undefined
        this.emit({
          kind: 'auth.session.probe-result',
          requestId: command.requestId,
          valid: false,
          detailVerified: false,
          reason: 'remote-unavailable'
        })
        return
      }

      this.validatedProbe = {
        fingerprint: fingerprint(cookieHeader),
        accountId,
        accountGeneration: command.accountGeneration,
        expiresAt: this.now() + PROBE_LIFETIME_MS
      }
      this.emit({
        kind: 'auth.session.probe-result',
        requestId: command.requestId,
        valid: true,
        accountId,
        detailVerified: true,
        ...publicProfileFrom(detail),
        reason: 'authenticated'
      })
    } catch {
      this.validatedProbe = undefined
      this.emit({
        kind: 'auth.session.probe-result',
        requestId: command.requestId,
        valid: false,
        detailVerified: false,
        reason: 'remote-unavailable'
      })
    } finally {
      cookieHeader = ''
    }
  }

  private grant(command: Extract<CredentialControlCommand, { kind: 'auth.lease.grant' }>): void {
    const probe = this.validatedProbe
    const now = this.now()
    const accepted = Boolean(
      probe &&
        probe.expiresAt > now &&
        probe.fingerprint === fingerprint(command.cookieHeader) &&
        probe.accountId === command.accountId &&
        probe.accountGeneration === command.accountGeneration &&
        command.expiresAt > now &&
        command.expiresAt - now <= MAX_LEASE_LIFETIME_MS
    )
    this.validatedProbe = undefined
    if (!accepted) {
      command.cookieHeader = ''
      this.emit({
        kind: 'auth.lease.ack',
        requestId: command.requestId,
        accepted: false
      })
      return
    }

    this.revoke()
    const secret = Buffer.from(command.cookieHeader, 'utf8')
    command.cookieHeader = ''
    const expiryTimer = setTimeout(() => this.revoke(), command.expiresAt - now)
    this.activeLease = {
      kind: 'authenticated',
      leaseId: command.leaseId,
      accountId: command.accountId,
      accountGeneration: command.accountGeneration,
      expiresAt: command.expiresAt,
      secret,
      expiryTimer
    }
    this.emit({
      kind: 'auth.lease.ack',
      requestId: command.requestId,
      leaseId: command.leaseId,
      accepted: true
    })
  }

  /** 接受 Main 从独立持久匿名 Session 发放的游客租约。 */
  private grantGuest(
    command: Extract<CredentialControlCommand, { kind: 'auth.guest-lease.grant' }>
  ): void {
    /** 当前时间戳，用于验证匿名租约边界。 */
    const now = this.now()
    /** 匿名 Cookie 必须只包含可识别的 MUSIC_A，且继续受五分钟租约约束。 */
    const accepted =
      command.expiresAt > now &&
      command.expiresAt - now <= MAX_LEASE_LIFETIME_MS &&
      /(?:^|;\s*)MUSIC_A=[^;\s]{16,4096}(?:;|$)/u.test(command.cookieHeader)
    if (!accepted) {
      command.cookieHeader = ''
      this.emit({
        kind: 'auth.lease.ack',
        requestId: command.requestId,
        accepted: false
      })
      return
    }

    this.revoke()
    /** 仅保存在 Utility 内存中的匿名凭据缓冲区。 */
    const secret = Buffer.from(command.cookieHeader, 'utf8')
    command.cookieHeader = ''
    /** 到期后主动清零匿名凭据的计时器。 */
    const expiryTimer = setTimeout(() => this.revoke(), command.expiresAt - now)
    this.activeLease = {
      kind: 'guest',
      leaseId: command.leaseId,
      accountId: command.accountId,
      accountGeneration: command.accountGeneration,
      expiresAt: command.expiresAt,
      secret,
      expiryTimer
    }
    this.emit({
      kind: 'auth.lease.ack',
      requestId: command.requestId,
      leaseId: command.leaseId,
      accepted: true
    })
  }

  private async logout(
    command: Extract<CredentialControlCommand, { kind: 'auth.logout' }>
  ): Promise<void> {
    const lease = this.activeLease
    if (
      !lease ||
      lease.kind !== 'authenticated' ||
      lease.leaseId !== command.leaseId ||
      lease.accountGeneration !== command.accountGeneration ||
      lease.expiresAt <= this.now()
    ) {
      this.emit({
        kind: 'auth.control-failure',
        requestId: command.requestId,
        code: 'LEASE_MISMATCH'
      })
      return
    }

    let remoteAccepted: boolean
    try {
      const api = await withoutThirdPartyConsole(() => this.requiredApi())
      const response = await withoutThirdPartyConsole(() =>
        api.logout({ cookie: lease.secret.toString('utf8'), timeout: 15_000 })
      )
      remoteAccepted = responseCode(response) === 200
    } catch {
      remoteAccepted = false
    } finally {
      this.revoke()
    }
    this.emit({
      kind: 'auth.logout-result',
      requestId: command.requestId,
      remoteAccepted
    })
  }

  private revoke(): void {
    this.validatedProbe = undefined
    const lease = this.activeLease
    this.activeLease = undefined
    if (!lease) return
    clearTimeout(lease.expiryTimer)
    lease.secret.fill(0)
  }
}
