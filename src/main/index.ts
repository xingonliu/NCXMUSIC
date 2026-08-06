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
import {
  WINDOW_CONTROL_CHANNELS,
  type WindowCommand,
  type WindowSnapshot
} from '../shared/contracts/window-controls'
import { redactSensitiveText } from '../shared/errors/redact-sensitive-text'
import { RuntimeStatusSchema } from '../shared/schemas/control-plane'
import { AuthSessionController, type EstablishResult } from './auth/auth-session-controller'
import { CredentialLeaseCoordinator } from './auth/credential-lease-coordinator'
import { NETEASE_AUTH_PARTITION } from './auth/navigation-policy'
import { ConnectionBroker } from './connection-broker'
import { UtilitySupervisor } from './utility-supervisor'

const isSmokeTest = process.env['NCX_SMOKE_TEST'] === '1'
const isLoginSpike = process.env['NCX_T02_SPIKE'] === '1'
let mainWindow: BrowserWindow | undefined
let supervisor: UtilitySupervisor | undefined
let broker: ConnectionBroker | undefined
let authController: AuthSessionController | undefined
let smokeTimer: ReturnType<typeof setTimeout> | undefined

/** 从 BrowserWindow 读取 Renderer 需要的窗口状态。 */
function createWindowSnapshot(window: BrowserWindow): WindowSnapshot {
  return {
    platform: process.platform,
    maximized: window.isMaximized(),
    fullscreen: window.isFullScreen(),
    focused: window.isFocused()
  }
}

/** 向主窗口广播最新窗口状态，供自绘窗口控件同步真实状态。 */
function publishWindowSnapshot(window = mainWindow): WindowSnapshot | undefined {
  if (!window || window.isDestroyed()) return undefined

  const snapshot = createWindowSnapshot(window)
  window.webContents.send(WINDOW_CONTROL_CHANNELS.status, snapshot)
  return snapshot
}

/** 监听可能改变窗口控件视觉的 BrowserWindow 事件。 */
function registerWindowStatePublisher(window: BrowserWindow): void {
  const publish = (): void => {
    publishWindowSnapshot(window)
  }

  window.on('maximize', publish)
  window.on('unmaximize', publish)
  window.on('enter-full-screen', publish)
  window.on('leave-full-screen', publish)
  window.on('focus', publish)
  window.on('blur', publish)
  window.on('restore', publish)
  window.on('resize', publish)
}

/** 执行 Renderer 发来的类型化窗口命令。 */
function applyWindowCommand(command: WindowCommand): WindowSnapshot {
  const window = mainWindow
  if (!window || window.isDestroyed()) throw new Error('Main window is unavailable')

  if (command.type === 'window.minimize') {
    window.minimize()
  } else if (command.type === 'window.toggleMaximize') {
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  } else if (command.type === 'window.requestClose') {
    window.close()
  } else if (command.type === 'window.toggleFullscreen') {
    window.setFullScreen(!window.isFullScreen())
  }

  return publishWindowSnapshot(window) ?? createWindowSnapshot(window)
}

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

  ipcMain.handle(WINDOW_CONTROL_CHANNELS.snapshot, (event) => {
    if (!isTrustedSender(event) || !mainWindow) {
      return {
        platform: process.platform,
        maximized: false,
        fullscreen: false,
        focused: false
      } satisfies WindowSnapshot
    }

    return createWindowSnapshot(mainWindow)
  })

  ipcMain.handle(WINDOW_CONTROL_CHANNELS.command, (event, command: WindowCommand) => {
    if (!isTrustedSender(event) || !mainWindow) {
      return {
        platform: process.platform,
        maximized: false,
        fullscreen: false,
        focused: false
      } satisfies WindowSnapshot
    }

    return applyWindowCommand(command)
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
  registerWindowStatePublisher(window)
  configureSmokeExit(window)

  const developmentUrl = process.env['ELECTRON_RENDERER_URL']
  if (developmentUrl) {
    const url = new URL(developmentUrl)
    if (isSmokeTest) url.searchParams.set('smoke', '1')
    await window.loadURL(url.toString())
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: isSmokeTest ? { smoke: '1' } : {}
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
