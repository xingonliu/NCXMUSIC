declare module 'uiohook-napi' {
  // ========= 类型 =========
  /** 当前任务只依赖的原生键盘事件字段。 */
  export interface UiohookNativeEvent {
    /** 平台可用时的物理按键名。 */
    code?: string
    /** 平台只返回数字码时的按键码。 */
    keycode?: number
  }

  /** `uiohook-napi` 暴露的全局 Hook 单例。 */
  export const uIOhook: {
    on(event: 'keydown' | 'keyup', listener: (event: UiohookNativeEvent) => void): void
    off(event: 'keydown' | 'keyup', listener: (event: UiohookNativeEvent) => void): void
    start(): void
    stop(): void
  }
}
