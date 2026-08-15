import { computed, ref } from 'vue'

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
  /** 创建时间戳。 */
  createdAt: number
}

// ========= 变量 =========

/** 全局活动的轻提示 Toast 列表（按触发时间先进先出入队，垂直堆叠展示）。 */
export const toastList = ref<ToastItem[]>([])

/** 全局活动的轻提示 Toast（兼容单一 Toast 访问场景）。 */
export const activeToast = computed<ToastItem | null>(() => {
  if (toastList.value.length === 0) return null
  return toastList.value[toastList.value.length - 1] ?? null
})

/** 每个 Toast ID 对应的独立自动关闭定时器映射表。 */
const timerMap = new Map<string, ReturnType<typeof setTimeout>>()

/** 最大允许同时堆叠显示的 Toast 数量。 */
const MAX_TOAST_STACK = 5

// ========= 函数 =========

/**
 * 触发全局轻提示 Toast。支持多条消息有序堆叠展示。
 * @param optionsOrMessage 可直接传入消息文本或 ToastOptions 配置项
 * @param type 当第一参数为消息文本时，可指定 Toast 类型，默认为 'info'
 * @returns 刚创建的 Toast 唯一 ID
 */
export function showToast(
  optionsOrMessage: string | ToastOptions,
  type: ToastType = 'info'
): string {
  const id = crypto.randomUUID()
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
      id,
      message: optionsOrMessage,
      type,
      title: defaultTitle,
      duration: 3500,
      createdAt: Date.now()
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
      id,
      message: optionsOrMessage.message,
      type: itemType,
      title: optionsOrMessage.title ?? defaultTitle,
      duration: optionsOrMessage.duration ?? 3500,
      createdAt: Date.now()
    }
  }

  // 若超出最大堆叠数，安全移除最旧的一条
  if (toastList.value.length >= MAX_TOAST_STACK) {
    const oldest = toastList.value[0]
    if (oldest) {
      dismissToast(oldest.id)
    }
  }

  toastList.value.push(item)

  // 启动该条 Toast 的独立倒计时
  if (item.duration > 0) {
    const timer = setTimeout(() => {
      dismissToast(id)
    }, item.duration)
    timerMap.set(id, timer)
  }

  return id
}

/**
 * 手动关闭指定的全局轻提示 Toast。若不传 ID 则关闭所有通知。
 * @param id 要关闭的 Toast 唯一 ID
 */
export function dismissToast(id?: string): void {
  if (id) {
    const timer = timerMap.get(id)
    if (timer) {
      clearTimeout(timer)
      timerMap.delete(id)
    }
    toastList.value = toastList.value.filter((t) => t.id !== id)
  } else {
    timerMap.forEach((t) => clearTimeout(t))
    timerMap.clear()
    toastList.value = []
  }
}

/**
 * 暂停指定 Toast 的自动关闭倒计时（用户悬浮时）。
 * @param id Toast 唯一 ID
 */
export function pauseToastTimer(id: string): void {
  const timer = timerMap.get(id)
  if (timer) {
    clearTimeout(timer)
    timerMap.delete(id)
  }
}

/**
 * 恢复指定 Toast 的自动关闭倒计时（用户移出后）。
 * @param id Toast 唯一 ID
 * @param remainingDuration 剩余时长，默认 2000ms
 */
export function resumeToastTimer(id: string, remainingDuration = 2000): void {
  pauseToastTimer(id)
  const target = toastList.value.find((t) => t.id === id)
  if (target && target.duration > 0) {
    const timer = setTimeout(() => {
      dismissToast(id)
    }, remainingDuration)
    timerMap.set(id, timer)
  }
}

/** Composable 钩子函数入口。 */
export function useToast() {
  return {
    toastList,
    activeToast,
    showToast,
    dismissToast,
    pauseToastTimer,
    resumeToastTimer,
    info: (message: string, title?: string) =>
      showToast({ message, type: 'info', ...(title ? { title } : {}) }),
    success: (message: string, title?: string) =>
      showToast({ message, type: 'success', ...(title ? { title } : {}) }),
    warning: (message: string, title?: string) =>
      showToast({ message, type: 'warning', ...(title ? { title } : {}) }),
    danger: (message: string, title?: string) =>
      showToast({ message, type: 'danger', ...(title ? { title } : {}) })
  }
}
