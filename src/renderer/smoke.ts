import type { RuntimeResult, UtilitySnapshot } from '../shared/schemas/runtime'

interface SmokeResult {
  ok: boolean
  checks: Record<string, boolean>
  failure?: string
}

interface BeforeReloadState {
  checks: Record<string, boolean>
  snapshot: UtilitySnapshot
}

const RELOAD_STATE_KEY = 'ncx.runtime-smoke.before-reload'

function emit(result: SmokeResult): void {
  document.title = `NCX_SMOKE_RESULT ${encodeURIComponent(JSON.stringify(result))}`
}

async function initialConnectionChecks(): Promise<BeforeReloadState> {
  const checks: Record<string, boolean> = {
    rendererHasNoNodeGlobals:
      !Reflect.has(globalThis, 'require') && !Reflect.has(globalThis, 'process')
  }
  checks.ready = await window.ncx.runtime.waitUntilReady(10_000)

  const ping = await window.ncx.runtime.ping()
  checks.ping = ping.ok && ping.data.respondedAt >= ping.data.receivedAt

  const requestId = crypto.randomUUID()
  const delayedPing = window.ncx.runtime.ping({ delayMs: 2_000, requestId })
  await new Promise((resolve) => setTimeout(resolve, 50))
  checks.cancelDispatched = window.ncx.runtime.cancel(requestId)
  const cancelled: RuntimeResult<unknown> = await delayedPing
  checks.cancelled = !cancelled.ok && cancelled.error.code === 'REQUEST_CANCELLED'

  const snapshotResult = await window.ncx.runtime.snapshot()
  if (!snapshotResult.ok) throw new Error(snapshotResult.error.message)
  checks.snapshot = snapshotResult.data.pendingRequestIds.length === 0
  checks.utilityRestartedAfterCrash = snapshotResult.data.utilityGeneration >= 2

  return { checks, snapshot: snapshotResult.data }
}

async function reloadedConnectionChecks(previous: BeforeReloadState): Promise<SmokeResult> {
  const checks = { ...previous.checks }
  checks.readyAfterReload = await window.ncx.runtime.waitUntilReady(10_000)

  const ping = await window.ncx.runtime.ping()
  checks.pingAfterReload = ping.ok && ping.data.respondedAt >= ping.data.receivedAt

  const snapshotResult = await window.ncx.runtime.snapshot()
  if (!snapshotResult.ok) throw new Error(snapshotResult.error.message)
  const snapshot = snapshotResult.data
  checks.reloadCreatedNewConnection = snapshot.connectionId !== previous.snapshot.connectionId
  checks.snapshotRestored =
    snapshot.utilityGeneration === previous.snapshot.utilityGeneration &&
    snapshot.startedAt === previous.snapshot.startedAt &&
    snapshot.handledRequests > previous.snapshot.handledRequests &&
    snapshot.pendingRequestIds.length === 0

  return { ok: Object.values(checks).every(Boolean), checks }
}

export async function runRuntimeSmoke(): Promise<void> {
  try {
    const previousRaw = sessionStorage.getItem(RELOAD_STATE_KEY)
    if (!previousRaw) {
      const initial = await initialConnectionChecks()
      if (!Object.values(initial.checks).every(Boolean)) {
        emit({ ok: false, checks: initial.checks })
        return
      }
      sessionStorage.setItem(RELOAD_STATE_KEY, JSON.stringify(initial))
      window.location.reload()
      return
    }

    sessionStorage.removeItem(RELOAD_STATE_KEY)
    const previous = JSON.parse(previousRaw) as BeforeReloadState
    emit(await reloadedConnectionChecks(previous))
  } catch (error) {
    sessionStorage.removeItem(RELOAD_STATE_KEY)
    emit({
      ok: false,
      checks: {},
      failure: error instanceof Error ? error.message : String(error)
    })
  }
}
