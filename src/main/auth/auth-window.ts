import { BrowserWindow, shell, type Cookie, type Session } from 'electron'

import {
  isAllowedLoginNavigation,
  isSafeExternalNavigation,
  NETEASE_LOGIN_URL
} from './navigation-policy'

export interface AuthWindowHandle {
  window: BrowserWindow
  dispose(): void
}

export function createAuthWindow(
  electronSession: Session,
  onCredentialCookieChanged: (cookie: Cookie) => void,
  onClosed: () => void
): AuthWindowHandle {
  electronSession.setPermissionCheckHandler(() => false)
  electronSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))

  const window = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    title: '登录网易云音乐',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      session: electronSession,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  })

  const openExternalIfSafe = (value: string): void => {
    if (isSafeExternalNavigation(value)) {
      void shell.openExternal(value)
    }
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedLoginNavigation(url)) {
      void window.loadURL(url)
    } else {
      openExternalIfSafe(url)
    }
    return { action: 'deny' }
  })

  const guardNavigation = (event: Electron.Event, url: string): void => {
    if (isAllowedLoginNavigation(url)) return
    event.preventDefault()
    openExternalIfSafe(url)
  }
  window.webContents.on('will-navigate', guardNavigation)
  window.webContents.on('will-redirect', guardNavigation)
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.webContents.on('did-finish-load', () => {
    void electronSession.cookies.get({ name: 'MUSIC_U' }).then((cookies) => {
      const credential = cookies.find((cookie) => !cookie.session || cookie.value.length > 0)
      if (credential) onCredentialCookieChanged(credential)
    })
  })

  const cookieListener = (
    _event: Electron.Event,
    cookie: Cookie,
    _cause: string,
    removed: boolean
  ): void => {
    if (!removed && cookie.name === 'MUSIC_U') {
      onCredentialCookieChanged(cookie)
    }
  }
  electronSession.cookies.on('changed', cookieListener)

  const dispose = (): void => {
    electronSession.cookies.off('changed', cookieListener)
  }
  window.once('closed', () => {
    dispose()
    onClosed()
  })
  window.once('ready-to-show', () => window.show())
  void window.loadURL(NETEASE_LOGIN_URL)

  return { window, dispose }
}
