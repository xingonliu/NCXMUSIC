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

  // 媒体链路：访客模式解析免费曲目并验证真实 <audio> 可播放
  const trackId = '457264737'
  const resolved = await window.ncx.runtime.resolveTrackUrl({ trackId, quality: 'standard' })
  checks.audioResolved = resolved.ok && resolved.data.url.length > 10
  if (resolved.ok) {
    checks.audioReachedCanPlay = await new Promise<boolean>((resolve) => {
      const element = new Audio()
      // 不设置 crossOrigin：网易云 CDN 通常不返回 Access-Control-Allow-Origin
      element.preload = 'auto'
      element.addEventListener('canplay', () => {
        resolve(true)
        element.pause()
        element.removeAttribute('src')
        element.load()
      })
      element.addEventListener('error', () => resolve(false))
      element.src = resolved.data.url
      setTimeout(() => resolve(false), 15_000)
    })
  } else {
    checks.audioReachedCanPlay = false
  }

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
