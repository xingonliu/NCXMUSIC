import { ref } from 'vue'

// ========= 类型 =========

/** Toast 提示框支持的视觉变体类型。 */
export type ToastType = 'info' | 'success' | 'warning' | 'danger'

/** showToast 配置选项接口。 */
export interface ToastOptions {
  /** Toast 提示消息文本。 */
  message: string
  /** Toast 提示类型。 */
  type?: ToastType
  /** Toast 提示标题。 */
  title?: string
  /** Toast 自动关闭延迟时长（毫秒），传 0 表示不自动关闭。 */
  duration?: number
}

/** 内部定义的激活 Toast 结构。 */
export interface ToastItem {
  /** Toast 唯一标识 UUID。 */
  id: string
  /** Toast 正文消息。 */
  message: string
  /** Toast 类型。 */
  type: ToastType
  /** Toast 标题。 */
  title: string
  /** Toast 关闭延迟时长 (ms)。 */
  duration: number
}

// ========= 变量 =========

/** 全局活动的轻提示 Toast。 */
export const activeToast = ref<ToastItem | null>(null)

/** 自动关闭定时器句柄。 */
let toastTimer: ReturnType<typeof setTimeout> | null = null

// ========= 函数 =========

/**
 * 触发全局轻提示 Toast。
 * @param optionsOrMessage 可直接传入消息文本或 ToastOptions 配置项
 * @param type 当第一参数为消息文本时，可指定 Toast 类型，默认为 'info'
 */
export function showToast(
  optionsOrMessage: string | ToastOptions,
  type: ToastType = 'info'
): void {
  // 清理上一条 Toast 的倒计时
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }

  let item: ToastItem
  if (typeof optionsOrMessage === 'string') {
    const defaultTitle =
      type === 'danger'
        ? '请求失败'
        : type === 'warning'
          ? '操作提示'
          : type === 'success'
            ? '操作成功'
            : '提示'
    item = {
      id: crypto.randomUUID(),
      message: optionsOrMessage,
      type,
      title: defaultTitle,
      duration: 3500
    }
  } else {
    const itemType = optionsOrMessage.type ?? 'info'
    const defaultTitle =
      itemType === 'danger'
        ? '请求失败'
        : itemType === 'warning'
          ? '操作提示'
          : itemType === 'success'
            ? '操作成功'
            : '提示'
    item = {
      id: crypto.randomUUID(),
      message: optionsOrMessage.message,
      type: itemType,
      title: optionsOrMessage.title ?? defaultTitle,
      duration: optionsOrMessage.duration ?? 3500
    }
  }

  activeToast.value = item

  if (item.duration > 0) {
    toastTimer = setTimeout(() => {
      if (activeToast.value?.id === item.id) {
        activeToast.value = null
      }
    }, item.duration)
  }
}

/** 手动关闭当前全局轻提示 Toast。 */
export function dismissToast(): void {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  activeToast.value = null
}

/** Composable 钩子函数入口。 */
export function useToast() {
  return {
    activeToast,
    showToast,
    dismissToast,
    info: (message: string, title?: string) => showToast({ message, type: 'info', ...(title ? { title } : {}) }),
    success: (message: string, title?: string) => showToast({ message, type: 'success', ...(title ? { title } : {}) }),
    warning: (message: string, title?: string) => showToast({ message, type: 'warning', ...(title ? { title } : {}) }),
    danger: (message: string, title?: string) => showToast({ message, type: 'danger', ...(title ? { title } : {}) })
  }
}
