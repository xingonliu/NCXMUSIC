import { statSync } from 'node:fs'
import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Notification,
  safeStorage,
  screen,
  type Session,
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
import { AGENT_SETTINGS_CHANNELS } from '../shared/contracts/agent-settings-bridge'
import { ACCOUNT_CHANNELS } from '../shared/contracts/account-bridge'
import { PROVIDER_PROFILE_CHANNELS } from '../shared/contracts/provider-profile-bridge'
import {
  CLIPBOARD_CHANNELS,
  MAX_CLIPBOARD_TEXT_LENGTH
} from '../shared/contracts/clipboard-bridge'
import { CONTROL_CHANNELS, type RuntimeStatus } from '../shared/contracts/control-plane'
import { EXTENSION_CHANNELS } from '../shared/contracts/extension-bridge'
import { LIFECYCLE_CHANNELS } from '../shared/contracts/lifecycle-bridge'
import { SHELL_SETTINGS_CHANNELS } from '../shared/contracts/shell-settings-bridge'
import { VOICE_SHORTCUT_CHANNELS } from '../shared/contracts/voice-bridge'
import { VOICE_SETTINGS_CHANNELS } from '../shared/contracts/voice-settings-bridge'
import {
  WINDOW_CONTROL_CHANNELS,
  type WindowCommand,
  type WindowSnapshot
} from '../shared/contracts/window-controls'
import { redactSensitiveText } from '../shared/errors/redact-sensitive-text'
import { AccountSessionSnapshotSchema, type AccountSessionSnapshot } from '../shared/schemas/account'
import {
  AgentSafetyRuntimeSyncSchema,
  AgentSafetySettingsRequestSchema,
  AgentSafetySettingsResultSchema
} from '../shared/schemas/agent-settings'
import { RuntimeStatusSchema } from '../shared/schemas/control-plane'
import { ProviderProfileRequestSchema } from '../shared/schemas/provider-profile'
import { ExtensionSettingsRequestSchema } from '../shared/schemas/extensions'
import { VoiceShortcutCommandSchema, VoiceShortcutEventSchema } from '../shared/schemas/voice'
import {
  VoiceCloudTranscriptionInputSchema,
  VoiceAgentNotificationInputSchema,
  VoiceLocalPcmChunkSchema,
  VoiceLocalSessionEndSchema,
  VoiceLocalSessionStartSchema,
  VoiceServiceEventSchema,
  VoiceOverlayStateSchema,
  VoiceSettingsRequestSchema
} from '../shared/schemas/voice-settings'
import { ShellSettingsRequestSchema } from '../shared/schemas/shell'
import { ProviderProfileStore } from '../infrastructure/credentials/provider-profile-store'
import { VoiceSettingsStore } from '../infrastructure/credentials/voice-settings-store'
import { LocalModelInstaller } from '../infrastructure/voice/local-model-installer'
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
import { ExtensionCoordinator, selectedSkillSource } from './extension-coordinator'
import { createApplicationTray } from './app-tray'
import { UtilitySupervisor } from './utility-supervisor'
import { VoiceShortcutCoordinator } from './voice-shortcut-coordinator'
import { LocalAsrCoordinator } from './local-asr-coordinator'
import { VoiceSettingsCoordinator } from './voice-settings-coordinator'
import { ShellSettingsCoordinator } from './shell-settings-coordinator'
import {
  APPLICATION_DISPLAY_NAME,
  createMainWindowOptions,
  createWindowsAppDetails,
  createWindowSnapshot,
  resolveCloseWindowAction,
  showMainWindow,
  WINDOWS_APP_USER_MODEL_ID
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
/** Main 独占的 Skill/MCP 配置、Secret 与 Utility 同步协调器。 */
let extensionCoordinator: ExtensionCoordinator | undefined
/** Main 独占的全局语音快捷键与 InputHookHost 协调器。 */
let voiceShortcutCoordinator: VoiceShortcutCoordinator | undefined
/** Main 独占的语音来源、模型安装和识别协调器。 */
let voiceSettingsCoordinator: VoiceSettingsCoordinator | undefined
/** 统一显示在鼠标所在屏幕任务栏上方的无焦点语音胶囊。 */
let voiceOverlayWindow: BrowserWindow | undefined
/** 外置语音胶囊延迟隐藏计时器。 */
let voiceOverlayHideTimer: ReturnType<typeof setTimeout> | undefined
/** 外置语音胶囊最近展示状态。 */
let latestVoiceOverlayState = VoiceOverlayStateSchema.parse({
  phase: 'idle',
  text: '',
  waveform: Array.from({ length: 12 }, () => 0.08),
  theme: 'system'
})
/** 外置语音胶囊透明承载窗口宽度，容纳最大 480px 胶囊与阴影。 */
const VOICE_OVERLAY_WIDTH = 500
/** 外置语音胶囊透明承载窗口高度。 */
const VOICE_OVERLAY_HEIGHT = 70
/** 外置语音胶囊与任务栏工作区底边的间距。 */
const VOICE_OVERLAY_BOTTOM_GAP = 12
/** Main 独占的 Shell 授权工作区协调器。 */
let shellSettingsCoordinator: ShellSettingsCoordinator | undefined
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

/** 解析 UtilityProcess 构建入口；打包后从 asar 解包目录执行原生/适配模块。 */
function utilityEntryPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'utility.js')
  }
  return join(__dirname, 'utility.js')
}

