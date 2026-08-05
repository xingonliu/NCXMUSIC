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

import {
  CONTROL_CHANNELS,
  RuntimeStatusSchema,
  type RuntimeStatus
} from '../shared/contracts/control-plane'
import { ConnectionBroker } from './connection-broker'
import { AuthSessionController, type EstablishResult } from './auth/auth-session-controller'
import { CredentialLeaseCoordinator } from './auth/credential-lease-coordinator'
import { NETEASE_AUTH_PARTITION } from './auth/navigation-policy'
import { UtilitySupervisor } from './utility-supervisor'
import { redactSensitiveText } from '../shared/errors/redact-sensitive-text'

const isSmokeTest = process.env.NCX_SMOKE_TEST === '1'
const isLoginSpike = process.env.NCX_T02_SPIKE === '1'
let mainWindow: BrowserWindow | undefined
let supervisor: UtilitySupervisor | undefined
let broker: ConnectionBroker | undefined
let authController: AuthSessionController | undefined
let quitting = false

function utilityEntryPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'utility.js')
  }
  return join(__dirname, 'utility.js')
}

function createSupervisor(): UtilitySupervisor {
  return new UtilitySupervisor(
    () =>
      utilityProcess.fork(utilityEntryPath(), [], {
        serviceName: 'NcxMusic Runtime',
        stdio: 'pipe'
      }),
    (stream, message) => {
      const normalized = message.trim()
      if (normalized) {
        const writer = stream === 'stderr' ? console.error : console.info
        writer(`[utility:${stream}] ${redactSensitiveText(normalized)}`)
      }
    }
  )
}

function emitSpikeResult(result: {
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
  app.exit(result.ok ? 0 : 1)
}

async function runLoginSpike(): Promise<void> {
  const controller = authController
  if (!controller) throw new Error('Auth controller is unavailable')
  const scenario = process.env.NCX_T02_SCENARIO ?? 'interactive'
  let finished = false
  const timeout = setTimeout(() => {
    emitSpikeResult({ scenario, ok: false, snapshot: controller.snapshot() })
  }, scenario === 'interactive' ? 10 * 60 * 1_000 : 60_000)

  const finish = (result: Parameters<typeof emitSpikeResult>[0]): void => {
    if (finished) return
    finished = true
    clearTimeout(timeout)
    emitSpikeResult(result)
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
    finish({ scenario, ok: restored.outcome === 'invalid', establish: restored })
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
      ok: loggedOut.snapshot.state === 'guest' && !loggedOut.snapshot.hasCredentialLease,
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
    if (result.source !== 'login-window') return
    if (result.outcome === 'authenticated') {
      finish({ scenario, ok: true, establish: result })
    }
  })
  controller.onLoginWindowClosed(() => {
    finish({ scenario, ok: false, snapshot: controller.snapshot() })
  })
  controller.openLogin()
}

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const window = mainWindow
  if (!window || window.isDestroyed() || event.sender !== window.webContents) {
    return false
  }
  return event.senderFrame === window.webContents.mainFrame
}

function broadcastStatus(status: RuntimeStatus): void {
  const window = mainWindow
  if (window && !window.isDestroyed()) {
    window.webContents.send(CONTROL_CHANNELS.status, RuntimeStatusSchema.parse(status))
  }
}

function registerControlPlane(): void {
  ipcMain.on(CONTROL_CHANNELS.connect, (event) => {
    if (!isTrustedSender(event)) {
      return
    }
    if (!broker?.connect(event.sender)) {
      broadcastStatus(
        supervisor?.currentStatus() ?? {
          state: 'stopped',
          generation: 0,
          restartAttempt: 0
        }
      )
    }
  })

  ipcMain.handle(CONTROL_CHANNELS.retry, (event) => {
    if (!isTrustedSender(event)) {
      return {
        state: 'disabled',
        generation: supervisor?.currentGeneration() ?? 0,
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
  if (!isSmokeTest) {
    return
  }

  const timeout = setTimeout(() => {
    console.error('NCX_SMOKE_TIMEOUT')
    app.exit(1)
  }, 30_000)

  window.on('page-title-updated', (event, title) => {
    if (!title.startsWith('NCX_SMOKE_RESULT ')) {
      return
    }
    event.preventDefault()
    clearTimeout(timeout)
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

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: !isSmokeTest,
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
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault()
    }
  })
  configureSmokeExit(window)

  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  if (developmentUrl) {
    const url = new URL(developmentUrl)
    if (isSmokeTest) {
      url.searchParams.set('smoke', '1')
    }
    await window.loadURL(url.toString())
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: isSmokeTest ? { smoke: '1' } : {}
    })
  }
}

app.whenReady().then(async () => {
  supervisor = createSupervisor()
  broker = new ConnectionBroker(supervisor, app.getVersion())
  const credentialLease = new CredentialLeaseCoordinator(supervisor)
  authController = new AuthSessionController(
    session.fromPartition(NETEASE_AUTH_PARTITION, { cache: true }),
    credentialLease
  )
  registerControlPlane()
  supervisor.onStatus((status) => {
    broadcastStatus(status)
    void authController?.handleUtilityStatus(status)
  })
  supervisor.start()
  if (isLoginSpike) {
    await runLoginSpike()
    return
  }
  await createWindow()
  if (!isSmokeTest) {
    void authController.restore('startup').catch(() => {
      console.warn('登录 Session 恢复暂不可用；未清除持久凭据。')
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('before-quit', () => {
  quitting = true
  authController?.shutdown()
  supervisor?.shutdown()
})

app.on('window-all-closed', () => {
  if (!quitting) {
    supervisor?.shutdown()
  }
  if (process.platform !== 'darwin' || isSmokeTest) {
    app.quit()
  }
})
