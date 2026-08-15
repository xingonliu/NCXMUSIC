import { describe, expect, it } from 'vitest'

import {
  createMainWindowOptions,
  createWindowSnapshot,
  resolveCloseWindowAction,
  showMainWindow
} from '../../src/main/window-chrome'

// ========= 变量 =========

/** 测试用 Preload 路径，避免断言依赖真实构建目录。 */
const preloadPath = '/tmp/ncx-preload.js'

/** 最小 BrowserWindow 状态桩，仅覆盖窗口快照读取所需方法。 */
const snapshotWindow = {
  isMaximized: () => true,
  isFullScreen: () => false,
  isFocused: () => true
}

/** 记录窗口恢复动作的测试状态。 */
const revealCalls: string[] = []

/** 已隐藏且未最小化的主窗口桩。 */
const hiddenWindow = {
  isMinimized: () => false,
  restore: () => revealCalls.push('restore'),
  isVisible: () => false,
  show: () => revealCalls.push('show'),
  focus: () => revealCalls.push('focus')
}

// ========= 生命周期 =========

describe('WindowChrome options', () => {
  it('保留 macOS 原生交通灯并避免 frameless 覆盖', () => {
    const options = createMainWindowOptions({ platform: 'darwin', preloadPath })

    expect(options.frame).toBeUndefined()
    expect(options.titleBarStyle).toBe('hidden')
    expect(options.trafficLightPosition).toEqual({ x: 24, y: 24 })
    expect(options.webPreferences?.preload).toBe(preloadPath)
  })

  it('保持 Windows 自绘窗口按钮所需的 frameless 配置并在指定时携带图标路径', () => {
    const options = createMainWindowOptions({
      platform: 'win32',
      preloadPath,
      iconPath: '/path/to/icon.png'
    })

    expect(options.frame).toBe(false)
    expect(options.titleBarStyle).toBeUndefined()
    expect(options.trafficLightPosition).toBeUndefined()
    expect(options.icon).toBe('/path/to/icon.png')
  })

  it('窗口快照只暴露 Renderer 需要的只读状态', () => {
    const snapshot = createWindowSnapshot(snapshotWindow as never)

    expect(snapshot).toEqual({
      platform: process.platform,
      maximized: true,
      fullscreen: false,
      focused: true
    })
  })

  it('把继续播放偏好映射为隐藏到系统托盘而不是最小化', () => {
    expect(resolveCloseWindowAction({
      closeWindowBehavior: 'minimize',
      appIsQuitting: false,
      isSmokeTest: false
    })).toBe('hide-to-tray')
  })

  it('把退出偏好映射为应用退出，并在真实退出阶段允许窗口关闭', () => {
    expect(resolveCloseWindowAction({
      closeWindowBehavior: 'quit',
      appIsQuitting: false,
      isSmokeTest: false
    })).toBe('quit')
    expect(resolveCloseWindowAction({
      closeWindowBehavior: 'minimize',
      appIsQuitting: true,
      isSmokeTest: false
    })).toBe('allow-close')
  })

  it('从系统托盘恢复隐藏窗口并聚焦', () => {
    revealCalls.length = 0

    showMainWindow(hiddenWindow as never)

    expect(revealCalls).toEqual(['show', 'focus'])
  })
})
