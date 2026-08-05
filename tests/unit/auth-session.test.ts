import type { Cookie, Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import {
  CookieSessionRepository,
  isNeteaseAuthCookie,
  serializeCookieHeader
} from '../../src/main/auth/cookie-session-repository'
import {
  isAllowedLoginNavigation,
  isSafeExternalNavigation
} from '../../src/main/auth/navigation-policy'
import { AuthSessionMachine } from '../../src/main/auth/session-state'
import { redactSensitiveText } from '../../src/shared/errors/redact-sensitive-text'

function cookie(overrides: Partial<Cookie>): Cookie {
  return {
    name: 'NMTID',
    value: 'public-fixture',
    domain: '.music.163.com',
    hostOnly: false,
    path: '/',
    secure: true,
    httpOnly: true,
    session: false,
    sameSite: 'unspecified',
    ...overrides
  }
}

function fakeSession(cookies: Cookie[]): {
  session: Session
  remove: ReturnType<typeof vi.fn>
  flushStore: ReturnType<typeof vi.fn>
} {
  const remove = vi.fn(async () => {})
  const flushStore = vi.fn(async () => {})
  return {
    session: {
      cookies: {
        get: vi.fn(async () => cookies),
        remove,
        flushStore
      }
    } as unknown as Session,
    remove,
    flushStore
  }
}

describe('auth session state', () => {
  it('invalidates generations and leases on switch, expiry, and logout', () => {
    const machine = new AuthSessionMachine()
    expect(machine.snapshot()).toEqual({
      state: 'logged_out',
      accountGeneration: 0,
      hasCredentialLease: false
    })

    machine.beginLogin()
    machine.markLoginWindowReady()
    machine.beginValidation()
    machine.acceptAccount('10001')
    expect(machine.markLeaseActive(true)).toMatchObject({
      state: 'authenticated',
      accountGeneration: 1,
      hasCredentialLease: true
    })

    expect(machine.beginLogin(true)).toMatchObject({
      state: 'opening_official_login',
      accountGeneration: 2,
      hasCredentialLease: false
    })
    machine.acceptAccount('20002')
    machine.markLeaseActive(true)
    expect(machine.expire()).toMatchObject({
      state: 'session_expired',
      accountGeneration: 3,
      hasCredentialLease: false
    })
    expect(machine.logout()).toMatchObject({ state: 'logged_out', hasCredentialLease: false })
  })

  it('uses an explicit cancelled state when the login window closes', () => {
    const machine = new AuthSessionMachine()
    machine.beginLogin()
    machine.markLoginWindowReady()
    expect(machine.cancelLogin().state).toBe('cancelled')
  })
})

describe('login navigation policy', () => {
  it('only allows HTTPS NetEase login hosts internally', () => {
    expect(isAllowedLoginNavigation('https://music.163.com/')).toBe(true)
    expect(isAllowedLoginNavigation('https://interface.music.163.com/path')).toBe(true)
    expect(isAllowedLoginNavigation('https://passport.163.com/path')).toBe(true)
    expect(isAllowedLoginNavigation('http://music.163.com/')).toBe(false)
    expect(isAllowedLoginNavigation('https://music.163.com.example.test/')).toBe(false)
    expect(isAllowedLoginNavigation('file:///tmp/index.html')).toBe(false)
  })

  it('only hands non-NetEase HTTPS links to the system browser', () => {
    expect(isSafeExternalNavigation('https://example.com/help')).toBe(true)
    expect(isSafeExternalNavigation('https://music.163.com/help')).toBe(false)
    expect(isSafeExternalNavigation('mailto:test@example.com')).toBe(false)
  })
})

describe('persistent cookie repository', () => {
  it('recognizes a structurally valid credential and serializes the isolated set', async () => {
    const cookies = [
      cookie({ name: 'MUSIC_U', value: 'x'.repeat(96) }),
      cookie({ name: '__remember_me', value: 'true', session: true }),
      cookie({ name: 'outside', domain: '.example.com' })
    ]
    const fake = fakeSession(cookies)
    const inspection = await new CookieSessionRepository(fake.session).inspect()
    expect(inspection).toMatchObject({
      kind: 'credential',
      cookieCount: 2,
      persistentCookieCount: 1
    })
    if (inspection.kind === 'credential') {
      expect(inspection.cookieHeader).toBe(serializeCookieHeader(cookies.slice(0, 2)))
      expect(inspection.cookieHeader).not.toContain('outside')
    }
  })

  it('distinguishes guest and invalid cookies and removes only the isolated set', async () => {
    const guest = fakeSession([cookie({ name: 'NMTID' })])
    expect(await new CookieSessionRepository(guest.session).inspect()).toMatchObject({
      kind: 'guest'
    })

    const invalid = fakeSession([
      cookie({ name: 'MUSIC_U', value: 'short' }),
      cookie({ name: 'outside', domain: '.example.com' })
    ])
    const repository = new CookieSessionRepository(invalid.session)
    expect(await repository.inspect()).toMatchObject({ kind: 'invalid' })
    await repository.clear()
    expect(invalid.remove).toHaveBeenCalledTimes(1)
    expect(invalid.flushStore).toHaveBeenCalledOnce()
  })

  it('does not classify lookalike domains as credential owners', () => {
    expect(isNeteaseAuthCookie(cookie({ domain: '.music.163.com' }))).toBe(true)
    expect(isNeteaseAuthCookie(cookie({ domain: '.passport.163.com' }))).toBe(true)
    expect(isNeteaseAuthCookie(cookie({ domain: '.music.163.com.example.test' }))).toBe(false)
  })
})

describe('credential redaction', () => {
  it('removes cookie headers, JSON fields, and named secrets from log text', () => {
    const output = redactSensitiveText(
      'Cookie: alpha=one; MUSIC_U=secret-token\n{"cookieHeader":"alpha=one; beta=two"}'
    )
    expect(output).not.toContain('secret-token')
    expect(output).not.toContain('alpha=one')
    expect(output).not.toContain('beta=two')
    expect(output).toContain('[REDACTED]')
  })
})
