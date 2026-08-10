import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import type { Session } from 'electron'

// ========= 类型 =========

/** 匿名注册 API 的最小安全响应。 */
interface AnonymousRegistrationResponse {
  /** 上游响应体。 */
  body?: unknown
  /** 上游 Set-Cookie 数组。 */
  cookie?: string[]
}

/** 匿名注册所需的锁定版 API 能力。 */
interface AnonymousRegistrationApi {
  /** 建立网易云游客匿名会话。 */
  register_anonimous(params?: { timeout?: number }): Promise<AnonymousRegistrationResponse>
}

/** 匿名注册 API 加载函数，便于测试注入。 */
type AnonymousApiLoader = () => Promise<AnonymousRegistrationApi>

// ========= 变量 =========

/** 匿名 Session 使用的独立持久分区。 */
export const NETEASE_GUEST_PARTITION = 'persist:ncx-netease-guest'

/** 匿名凭据 Cookie 名。 */
const ANONYMOUS_COOKIE_NAME = 'MUSIC_A'

/** 匿名注册网络超时。 */
const ANONYMOUS_REGISTRATION_TIMEOUT_MS = 15_000

// ========= 函数 =========

/** 判断未知值是否为普通对象。 */
function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 动态加载锁定版本的网易云 API。 */
async function defaultApiLoader(): Promise<AnonymousRegistrationApi> {
  /** 打包运行时资源路径。 */
  const resourcesPath = process.resourcesPath
  /** 打包后用于解析依赖的 manifest。 */
  const packagedManifest = resourcesPath
    ? join(resourcesPath, 'app.asar', 'package.json')
    : undefined
  if (packagedManifest && existsSync(packagedManifest)) {
    return createRequire(packagedManifest)(
      '@neteasecloudmusicapienhanced/api'
    ) as AnonymousRegistrationApi
  }
  /** 开发环境按 ESM 方式加载的 API 模块。 */
  const imported = await import('@neteasecloudmusicapienhanced/api')
  return (imported.default ?? imported) as unknown as AnonymousRegistrationApi
}

/** 从 Set-Cookie 或响应体 cookie 字符串中提取 MUSIC_A。 */
function extractAnonymousToken(response: AnonymousRegistrationResponse): string | undefined {
  /** 可供搜索的 Cookie 字符串集合。 */
  const candidates = [
    ...(Array.isArray(response.cookie) ? response.cookie : []),
    typeof record(response.body)?.['cookie'] === 'string'
      ? String(record(response.body)?.['cookie'])
      : ''
  ]
  for (const candidate of candidates) {
    /** MUSIC_A 名值对匹配结果。 */
    const match = /(?:^|;\s*)MUSIC_A=([^;\s]{16,4096})(?:;|$)/u.exec(candidate)
    if (match?.[1]) return match[1]
  }
  return undefined
}

/** 屏蔽三方依赖日志，避免匿名 Token 意外进入应用日志。 */
async function withoutThirdPartyConsole<T>(operation: () => Promise<T>): Promise<T> {
  /** 原始 console 方法快照。 */
  const original = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn
  }
  /** 三方调用期间使用的空日志函数。 */
  const muted = (): void => {}
  Object.assign(console, { debug: muted, error: muted, info: muted, log: muted, warn: muted })
  try {
    return await operation()
  } finally {
    Object.assign(console, original)
  }
}

// ========= 类 =========

/** Main 侧游客匿名 Session 仓库，凭据不会进入 Renderer。 */
export class AnonymousSessionRepository {
  constructor(
    private readonly electronSession: Session,
    private readonly loadApi: AnonymousApiLoader = defaultApiLoader
  ) {}

  /** 恢复已有匿名 Cookie；不存在时返回 undefined。 */
  async restore(): Promise<string | undefined> {
    /** 独立分区中保存的 MUSIC_A Cookie。 */
    const cookie = (await this.electronSession.cookies.get({ name: ANONYMOUS_COOKIE_NAME }))
      .find((item) => item.value.length >= 16)
    return cookie ? `${ANONYMOUS_COOKIE_NAME}=${cookie.value}` : undefined
  }

  /** 恢复或建立真正的网易云匿名会话。 */
  async establish(): Promise<string> {
    /** 可复用的持久匿名凭据。 */
    const restored = await this.restore()
    if (restored) return restored

    /** 锁定版本的匿名注册 API。 */
    const api = await withoutThirdPartyConsole(() => this.loadApi())
    /** 网易云匿名注册响应。 */
    const response = await withoutThirdPartyConsole(() => api.register_anonimous({
      timeout: ANONYMOUS_REGISTRATION_TIMEOUT_MS
    }))
    /** 从响应中提取的匿名 Token。 */
    const token = extractAnonymousToken(response)
    if (!token) throw new Error('网易云匿名会话未返回有效凭据。')

    await this.electronSession.cookies.set({
      url: 'https://music.163.com/',
      name: ANONYMOUS_COOKIE_NAME,
      value: token,
      domain: '.music.163.com',
      path: '/',
      secure: true,
      httpOnly: true,
      expirationDate: Math.floor(Date.now() / 1_000) + 365 * 24 * 60 * 60
    })
    await this.electronSession.cookies.flushStore()
    return `${ANONYMOUS_COOKIE_NAME}=${token}`
  }
}
