import { computed, ref, type ComputedRef } from 'vue'

import { enUS } from './locales/en-US'
import { zhCN } from './locales/zh-CN'
import type { LocaleMessagesFor } from './locales/types'

// ========= 类型 =========

/** 应用当前支持的界面语言。 */
export type AppLocale = 'zh-CN' | 'en-US'

/** 翻译参数支持字符串与数字替换。 */
export type TranslationParams = Readonly<Record<string, string | number>>

/** 由简体中文基准语言包推导出的完整文案结构。 */
export type LocaleMessages = LocaleMessagesFor<typeof zhCN>

/** 语言选择器展示的稳定语言元数据。 */
export interface SupportedLocaleOption {
  /** BCP 47 语言标签。 */
  readonly value: AppLocale
  /** 以该语言自身书写的显示名称。 */
  readonly label: string
}

// ========= 变量 =========

/** 设置页可展示的语言选项。 */
export const SUPPORTED_LOCALES: readonly SupportedLocaleOption[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' }
]

/** 各语言标签对应的完整文案字典。 */
const messagesByLocale: Readonly<Record<AppLocale, LocaleMessages>> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

/** 当前应用语言；默认值保持既有简体中文体验。 */
const currentLocale = ref<AppLocale>('zh-CN')

/** 当前语言的只读响应式引用。 */
const locale = computed<AppLocale>(() => currentLocale.value)

/** 当前语言的只读响应式文案字典。 */
const messages = computed<LocaleMessages>(() => messagesByLocale[currentLocale.value])

// ========= 函数 =========

/** 判断未知值是否为应用支持的语言标签。 */
export function isSupportedLocale(value: unknown): value is AppLocale {
  return value === 'zh-CN' || value === 'en-US'
}

/** 切换当前语言，并同步文档根节点的语言语义。 */
export function setLocale(nextLocale: AppLocale): void {
  currentLocale.value = nextLocale
  document.documentElement.lang = nextLocale
}

/** 从指定语言包读取稳定本地化键，缺失时回退到简体中文。 */
function resolveMessage(key: string): string {
  /** 当前语言中解析出的候选文案。 */
  const localizedMessage = resolveMessageFrom(messages.value, key)
  if (localizedMessage !== undefined) return localizedMessage

  /** 简体中文基准语言中解析出的回退文案。 */
  return resolveMessageFrom(messagesByLocale['zh-CN'], key) ?? key
}

/** 从单个语言包按点分隔键读取字符串。 */
function resolveMessageFrom(localeMessages: LocaleMessages, key: string): string | undefined {
  /** 兼容历史 routes 对象使用完整键名的存储方式。 */
  if (key in localeMessages.routes) {
    return localeMessages.routes[key as keyof typeof localeMessages.routes]
  }

  /** 沿点分隔路径逐层读取的候选值。 */
  let message: unknown = localeMessages
  for (const segment of key.split('.')) {
    if (!message || typeof message !== 'object' || !(segment in message)) return undefined
    message = (message as Record<string, unknown>)[segment]
  }
  return typeof message === 'string' ? message : undefined
}

/** 解析稳定本地化键，并对 `{name}` 参数执行安全替换。 */
export function t(key: string, params: TranslationParams = {}): string {
  return resolveMessage(key).replace(
    /\{([a-zA-Z0-9_]+)\}/gu,
    (_match, name: string) => String(params[name] ?? `{${name}}`)
  )
}

/** 暴露应用级响应式语言状态、文案字典与切换函数。 */
export function useI18n(): {
  locale: ComputedRef<AppLocale>
  messages: ComputedRef<LocaleMessages>
  setLocale: (nextLocale: AppLocale) => void
  t: (key: string, params?: TranslationParams) => string
} {
  return { locale, messages, setLocale, t }
}
