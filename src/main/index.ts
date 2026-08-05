import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  ipcMain,
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
import { UtilitySupervisor } from './utility-supervisor'

const isSmokeTest = process.env.NCX_SMOKE_TEST === '1'
let mainWindow: BrowserWindow | undefined
let supervisor: UtilitySupervisor | undefined
let broker: ConnectionBroker | undefined
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
        writer(`[utility:${stream}] ${normalized}`)
      }
    }
  )
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
  registerControlPlane()
  supervisor.onStatus(broadcastStatus)
  supervisor.start()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('before-quit', () => {
  quitting = true
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
