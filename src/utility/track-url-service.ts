import type { CredentialLeaseService } from './credential-lease-service'
import { TrackUrlResolver } from '../infrastructure/netease/track-url-resolver'
import {
  ResolveTrackUrlPayloadSchema,
  ResolvedMediaSourceSchema
} from '../shared/schemas/music'
import type { ResolvedMediaSource } from '../shared/schemas/music'

// ─────────────────────────────────────────────────────────────────────────────
// TrackUrlService
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Utility 侧：处理 music.resolve-url 请求。
 * 通过 CredentialLeaseService.executeWithCookie 获取 Cookie，
 * 调用 TrackUrlResolver 解析播放 URL，不持久化、不记录 URL 内容。
 */
export class TrackUrlService {
  private readonly resolver = new TrackUrlResolver()

  /** 进行中的解析请求（requestId → AbortController） */
  private readonly pending = new Map<string, AbortController>()

  constructor(private readonly credentialLease: CredentialLeaseService) {}

  /**
   * 解析指定曲目的短期 HTTPS 播放 URL。
   *
   * @param requestId 请求 ID，用于支持取消
   * @param rawPayload 来自 IPC 的原始载荷（经 Zod 校验）
   * @returns 解析结果
   */
  async resolve(
    requestId: string,
    rawPayload: unknown
  ): Promise<ResolvedMediaSource> {
    // 校验载荷
    const parsed = ResolveTrackUrlPayloadSchema.safeParse(rawPayload)
    if (!parsed.success) {
      throw Object.assign(
        new Error(`music.resolve-url 载荷格式错误：${parsed.error.message}`),
        { code: 'PROTOCOL_INVALID_MESSAGE' }
      )
    }

    const { trackId, quality } = parsed.data

    // 注册取消句柄
    const controller = new AbortController()
    this.pending.set(requestId, controller)

    try {
      // 优先走凭据租约（登录用户享受完整音质），无租约时以访客身份调 API。
      // song_url_v1 在无 Cookie 下对免费曲目返回完整流、对付费曲目返回试听片段。
      const cookie = this.credentialLease.hasActiveLease()
        ? await this.credentialLease.executeWithCookie(async (value) => value)
        : ''
      const result = await this.resolver.resolve(trackId, quality, cookie, controller.signal)
      // 验证结果符合契约（防止 resolver 返回异常数据进入 IPC）
      return ResolvedMediaSourceSchema.parse(result)
    } finally {
      this.pending.delete(requestId)
    }
  }

  /**
   * 取消进行中的解析请求。
   *
   * @param requestId 对应的请求 ID
   */
  cancel(requestId: string): void {
    const controller = this.pending.get(requestId)
    if (!controller) return
    controller.abort()
    this.pending.delete(requestId)
  }

  /** 关闭服务，取消全部进行中请求 */
  shutdown(): void {
    for (const controller of this.pending.values()) controller.abort()
    this.pending.clear()
  }
}
