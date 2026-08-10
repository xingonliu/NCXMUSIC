import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import type {
  MusicQualityLevel,
  MusicQualityPreference,
  ResolvedMediaSource
} from '../../shared/schemas/music'

// ─────────────────────────────────────────────────────────────────────────────
// 内部类型（与 @neteasecloudmusicapienhanced/api 的响应结构对齐）
// ─────────────────────────────────────────────────────────────────────────────

/** netease song_url_v1 单条数据 */
interface SongUrlData {
  id?: number | string
  url?: string | null
  br?: number
  size?: number
  type?: string
  level?: string
  code?: number
}

interface SongUrlResponse {
  status?: number
  body?: {
    code?: number
    data?: SongUrlData[]
  }
}

/** song_url_v1 接受的音质参数（netease API 枚举值） */
type NeteaseQuality =
  | 'standard'
  | 'exhigh'
  | 'lossless'
  | 'hires'
  | 'jyeffect'
  | 'sky'
  | 'jymaster'

export interface NeteaseApi {
  song_url_v1(params: {
    id: string | number
    level: NeteaseQuality
    cookie?: string
    timeout?: number
    /** 播放地址显式使用 weapi，避免依赖运行时生成的 xeapi 临时公钥。 */
    crypto?: 'weapi'
  }): Promise<SongUrlResponse>
}

/** 播放地址解析使用的稳定加密方式，不依赖 /tmp/xeapi_public_key。 */
const PLAYBACK_API_CRYPTO = 'weapi' as const

// ─────────────────────────────────────────────────────────────────────────────
// 音质降级链
// ─────────────────────────────────────────────────────────────────────────────

/**
 * auto 模式使用的高保真降级链（从最高到最低）。
 * higher / dolby 是架构文档定义的内部等级，不进入 auto 链。
 */
const AUTO_QUALITY_CHAIN: NeteaseQuality[] = [
  'jymaster',
  'hires',
  'lossless',
  'exhigh',
  'standard'
]

/** 产品音质从低到高的稳定等级，用于比较请求目标与上游实际档位。 */
const QUALITY_RANK: Record<MusicQualityLevel, number> = {
  standard: 0,
  higher: 1,
  exhigh: 2,
  lossless: 3,
  hires: 4,
  jyeffect: 5,
  sky: 6,
  dolby: 7,
  jymaster: 8
}

/**
 * 将架构层音质枚举映射到 netease API 支持的值。
 * higher → standard（降级到最近可用），dolby → 不进入 auto 链，仅显式指定。
 */
function toNeteaseQuality(level: MusicQualityLevel): NeteaseQuality {
  const mapping: Partial<Record<MusicQualityLevel, NeteaseQuality>> = {
    standard: 'standard',
    higher: 'standard', // API 无 higher，降到 standard
    exhigh: 'exhigh',
    lossless: 'lossless',
    hires: 'hires',
    jyeffect: 'jyeffect',
    sky: 'sky',
    dolby: 'jyeffect', // dolby 在 API 中用 jyeffect 表示
    jymaster: 'jymaster'
  }
  return mapping[level] ?? 'standard'
}

/** 将网易云返回的 CDN 地址规范为 HTTPS，避免明文媒体地址阻断播放。 */
function toHttpsPlaybackUrl(value: string): string {
  /** 可修改协议的 URL 对象。 */
  const url = new URL(value)
  if (url.protocol === 'http:') url.protocol = 'https:'
  return url.toString()
}

// ─────────────────────────────────────────────────────────────────────────────
// API 加载
// ─────────────────────────────────────────────────────────────────────────────

async function loadApi(): Promise<NeteaseApi> {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  const packagedManifest = resourcesPath
    ? join(resourcesPath, 'app.asar', 'package.json')
    : undefined
  if (packagedManifest && existsSync(packagedManifest)) {
    return createRequire(packagedManifest)(
      '@neteasecloudmusicapienhanced/api'
    ) as NeteaseApi
  }
  const imported = await import('@neteasecloudmusicapienhanced/api')
  return (imported.default ?? imported) as unknown as NeteaseApi
}

