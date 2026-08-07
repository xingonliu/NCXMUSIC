// ========= 变量 =========

/** Renderer 可请求的窗口命令集合。 */
export type WindowCommandType =
  | 'window.minimize'
  | 'window.toggleMaximize'
  | 'window.requestClose'
  | 'window.toggleFullscreen'

/** Renderer 需要区分的桌面平台类型。 */
export type DesktopPlatform = 'darwin' | 'win32' | 'linux' | string

/** 窗口 IPC 通道名，集中冻结避免跨进程字符串散落。 */
export const WINDOW_CONTROL_CHANNELS = {
  command: 'ncx:window-command',
  snapshot: 'ncx:window-snapshot',
  status: 'ncx:window-status',
  drag: 'ncx:window-drag'
} as const

/** Renderer 与 Main 之间传递的窗口命令载荷。 */
export interface WindowCommand {
  readonly type: WindowCommandType
}

/** 自绘拖拽的 IPC 载荷：仅通知按下/松开，移动由 Main 进程轮询光标完成。 */
export interface WindowDragMessage {
  readonly type: 'window.dragStart' | 'window.dragEnd'
}

/** BrowserWindow 的只读状态快照。 */
export interface WindowSnapshot {
  readonly platform: DesktopPlatform
  readonly maximized: boolean
  readonly fullscreen: boolean
  readonly focused: boolean
}

/** Preload 暴露给 Renderer 的窗口控制桥接。 */
export interface WindowControlBridge {
  readonly snapshot: () => Promise<WindowSnapshot>
  readonly send: (command: WindowCommand) => Promise<WindowSnapshot>
  readonly onSnapshot: (listener: (snapshot: WindowSnapshot) => void) => () => void
  /** 通知 Main 开始自绘拖拽（按下时刻，一次）。 */
  readonly dragStart: () => void
  /** 通知 Main 结束自绘拖拽（松开时刻，一次）。 */
  readonly dragEnd: () => void
}
