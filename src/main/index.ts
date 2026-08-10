import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  safeStorage,
  type Tray,
  session,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  utilityProcess
} from 'electron'

import {
  resolveNcxCacheRoot,
  resolveNcxDataRoot
} from '../infrastructure/persistence/account-space'
import { ACCOUNT_CHANNELS } from '../shared/contracts/account-bridge'
import { PROVIDER_PROFILE_CHANNELS } from '../shared/contracts/provider-profile-bridge'
import {
  CLIPBOARD_CHANNELS,
  MAX_CLIPBOARD_TEXT_LENGTH
} from '../shared/contracts/clipboard-bridge'
import { CONTROL_CHANNELS, type RuntimeStatus } from '../shared/contracts/control-plane'
import { LIFECYCLE_CHANNELS } from '../shared/contracts/lifecycle-bridge'
import {
  WINDOW_CONTROL_CHANNELS,
  type WindowCommand,
  type WindowSnapshot
} from '../shared/contracts/window-controls'
import { redactSensitiveText } from '../shared/errors/redact-sensitive-text'
import { AccountSessionSnapshotSchema, type AccountSessionSnapshot } from '../shared/schemas/account'
import { RuntimeStatusSchema } from '../shared/schemas/control-plane'
import { ProviderProfileRequestSchema } from '../shared/schemas/provider-profile'
import { ProviderProfileStore } from '../infrastructure/credentials/provider-profile-store'
import { AuthSessionController, type EstablishResult } from './auth/auth-session-controller'
import { AccountStoreCoordinator } from './auth/account-store-coordinator'
import {
  AnonymousSessionRepository,
  NETEASE_GUEST_PARTITION
} from './auth/anonymous-session-repository'
import { CredentialLeaseCoordinator } from './auth/credential-lease-coordinator'
import { NETEASE_AUTH_PARTITION } from './auth/navigation-policy'
import { ConnectionBroker } from './connection-broker'
import { AppConfigStore } from './app-config-store'
import { ProviderProfileCoordinator } from './provider-profile-coordinator'
import { createApplicationTray } from './app-tray'
import { UtilitySupervisor } from './utility-supervisor'
import {
  createMainWindowOptions,
  createWindowSnapshot,
  resolveCloseWindowAction,
  showMainWindow
} from './window-chrome'

const isSmokeTest = process.env['NCX_SMOKE_TEST'] === '1'
const isLoginSpike = process.env['NCX_T02_SPIKE'] === '1'
let mainWindow: BrowserWindow | undefined
let supervisor: UtilitySupervisor | undefined
let broker: ConnectionBroker | undefined
let authController: AuthSessionController | undefined
/** Utility 账户 SQLite 切换完成回执协调器。 */
let accountStoreCoordinator: AccountStoreCoordinator | undefined
/** Main 持有的应用配置唯一权威来源。 */
let appConfigStore: AppConfigStore | undefined
/** Main 独占的 Provider Profile 与安全凭据协调器。 */
let providerProfileCoordinator: ProviderProfileCoordinator | undefined
let smokeTimer: ReturnType<typeof setTimeout> | undefined
/** 主窗口关闭按钮行为；`minimize` 为兼容旧配置的托盘驻留值。 */
let closeWindowBehavior: 'minimize' | 'quit' = 'minimize'

/** 应用会话期间常驻且防止被垃圾回收的系统托盘。 */
let applicationTray: Tray | undefined

/** 应用是否已经进入真实退出流程。 */
let appIsQuitting = false
/** 退出前 Renderer 刷新状态。 */
let quitFlushState: 'idle' | 'flushing' | 'ready' = 'idle'
/** 等待 Renderer 刷新完成的请求。 */
const pendingLifecycleFlushes = new Map<string, {
  /** 完成当前刷新等待。 */
  resolve: () => void
  /** 有限等待计时器。 */
  timer: ReturnType<typeof setTimeout>
}>()

/** 向主窗口广播最新窗口状态，供自绘窗口控件同步真实状态。 */
function publishWindowSnapshot(window = mainWindow): WindowSnapshot | undefined {
  if (!window || window.isDestroyed()) return undefined

  const snapshot = {
    ...createWindowSnapshot(window),
    closeBehavior: closeWindowBehavior
  }
  window.webContents.send(WINDOW_CONTROL_CHANNELS.status, snapshot)
  return snapshot
}

