import { describe, expect, it } from 'vitest'

import { createMainWindowOptions, createWindowSnapshot } from '../../src/main/window-chrome'

// ========= 变量 =========

/** 测试用 Preload 路径，避免断言依赖真实构建目录。 */
const preloadPath = '/tmp/ncx-preload.js'

/** 最小 BrowserWindow 状态桩，仅覆盖窗口快照读取所需方法。 */
const snapshotWindow = {
  isMaximized: () => true,
  isFullScreen: () => false,
  isFocused: () => true
}

// ========= 生命周期 =========

describe('WindowChrome options', () => {
  it('保留 macOS 原生交通灯并避免 frameless 覆盖', () => {
    const options = createMainWindowOptions({ platform: 'darwin', preloadPath })

    expect(options.frame).toBeUndefined()
    expect(options.titleBarStyle).toBe('hidden')
    expect(options.trafficLightPosition).toEqual({ x: 24, y: 24 })
    expect(options.roundedCorners).toBe(false)
    expect(options.webPreferences?.preload).toBe(preloadPath)
  })

  it('保持 Windows 自绘窗口按钮所需的 frameless 配置', () => {
    const options = createMainWindowOptions({ platform: 'win32', preloadPath })

    expect(options.frame).toBe(false)
    expect(options.titleBarStyle).toBeUndefined()
    expect(options.trafficLightPosition).toBeUndefined()
  })

  it('透明窗口使外轮廓由 CSS 圆角决定', () => {
    const options = createMainWindowOptions({ platform: 'win32', preloadPath })

    expect(options.transparent).toBe(true)
    expect(options.backgroundColor).toBe('#00000000')
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
})
