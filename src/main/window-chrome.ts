import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

import type { WindowSnapshot } from '../shared/contracts/window-controls'

// ========= 变量 =========

/** macOS 原生交通灯在隐藏标题栏窗口中的固定对齐位置。 */
export const MACOS_TRAFFIC_LIGHT_POSITION = { x: 24, y: 24 } as const

/** 主窗口基础尺寸，和设计系统响应式窗口基线保持一致。 */
const MAIN_WINDOW_BOUNDS = {
  width: 1280,
  height: 800,
  minWidth: 960,
  minHeight: 640
} as const

/** 构建主窗口参数需要的最小输入。 */
export interface MainWindowOptionsInput {
  readonly platform: NodeJS.Platform
  readonly preloadPath: string
}

// ========= 函数 =========

/** 构造双平台 WindowChrome 参数，macOS 保留原生交通灯，Windows 使用自绘控件。 */
export function createMainWindowOptions(
  input: MainWindowOptionsInput
): BrowserWindowConstructorOptions {
  return {
    ...MAIN_WINDOW_BOUNDS,
    show: false,
    autoHideMenuBar: true,
    // 透明窗口：外轮廓交由 Renderer 的 CSS 圆角绘制，窗口圆角与悬浮侧边栏完全一致。
    transparent: true,
    backgroundColor: '#00000000',
    ...(input.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: MACOS_TRAFFIC_LIGHT_POSITION,
          // 关闭 macOS 原生圆角遮罩，避免其裁切 CSS 圆角，让形状完全由透明通道决定。
          roundedCorners: false
        }
      : {
          frame: false
        }),
    webPreferences: {
      preload: input.preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  }
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
