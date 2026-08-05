const INTERNAL_HOSTS = new Set([
  'music.163.com',
  'login.163.com',
  'passport.163.com',
  'reg.163.com'
])

function isInternalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return INTERNAL_HOSTS.has(normalized) || normalized.endsWith('.music.163.com')
}

export function isAllowedLoginNavigation(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && isInternalHost(url.hostname)
  } catch {
    return false
  }
}

export function isSafeExternalNavigation(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !isInternalHost(url.hostname)
  } catch {
    return false
  }
}

export const NETEASE_LOGIN_URL = 'https://music.163.com/'
export const NETEASE_AUTH_PARTITION = 'persist:ncx-netease-auth'