/** 生成未初始化时的安全游客账户快照。 */
function guestAccountSnapshot(): AccountSessionSnapshot {
  return AccountSessionSnapshotSchema.parse({
    state: 'logged_out',
    accountGeneration: 0,
    hasCredentialLease: false,
    activeAccount: {
      kind: 'guest',
      accountId: 'guest:local',
      displayName: '游客'
    },
    canLogin: true,
    canLogout: false,
    canSwitchAccount: false,
    canMutateMusic: false,
    rendererCanReadSecrets: false
  })
}

/** 读取当前账户安全快照。 */
function currentAccountSnapshot(): AccountSessionSnapshot {
  return authController?.publicSnapshot() ?? guestAccountSnapshot()
}

/** 向主窗口广播最新账户安全快照。 */
function publishAccountSnapshot(): AccountSessionSnapshot {
  const snapshot = currentAccountSnapshot()
  const window = mainWindow
  if (window && !window.isDestroyed()) {
    window.webContents.send(ACCOUNT_CHANNELS.status, snapshot)
  }
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
  } else if (command.type === 'window.setCloseBehavior') {
    closeWindowBehavior = command.behavior
    appConfigStore?.setCloseWindowBehavior(command.behavior)
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
        env: {
          ...process.env,
          NCXMUSIC_DATA_ROOT: resolveNcxDataRoot(app.getPath('userData')),
          NCXMUSIC_CACHE_ROOT: resolveNcxCacheRoot(app.getPath('sessionData'))
        },
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
  ipcMain.on(LIFECYCLE_CHANNELS.flushAck, (event, requestId: unknown) => {
    if (!isTrustedSender(event) || typeof requestId !== 'string') return
    /** 与 Renderer 回执对应的等待项。 */
    const pending = pendingLifecycleFlushes.get(requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingLifecycleFlushes.delete(requestId)
    pending.resolve()
  })

  ipcMain.handle(CLIPBOARD_CHANNELS.writeText, (event, text: unknown) => {
    if (!isTrustedSender(event)) throw new Error('拒绝非主窗口剪贴板请求。')
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_CLIPBOARD_TEXT_LENGTH) {
      throw new Error('剪贴板文本不合法。')
    }
    clipboard.writeText(text)
  })

  ipcMain.handle(PROVIDER_PROFILE_CHANNELS.request, async (event, rawRequest: unknown) => {
    if (!isTrustedSender(event) || !providerProfileCoordinator) {
      throw new Error('Provider Profile 服务不可用。')
    }
    /** Renderer 请求必须先通过共享 Schema。 */
    const request = ProviderProfileRequestSchema.parse(rawRequest)
    return providerProfileCoordinator.handle(request)
  })

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

  ipcMain.handle(ACCOUNT_CHANNELS.snapshot, (event) => {
    if (!isTrustedSender(event)) return guestAccountSnapshot()
    return publishAccountSnapshot()
  })

  ipcMain.handle(ACCOUNT_CHANNELS.login, async (event) => {
    if (!isTrustedSender(event)) return guestAccountSnapshot()
    await authController?.openLogin(false)
    return publishAccountSnapshot()
  })

  ipcMain.handle(ACCOUNT_CHANNELS.switchAccount, async (event) => {
    if (!isTrustedSender(event)) return guestAccountSnapshot()
    await authController?.openLogin(true)
    return publishAccountSnapshot()
  })

  ipcMain.handle(ACCOUNT_CHANNELS.logout, async (event) => {
    if (!isTrustedSender(event)) return guestAccountSnapshot()
    await authController?.logout()
    return publishAccountSnapshot()
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

    return {
      ...createWindowSnapshot(mainWindow),
      closeBehavior: closeWindowBehavior
    }
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

/** 请求 Renderer 刷新播放快照并等待完成或有限超时。 */
function requestRendererFlush(timeoutMs = 2_500): Promise<void> {
  /** 当前主窗口。 */
  const window = mainWindow
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return Promise.resolve()
  /** 本次退出刷新请求 ID。 */
  const requestId = crypto.randomUUID()
  return new Promise((resolve) => {
    /** 超时后继续退出，避免 Renderer 故障永久阻塞应用。 */
    const timer = setTimeout(() => {
      pendingLifecycleFlushes.delete(requestId)
      resolve()
    }, timeoutMs)
    pendingLifecycleFlushes.set(requestId, { resolve, timer })
    window.webContents.send(LIFECYCLE_CHANNELS.flushRequest, { requestId })
  })
}

/** 在真实退出阶段关闭账户、Utility 与等待句柄。 */
function shutdownApplicationServices(): void {
  if (appIsQuitting) return
  appIsQuitting = true
  if (smokeTimer) clearTimeout(smokeTimer)
  for (const pending of pendingLifecycleFlushes.values()) {
    clearTimeout(pending.timer)
    pending.resolve()
  }
  pendingLifecycleFlushes.clear()
  applicationTray?.destroy()
  applicationTray = undefined
  authController?.shutdown()
  accountStoreCoordinator?.shutdown()
  supervisor?.shutdown()
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
  const window = new BrowserWindow(
    createMainWindowOptions({
      platform: process.platform,
      preloadPath: join(__dirname, '../preload/index.js')
    })
  )
  mainWindow = window

  window.on('close', (event) => {
    /** 当前关闭请求对应的真实窗口生命周期动作。 */
    const action = resolveCloseWindowAction({
      closeWindowBehavior,
      appIsQuitting,
      isSmokeTest
    })
    if (action === 'allow-close') return
    event.preventDefault()
    if (action === 'quit') {
      app.quit()
      return
    }
    window.hide()
  })

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
    /** 已存在且需要从托盘或最小化状态恢复的主窗口。 */
    const window = mainWindow
    if (!window || window.isDestroyed()) return
    showMainWindow(window)
  })

  app.whenReady()
    .then(async () => {
      supervisor = createSupervisor()
      broker = new ConnectionBroker(supervisor, app.getVersion())
      /** 使用 Electron safeStorage 加密模型 API Key 和自定义 Header 值。 */
      const providerProfileStore = new ProviderProfileStore(app.getPath('userData'), {
        isAvailable: () => safeStorage.isEncryptionAvailable(),
        encrypt: (value) => safeStorage.encryptString(value),
        decrypt: (value) => safeStorage.decryptString(value)
      })
      providerProfileStore.load()
      providerProfileCoordinator = new ProviderProfileCoordinator(providerProfileStore, supervisor)
      appConfigStore = new AppConfigStore(app.getPath('userData'))
      closeWindowBehavior = appConfigStore.load().closeWindowBehavior
      accountStoreCoordinator = new AccountStoreCoordinator(supervisor)
      authController = new AuthSessionController(
        session.fromPartition(NETEASE_AUTH_PARTITION, { cache: true }),
        new CredentialLeaseCoordinator(supervisor),
        new AnonymousSessionRepository(
          session.fromPartition(NETEASE_GUEST_PARTITION, { cache: false })
        ),
        (accountId, accountGeneration) =>
          accountStoreCoordinator?.open(accountId, accountGeneration) ??
          Promise.reject(new Error('Account store coordinator is unavailable'))
      )
      authController.onResult(() => publishAccountSnapshot())
      authController.onLoginWindowClosed(() => publishAccountSnapshot())
      registerControlPlane()
      supervisor.onStatus((status) => {
        broadcastStatus(status)
        if (status.state === 'ready') providerProfileCoordinator?.syncUtility()
        void (authController?.handleUtilityStatus(status) ?? Promise.resolve()).finally(() =>
          publishAccountSnapshot()
        )
      })
      supervisor.start()
      if (isLoginSpike) {
        await waitForUtilityReady()
        await runLoginSpike()
        return
      }
      await createMainWindow()
      if (!isSmokeTest) {
        applicationTray = await createApplicationTray({
          showMainWindow: () => {
            /** 托盘入口当前可恢复的主窗口。 */
            const window = mainWindow
            if (!window || window.isDestroyed()) return
            showMainWindow(window)
          },
          quitApplication: () => app.quit()
        })
      }
      publishAccountSnapshot()
      if (!isSmokeTest) {
        void waitForUtilityReady()
          .then(() => authController?.restore('startup'))
          .catch(() => console.warn('登录 Session 恢复暂不可用；未清除持久凭据。'))
      }

      app.on('activate', () => {
        /** 平台激活事件发生时的现有主窗口。 */
        const window = mainWindow
        if (!window || window.isDestroyed()) {
          void createMainWindow()
          return
        }
        showMainWindow(window)
      })
    })
    .catch((error) => {
      console.error(`应用启动失败：${redactSensitiveText(error)}`)
      authController?.shutdown()
      supervisor?.shutdown()
      app.exit(1)
    })
}

app.on('before-quit', (event) => {
  if (isSmokeTest || quitFlushState === 'ready') {
    shutdownApplicationServices()
    return
  }
  event.preventDefault()
  if (quitFlushState === 'flushing') return
  quitFlushState = 'flushing'
  void requestRendererFlush().finally(() => {
    quitFlushState = 'ready'
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isSmokeTest) app.quit()
})
