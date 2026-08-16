import { join } from 'node:path'

import { app, Menu, nativeImage, Tray, type NativeImage } from 'electron'

// ========= 类型 =========

/** 系统托盘需要调用的应用生命周期动作。 */
export interface ApplicationTrayActions {
  /** 显示并聚焦主窗口。 */
  readonly showMainWindow: () => void
  /** 明确退出整个应用。 */
  readonly quitApplication: () => void
}

// ========= 变量 =========

/** 无法读取可执行文件图标时使用的内嵌 PNG 音乐图标。 */
const FALLBACK_TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKQSURBVFhH1Ve/axRBFE6ZMmXK/Ak2wcxekfsHhICNVqYJBGzE6rg9vBQpJAQkhRwWKVLEH6AECyNYaKNELM5GsLxgkXDZ3Vv11Ltwmg3f3N44997O7O5lLfzgg7D75r3vfTP3Jjs19b+iWvIX3JJX1kljCkV9vj1bdbzVmuO/rDlBZKQIDlzhVeqXwzmaYyLUF8MZVwRrrgh6rFgaRacB4TRnZkhrhR+yxDkohYuTazR3KmqOvzxR1wbCRVrDCBSnCQriPVqLYWh7cZ1T4iDTmgo4MHn2fPvm9+j19q+oud+Pmi9O5d+UiNHXoLmq075Ea0vAIlrERhRIA2LoOtcJ9mjtuPt81k8qAGQuYHjQoDTqAlrNAbM/aQsURacxJgATjAWlUBdg6tRE1wmOVXFMOxqQhRcRAKptwMVCX2bhRQWoCVkT3hJ7mYE2Adh7cK3cYetGrC74t4YOyFuOB6QxScD9G1+jk8Pf6nmvexbtVrpsLajGM6ygL7OQCkC34dEf9WyEwelZtHk1ZOvxy5MCMH7pSxvRJez9sNdXRSAAnZqwv/WT5cGdM/wVzLdn+UtOdPHl04DmloCAZ+s/6GOFVw0uAIc//iHKG7BFA3TCXn1vKd4+7EV3r4TS7iTQgYSpW19sTWsC7PeAzV7g/dO+jHu+wV1497jH8rH7AEOBBum02QvoFj9Y+aZG8c5t0yj2lsYEAFDFAmPa7AVwMOkaI0XwkdaWSHPhyZ1uoojkE25hUvcjpN2KcGJkL7h1PUfnIL0Fk+A6nUdsYREUwcHYyTcBQYWLkMXDGVrLCsxqlmgS4gMlS+dJiMf0G5Y0Gz9bD1weIBG2Jdv/jfh+jOf8v8Dw28GrxN+Mf1nyynmtPgcGbz1WB+jrqAAAAABJRU5ErkJggg=='

// ========= 函数 =========

/** 优先选择当前操作系统对应的系统托盘图标资源路径。 */
function resolveTrayIconResourcePath(): string {
  if (process.platform === 'win32') {
    return join(__dirname, '../../resources/icon.ico')
  }
  return join(__dirname, '../../resources/icon.png')
}

/** 优先读取本地资源图标或当前可执行文件图标，并在失败时回退到内嵌图标。 */
async function resolveTrayIcon(): Promise<NativeImage> {
  try {
    const resourcePath = resolveTrayIconResourcePath()
    const resourceIcon = nativeImage.createFromPath(resourcePath)
    if (!resourceIcon.isEmpty()) {
      return process.platform === 'darwin'
        ? resourceIcon.resize({ width: 16, height: 16 })
        : resourceIcon
    }
  } catch {
    // 本地资源不存在或加载失败时继续尝试可执行文件图标。
  }
  try {
    /** 当前可执行文件关联的小尺寸平台图标。 */
    const executableIcon = await app.getFileIcon(process.execPath, { size: 'small' })
    if (!executableIcon.isEmpty()) return executableIcon
  } catch {
    // 平台不支持读取可执行文件图标时继续回退至内嵌图标。
  }
  return nativeImage.createFromDataURL(FALLBACK_TRAY_ICON_DATA_URL)
}

/** 创建并配置应用会话期间常驻的系统托盘。 */
export async function createApplicationTray(actions: ApplicationTrayActions): Promise<Tray> {
  /** 跨平台可用的托盘图标。 */
  const icon = await resolveTrayIcon()
  /** 应用会话期间必须持有引用的系统托盘。 */
  const tray = new Tray(icon)
  /** 托盘右键菜单，提供窗口恢复和明确退出入口。 */
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: actions.showMainWindow },
    { type: 'separator' },
    { label: '退出应用', click: actions.quitApplication }
  ])

  tray.setToolTip('Ncxmusic')
  tray.setContextMenu(contextMenu)
  tray.on('click', actions.showMainWindow)
  return tray
}
