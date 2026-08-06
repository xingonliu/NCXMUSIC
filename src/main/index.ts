import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  utilityProcess
} from 'electron'

import { CONTROL_CHANNELS, type RuntimeStatus } from '../shared/contracts/control-plane'
import { redactSensitiveText } from '../shared/errors/redact-sensitive-text'
import { RuntimeStatusSchema } from '../shared/schemas/control-plane'
import { AuthSessionController, type EstablishResult } from './auth/auth-session-controller'
import { CookieSessionRepository } from './auth/cookie-session-repository'
import { CredentialLeaseCoordinator } from './auth/credential-lease-coordinator'
import { NETEASE_AUTH_PARTITION } from './auth/navigation-policy'
import { ConnectionBroker } from './connection-broker'
import {
  extractMusicU,
  writeT03CredentialEnv,
  T03_ENV_FILENAME
} from './t03-spike/credential-env-writer'
import {
  observeMediaRequests,
  type MediaRequestSummary
} from './t03-spike/media-request-observer'
import { UtilitySupervisor } from './utility-supervisor'

const isSmokeTest = process.env['NCX_SMOKE_TEST'] === '1'
const isLoginSpike = process.env['NCX_T02_SPIKE'] === '1'
const isT03Spike = process.env['NCX_T03_SPIKE'] === '1'
let mainWindow: BrowserWindow | undefined
let supervisor: UtilitySupervisor | undefined
let broker: ConnectionBroker | undefined
let authController: AuthSessionController | undefined
let smokeTimer: ReturnType<typeof setTimeout> | undefined
/** T-03 Spike：webRequest 观测器的终止函数，页面结果到达时调用 */
let stopMediaObserver: (() => MediaRequestSummary) | undefined

function utilityEntryPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'utility.js')
  }
  return join(__dirname, 'utility.js')
}

function createSupervisor(): UtilitySupervisor {
  let shouldCrashFirstUtilityForSmoke = isSmokeTest
  return new UtilitySupervisor(
    () => {
      const args = shouldCrashFirstUtilityForSmoke ? ['--ncx-smoke-crash-before-ready'] : []
      shouldCrashFirstUtilityForSmoke = false
      return utilityProcess.fork(utilityEntryPath(), args, {
        serviceName: 'NcxMusic Runtime',
        stdio: 'pipe'
      })
    },
    (stream, message) => {
      const normalized = message.trim()
      if (!normalized) return
      const writer = stream === 'stderr' ? console.error : console.info
      writer(`[utility:${stream}] ${redactSensitiveText(normalized)}`)
    }
  )
}

function waitForUtilityReady(timeoutMs = 15_000): Promise<void> {
  const runtime = supervisor
  if (!runtime) return Promise.reject(new Error('Utility supervisor is unavailable'))
  if (runtime.currentStatus().state === 'ready') return Promise.resolve()

  return new Promise((resolve, reject) => {
    let unsubscribe = (): void => {}
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error('Utility did not become ready in time'))
    }, timeoutMs)
    unsubscribe = runtime.onStatus((status) => {
      if (status.state === 'ready') {
        clearTimeout(timer)
        unsubscribe()
        resolve()
      } else if (status.state === 'disabled') {
        clearTimeout(timer)
        unsubscribe()
        reject(new Error(status.reason ?? 'Utility is disabled'))
      }
    })
  })
}

function emitLoginSpikeResult(result: {
  scenario: string
  ok: boolean
  establish?: EstablishResult
  snapshot?: ReturnType<AuthSessionController['snapshot']>
  remoteAccepted?: boolean
}): void {
  const establish = result.establish
  const safe = {
    scenario: result.scenario,
    ok: result.ok,
    ...(establish
      ? {
          outcome: establish.outcome,
          source: establish.source,
          cookieCount: establish.cookieCount,
          persistentCookieCount: establish.persistentCookieCount,
          detailVerified: establish.detailVerified,
          ...establish.snapshot
        }
      : result.snapshot),
    ...(result.remoteAccepted === undefined
      ? {}
      : { remoteLogoutAccepted: result.remoteAccepted })
  }
  console.info(`NCX_T02_RESULT ${JSON.stringify(safe)}`)
  authController?.shutdown()
  supervisor?.shutdown()
  app.exit(result.ok ? 0 : 1)
}

