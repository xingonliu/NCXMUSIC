import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

import type { WindowSnapshot } from '../shared/contracts/window-controls'

// ========= 类型 =========

/** 关闭请求经应用状态与用户偏好解析后的主进程动作。 */
export type CloseWindowAction = 'allow-close' | 'hide-to-tray' | 'quit'

/** 解析关闭请求动作所需的最小应用状态。 */
export interface CloseWindowActionInput {
  /** 用户选择的关闭窗口行为；`minimize` 为兼容旧配置的托盘驻留值。 */
  readonly closeWindowBehavior: 'minimize' | 'quit'
  /** 应用是否已经进入真实退出流程。 */
  readonly appIsQuitting: boolean
  /** 当前是否为必须真实关闭窗口的 Smoke 测试。 */
  readonly isSmokeTest: boolean
}

/** 构建主窗口参数需要的最小输入。 */
export interface MainWindowOptionsInput {
  /** 目标操作系统平台。 */
  readonly platform: NodeJS.Platform
  /** Preload 脚本文件绝对路径。 */
  readonly preloadPath: string
  /** 主窗口应用程序图标路径。 */
  readonly iconPath?: string
}

/** 创建 Windows 任务栏身份参数所需输入。 */
export interface WindowsAppDetailsInput {
  /** Windows Shell 读取的应用图标路径。 */
  readonly iconPath: string
  /** Windows 从任务栏重新启动应用时执行的完整命令。 */
  readonly relaunchCommand: string
}

/** Windows 任务栏按钮使用的完整应用身份。 */
export interface WindowsAppDetails {
  /** 稳定的 Windows AppUserModelID。 */
  readonly appId: string
  /** 任务栏重新启动入口的图标路径。 */
  readonly appIconPath: string
  /** 图标文件或可执行文件中的资源索引。 */
  readonly appIconIndex: number
  /** Windows 从任务栏重新启动应用时执行的完整命令。 */
  readonly relaunchCommand: string
  /** Windows 任务栏与重启入口展示的应用名称。 */
  readonly relaunchDisplayName: string
}

// ========= 变量 =========

/** 所有平台统一使用的应用显示名称。 */
export const APPLICATION_DISPLAY_NAME = 'Ncxmusic'

/** Windows 安装器、通知与任务栏共享的稳定应用标识。 */
export const WINDOWS_APP_USER_MODEL_ID = 'io.github.ncxmusic.app'

/** macOS 原生交通灯在隐藏标题栏窗口中的固定对齐位置。 */
export const MACOS_TRAFFIC_LIGHT_POSITION = { x: 24, y: 24 } as const

/** 主窗口基础尺寸，和设计系统响应式窗口基线保持一致。 */
const MAIN_WINDOW_BOUNDS = {
  width: 1280,
  height: 800,
  minWidth: 960,
  minHeight: 640
} as const

// ========= 函数 =========

/** 构造 Windows 任务栏按钮与重启入口的完整品牌身份。 */
export function createWindowsAppDetails(input: WindowsAppDetailsInput): WindowsAppDetails {
  return {
    appId: WINDOWS_APP_USER_MODEL_ID,
    appIconPath: input.iconPath,
    appIconIndex: 0,
    relaunchCommand: input.relaunchCommand,
    relaunchDisplayName: APPLICATION_DISPLAY_NAME
  }
}

/** 构造双平台 WindowChrome 参数，macOS 保留原生交通灯，Windows 使用自绘控件。 */
export function createMainWindowOptions(
  input: MainWindowOptionsInput
): BrowserWindowConstructorOptions {
  return {
    ...MAIN_WINDOW_BOUNDS,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f7',
    ...(input.iconPath ? { icon: input.iconPath } : {}),
    ...(input.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: MACOS_TRAFFIC_LIGHT_POSITION
        }
      : {
          frame: false
        }),
    webPreferences: {
      preload: input.preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      /** 隐藏到托盘后仍需处理全局语音录音、VAD 与实时波形。 */
      backgroundThrottling: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  }
}

/** 将关闭按钮请求映射为隐藏到托盘、退出应用或允许窗口真实关闭。 */
export function resolveCloseWindowAction(input: CloseWindowActionInput): CloseWindowAction {
  if (input.appIsQuitting || input.isSmokeTest) return 'allow-close'
  return input.closeWindowBehavior === 'quit' ? 'quit' : 'hide-to-tray'
}

/** 恢复可能已最小化或隐藏的主窗口并把焦点交还给它。 */
export function showMainWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) window.show()
  window.focus()
}

/** 从 BrowserWindow 读取 Renderer 需要的窗口状态。 */
export function createWindowSnapshot(window: BrowserWindow): WindowSnapshot {
  return {
    platform: process.platform,
    maximized: window.isMaximized(),
    fullscreen: window.isFullScreen(),
    focused: window.isFocused()
  }
}
