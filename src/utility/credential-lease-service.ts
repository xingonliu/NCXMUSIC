import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import type {
  CredentialControlCommand,
  CredentialControlEvent
} from '../shared/contracts/credential-lease'

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

function accountIdFrom(value: unknown): string | undefined {
  const response = record(value)
  const body = record(response?.body)
  const data = record(body?.data)
  const account = record(data?.account) ?? record(body?.account)
  const id = account?.id ?? account?.userId
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
    return String(id)
  }
  if (typeof id === 'string' && /^\d{1,32}$/u.test(id)) {
    return id
  }
  return undefined
}

function responseCode(value: unknown): number | undefined {
  const response = record(value)
  const body = record(response?.body)
  const data = record(body?.data)
  const code = body?.code ?? data?.code
  return typeof code === 'number' ? code : undefined
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function defaultApiLoader(): Promise<NeteaseAuthApi> {
  const packagedManifest = join(process.resourcesPath, 'app.asar', 'package.json')
  if (existsSync(packagedManifest)) {
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
    if (command.kind === 'auth.lease.revoke') {
      this.revoke()
      this.emit({
        kind: 'auth.lease.ack',
        requestId: command.requestId,
        accepted: true
      })
      return
    }
    await this.logout(command)
  }

  shutdown(): void {
    this.revoke()
    this.validatedProbe = undefined
  }

  hasActiveLease(): boolean {
    return Boolean(this.activeLease && this.activeLease.expiresAt > this.now())
  }

  private async requiredApi(): Promise<NeteaseAuthApi> {
    this.api ??= await this.loadApi()
    return this.api
  }

  private async probe(command: Extract<CredentialControlCommand, { kind: 'auth.session.probe' }>): Promise<void> {
    const cookieHeader = command.cookieHeader
    command.cookieHeader = ''
    try {
      const api = await withoutThirdPartyConsole(() => this.requiredApi())
      const status = await withoutThirdPartyConsole(() =>
        api.login_status({ cookie: cookieHeader, timeout: 15_000 })
      )
      let accountId = accountIdFrom(status)
      if (!accountId) {
        const account = await withoutThirdPartyConsole(() =>
          api.user_account({ cookie: cookieHeader, timeout: 15_000 })
        )
        accountId = accountIdFrom(account)
      }
      if (!accountId) {
        this.validatedProbe = undefined
        this.emit({
          kind: 'auth.session.probe-result',
          requestId: command.requestId,
          valid: false,
          detailVerified: false,
          reason: 'missing-account'
        })
        return
      }

      const detail = await withoutThirdPartyConsole(() =>
        api.user_detail({ cookie: cookieHeader, timeout: 15_000, uid: accountId })
      )
      const detailVerified = responseCode(detail) === 200
      this.validatedProbe = {
        fingerprint: fingerprint(cookieHeader),
        accountId,
        accountGeneration: command.accountGeneration,
        expiresAt: this.now() + 30_000
      }
      this.emit({
        kind: 'auth.session.probe-result',
        requestId: command.requestId,
        valid: true,
        accountId,
        detailVerified,
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
    }
  }

  private grant(command: Extract<CredentialControlCommand, { kind: 'auth.lease.grant' }>): void {
    const probe = this.validatedProbe
    const accepted = Boolean(
      probe &&
        probe.expiresAt > this.now() &&
        probe.fingerprint === fingerprint(command.cookieHeader) &&
        probe.accountId === command.accountId &&
        probe.accountGeneration === command.accountGeneration &&
        command.expiresAt > this.now()
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
    const expiryTimer = setTimeout(() => this.revoke(), command.expiresAt - this.now())
    this.activeLease = {
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

  private async logout(command: Extract<CredentialControlCommand, { kind: 'auth.logout' }>): Promise<void> {
    const lease = this.activeLease
    if (
      !lease ||
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
    const lease = this.activeLease
    this.activeLease = undefined
    if (!lease) return
    clearTimeout(lease.expiryTimer)
    lease.secret.fill(0)
  }
}
