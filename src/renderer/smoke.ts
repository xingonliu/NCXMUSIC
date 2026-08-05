import type { RuntimeResult } from '../shared/contracts/runtime'

interface SmokeResult {
  ok: boolean
  checks: Record<string, boolean>
  failure?: string
}

function emit(result: SmokeResult): void {
  document.title = `NCX_SMOKE_RESULT ${encodeURIComponent(JSON.stringify(result))}`
}

export async function runRuntimeSmoke(): Promise<void> {
  const checks: Record<string, boolean> = {}
  try {
    checks.rendererHasNoNodeGlobals =
      !Reflect.has(globalThis, 'require') && !Reflect.has(globalThis, 'process')
    checks.ready = await window.ncx.runtime.waitUntilReady(10_000)

    const ping = await window.ncx.runtime.ping()
    checks.ping = ping.ok && ping.data.respondedAt >= ping.data.receivedAt

    const requestId = crypto.randomUUID()
    const delayedPing = window.ncx.runtime.ping({ delayMs: 2_000, requestId })
    await new Promise((resolve) => setTimeout(resolve, 50))
    checks.cancelDispatched = window.ncx.runtime.cancel(requestId)
    const cancelled: RuntimeResult<unknown> = await delayedPing
    checks.cancelled = !cancelled.ok && cancelled.error.code === 'REQUEST_CANCELLED'

    const snapshot = await window.ncx.runtime.snapshot()
    checks.snapshot =
      snapshot.ok &&
      snapshot.data.protocolVersion === 1 &&
      snapshot.data.pendingRequestIds.length === 0

    const ok = Object.values(checks).every(Boolean)
    emit({ ok, checks })
  } catch (error) {
    emit({
      ok: false,
      checks,
      failure: error instanceof Error ? error.message : String(error)
    })
  }
}
