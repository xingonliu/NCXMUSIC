import { join } from 'node:path'

import { app, BrowserWindow, utilityProcess, type UtilityProcess } from 'electron'

import { RuntimeReadyMessageSchema } from '../shared/schemas/runtime'

let mainWindow: BrowserWindow | undefined
let runtimeProcess: UtilityProcess | undefined

function runtimeEntryPath(): string {
  if (app.isPackaged) {
    return join(
      process.resourcesPath,
      'app.asar.unpacked',
      'out',
      'main',
      'utility.js'
    )
  }

  return join(__dirname, 'utility.js')
}

function startRuntime(): void {
  const child = utilityProcess.fork(runtimeEntryPath(), [], {
    serviceName: 'NcxMusic Runtime',
    stdio: 'pipe'
  })
  runtimeProcess = child

  child.stdout?.on('data', (chunk: Buffer | string) => {
    const message = String(chunk).trim()
    if (message) console.info(`[utility] ${message}`)
  })
  child.stderr?.on('data', (chunk: Buffer | string) => {
    const message = String(chunk).trim()
    if (message) console.error(`[utility] ${message}`)
  })
  child.on('message', (rawMessage: unknown) => {
    const parsed = RuntimeReadyMessageSchema.safeParse(rawMessage)
    if (parsed.success) {
      console.info(
        `[utility] ready protocol=${parsed.data.protocolVersion} pid=${parsed.data.pid}`
      )
    }
  })
  child.once('exit', (code) => {
    if (runtimeProcess === child) runtimeProcess = undefined
    console.info(`[utility] exited code=${code}`)
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

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== window.webContents.getURL()) event.preventDefault()
  })
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  const developmentUrl = process.env['ELECTRON_RENDERER_URL']
  if (developmentUrl) {
    await window.loadURL(developmentUrl)
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'))
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

  app.whenReady().then(async () => {
    startRuntime()
    await createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow()
    })
  })
}

app.on('before-quit', () => {
  runtimeProcess?.kill()
  runtimeProcess = undefined
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
