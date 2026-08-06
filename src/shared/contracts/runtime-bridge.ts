import type { RuntimeStatus } from '../schemas/control-plane'
import type { PingResult, RuntimeResult, UtilitySnapshot } from '../schemas/runtime'
import type { ResolveTrackUrlPayload, ResolvedMediaSource } from '../schemas/music'

export interface NcxRuntimeBridge {
  waitUntilReady(timeoutMs?: number): Promise<boolean>
  ping(input?: { delayMs?: number; requestId?: string }): Promise<RuntimeResult<PingResult>>
  cancel(requestId: string): boolean
  snapshot(): Promise<RuntimeResult<UtilitySnapshot>>
  retryUtility(): Promise<RuntimeStatus>
  onStatus(listener: (status: RuntimeStatus) => void): () => void
  /** 向 Utility 请求解析指定曲目的短期 HTTPS 播放 URL */
  resolveTrackUrl(
    input: ResolveTrackUrlPayload & { requestId?: string }
  ): Promise<RuntimeResult<ResolvedMediaSource>>
}
