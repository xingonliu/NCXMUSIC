import { app, BrowserWindow } from 'electron'
app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 1280, height: 960, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })
  window.loadURL('http://127.0.0.1:5198/tests/fixtures/glass-materials/index.html')
})
app.on('window-all-closed', () => app.quit())