async function runLoginSpike(): Promise<void> {
  const controller = authController
  if (!controller) throw new Error('Auth controller is unavailable')
  const scenario = process.env['NCX_T02_SCENARIO'] ?? 'interactive'
  let finished = false
  const timeout = setTimeout(
    () => emitLoginSpikeResult({ scenario, ok: false, snapshot: controller.snapshot() }),
    scenario === 'interactive' ? 10 * 60 * 1_000 : 60_000
  )
  const finish = (result: Parameters<typeof emitLoginSpikeResult>[0]): void => {
    if (finished) return
    finished = true
    clearTimeout(timeout)
    emitLoginSpikeResult(result)
  }

  if (scenario === 'invalid' || scenario === 'expired') {
    await session.fromPartition(NETEASE_AUTH_PARTITION).cookies.set({
      url: 'https://music.163.com/',
      name: 'MUSIC_U',
      value: scenario === 'invalid' ? 'invalid' : `expired-${'x'.repeat(88)}`,
      secure: true,
      httpOnly: true,
      expirationDate: Math.floor(Date.now() / 1_000) + 3_600
    })
  }

  const restored = await controller.restore('startup')
  if (scenario === 'guest') {
    finish({ scenario, ok: restored.outcome === 'guest', establish: restored })
    return
  }
  if (scenario === 'invalid') {
    finish({ scenario, ok: restored.outcome === 'invalid', establish: restored })
    return
  }
  if (scenario === 'expired') {
    finish({
      scenario,
      ok: restored.outcome === 'invalid' || restored.outcome === 'remote-unavailable',
      establish: restored
    })
    return
  }
  if (scenario === 'restore') {
    finish({ scenario, ok: restored.outcome === 'authenticated', establish: restored })
    return
  }
  if (scenario === 'logout') {
    if (restored.outcome !== 'authenticated') {
      finish({ scenario, ok: false, establish: restored })
      return
    }
    const loggedOut = await controller.logout()
    finish({
      scenario,
      ok:
        loggedOut.snapshot.state === 'logged_out' &&
        !loggedOut.snapshot.hasCredentialLease,
      snapshot: loggedOut.snapshot,
      remoteAccepted: loggedOut.remoteAccepted
    })
    return
  }
  if (scenario === 'switch') {
    if (restored.outcome !== 'authenticated') {
      finish({ scenario, ok: false, establish: restored })
      return
    }
    const previousGeneration = restored.snapshot.accountGeneration
    const snapshot = await controller.prepareAccountSwitch()
    finish({
      scenario,
      ok:
        snapshot.accountGeneration === previousGeneration + 1 &&
        !snapshot.hasCredentialLease,
      snapshot
    })
    return
  }
  if (scenario !== 'interactive') {
    finish({ scenario, ok: false, establish: restored })
    return
  }
  if (restored.outcome === 'authenticated') {
    finish({ scenario, ok: true, establish: restored })
    return
  }

  controller.onResult((result) => {
    if (result.source === 'login-window' && result.outcome === 'authenticated') {
      finish({ scenario, ok: true, establish: result })
    }
  })
  controller.onLoginWindowClosed(() => {
    finish({ scenario, ok: false, snapshot: controller.snapshot() })
  })
  await controller.openLogin()
}

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const window = mainWindow
  if (!window || window.isDestroyed() || event.sender !== window.webContents) return false
  return event.senderFrame === window.webContents.mainFrame
}

function broadcastStatus(status: RuntimeStatus): void {
  const window = mainWindow
  if (!window || window.isDestroyed()) return
  window.webContents.send(CONTROL_CHANNELS.status, RuntimeStatusSchema.parse(status))
}