/** 解析 InputHookHost 构建入口；打包后从 asar 解包目录执行原生模块。 */
function inputHookEntryPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'out', 'main', 'inputHook.js')
  }
  return join(__dirname, 'inputHook.js')
}

/** 返回本地 ASR utilityProcess 的构建入口。 */
function localAsrEntryPath(): string {
  return join(__dirname, 'localAsr.js')
}

/** 解析应用程序主图标绝对路径，Windows 使用多尺寸 ICO，其余平台使用 PNG。 */
function appIconEntryPath(): string {
  /** 当前平台适用的应用图标文件名。 */
  const iconFileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  return join(__dirname, '../../resources', iconFileName)
}

/** 解析 Windows 从任务栏重新启动当前应用时执行的完整命令。 */
function windowsRelaunchCommand(): string {
  if (app.isPackaged) return `"${process.execPath}"`
  return `"${process.execPath}" "${app.getAppPath()}"`
}

/** 将 Ncxmusic 名称、AppUserModelID 与图标写入指定 Windows 窗口的任务栏身份。 */
function applyWindowsWindowIdentity(window: BrowserWindow): void {
  if (process.platform !== 'win32') return
  /** 已打包应用优先使用 EXE 内嵌图标，开发环境使用工作区 ICO。 */
  const taskbarIconPath = app.isPackaged ? process.execPath : appIconEntryPath()
  window.setAppDetails(createWindowsAppDetails({
    iconPath: taskbarIconPath,
    relaunchCommand: windowsRelaunchCommand()
  }))
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
        serviceName: 'Ncxmusic Runtime',
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

/** 向主窗口发布经共享 Schema 校验的语音快捷键事件。 */
function publishVoiceShortcutEvent(rawEvent: unknown): void {
  /** 已校验的最小语音事件。 */
  const event = VoiceShortcutEventSchema.safeParse(rawEvent)
  const window = mainWindow
  console.info('[Main] 收到语音快捷键事件:', JSON.stringify(rawEvent))
  if (!event.success) {
    console.warn('[Main] 语音快捷键事件校验失败:', event.error)
    return
  }
  if (!window || window.isDestroyed()) {
    console.warn('[Main] 主窗口不存在或已销毁，忽略语音快捷键事件')
    return
  }
  if (event.data.type === 'pressed' && window.isFullScreen()) {
    console.warn('[Main] 主窗口处于全屏模式，已暂停并取消语音快捷键')
    window.webContents.send(VOICE_SHORTCUT_CHANNELS.event, {
      type: 'cancelled',
      generation: event.data.generation,
      reason: '全屏演示或沉浸模式下已暂停语音快捷键。'
    })
    return
  }
  if (event.data.type === 'pressed') {
    console.info('[Main] 正在显示任务栏上方的外置语音胶囊')
    updateVoiceOverlay({
      phase: 'starting',
      text: '准备中',
      waveform: Array.from({ length: 12 }, () => 0.08),
      theme: latestVoiceOverlayState.theme
    })
  }
  window.webContents.send(VOICE_SHORTCUT_CHANNELS.event, event.data)
}

/** 创建并预加载鼠标所在显示器底部的外置语音胶囊。 */
function ensureVoiceOverlayWindow(): BrowserWindow {
  if (voiceOverlayWindow && !voiceOverlayWindow.isDestroyed()) return voiceOverlayWindow
  /** 无焦点胶囊窗口；窗口外围透明，仅展示磨砂 HUD 实体。 */
  const window = new BrowserWindow({
    width: VOICE_OVERLAY_WIDTH,
    height: VOICE_OVERLAY_HEIGHT,
    icon: appIconEntryPath(),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  applyWindowsWindowIdentity(window)
  voiceOverlayWindow = window
  window.setAlwaysOnTop(true, 'floating')
  if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.once('did-finish-load', () => renderVoiceOverlay(latestVoiceOverlayState))
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(VOICE_OVERLAY_HTML)}`)
  window.once('closed', () => {
    if (voiceOverlayWindow === window) voiceOverlayWindow = undefined
  })
  return window
}

/** 更新并定位统一外置语音胶囊，不依赖主窗口焦点状态。 */
function updateVoiceOverlay(rawState: unknown): void {
  /** 经校验的纯展示状态。 */
  const state = VoiceOverlayStateSchema.safeParse(rawState)
  if (!state.success) return
  latestVoiceOverlayState = state.data
  if (voiceOverlayHideTimer) clearTimeout(voiceOverlayHideTimer)
  voiceOverlayHideTimer = undefined
  if (state.data.phase === 'idle') {
    renderVoiceOverlay(state.data)
    voiceOverlayHideTimer = setTimeout(() => {
      voiceOverlayWindow?.hide()
      voiceOverlayHideTimer = undefined
    }, 280)
    return
  }
  /** 当前鼠标所在显示器。 */
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  /** 胶囊窗口。 */
  const window = ensureVoiceOverlayWindow()
  /** 任务栏或 Dock 内侧可用区域。 */
  const workArea = display.workArea
  window.setBounds({
    x: Math.round(workArea.x + (workArea.width - VOICE_OVERLAY_WIDTH) / 2),
    y: Math.round(workArea.y + workArea.height - VOICE_OVERLAY_HEIGHT - VOICE_OVERLAY_BOTTOM_GAP),
    width: VOICE_OVERLAY_WIDTH,
    height: VOICE_OVERLAY_HEIGHT
  })
  renderVoiceOverlay(state.data)
  window.showInactive()
}

/** 将受限状态写入隔离的 data URL 胶囊 DOM。 */
function renderVoiceOverlay(state: typeof latestVoiceOverlayState): void {
  /** 当前外置窗口。 */
  const window = voiceOverlayWindow
  if (!window || window.isDestroyed() || window.webContents.isLoading()) return
  /** 只包含 Schema 校验值的 JSON。 */
  const payload = JSON.stringify(state)
  void window.webContents.executeJavaScript(`window.__renderVoiceOverlay(${payload})`, true).catch(() => undefined)
}

/** 外置语音胶囊的无权限静态页面。 */
const VOICE_OVERLAY_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root {
      --voice-overlay-bg: rgba(22, 22, 26, 0.88);
      --voice-overlay-text: #ffffff;
      --voice-overlay-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.46), 0 2px 6px rgba(0, 0, 0, 0.22);
      --voice-overlay-squircle-smoothing: 60%;
      --voice-overlay-squircle-radius-xs: 6px;
      --voice-overlay-squircle-radius-full: 9999px;
      --voice-overlay-font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      --voice-overlay-spring: cubic-bezier(0.175, 0.885, 0.32, 1.25);
      --voice-overlay-exit: cubic-bezier(0.4, 0, 0.2, 1);
    }

    .voice-overlay-shell[data-theme="light"] {
      --voice-overlay-bg: rgba(255, 255, 255, 0.88);
      --voice-overlay-text: #1d1d1f;
      --voice-overlay-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);
    }

    @media (prefers-color-scheme: light) {
      .voice-overlay-shell:not([data-theme="dark"]) {
        --voice-overlay-bg: rgba(255, 255, 255, 0.88);
        --voice-overlay-text: #1d1d1f;
        --voice-overlay-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04);
      }
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
    }

    body {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 20px;
      font-family: var(--voice-overlay-font);
      pointer-events: none;
      user-select: none;
    }

    .voice-overlay-shell {
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      opacity: 0;
      visibility: hidden;
      border-radius: var(--voice-overlay-squircle-radius-full);
      -electron-corner-smoothing: var(--voice-overlay-squircle-smoothing);
      pointer-events: none;
      transform: translateY(18px) scale(0.88);
      transition:
        opacity 0.28s var(--voice-overlay-exit),
        transform 0.35s var(--voice-overlay-spring),
        visibility 0.35s;
      will-change: transform, opacity;
    }

    .voice-overlay-shell.is-visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }

    .voice-overlay-shell.is-exiting {
      opacity: 0;
      visibility: visible;
      transform: translateY(14px) scale(0.92);
      transition:
        opacity 0.25s var(--voice-overlay-exit),
        transform 0.25s var(--voice-overlay-exit);
    }

    .voice-overlay-capsule {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      width: fit-content;
      height: 42px;
      min-width: 120px;
      max-width: 480px;
      padding: 0 16px 0 10px;
      overflow: hidden;
      color: var(--voice-overlay-text);
      background: var(--voice-overlay-bg);
      border: 0;
      border-radius: var(--voice-overlay-squircle-radius-full);
      -electron-corner-smoothing: var(--voice-overlay-squircle-smoothing);
      box-shadow: var(--voice-overlay-shadow);
      outline: 0;
      backdrop-filter: blur(28px) saturate(190%);
      transition:
        min-width 0.32s var(--voice-overlay-spring),
        max-width 0.32s var(--voice-overlay-spring),
        background 0.3s ease,
        color 0.3s ease,
        box-shadow 0.3s ease;
    }

    .voice-overlay-orb-container {
      position: relative;
      display: flex;
      flex: 0 0 24px;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin-right: 8px;
    }

    .voice-overlay-orb {
      position: relative;
      width: 20px;
      height: 20px;
      background: conic-gradient(
        from 180deg at 50% 50%,
        #ff2d55 0deg,
        #af52de 70deg,
        #5e5ce6 140deg,
        #007aff 200deg,
        #30d158 270deg,
        #ff9500 320deg,
        #ff2d55 360deg
      );
      border-radius: var(--voice-overlay-squircle-radius-full);
      -electron-corner-smoothing: var(--voice-overlay-squircle-smoothing);
      box-shadow: 0 0 10px rgba(94, 92, 230, 0.6), inset 0 0 3px rgba(255, 255, 255, 0.6);
      filter: blur(0.5px);
      transition: transform 0.3s var(--voice-overlay-spring), filter 0.3s ease;
    }

    .voice-overlay-content {
      display: flex;
      flex: 1;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    .voice-overlay-title {
      max-width: 400px;
      overflow: hidden;
      color: var(--voice-overlay-text);
      font-size: 13.5px;
      font-weight: 550;
      line-height: 1;
      letter-spacing: -0.01em;
      text-overflow: ellipsis;
      transition: color 0.3s ease;
      white-space: nowrap;
    }

    .voice-overlay-wave {
      display: none;
      flex: 0 0 65px;
      width: 65px;
      height: 20px;
      border-radius: var(--voice-overlay-squircle-radius-xs);
      -electron-corner-smoothing: var(--voice-overlay-squircle-smoothing);
    }

    .voice-overlay-capsule[data-state="starting"] { min-width: 110px; }
    .voice-overlay-capsule[data-state="listening"] { min-width: 175px; }
    .voice-overlay-capsule[data-state="transcribing"] { min-width: 130px; }
    .voice-overlay-capsule[data-state="reviewing"] { min-width: 145px; max-width: 460px; }

    .voice-overlay-capsule[data-state="listening"] .voice-overlay-orb {
      animation: voice-overlay-spin 2s linear infinite, voice-overlay-pulse-glow 1.4s ease-in-out infinite;
    }

    .voice-overlay-capsule[data-state="listening"] .voice-overlay-wave { display: block; }

    .voice-overlay-capsule[data-state="transcribing"] .voice-overlay-orb {
      animation: voice-overlay-spin 0.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
      filter: blur(1px) brightness(1.25);
    }

    .voice-overlay-capsule[data-state="reviewing"] .voice-overlay-orb {
      box-shadow: 0 0 10px rgba(48, 209, 88, 0.7);
      transform: scale(1.06);
    }

    @keyframes voice-overlay-spin {
      0% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(180deg) scale(1.08); }
      100% { transform: rotate(360deg) scale(1); }
    }

    @keyframes voice-overlay-pulse-glow {
      0%, 100% {
        filter: blur(0.5px) brightness(1);
        box-shadow: 0 0 8px rgba(94, 92, 230, 0.5);
      }
      50% {
        filter: blur(1.2px) brightness(1.3);
        box-shadow: 0 0 14px rgba(0, 199, 255, 0.8), 0 0 18px rgba(255, 45, 85, 0.6);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .voice-overlay-shell,
      .voice-overlay-capsule,
      .voice-overlay-orb {
        animation: none;
        transition: none;
      }
    }
  </style>
</head>
<body>
  <div id="voice-overlay-shell" class="voice-overlay-shell" data-theme="system">
    <div id="voice-overlay-capsule" class="voice-overlay-capsule" data-state="starting">
      <div class="voice-overlay-orb-container" aria-hidden="true">
        <div class="voice-overlay-orb"></div>
      </div>
      <div class="voice-overlay-content">
        <div id="voice-overlay-title" class="voice-overlay-title">准备中</div>
        <canvas id="voice-overlay-wave" class="voice-overlay-wave" width="130" height="40" aria-hidden="true"></canvas>
      </div>
    </div>
  </div>
  <script>
    // ========= 变量 =========

    /** 胶囊显隐动画容器。 */
    const voiceOverlayShell = document.getElementById('voice-overlay-shell');
    /** 根据识别阶段切换视觉状态的胶囊实体。 */
    const voiceOverlayCapsule = document.getElementById('voice-overlay-capsule');
    /** 单行识别状态或转写文本。 */
    const voiceOverlayTitle = document.getElementById('voice-overlay-title');
    /** 收音状态下的三色流体波形画布。 */
    const voiceOverlayWave = document.getElementById('voice-overlay-wave');
    /** 波形二维绘图上下文。 */
    const voiceOverlayWaveContext = voiceOverlayWave.getContext('2d');
    /** 当前录音频谱，固定为十二个归一化采样点。 */
    let voiceOverlayWaveform = Array.from({ length: 12 }, () => 0.08);
    /** 当前识别展示阶段。 */
    let voiceOverlayPhase = 'idle';
    /** 流体波形动画相位。 */
    let voiceOverlayWavePhase = 0;
    /** 仅收音状态运行的流体波形动画帧。 */
    let voiceOverlayAnimationFrame;
    /** 用户是否要求减少动画。 */
    const voiceOverlayReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ========= 函数 =========

    /** 返回阶段对应的默认单行文案。 */
    function resolveVoiceOverlayTitle(state) {
      if (state.text) return state.text;
      if (state.phase === 'starting') return '正在启动语音识别…';
      if (state.phase === 'listening') return '正在收音…';
      if (state.phase === 'transcribing') return '正在转写…';
      if (state.phase === 'reviewing') return '识别完成';
      return '';
    }

    /** 根据十二点频谱插值当前横坐标的归一化振幅。 */
    function resolveVoiceOverlayAmplitude(progress) {
      const waveformIndex = Math.min(voiceOverlayWaveform.length - 1, Math.floor(progress * voiceOverlayWaveform.length));
      return Math.max(0.08, voiceOverlayWaveform[waveformIndex] || 0.08);
    }

    /** 绘制与彩虹光球呼应的三层流体声波。 */
    function drawVoiceOverlayWave() {
      const width = voiceOverlayWave.width;
      const height = voiceOverlayWave.height;
      const centerY = height / 2;
      const ribbons = [
        { color: 'rgba(255, 45, 85, 0.85)', frequency: 0.045, speed: 1.2, amplitude: 10 },
        { color: 'rgba(94, 92, 230, 0.9)', frequency: 0.055, speed: -1, amplitude: 9 },
        { color: 'rgba(0, 199, 255, 0.85)', frequency: 0.04, speed: 1.5, amplitude: 7 }
      ];

      voiceOverlayWaveContext.clearRect(0, 0, width, height);
      if (voiceOverlayPhase !== 'listening') return;

      for (const ribbon of ribbons) {
        voiceOverlayWaveContext.beginPath();
        voiceOverlayWaveContext.strokeStyle = ribbon.color;
        voiceOverlayWaveContext.lineWidth = 1.8;
        voiceOverlayWaveContext.lineCap = 'round';
        for (let x = 0; x <= width; x += 3) {
          const progress = x / width;
          const envelope = Math.sin(progress * Math.PI);
          const volume = 0.25 + resolveVoiceOverlayAmplitude(progress) * 0.75;
          const offset = Math.sin(x * ribbon.frequency + voiceOverlayWavePhase * ribbon.speed) * ribbon.amplitude * volume * envelope;
          if (x === 0) voiceOverlayWaveContext.moveTo(x, centerY + offset);
          else voiceOverlayWaveContext.lineTo(x, centerY + offset);
        }
        voiceOverlayWaveContext.stroke();
      }
    }

    /** 收音期间推进一帧波形动画。 */
    function animateVoiceOverlayWave() {
      if (!voiceOverlayReducedMotion) voiceOverlayWavePhase += 0.08;
      drawVoiceOverlayWave();
      if (voiceOverlayReducedMotion || voiceOverlayPhase !== 'listening') {
        voiceOverlayAnimationFrame = undefined;
        return;
      }
      voiceOverlayAnimationFrame = window.requestAnimationFrame(animateVoiceOverlayWave);
    }

    /** 只在胶囊处于收音状态时占用动画帧，隐藏预热时保持零循环。 */
    function syncVoiceOverlayWaveAnimation() {
      if (voiceOverlayPhase === 'listening' && voiceOverlayAnimationFrame === undefined) {
        animateVoiceOverlayWave();
        return;
      }
      if (voiceOverlayPhase === 'listening' || voiceOverlayAnimationFrame === undefined) return;
      window.cancelAnimationFrame(voiceOverlayAnimationFrame);
      voiceOverlayAnimationFrame = undefined;
      drawVoiceOverlayWave();
    }

    /** 接收 Main 校验后的纯展示状态并更新 HUD。 */
    window.__renderVoiceOverlay = function renderVoiceOverlayState(state) {
      voiceOverlayPhase = state.phase;
      voiceOverlayWaveform = state.waveform;
      voiceOverlayShell.dataset.theme = state.theme;
      voiceOverlayCapsule.dataset.state = state.phase;
      voiceOverlayTitle.textContent = resolveVoiceOverlayTitle(state);
      syncVoiceOverlayWaveAnimation();
      if (state.phase === 'idle') {
        voiceOverlayShell.classList.remove('is-visible');
        voiceOverlayShell.classList.add('is-exiting');
        return;
      }
      voiceOverlayShell.classList.remove('is-exiting');
      voiceOverlayShell.classList.add('is-visible');
    };
  </script>
</body>
</html>`

/** 向所有主窗口 Renderer 广播经 Schema 校验的语音服务事件。 */
function publishVoiceServiceEvent(rawEvent: unknown): void {
  /** 已校验事件。 */
  const event = VoiceServiceEventSchema.safeParse(rawEvent)
  if (!event.success) return
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(VOICE_SETTINGS_CHANNELS.event, event.data)
    }
  }
}

/** 将 Main 持久化的 Agent 安全设置同步给当前 Utility 代次。 */
function syncAgentSafetyToUtility(): boolean {
  /** 当前 Main 配置存储。 */
  const store = appConfigStore
  if (!store) return false
  /** 当前已校验的应用配置。 */
  const config = store.load()
  return supervisor?.postControl(AgentSafetyRuntimeSyncSchema.parse({
    kind: 'agent.safety.sync',
    preferences: config.agentSafety
  })) ?? false
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

  ipcMain.handle(AGENT_SETTINGS_CHANNELS.request, async (event, rawRequest: unknown) => {
    if (!isTrustedSender(event) || !appConfigStore) {
      throw new Error('Agent 安全设置服务不可用。')
    }
    /** Renderer 发来的严格 Agent 安全设置请求。 */
    const request = AgentSafetySettingsRequestSchema.parse(rawRequest)
    /** Main 当前应用配置。 */
    const config = request.operation === 'setSafety'
      ? appConfigStore.setAgentSafety({
          ...(request.musicSafetyLevel ? { musicSafetyLevel: request.musicSafetyLevel } : {}),
          ...(request.commandSafetyLevel ? { commandSafetyLevel: request.commandSafetyLevel } : {}),
          ...(request.shellToolEnabled !== undefined ? { shellToolEnabled: request.shellToolEnabled } : {})
        })
      : appConfigStore.load()
    if (request.operation === 'setSafety') syncAgentSafetyToUtility()
    return AgentSafetySettingsResultSchema.parse({ preferences: config.agentSafety })
  })

  ipcMain.handle(EXTENSION_CHANNELS.request, async (event, rawRequest: unknown) => {
    if (!isTrustedSender(event) || !extensionCoordinator) {
      throw new Error('扩展设置服务不可用。')
    }
    /** Renderer 请求必须先通过共享扩展 Schema。 */
    const request = ExtensionSettingsRequestSchema.parse(rawRequest)
    return extensionCoordinator.handle(request)
  })

  ipcMain.handle(VOICE_SHORTCUT_CHANNELS.command, async (event, rawCommand: unknown) => {
    if (!isTrustedSender(event) || !voiceShortcutCoordinator) {
      throw new Error('语音快捷键服务不可用。')
    }
    /** Renderer 发来的严格语音快捷键命令。 */
    const command = VoiceShortcutCommandSchema.parse(rawCommand)
    if (command.operation === 'snapshot') return voiceShortcutCoordinator.snapshot()
    if (command.operation === 'openPermissionSettings') {
      return voiceShortcutCoordinator.openPermissionSettings()
    }
    return voiceShortcutCoordinator.configure(command.enabled, command.chord)
  })

  ipcMain.handle(VOICE_SETTINGS_CHANNELS.request, (event, rawRequest: unknown) => {
    if (!isTrustedSender(event) || !voiceSettingsCoordinator) throw new Error('语音设置服务不可用。')
    /** Renderer 发来的严格语音设置请求。 */
    const request = VoiceSettingsRequestSchema.parse(rawRequest)
    return voiceSettingsCoordinator.request(request)
  })

  ipcMain.handle(VOICE_SETTINGS_CHANNELS.localStart, async (event, rawInput: unknown) => {
    if (!isTrustedSender(event) || !voiceSettingsCoordinator) throw new Error('本地语音识别服务不可用。')
    await voiceSettingsCoordinator.startLocal(VoiceLocalSessionStartSchema.parse(rawInput))
  })

  ipcMain.on(VOICE_SETTINGS_CHANNELS.localChunk, (event, rawInput: unknown) => {
    if (!isTrustedSender(event) || !voiceSettingsCoordinator) return
    /** 受限 PCM 数据块。 */
    const input = VoiceLocalPcmChunkSchema.safeParse(rawInput)
    if (input.success) voiceSettingsCoordinator.sendLocalChunk(input.data)
  })

  ipcMain.handle(VOICE_SETTINGS_CHANNELS.localFinish, async (event, rawInput: unknown) => {
    if (!isTrustedSender(event) || !voiceSettingsCoordinator) throw new Error('本地语音识别服务不可用。')
    return voiceSettingsCoordinator.finishLocal(VoiceLocalSessionEndSchema.parse(rawInput))
  })

  ipcMain.on(VOICE_SETTINGS_CHANNELS.localCancel, (event, rawInput: unknown) => {
    if (!isTrustedSender(event) || !voiceSettingsCoordinator) return
    /** 待取消本地会话。 */
    const input = VoiceLocalSessionEndSchema.safeParse(rawInput)
    if (input.success) voiceSettingsCoordinator.cancelLocal(input.data)
  })

  ipcMain.handle(VOICE_SETTINGS_CHANNELS.cloudTranscribe, async (event, rawInput: unknown) => {
    if (!isTrustedSender(event) || !voiceSettingsCoordinator) throw new Error('独立云端语音识别服务不可用。')
    return voiceSettingsCoordinator.transcribeCloud(VoiceCloudTranscriptionInputSchema.parse(rawInput))
  })

  ipcMain.on(VOICE_SETTINGS_CHANNELS.cloudCancel, (event, rawInput: unknown) => {
    if (!isTrustedSender(event) || !voiceSettingsCoordinator) return
    /** 待取消云端会话。 */
    const input = VoiceLocalSessionEndSchema.safeParse(rawInput)
    if (input.success) voiceSettingsCoordinator.cancelCloud(input.data)
  })

  ipcMain.on(VOICE_SETTINGS_CHANNELS.overlayState, (event, rawInput: unknown) => {
    if (!isTrustedSender(event)) return
    updateVoiceOverlay(rawInput)
  })

  ipcMain.on(VOICE_SETTINGS_CHANNELS.notifyAgentComplete, (event, rawInput: unknown) => {
    if (!isTrustedSender(event)) return
    /** 经校验的通知文案。 */
    const input = VoiceAgentNotificationInputSchema.safeParse(rawInput)
    if (!input.success || !Notification.isSupported()) return
    /** 操作系统原生通知。 */
    const notification = new Notification({ title: input.data.title, body: input.data.body })
    notification.on('click', () => {
      /** 当前可恢复主窗口。 */
      const window = mainWindow
      if (!window || window.isDestroyed()) return
      showMainWindow(window)
      publishVoiceServiceEvent({ type: 'open-agent' })
    })
    notification.show()
  })

  ipcMain.handle(SHELL_SETTINGS_CHANNELS.request, async (event, rawRequest: unknown) => {
    if (!isTrustedSender(event) || !shellSettingsCoordinator) {
      throw new Error('Shell 工作区设置服务不可用。')
    }
    /** Renderer 发来的严格 Shell 设置请求。 */
    const request = ShellSettingsRequestSchema.parse(rawRequest)
    return shellSettingsCoordinator.handle(request)
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
  voiceShortcutCoordinator?.shutdown()
  voiceSettingsCoordinator?.shutdown()
  if (voiceOverlayHideTimer) clearTimeout(voiceOverlayHideTimer)
  voiceOverlayHideTimer = undefined
  voiceOverlayWindow?.destroy()
  voiceOverlayWindow = undefined
  extensionCoordinator?.shutdown()
  supervisor?.shutdown()
}

/** 只允许主窗口为音频录制请求麦克风权限，拒绝视频和其他页面。 */
function configureMediaPermissions(window: BrowserWindow, targetSession: Session): void {
  targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    /** 媒体请求实际声明的媒体轨道；非媒体请求为空。 */
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
    /** 是否为主窗口发起的纯音频媒体权限。 */
    const trustedAudioRequest = webContents === window.webContents
      && permission === 'media'
      && (!mediaTypes || mediaTypes.every((type: string) => type === 'audio'))
    callback(trustedAudioRequest)
  })
  targetSession.setPermissionCheckHandler((webContents, permission, _origin, details) => {
    /** Chromium 权限预检同样只允许当前主窗口纯音频。 */
    return webContents === window.webContents
      && permission === 'media'
      && (!details.mediaType || details.mediaType === 'audio')
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
  const window = new BrowserWindow(
    createMainWindowOptions({
      platform: process.platform,
      preloadPath: join(__dirname, '../preload/index.js'),
      iconPath: appIconEntryPath()
    })
  )
  applyWindowsWindowIdentity(window)
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
  configureMediaPermissions(window, window.webContents.session)
  registerWindowStatePublisher(window)
  configureSmokeExit(window)

  window.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      window.webContents.toggleDevTools()
    }
  })

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

// ========= 应用主入口与单实例锁 =========

/** 设置应用跨平台权威显示名称。 */
app.name = APPLICATION_DISPLAY_NAME
app.setName(APPLICATION_DISPLAY_NAME)

/** Windows 在创建任何窗口前固定通知、任务栏与快捷方式归组标识。 */
if (process.platform === 'win32') app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID)

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
      if (process.platform === 'darwin' && app.dock) {
        try {
          app.dock.setIcon(appIconEntryPath())
        } catch {
          // 平台或环境不支持设置 Dock 图标时静默忽略
        }
      }
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
      /** 语音设置与 Provider 共用的系统安全存储适配器。 */
      const voiceSecretCipher = {
        isAvailable: (): boolean => safeStorage.isEncryptionAvailable(),
        encrypt: (value: string): Buffer => safeStorage.encryptString(value),
        decrypt: (value: Buffer): string => safeStorage.decryptString(value)
      }
      /** Main 独占的语音设置仓库。 */
      const voiceSettingsStore = new VoiceSettingsStore(app.getPath('userData'), voiceSecretCipher)
      voiceSettingsStore.load(Boolean(providerProfileStore.activeProfileId()))
      /** 应用私有目录中的本地模型安装器。 */
      const localModelInstaller = new LocalModelInstaller(app.getPath('userData'))
      /** 本地 ASR 进程协调器。 */
      const localAsrCoordinator = new LocalAsrCoordinator({
        entryPath: localAsrEntryPath(),
        installer: localModelInstaller,
        loadMode: () => voiceSettingsStore.snapshot().localLoadMode,
        publish: publishVoiceServiceEvent
      })
      voiceSettingsCoordinator = new VoiceSettingsCoordinator({
        store: voiceSettingsStore,
        installer: localModelInstaller,
        localAsr: localAsrCoordinator,
        publish: publishVoiceServiceEvent
      })
      extensionCoordinator = new ExtensionCoordinator({
        dataRoot: app.getPath('userData'),
        protector: {
          isAvailable: () => safeStorage.isEncryptionAvailable(),
          encrypt: (value) => safeStorage.encryptString(value),
          decrypt: (value) => safeStorage.decryptString(value)
        },
        supervisor,
        chooseSkillSource: async (sourceType) => {
          /** 与来源类型严格对应的系统选择结果。 */
          const result = await dialog.showOpenDialog({
            title: sourceType === 'folder' ? '选择 Skill 文件夹' : '选择 Skill ZIP',
            properties: [sourceType === 'folder' ? 'openDirectory' : 'openFile'],
            ...(sourceType === 'zip'
              ? { filters: [{ name: 'Skill ZIP', extensions: ['zip'] }] }
              : {})
          })
          /** 用户选择的首个路径。 */
          const path = result.canceled ? undefined : result.filePaths[0]
          if (!path) return undefined
          return selectedSkillSource(path, statSync(path).isDirectory())
        }
      })
      shellSettingsCoordinator = new ShellSettingsCoordinator({
        dataRoot: app.getPath('userData'),
        supervisor,
        chooseDirectory: async () => {
          /** 用户明确选择的单个工作区目录。 */
          const result = await dialog.showOpenDialog({
            title: '授权 Shell 工作区',
            properties: ['openDirectory', 'createDirectory']
          })
          return result.canceled ? undefined : result.filePaths[0]
        }
      })
      voiceShortcutCoordinator = new VoiceShortcutCoordinator({
        userDataPath: app.getPath('userData'),
        hostEntryPath: inputHookEntryPath(),
        publish: publishVoiceShortcutEvent
      })
      appConfigStore = new AppConfigStore(app.getPath('userData'))
      closeWindowBehavior = appConfigStore.load().closeWindowBehavior
      accountStoreCoordinator = new AccountStoreCoordinator(supervisor)
      /** 允许 Web Audio API 跨域提取音频频谱。 */
      const configureCorsHeaders = (targetSession: Session): void => {
        targetSession.webRequest.onHeadersReceived((details, callback) => {
          const responseHeaders = { ...details.responseHeaders }
          responseHeaders['access-control-allow-origin'] = ['*']
          responseHeaders['access-control-allow-headers'] = ['*']
          callback({ responseHeaders })
        })
      }
      configureCorsHeaders(session.defaultSession)
      const authSession = session.fromPartition(NETEASE_AUTH_PARTITION, { cache: true })
      const guestSession = session.fromPartition(NETEASE_GUEST_PARTITION, { cache: false })
      configureCorsHeaders(authSession)
      configureCorsHeaders(guestSession)

      authController = new AuthSessionController(
        authSession,
        new CredentialLeaseCoordinator(supervisor),
        new AnonymousSessionRepository(guestSession),
        (accountId, accountGeneration) =>
          accountStoreCoordinator?.open(accountId, accountGeneration) ??
          Promise.reject(new Error('Account store coordinator is unavailable'))
      )
      authController.onResult(() => publishAccountSnapshot())
      authController.onLoginWindowClosed(() => publishAccountSnapshot())
      registerControlPlane()
      voiceShortcutCoordinator.start()
      supervisor.onStatus((status) => {
        broadcastStatus(status)
        if (status.state === 'ready') {
          try {
            syncAgentSafetyToUtility()
          } catch (error) {
            console.error('[Supervisor] 同步 Agent 安全设置失败:', error)
          }
          try {
            providerProfileCoordinator?.syncUtility()
          } catch (error) {
            console.error('[Supervisor] 同步 Provider Profile 失败:', error)
          }
          try {
            extensionCoordinator?.syncUtility()
          } catch (error) {
            console.error('[Supervisor] 同步扩展配置失败:', error)
          }
          try {
            shellSettingsCoordinator?.syncUtility()
          } catch (error) {
            console.error('[Supervisor] 同步 Shell 设置失败:', error)
          }
        }
        void (authController?.handleUtilityStatus(status) ?? Promise.resolve())
          .catch(() => {
            // Utility 代次切换可使在途租约被拒绝；下一次 ready 会重新建立，不泄露凭据错误细节。
            console.warn('Utility 状态切换期间账户租约暂未建立；等待下一次 ready 重试。')
          })
          .finally(() => publishAccountSnapshot())
      })
      supervisor.start()
      if (isLoginSpike) {
        await waitForUtilityReady()
        await runLoginSpike()
        return
      }
      if (!isSmokeTest) ensureVoiceOverlayWindow()
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
