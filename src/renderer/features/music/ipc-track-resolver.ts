import type {
  MusicQualityPreference,
  ResolvedMediaSource,
  TrackResolver
} from '../../../domains/player/types'
import { translatePublicError } from '../../i18n'

// ─────────────────────────────────────────────────────────────────────────────
// IpcTrackResolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderer 侧 TrackResolver 实现：通过 Preload Gateway 向 Utility 请求播放地址。
 *
 * Renderer 永远拿不到 Cookie，只拿到短期 HTTPS URL。
 * 解析结果不写入 localStorage、不打印到 console。
 */
export class IpcTrackResolver implements TrackResolver {
  /**
   * 解析指定曲目的可播放源。
   *
   * @param trackId 网易云曲目 ID
   * @param quality 音质偏好
   * @param signal  取消信号；中止时向 Utility 发送 cancel 并抛出 AbortError
   * @throws AbortError 当 signal 被中止
   * @throws Error 携带 code 字段，标识失败原因
   */
  async resolve(
    trackId: string,
    quality: MusicQualityPreference,
    signal: AbortSignal
  ): Promise<ResolvedMediaSource> {
    signal.throwIfAborted()

    // 自行生成 requestId，以便取消时精确定位到这一次请求
    const requestId = crypto.randomUUID()

    // signal 中止时立刻向 Utility 投递 cancel，让上游请求尽早释放
    const onAbort = (): void => {
      window.ncx.runtime.cancel(requestId)
    }
    signal.addEventListener('abort', onAbort, { once: true })

    try {
      const result = await window.ncx.runtime.resolveTrackUrl({
        trackId,
        quality,
        requestId
      })

      // 请求返回前已被取消：不把结果交给引擎
      signal.throwIfAborted()

      if (!result.ok) {
        throw Object.assign(new Error(translatePublicError(result.error)), {
          code: result.error.code,
          retryable: result.error.retryable
        })
      }

      return result.data
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }
}
