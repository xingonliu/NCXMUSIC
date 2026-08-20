import {
  INPUT_HOOK_PROTOCOL_VERSION,
  InputHookConfigSchema,
  InputHookNativeEventSchema,
  type InputHookConfig,
  type InputHookNativeEvent,
  type InputHookReport
} from '../shared/contracts/input-hook'
import { ShortcutMatcher } from './shortcut-matcher'

// ========= 类型 =========
/** Electron utilityProcess 提供的受限父进程消息端口。 */
interface ProcessPort {
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
}

/** `uiohook-napi` 键盘 Hook 的最小消费接口。 */
interface UiohookModule {
  uIOhook: {
    on(event: 'keydown' | 'keyup', listener: (event: unknown) => void): void
    off(event: 'keydown' | 'keyup', listener: (event: unknown) => void): void
    start(): void
    stop(): void
  }
}

// ========= 变量 =========
/** 当前 Host 的父进程端口，缺失时 Host 只会静默退出。 */
const parentPort = process.parentPort as ProcessPort | undefined
/** 当前快捷键匹配器，随 Main 下发配置重建。 */
let matcher: ShortcutMatcher | undefined
/** 当前已启动的原生 Hook 实例。 */
let nativeHook: UiohookModule['uIOhook'] | undefined
/** 当前 keydown 监听器引用，用于重配时精确卸载。 */
let keydownListener: ((event: unknown) => void) | undefined
/** 当前 keyup 监听器引用，用于重配时精确卸载。 */
let keyupListener: ((event: unknown) => void) | undefined

// ========= 函数 =========
/** 向 Main 发送契约允许的状态报告。 */
function post(message: InputHookReport): void {
  parentPort?.postMessage(message)
}

/** 生成 Host 启动、失败或权限状态报告。 */
function report(config: InputHookConfig, status: InputHookReport['status'], reason?: string): InputHookReport {
  return {
    protocolVersion: INPUT_HOOK_PROTOCOL_VERSION,
    status,
    sessionGeneration: config.sessionGeneration,
    ...(reason ? { reason } : {})
  }
}

/** 将原生 Hook 事件压缩为白名单按键事件，丢弃其他键盘输入。 */
function normalizeNativeEvent(type: InputHookNativeEvent['type'], event: unknown): InputHookNativeEvent | undefined {
  const code = typeof event === 'object' && event ? Reflect.get(event, 'code') : undefined
  const keycode = typeof event === 'object' && event ? Reflect.get(event, 'keycode') : undefined
  /** uiohook 在不同平台可能只给 keycode；映射表只包含语音快捷键白名单。 */
  const keycodeMap = new Map<number, InputHookNativeEvent['key']>([
    [29, 'ControlLeft'],
    [42, 'ShiftLeft'],
    [54, 'ShiftRight'],
    [56, 'AltLeft'],
    [57, 'Space'],
    [16, 'KeyQ'],
    [3613, 'ControlRight'],
    [3640, 'AltRight'],
    [3675, 'MetaLeft'],
    [3676, 'MetaRight']
  ])
  /** 优先采用原生物理按键名，再使用受限数字码映射。 */
  const key = typeof code === 'string'
    ? InputHookNativeEventSchema.shape.key.safeParse(code).data
    : typeof keycode === 'number'
      ? keycodeMap.get(keycode)
      : undefined
  return InputHookNativeEventSchema.safeParse({ type, key }).data
}

/** 把归一化事件交给匹配器，并只转发状态变化。 */
function dispatch(event: InputHookNativeEvent): void {
  const current = matcher
  if (!current) return
  const next = current.handle(event)
  if (next) {
    console.info(`[InputHook] 组合键状态触发: status=${next.status}, generation=${next.sessionGeneration}`)
    post(next)
  }
}

/** 停止并卸载当前原生 Hook，防止重配或退出后残留监听。 */
function detachNativeHook(): void {
  if (!nativeHook) return
  if (keydownListener) nativeHook.off('keydown', keydownListener)
  if (keyupListener) nativeHook.off('keyup', keyupListener)
  nativeHook.stop()
  nativeHook = undefined
  keydownListener = undefined
  keyupListener = undefined
}

/** 动态加载并启动原生 Hook，避免无配置时触碰系统权限。 */
async function attachNativeHook(config: InputHookConfig): Promise<void> {
  const loaded = (await import('uiohook-napi')) as UiohookModule
  nativeHook = loaded.uIOhook
  keydownListener = (event) => {
    const rawKeycode = typeof event === 'object' && event ? Reflect.get(event, 'keycode') : undefined
    const normalized = normalizeNativeEvent('keydown', event)
    if (normalized) {
      console.info(`[InputHook] 检测到目标按键 keydown: key=${normalized.key}, keycode=${rawKeycode}`)
      dispatch(normalized)
    }
  }
  keyupListener = (event) => {
    const rawKeycode = typeof event === 'object' && event ? Reflect.get(event, 'keycode') : undefined
    const normalized = normalizeNativeEvent('keyup', event)
    if (normalized) {
      console.info(`[InputHook] 检测到目标按键 keyup: key=${normalized.key}, keycode=${rawKeycode}`)
      dispatch(normalized)
    }
  }
  nativeHook.on('keydown', keydownListener)
  nativeHook.on('keyup', keyupListener)
  nativeHook.start()
  console.info(`[InputHook] 原生全局键盘 Hook 启动成功 (ready)，正在监听:`, config.chord)
  post(report(config, 'ready'))
}

/** 应用 Main 下发的新快捷键配置，失败时报告明确禁用原因。 */
async function configure(message: unknown): Promise<void> {
  const parsed = InputHookConfigSchema.safeParse(message)
  if (!parsed.success) return
  detachNativeHook()
  matcher = new ShortcutMatcher(parsed.data)
  console.info(`[InputHook] 正在配置快捷键 Hook:`, parsed.data.chord)
  try {
    await attachNativeHook(parsed.data)
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    /** 检查是否为 macOS 辅助功能或无障碍权限缺失。 */
    const isPermissionDenied = text.includes('AXAPI') ||
      text.includes('assistive devices') ||
      text.toLowerCase().includes('permission') ||
      text.includes('Accessibility API')
    console.error(`[InputHook] 原生键盘 Hook 启动失败:`, text, isPermissionDenied ? '(缺少系统辅助功能/Accessibility 权限)' : '')
    post(report(parsed.data, isPermissionDenied ? 'permission_denied' : 'hook_failed', text))
  }
}

// ========= 生命周期 =========
parentPort?.on('message', (event) => {
  const message = event.data
  if (typeof message === 'object' && message && Reflect.get(message, 'type') === 'setListening') {
    const listening = Boolean(Reflect.get(message, 'listening'))
    console.info(`[InputHook] 收到主进程会话状态同步: listening=${listening}`)
    matcher?.setListening(listening)
    return
  }
  void configure(message)
})

process.once('exit', () => {
  detachNativeHook()
})
