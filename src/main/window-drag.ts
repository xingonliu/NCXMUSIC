import { screen, type BrowserWindow } from 'electron'

// ========= 变量 =========

/** 拖拽轮询间隔（毫秒），约 60fps 的光标跟随。 */
const DRAG_POLL_INTERVAL_MS = 16

/** 退出全屏动画超时兜底（毫秒），超时未收到事件也直接开始跟手。 */
const FULLSCREEN_LEAVE_TIMEOUT_MS = 2_000

/** Windows 顶部吸附阈值（DIP）：拖拽结束时光标进入工作区顶部该距离内则重新最大化。 */
const TOP_SNAP_THRESHOLD_PX = 8

/** 光标位置快照。 */
interface CursorPoint {
  readonly x: number
  readonly y: number
}

/** 拖拽控制器对外接口。 */
export interface WindowDragController {
  /** 按下时刻调用：进入自绘拖拽手势。 */
  readonly start: () => void
  /** 松开时刻调用：结束手势并按平台执行顶部吸附还原。 */
  readonly end: () => void
  /** 释放监听器与计时器。 */
  readonly dispose: () => void
}

/** 可注入的光标/显示器查询依赖，便于单元测试替换。 */
export interface WindowDragDeps {
  readonly screen: Pick<typeof screen, 'getCursorScreenPoint' | 'getDisplayNearestPoint'>
  readonly platform: NodeJS.Platform
}

// ========= 函数 =========

/** 默认依赖：真实 Electron screen API 与当前平台。 */
function defaultDeps(): WindowDragDeps {
  return { screen, platform: process.platform }
}

/**
 * 创建主进程自绘拖拽控制器。
 *
 * 无边框窗口的原生拖拽循环在最大化/全屏时不会还原尺寸，此控制器复刻
 * 原生"拖拽最大化窗口标题栏即还原"手势：按下时先 unmaximize()/退出全屏，
 * 再由主进程按光标位置轮询移动窗口，抓取点始终保持在光标下方。
 */
export function createWindowDragController(
  window: BrowserWindow,
  deps: WindowDragDeps = defaultDeps()
): WindowDragController {
  /** 拖拽轮询定时器句柄。 */
  let pollTimer: ReturnType<typeof setInterval> | undefined
  /** 退出全屏等待兜底定时器句柄。 */
  let leaveFullscreenTimer: ReturnType<typeof setTimeout> | undefined
  /** 等待中的 leave-full-screen 一次性监听，end 时需移除避免迟到事件空转。 */
  let pendingLeaveListener: (() => void) | undefined
  /** 按下时光标相对窗口左上角的偏移，拖拽期间保持抓取点位于光标下。 */
  let grabOffset: CursorPoint | undefined
  /** 拖拽开始时窗口是否处于最大化状态，用于结束时的顶部吸附还原。 */
  let startedMaximized = false
  /** 拖拽开始时窗口是否处于全屏状态。 */
  let startedFullscreen = false

  /** 移动窗口使抓取点保持位于当前光标下。 */
  function followCursor(): void {
    if (!grabOffset || window.isDestroyed()) return
    const cursor = deps.screen.getCursorScreenPoint()
    window.setPosition(cursor.x - grabOffset.x, cursor.y - grabOffset.y)
  }

  /** 启动 60fps 光标轮询移动循环。 */
  function beginPolling(): void {
    if (pollTimer) return
    followCursor()
    pollTimer = setInterval(followCursor, DRAG_POLL_INTERVAL_MS)
  }

  /** 停止轮询循环。 */
  function stopPolling(): void {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = undefined
  }

  /** 结束整个拖拽手势：停止循环、按平台执行顶部吸附还原、清空状态。 */
  function end(): void {
    stopPolling()
    if (leaveFullscreenTimer) clearTimeout(leaveFullscreenTimer)
    leaveFullscreenTimer = undefined
    if (pendingLeaveListener) {
      window.removeListener('leave-full-screen', pendingLeaveListener)
      pendingLeaveListener = undefined
    }
    if (grabOffset && !window.isDestroyed()) {
      if (deps.platform === 'win32' && startedMaximized) {
        const cursor = deps.screen.getCursorScreenPoint()
        const workArea = deps.screen.getDisplayNearestPoint(cursor).workArea
        if (cursor.y <= workArea.y + TOP_SNAP_THRESHOLD_PX) window.maximize()
      }
    }
    grabOffset = undefined
    startedMaximized = false
    startedFullscreen = false
  }

  /** 按下时刻进入拖拽手势：最大化先还原、全屏先退出，再进入跟随循环。 */
  function start(): void {
    if (window.isDestroyed()) return
    end()
    const cursor = deps.screen.getCursorScreenPoint()
    const bounds = window.getBounds()
    grabOffset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
    startedMaximized = window.isMaximized()
    startedFullscreen = window.isFullScreen()

    if (startedFullscreen) {
      // 退出全屏为异步动画（尤其 macOS），等事件或超时后再开始跟手，避免与动画竞争。
      window.setFullScreen(false)
      const onLeaveFullscreen = (): void => {
        pendingLeaveListener = undefined
        leaveFullscreenTimer = undefined
        // 动画结束后窗口已还原，以还原边界重新锚定，避免被锚定到全屏原点。
        reanchorAfterRestore()
        beginPolling()
      }
      pendingLeaveListener = onLeaveFullscreen
      window.once('leave-full-screen', onLeaveFullscreen)
      leaveFullscreenTimer = setTimeout(() => {
        // 兜底：事件未到达（如系统直接退出）时按当前窗口状态继续。
        if (pendingLeaveListener) window.removeListener('leave-full-screen', pendingLeaveListener)
        pendingLeaveListener = undefined
        leaveFullscreenTimer = undefined
        reanchorAfterRestore()
        beginPolling()
      }, FULLSCREEN_LEAVE_TIMEOUT_MS)
      return
    }
    if (startedMaximized) {
      window.unmaximize()
      // unmaximize 同步生效：以还原边界重新锚定，复刻原生"窗口留在原位、按鼠标增量跟随"，
      // 而不是把窗口锚定到最大化原点导致按下后跳向屏幕角落。
      reanchorAfterRestore()
    }
    beginPolling()
  }

  /** 窗口已还原为非最大化/全屏尺寸后，以还原边界重新锚定抓取偏移。 */
  function reanchorAfterRestore(): void {
    if (!grabOffset || window.isDestroyed()) return
    const cursor = deps.screen.getCursorScreenPoint()
    const restored = window.getBounds()
    grabOffset = { x: cursor.x - restored.x, y: cursor.y - restored.y }
  }

  /** 窗口失焦保护：仅主动轮询期间失焦才终止手势，避免漏收 pointerup 后循环空转。 */
  function handleBlur(): void {
    if (pollTimer) end()
  }

  /** 窗口销毁时释放所有定时器与监听。 */
  function dispose(): void {
    stopPolling()
    if (leaveFullscreenTimer) clearTimeout(leaveFullscreenTimer)
    leaveFullscreenTimer = undefined
    if (pendingLeaveListener) {
      window.removeListener('leave-full-screen', pendingLeaveListener)
      pendingLeaveListener = undefined
    }
    grabOffset = undefined
    window.removeListener('blur', handleBlur)
    window.removeListener('closed', dispose)
  }

  window.on('blur', handleBlur)
  window.on('closed', dispose)

  return { start, end, dispose }
}
