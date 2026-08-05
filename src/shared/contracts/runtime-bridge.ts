import type { RuntimeStatus } from './control-plane'
import type { PingResult, RuntimeResult, UtilitySnapshot } from './runtime'

export interface NcxRuntimeBridge {
  waitUntilReady(timeoutMs?: number): Promise<boolean>
  ping(input?: { delayMs?: number; requestId?: string }): Promise<RuntimeResult<PingResult>>
  cancel(requestId: string): boolean
  snapshot(): Promise<RuntimeResult<UtilitySnapshot>>
  retryUtility(): Promise<RuntimeStatus>
  onStatus(listener: (status: RuntimeStatus) => void): () => void
}
