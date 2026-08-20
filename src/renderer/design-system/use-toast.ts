import { computed, ref } from 'vue'

import { translatePublicError, translateSourceText } from '../i18n'

// ========= 类型 =========

/** Toast 提示框支持的视觉变体类型。 */
export type ToastType = 'info' | 'success' | 'warning' | 'danger'

/** showToast 配置选项接口。 */
export interface ToastOptions {
  /** Toast 提示消息文本。 */
  message: string
  /** Toast 提示类型。 */
  type?: ToastType | undefined
  /** Toast 提示标题。 */
  title?: string | undefined
  /** Toast 自动关闭延迟时长（毫秒），传 0 表示不自动关闭。 */
  duration?: number | undefined
}

/** 内部定义的激活 Toast 结构。 */
export interface ToastItem {
  /** Toast 唯一标识 UUID。 */
  id: string
  /** Toast 正文消息（描述内容）。 */
  message: string
  /** Toast 类型。 */
  type: ToastType
  /** Toast 可选标题（向后兼容）。 */
  title?: string | undefined
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

/** 最大允许同时入队堆叠记录的 Toast 数量。 */
const MAX_TOAST_STACK = 5

// ========= 函数 =========

/** 翻译 Toast 文案；警告与错误类型对未知中文内部错误使用安全回退。 */
function localizeToastText(message: string, type: ToastType): string {
  /** 已在兼容目录中收录的固定界面文案。 */
  const translatedMessage = translateSourceText(message)
  if (translatedMessage !== message || type === 'info' || type === 'success') {
    return translatedMessage
  }
  return translatePublicError({ message })
}

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
    item = {
      id,
      message: localizeToastText(optionsOrMessage, type),
      type,
      duration: 3500,
      createdAt: Date.now()
    }
  } else {
    const itemType = optionsOrMessage.type ?? 'info'
    item = {
      id,
      message: localizeToastText(optionsOrMessage.message, itemType),
      type: itemType,
      ...(optionsOrMessage.title !== undefined
        ? { title: translateSourceText(optionsOrMessage.title) }
        : {}),
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
 * @param remainingDuration 剩余时长，默认 2500ms
 */
export function resumeToastTimer(id: string, remainingDuration = 2500): void {
  pauseToastTimer(id)
  const target = toastList.value.find((t) => t.id === id)
  if (target && target.duration > 0) {
    const timer = setTimeout(() => {
      dismissToast(id)
    }, remainingDuration)
    timerMap.set(id, timer)
  }
}

/**
 * 暂停所有 Toast 的倒计时（鼠标移入 Toast 容器展开时）。
 */
export function pauseAllToastTimers(): void {
  for (const timer of timerMap.values()) {
    clearTimeout(timer)
  }
  timerMap.clear()
}

/**
 * 恢复所有 Toast 的倒计时（鼠标移出 Toast 容器折叠后）。
 * @param remainingDuration 恢复时的统一展示时长，默认 2500ms
 */
export function resumeAllToastTimers(remainingDuration = 2500): void {
  pauseAllToastTimers()
  toastList.value.forEach((item) => {
    if (item.duration > 0) {
      const timer = setTimeout(() => {
        dismissToast(item.id)
      }, remainingDuration)
      timerMap.set(item.id, timer)
    }
  })
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
    pauseAllToastTimers,
    resumeAllToastTimers,
    info: (message: string, duration?: number) =>
      showToast({ message, type: 'info', ...(duration !== undefined ? { duration } : {}) }),
    success: (message: string, duration?: number) =>
      showToast({ message, type: 'success', ...(duration !== undefined ? { duration } : {}) }),
    warning: (message: string, duration?: number) =>
      showToast({ message, type: 'warning', ...(duration !== undefined ? { duration } : {}) }),
    danger: (message: string, duration?: number) =>
      showToast({ message, type: 'danger', ...(duration !== undefined ? { duration } : {}) })
  }
}
