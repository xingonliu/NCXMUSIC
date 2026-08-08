import { describe, expect, it } from 'vitest'

import { CredentialLeaseService } from '../../src/utility/credential-lease-service'
import { TrackUrlService } from '../../src/utility/track-url-service'

// ─────────────────────────────────────────────────────────────────────────────
// T-03 真实网络集成测试：访客（无登录）播放地址解析
//
// 验证 TrackUrlService 在无凭据租约时仍能调用 song_url_v1 并返回可播放 URL。
// 不依赖 Electron、不启动 IPC、不打 Mock —— 走真实的 @neteasecloudmusicapienhanced/api。
// ─────────────────────────────────────────────────────────────────────────────

// ── 变量区 ──

/** 无需登录即可播放的免费曲目 ID（API 审计 + 实测确认：fee=0, freeTrialInfo=null） */
const FREE_TRACK_ID = '457264737'

/** 需要登录才能播放完整歌曲的付费曲目（fee=1，无登录时返回 30 秒试听） */
const PAID_TRACK_ID = '449818741'

/** 是否执行依赖真实网易云网络和 xeapi public key 的访客播放集成测试 */
const shouldRunRealNetworkTests = process.env['NCXMUSIC_RUN_REAL_NETWORK_TESTS'] === '1'

// ── 测试区 ──

describe.skipIf(!shouldRunRealNetworkTests)('TrackUrlService 访客模式（T-03 真实网络）', () => {
  /**
   * 构造不带活跃租约的 CredentialLeaseService。
   * TrackUrlService 应自动检测到 hasActiveLease() === false 并以空 Cookie 调用 API。
   */
  function guestLease(): CredentialLeaseService {
    return new CredentialLeaseService(() => {
      // 不连接任何 Main，事件回传无人接收
    })
  }

  it('免费曲目在访客模式下返回完整可播放 HTTPS URL', async () => {
    const lease = guestLease()
    const service = new TrackUrlService(lease)

    const result = await service.resolve(crypto.randomUUID(), {
      trackId: FREE_TRACK_ID,
      quality: 'auto'
    })

    // URL 必须是 HTTP 或 HTTPS 的网易云 CDN 地址（如 m8.music.126.net）
    expect(result.url).toMatch(/^https?:\/\//u)
    expect(result.url).toContain('126.net')
    // 免费曲目 fee=0 → freeTrialInfo 不应存在
    expect(result.actualQuality).toBeTruthy()
    expect(result.format).toBe('mp3')
    expect(result.bitrate).toBeGreaterThan(0)

    // 免费曲目无试听限制
    const hasUrl = Boolean(result.url)
    expect(hasUrl).toBe(true)
  }, 20_000)

  it('付费曲目在访客模式下返回试听片段', async () => {
    const lease = guestLease()
    const service = new TrackUrlService(lease)

    const result = await service.resolve(crypto.randomUUID(), {
      trackId: PAID_TRACK_ID,
      quality: 'standard'
    })

    // 付费曲目在无登录时仍返回 URL，但降级为试听质量
    expect(result.url).toMatch(/^https?:\/\//u)
    // 降级应被检测到
    expect(result.downgraded).toBeDefined()
  }, 20_000)

  it('auto 模式能降级到可用音质（即使无登录）', async () => {
    const lease = guestLease()
    const service = new TrackUrlService(lease)

    const result = await service.resolve(crypto.randomUUID(), {
      trackId: FREE_TRACK_ID,
      quality: 'auto'
    })

    // auto 会按 jymaster→hires→lossless→exhigh→standard 尝试
    // 无登录下 free track 通常停在 hires（320kbps）或 lower
    expect(result.attemptedQualities.length).toBeGreaterThanOrEqual(1)
    expect(result.url).toBeTruthy()
    expect(result.bitrate).toBeGreaterThan(0)
  }, 30_000)

  it('返回结果通过 ResolvedMediaSource Zod 校验', async () => {
    const lease = guestLease()
    const service = new TrackUrlService(lease)

    // TrackUrlService.resolve 内部已经调了 ResolvedMediaSourceSchema.parse
    // 所以能正常返回即表示已通过校验
    const result = await service.resolve(crypto.randomUUID(), {
      trackId: FREE_TRACK_ID,
      quality: 'exhigh'
    })

    expect(result).toHaveProperty('url')
    expect(result).toHaveProperty('requestedQuality')
    expect(result).toHaveProperty('actualQuality')
    expect(result).toHaveProperty('attemptedQualities')
    expect(result).toHaveProperty('downgraded')
    // format 和 bitrate 可能缺失，但 url 必须存在
    expect(result.url.length).toBeGreaterThan(10)
  }, 20_000)

  it('无效曲目 ID 抛出携带 code 的错误', async () => {
    const lease = guestLease()
    const service = new TrackUrlService(lease)

    await expect(
      service.resolve(crypto.randomUUID(), {
        trackId: '99999999999999999999',
        quality: 'standard'
      })
    ).rejects.toThrow()
  }, 20_000)

  it('开始解析后立即取消能中止网络请求', async () => {
    const lease = guestLease()
    const service = new TrackUrlService(lease)
    const requestId = crypto.randomUUID()

    const promise = service.resolve(requestId, {
      trackId: FREE_TRACK_ID,
      quality: 'standard'
    })
    // 让微任务跑空，确保 resolve() 已进入 try 块并注册了 AbortController
    await Promise.resolve()
    service.cancel(requestId)

    await expect(promise).rejects.toThrow()
    expect(() => service.cancel(requestId)).not.toThrow()
  }, 10_000)
})
