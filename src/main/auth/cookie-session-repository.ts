import type { Cookie, Session } from 'electron'

import { isNeteaseLoginHost } from './navigation-policy'

export interface CredentialMaterial {
  cookieHeader: string
  cookieCount: number
  persistentCookieCount: number
}

export type CredentialInspection =
  | { kind: 'guest'; cookieCount: number }
  | { kind: 'invalid'; cookieCount: number }
  | ({ kind: 'credential' } & CredentialMaterial)

function normalizedDomain(cookie: Pick<Cookie, 'domain'>): string {
  return cookie.domain?.replace(/^\./u, '').toLowerCase() ?? ''
}

export function isNeteaseAuthCookie(cookie: Pick<Cookie, 'domain'>): boolean {
  const domain = normalizedDomain(cookie)
  return domain === '163.com' || isNeteaseLoginHost(domain)
}

export function serializeCookieHeader(cookies: Cookie[]): string {
  return [...cookies]
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name)
      if (byName !== 0) return byName
      const byDomain = normalizedDomain(left).localeCompare(normalizedDomain(right))
      if (byDomain !== 0) return byDomain
      return (right.path ?? '/').length - (left.path ?? '/').length
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
}

export function structurallyValidMusicU(value: string): boolean {
  return value.length >= 32 && value.length <= 4_096 && !/[\s;\0]/u.test(value)
}

function cookieRemovalUrl(cookie: Cookie): string {
  const scheme = cookie.secure ? 'https:' : 'http:'
  const domain = normalizedDomain(cookie)
  const path = cookie.path?.startsWith('/') ? cookie.path : '/'
  return `${scheme}//${domain}${path}`
}

export class CookieSessionRepository {
  constructor(private readonly electronSession: Session) {}

  async inspect(): Promise<CredentialInspection> {
    const cookies = (await this.electronSession.cookies.get({})).filter(isNeteaseAuthCookie)
    const credential = cookies.find(
      (cookie) => cookie.name === 'MUSIC_U' && normalizedDomain(cookie).endsWith('163.com')
    )
    if (!credential) return { kind: 'guest', cookieCount: cookies.length }
    if (!structurallyValidMusicU(credential.value)) {
      return { kind: 'invalid', cookieCount: cookies.length }
    }
    return {
      kind: 'credential',
      cookieHeader: serializeCookieHeader(cookies),
      cookieCount: cookies.length,
      persistentCookieCount: cookies.filter((cookie) => !cookie.session).length
    }
  }

  async clear(): Promise<void> {
    const cookies = (await this.electronSession.cookies.get({})).filter(isNeteaseAuthCookie)
    await Promise.all(
      cookies.map((cookie) =>
        this.electronSession.cookies.remove(cookieRemovalUrl(cookie), cookie.name)
      )
    )
    await this.electronSession.cookies.flushStore()
  }

  async flush(): Promise<void> {
    await this.electronSession.cookies.flushStore()
  }
}