/** 屏蔽 netease API 包的三方 console 输出 */
async function withoutThirdPartyConsole<T>(op: () => Promise<T>): Promise<T> {
  const orig = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn
  }
  const noop = (): void => {}
  console.debug = noop
  console.error = noop
  console.info = noop
  console.log = noop
  console.warn = noop
  try {
    return await op()
  } finally {
    Object.assign(console, orig)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackUrlResolver
// ─────────────────────────────────────────────────────────────────────────────

export class TrackUrlResolver {
  private api: NeteaseApi | undefined

  /**
   * @param api 可选的网易云 API 实例；生产环境省略并按需加载，测试可注入夹具。
   */
  constructor(api?: NeteaseApi) {
    this.api = api
  }

  private async requiredApi(): Promise<NeteaseApi> {
    this.api ??= await loadApi()
    return this.api
  }

  /**
   * 解析指定曲目的短期 HTTPS 播放 URL。
   *
   * @param trackId 网易云曲目 ID
   * @param quality 期望音质（auto 则走降级链）
   * @param cookie  来自凭据租约的 Cookie 字符串
   * @param signal  取消信号
   * @returns 解析结果，或在无可用 URL 时抛出 Error
   */
  async resolve(
    trackId: string,
    quality: MusicQualityPreference,
    cookie: string,
    signal?: AbortSignal
  ): Promise<ResolvedMediaSource> {
    const api = await this.requiredApi()
    const chain: NeteaseQuality[] =
      quality === 'auto' ? AUTO_QUALITY_CHAIN : [toNeteaseQuality(quality as MusicQualityLevel)]

    const attempted: MusicQualityLevel[] = []
    let lastData: SongUrlData | undefined

    for (const level of chain) {
      signal?.throwIfAborted()
      attempted.push(level as MusicQualityLevel)

      const resp = await withoutThirdPartyConsole(() =>
        api.song_url_v1({
          id: trackId,
          level,
          cookie,
          timeout: 15_000,
          crypto: PLAYBACK_API_CRYPTO
        })
      )

      const data = resp.body?.data?.[0]
      lastData = data

      if (data?.url) {
        const actualLevel = (data.level ?? level) as MusicQualityLevel
        const requestedQuality =
          quality === 'auto'
            ? 'auto'
            : (quality as MusicQualityPreference)
        /** 用户本次请求或自动模式的目标档位。 */
        const targetLevel: MusicQualityLevel = quality === 'auto'
          ? (AUTO_QUALITY_CHAIN[0] ?? 'jymaster')
          : quality as MusicQualityLevel
        const isDowngraded =
          QUALITY_RANK[actualLevel] < QUALITY_RANK[targetLevel]

        return {
          url: toHttpsPlaybackUrl(data.url),
          requestedQuality,
          actualQuality: actualLevel,
          attemptedQualities: attempted,
          downgraded: isDowngraded,
          ...(isDowngraded
            ? { downgradeReason: attempted.length > 1 ? 'account-unavailable' as const : 'upstream-fallback' as const }
            : {}),
          ...(data.br !== undefined ? { bitrate: data.br } : {}),
          ...(data.type ? { format: data.type } : {}),
          ...(data.size !== undefined && data.size > 0 ? { size: data.size } : {})
        }
      }

      // URL 为 null：此音质当前账号不可用，继续降级
    }

    // 所有音质尝试完毕仍无 URL
    const code = lastData?.code
    const reason =
      code === 404
        ? 'track-unavailable'
        : code === 403
          ? 'account-unavailable'
          : 'upstream-fallback'

    throw Object.assign(new Error(`无法获取曲目 ${trackId} 的播放 URL（${reason}）`), {
      code: reason,
      attempted
    })
  }
}
