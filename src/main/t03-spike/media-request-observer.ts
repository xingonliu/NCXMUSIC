import type { Session } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// 媒体请求观测器
//
// T-03 的通过条件要求观测真实 `Range` 请求与 206/416 响应，而 Renderer 侧的
// HTMLAudioElement 无法读取这些底层 HTTP 细节。因此在 Main 用 webRequest
// 观测主窗口 Session 的媒体请求，只记录状态码与协商结果，不记录 URL 查询串
// （其中含短期签名）也不记录任何请求 Cookie。
// ─────────────────────────────────────────────────────────────────────────────

// ── 类型区 ──

/** 单次媒体请求的脱敏观测记录 */
export interface MediaRequestRecord {
  /** 请求序号，从 1 开始 */
  sequence: number
  /** 是否携带了 Range 请求头 */
  hasRangeHeader: boolean
  /** Range 请求头的值；未携带时为 null */
  rangeValue: string | null
  /** HTTP 响应状态码 */
  statusCode: number
  /** 响应是否声明支持字节范围 */
  acceptsRanges: boolean
  /** Content-Range 响应头；不存在时为 null */
  contentRange: string | null
  /** Content-Type 响应头；不存在时为 null */
  contentType: string | null
  /** Content-Length 响应头解析值；不可用时为 null */
  contentLength: number | null
  /** 请求主机名（不含路径与查询串，避免记录签名参数） */
  host: string
}

/** 观测汇总 */
export interface MediaRequestSummary {
  /** 全部脱敏记录 */
  records: MediaRequestRecord[]
  /** 是否出现过 206 Partial Content */
  sawPartialContent: boolean
  /** 是否出现过 416 Range Not Satisfiable */
  sawRangeNotSatisfiable: boolean
  /** 是否出现过携带 Range 头的请求 */
  sawRangeRequest: boolean
  /** 观测到的所有 Content-Type 去重列表 */
  contentTypes: string[]
}

// ── 函数区 ──

/** 读取响应头的首个值，统一小写键查找 */
function headerValue(
  headers: Record<string, string | string[]> | undefined,
  name: string
): string | null {
  if (!headers) return null
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) continue
    const first = Array.isArray(value) ? value[0] : value
    return first ?? null
  }
  return null
}

/** 安全解析主机名；URL 非法时返回空串 */
function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).host
  } catch {
    return ''
  }
}

// ── 观测器 ──

/**
 * 在指定 Session 上观测媒体请求。
 *
 * @param electronSession 需要观测的 Session（主窗口 Session）
 * @returns 停止观测并返回汇总的函数
 */
export function observeMediaRequests(
  electronSession: Session
): () => MediaRequestSummary {
  // ── 变量区 ──

  const records: MediaRequestRecord[] = []
  /** requestId → 该请求携带的 Range 头，用于把请求与响应配对 */
  const rangeByRequestId = new Map<string, string | null>()
  let sequence = 0

  // 只观测媒体资源，避免把页面与脚本请求也记进来
  const filter = { urls: ['https://*/*'], types: ['media' as const] }

  electronSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    rangeByRequestId.set(details.id.toString(), headerValue(details.requestHeaders, 'range'))
    callback({ requestHeaders: details.requestHeaders })
  })

  electronSession.webRequest.onCompleted(filter, (details) => {
    const key = details.id.toString()
    const rangeValue = rangeByRequestId.get(key) ?? null
    rangeByRequestId.delete(key)

    const rawLength = headerValue(details.responseHeaders, 'content-length')
    const parsedLength = rawLength === null ? Number.NaN : Number(rawLength)
    const acceptRanges = headerValue(details.responseHeaders, 'accept-ranges')
    const contentRange = headerValue(details.responseHeaders, 'content-range')

    sequence += 1
    records.push({
      sequence,
      hasRangeHeader: rangeValue !== null,
      rangeValue,
      statusCode: details.statusCode,
      // 206 本身即证明服务端满足了字节范围请求
      acceptsRanges:
        details.statusCode === 206 ||
        contentRange !== null ||
        (acceptRanges !== null && acceptRanges.toLowerCase() !== 'none'),
      contentRange,
      contentType: headerValue(details.responseHeaders, 'content-type'),
      contentLength: Number.isFinite(parsedLength) ? parsedLength : null,
      host: hostOf(details.url)
    })
  })

  return (): MediaRequestSummary => {
    // 解绑监听：传 null 清除该 Session 上的处理器
    electronSession.webRequest.onBeforeSendHeaders(null)
    electronSession.webRequest.onCompleted(null)

    const contentTypes = [
      ...new Set(
        records
          .map((record) => record.contentType)
          .filter((value): value is string => value !== null)
      )
    ]

    return {
      records,
      sawPartialContent: records.some((record) => record.statusCode === 206),
      sawRangeNotSatisfiable: records.some((record) => record.statusCode === 416),
      sawRangeRequest: records.some((record) => record.hasRangeHeader),
      contentTypes
    }
  }
}