function registerControlPlane(): void {
  ipcMain.on(CONTROL_CHANNELS.connect, (event) => {
    if (!isTrustedSender(event)) return
    const status = supervisor?.currentStatus() ?? {
      state: 'stopped' as const,
      generation: 0,
      restartAttempt: 0
    }
    if (!broker?.connect(event.sender)) broadcastStatus(status)
  })

  ipcMain.handle(CONTROL_CHANNELS.retry, (event) => {
    if (!isTrustedSender(event)) {
      return {
        state: 'disabled',
        generation: supervisor?.currentStatus().generation ?? 0,
        restartAttempt: 3,
        reason: '拒绝非主窗口的重试请求。'
      }
    }
    return supervisor?.retry() ?? {
      state: 'stopped',
      generation: 0,
      restartAttempt: 0
    }
  })
}

function configureSmokeExit(window: BrowserWindow): void {
  if (!isSmokeTest) return

  smokeTimer = setTimeout(() => {
    console.error('NCX_SMOKE_TIMEOUT')
    app.exit(1)
  }, 30_000)

  window.on('page-title-updated', (event, title) => {
    if (!title.startsWith('NCX_SMOKE_RESULT ')) return
    event.preventDefault()
    if (smokeTimer) clearTimeout(smokeTimer)
    const payload = decodeURIComponent(title.slice('NCX_SMOKE_RESULT '.length))
    console.info(`NCX_SMOKE_RESULT ${payload}`)
    try {
      const result = JSON.parse(payload) as { ok?: unknown }
      app.exit(result.ok === true ? 0 : 1)
    } catch {
      app.exit(1)
    }
  })
}

