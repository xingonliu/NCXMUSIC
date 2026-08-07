import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BrowserWindow } from 'electron'
import {
  createWindowDragController,
  type WindowDragDeps
} from '../../src/main/window-drag'

// ========= 变量 =========

/** 测试用光标位置，可由用例修改。 */
let cursor = { x: 400, y: 300 }

/** 构造可注入的光标/显示器依赖桩。 */
function dragDeps(platform: NodeJS.Platform = 'win32'): WindowDragDeps {
  return {
    platform,
    screen: {
      getCursorScreenPoint: () => ({ ...cursor }),
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      })
    } as unknown as WindowDragDeps['screen']
  }
}

/** 最小 BrowserWindow 桩：记录位置、最大化/全屏状态与事件监听。 */
class FakeWindow {
  bounds = { x: 100, y: 80, width: 1280, height: 800 }
  maximized = false
  fullscreen = false
  destroyed = false
  private readonly listeners = new Map<string, Set<() => void>>()

  on(event: string, listener: () => void): this {
    const set = this.listeners.get(event) ?? new Set<() => void>()
    set.add(listener)
    this.listeners.set(event, set)
    return this
  }

  once(event: string, listener: () => void): this {
    return this.on(event, listener)
  }

  removeListener(event: string, listener: () => void): this {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  emit(event: string): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener()
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return { ...this.bounds }
  }

  setPosition(x: number, y: number): void {
    this.bounds.x = x
    this.bounds.y = y
  }

  isMaximized(): boolean {
    return this.maximized
  }

  isFullScreen(): boolean {
    return this.fullscreen
  }

  unmaximize(): void {
    this.maximized = false
  }

  maximize(): void {
    this.maximized = true
  }

  setFullScreen(value: boolean): void {
    this.fullscreen = value
  }

  isDestroyed(): boolean {
    return this.destroyed
  }

  asElectronWindow(): BrowserWindow {
    return this as unknown as BrowserWindow
  }
}

// ========= 生命周期 =========

describe('WindowDragController 普通拖拽', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('按下后抓取点保持光标下，并随光标移动轮询更新', () => {
    const window = new FakeWindow()
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps())

    controller.start()

    cursor = { x: 520, y: 420 }
    vi.advanceTimersByTime(16)

    // 偏移 = 按下时光标 - 窗口原点 = (300, 220)，窗口原点 = 光标 - 偏移
    expect(window.bounds.x).toBe(220)
    expect(window.bounds.y).toBe(200)

    controller.end()
    expect(window.maximized).toBe(false)
  })

  it('开始即立即对齐一次，无需等待轮询', () => {
    const window = new FakeWindow()
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps())

    controller.start()

    expect(window.bounds.x).toBe(100)
    expect(window.bounds.y).toBe(80)
    // 抓取点保持在光标下：窗口原点 + 偏移 == 光标
    expect(window.bounds.x + (cursor.x - 100)).toBe(cursor.x)
  })
})

describe('WindowDragController 最大化拖拽还原', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('先 unmaximize 再以按下偏移定位，抓取点不跳', () => {
    const window = new FakeWindow()
    window.maximized = true
    window.bounds = { x: 0, y: 0, width: 1920, height: 1040 }
    cursor = { x: 750, y: 600 }
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps())

    controller.start()

    expect(window.maximized).toBe(false)
    // 偏移以最大化边界计算 = (750, 600)，还原后窗口原点 = 光标 - 偏移
    expect(window.bounds.x).toBe(0)
    expect(window.bounds.y).toBe(0)
    expect(window.bounds.x + 750).toBe(cursor.x)
  })

  it('Windows 结束于工作区顶部时重新最大化', () => {
    const window = new FakeWindow()
    window.maximized = true
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps('win32'))

    controller.start()
    cursor = { x: 800, y: 4 }
    controller.end()

    expect(window.maximized).toBe(true)
  })

  it('Windows 结束于非顶部时不吸附', () => {
    const window = new FakeWindow()
    window.maximized = true
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps('win32'))

    controller.start()
    cursor = { x: 800, y: 400 }
    controller.end()

    expect(window.maximized).toBe(false)
  })

  it('macOS 顶部松开不执行最大化吸附', () => {
    const window = new FakeWindow()
    window.maximized = true
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps('darwin'))

    controller.start()
    cursor = { x: 800, y: 4 }
    controller.end()

    expect(window.maximized).toBe(false)
  })
})

describe('WindowDragController 全屏拖拽', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('先退出全屏，收到 leave-full-screen 后才开始跟手', () => {
    const window = new FakeWindow()
    window.fullscreen = true
    window.bounds = { x: 0, y: 0, width: 1920, height: 1080 }
    cursor = { x: 900, y: 700 }
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps('darwin'))

    controller.start()

    expect(window.fullscreen).toBe(false)
    // 等待退出动画期间不移动窗口
    cursor = { x: 950, y: 720 }
    vi.advanceTimersByTime(32)
    expect(window.bounds.x).toBe(0)
    expect(window.bounds.y).toBe(0)

    window.emit('leave-full-screen')
    vi.advanceTimersByTime(16)

    // 偏移以全屏边界计算 = (900, 700)，还原后窗口原点 = 光标 - 偏移
    expect(window.bounds.x).toBe(50)
    expect(window.bounds.y).toBe(20)
  })

  it('leave-full-screen 超时后兜底开始跟手', () => {
    const window = new FakeWindow()
    window.fullscreen = true
    window.bounds = { x: 0, y: 0, width: 1920, height: 1080 }
    cursor = { x: 900, y: 700 }
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps('darwin'))

    controller.start()

    vi.advanceTimersByTime(2_000)
    vi.advanceTimersByTime(16)

    expect(window.bounds.x).toBe(0)
    expect(window.bounds.y).toBe(0)
    expect(window.bounds.x + 900).toBe(cursor.x)
  })
})

describe('WindowDragController 生命周期保护', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('轮询期间窗口失焦终止拖拽，不再跟随', () => {
    const window = new FakeWindow()
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps())

    controller.start()
    window.emit('blur')

    cursor = { x: 700, y: 500 }
    vi.advanceTimersByTime(32)

    expect(window.bounds.x).toBe(100)
    expect(window.bounds.y).toBe(80)
  })

  it('全屏等待期间失焦不提前终止手势', () => {
    const window = new FakeWindow()
    window.fullscreen = true
    window.bounds = { x: 0, y: 0, width: 1920, height: 1080 }
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps('darwin'))

    controller.start()
    window.emit('blur')
    window.emit('leave-full-screen')
    vi.advanceTimersByTime(16)

    expect(window.bounds.x).toBe(0)
    expect(window.bounds.y).toBe(0)
  })

  it('dispose 后清理轮询与监听', () => {
    const window = new FakeWindow()
    const controller = createWindowDragController(window.asElectronWindow(), dragDeps())

    controller.start()
    controller.dispose()

    cursor = { x: 700, y: 500 }
    vi.advanceTimersByTime(32)

    expect(window.bounds.x).toBe(100)
    expect(window.bounds.y).toBe(80)
  })
})