/** T-03 Spike：监听页面标题以收集媒体验证结果并上报 webRequest 观测 */
function configureT03SpikeExit(window: BrowserWindow): void {
  smokeTimer = setTimeout(() => {
    console.error('NCX_T03_TIMEOUT')
    app.exit(1)
  }, 3 * 60_000)

  window.on('page-title-updated', (event, title) => {
    if (!title.startsWith('NCX_T03_RESULT ')) return
    event.preventDefault()
    if (smokeTimer) clearTimeout(smokeTimer)

    const payload = decodeURIComponent(title.slice('NCX_T03_RESULT '.length))
    const mediaSummary = stopMediaObserver?.()

    // 脱敏输出：只包含验证结果与 webRequest 观测，不输出播放 URL
    const safe = {
      spike: 'T-03',
      ...(mediaSummary
        ? {
            mediaRequests: {
              recordCount: mediaSummary.records.length,
              sawPartialContent: mediaSummary.sawPartialContent,
              sawRangeNotSatisfiable: mediaSummary.sawRangeNotSatisfiable,
              sawRangeRequest: mediaSummary.sawRangeRequest,
              contentTypes: mediaSummary.contentTypes
            }
          }
        : {}),
      pageResult: JSON.parse(payload)
    }
    console.info(`NCX_T03_RESULT ${JSON.stringify(safe)}`)

    authController?.shutdown()
    supervisor?.shutdown()
    try {
      app.exit(safe.pageResult?.ok === true ? 0 : 1)
    } catch {
      app.exit(1)
    }
  })
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f7',
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hidden' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })
  mainWindow = window

  if (!isSmokeTest) window.once('ready-to-show', () => window.show())
  window.once('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== window.webContents.getURL()) event.preventDefault()
  })
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  configureSmokeExit(window)
  if (isT03Spike) {
    configureT03SpikeExit(window)
    // 观测主窗口 Session 的媒体请求，记录 Range/206/416 等底层 HTTP 细节
    stopMediaObserver = observeMediaRequests(window.webContents.session)
  }

  const developmentUrl = process.env['ELECTRON_RENDERER_URL']
  if (developmentUrl) {
    const url = new URL(developmentUrl)
    if (isSmokeTest) url.searchParams.set('smoke', '1')
    else if (isT03Spike) {
      url.searchParams.set('t03', '1')
      const tracks = (process.env['NCX_T03_TRACKS'] ?? '').trim()
      if (tracks) url.searchParams.set('t03tracks', tracks)
    }
    await window.loadURL(url.toString())
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: isSmokeTest
        ? { smoke: '1' }
        : isT03Spike
          ? { t03: '1', ...(process.env['NCX_T03_TRACKS']?.trim() ? { t03tracks: process.env['NCX_T03_TRACKS'].trim() } : {}) }
          : {}
    })
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = mainWindow
    if (!window || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.whenReady()
    .then(async () => {
      supervisor = createSupervisor()
      broker = new ConnectionBroker(supervisor, app.getVersion())
      authController = new AuthSessionController(
        session.fromPartition(NETEASE_AUTH_PARTITION, { cache: true }),
        new CredentialLeaseCoordinator(supervisor)
      )
      registerControlPlane()
      supervisor.onStatus((status) => {
        broadcastStatus(status)
        void authController?.handleUtilityStatus(status)
      })
      supervisor.start()
      if (isLoginSpike) {
        await waitForUtilityReady()
        await runLoginSpike()
        return
      }
      if (isT03Spike) {
        await waitForUtilityReady()
        const establish = await authController.restore('startup')
        if (establish.outcome !== 'authenticated') {
          console.error(
            `T-03 Spike：登录 Session 未就绪（outcome=${establish.outcome}）；请先用 NCX_T02_SCENARIO=interactive 登录一次。`
          )
          authController.shutdown()
          supervisor.shutdown()
          app.exit(1)
        }
        // EstablishResult 不含 cookieHeader（已在 establish() 内部零化），
        // 需独立从 Cookie Store 读取完整 Cookie 头用于写入凭据 env。
        const credentialRepo = new CookieSessionRepository(
          session.fromPartition(NETEASE_AUTH_PARTITION, { cache: true })
        )
        const inspection = await credentialRepo.inspect()
        if (inspection.kind !== 'credential') {
          console.error('T-03 Spike：Cookie 缺失，拒绝写入 env。')
          authController.shutdown()
          supervisor.shutdown()
          app.exit(1)
          return
        }
        const musicU = extractMusicU(inspection.cookieHeader)
        if (!musicU) {
          console.error('T-03 Spike：Cookie 头中未提取到 MUSIC_U；凭据 env 将仅包含 Cookie 头。')
        }
        // ADR-002 规定 accountId 不离开安全域；使用哈希化指纹作为标识
        const accountFingerprint = establish.snapshot.accountFingerprint ?? 'unknown'
        await writeT03CredentialEnv(
          join(process.cwd(), T03_ENV_FILENAME),
          {
            cookieHeader: inspection.cookieHeader,
            musicU: musicU ?? '',
            accountId: accountFingerprint
          }
        )
        inspection.cookieHeader = ''
        console.info(
          `T-03 Spike：凭据已写入 ${T03_ENV_FILENAME}；accountFingerprint=${accountFingerprint}，musicU 已提取=${Boolean(musicU)}`
        )
        await createMainWindow()
        return
      }
      await createMainWindow()
      if (!isSmokeTest) {
        void waitForUtilityReady()
          .then(() => authController?.restore('startup'))
          .catch(() => console.warn('登录 Session 恢复暂不可用；未清除持久凭据。'))
      }

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) void createMainWindow()
      })
    })
    .catch((error) => {
      console.error(`应用启动失败：${redactSensitiveText(error)}`)
      authController?.shutdown()
      supervisor?.shutdown()
      app.exit(1)
    })
}

app.on('before-quit', () => {
  if (smokeTimer) clearTimeout(smokeTimer)
  authController?.shutdown()
  supervisor?.shutdown()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isSmokeTest) app.quit()
})
