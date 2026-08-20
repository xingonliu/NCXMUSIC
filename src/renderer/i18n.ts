import { computed, ref, type ComputedRef } from 'vue'

import { enUS } from './locales/en-US'
import { enUSSourceMessages } from './locales/en-US-source'
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

/** 可由界面安全本地化的公共错误最小结构。 */
export interface LocalizableError {
  /** 跨进程或领域返回的稳定错误码。 */
  readonly code?: string
  /** 用于中文界面展示和诊断的原始错误消息。 */
  readonly message: string
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

/** 带数字占位符的旧界面文案翻译规则。 */
const sourceMessagePatterns = Object.entries(enUSSourceMessages)
  .filter(([source]) => /\{\d+\}/u.test(source))
  .map(([source, target]) => createSourceMessagePattern(source, target))

/** 公共错误码到稳定语言包键的映射。 */
const errorMessageKeys: Readonly<Record<string, keyof LocaleMessages['errors']>> = {
  PROTOCOL_INVALID_MESSAGE: 'protocolInvalidMessage',
  PROTOCOL_VERSION_MISMATCH: 'protocolVersionMismatch',
  CONNECTION_REPLACED: 'connectionReplaced',
  REQUEST_TIMEOUT: 'requestTimeout',
  TIMEOUT: 'requestTimeout',
  PLAYER_COMMAND_TIMEOUT: 'requestTimeout',
  PLAYER_STATE_TIMEOUT: 'requestTimeout',
  REQUEST_CANCELLED: 'requestCancelled',
  CANCELLED: 'requestCancelled',
  PROFILE_CANCELLED: 'requestCancelled',
  UPSTREAM_ERROR: 'upstream',
  MCP_TOOL_ERROR: 'upstream',
  MCP_CALL_FAILED: 'upstream',
  UTILITY_UNAVAILABLE: 'utilityUnavailable',
  SKILL_HOST_UNAVAILABLE: 'utilityUnavailable',
  SKILL_HOST_EXITED: 'utilityUnavailable',
  CAPABILITY_UNAVAILABLE: 'capabilityUnavailable',
  MCP_REAPPROVAL_REQUIRED: 'capabilityUnavailable',
  QUEUE_ITEM_NOT_IN_CONTEXT: 'capabilityUnavailable',
  AUTH_REQUIRED: 'authRequired',
  ALREADY_COMPLETED: 'alreadyCompleted',
  SERVICE_UNAVAILABLE: 'serviceUnavailable',
  ACCOUNT_STALE: 'accountStale',
  POLICY_DENIED: 'policyDenied',
  TOOL_ARGUMENTS_INVALID: 'argumentsInvalid',
  INVALID_COMMAND: 'argumentsInvalid',
  INVALID_SELECTION: 'argumentsInvalid',
  NOT_FOUND: 'notFound',
  PROVIDER_TIMEOUT: 'providerTimeout',
  TOOL_CALL_LIMIT: 'serviceUnavailable'
}

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

/** 转义将要嵌入正则表达式的普通字符串。 */
function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/** 把带 `{0}` 数字占位符的源文案编译为运行时翻译规则。 */
function createSourceMessagePattern(source: string, target: string): {
  pattern: RegExp
  target: string
} {
  /** 源文案中按数字占位符切分出的静态片段。 */
  const sourceParts = source.split(/\{\d+\}/u).map(escapeRegularExpression)
  return {
    pattern: new RegExp(`^${sourceParts.join('(.+?)')}$`, 'u'),
    target
  }
}

/** 使用正则捕获值填充英语目标文案的数字占位符。 */
function fillSourceMessagePattern(target: string, captures: readonly string[]): string {
  return target.replace(/\{(\d+)\}/gu, (_match, index: string) => captures[Number(index)] ?? '')
}

/** 翻译迁移期间保留在 Vue 模板中的中文源文案。 */
export function translateSourceText(source: string): string {
  if (currentLocale.value === 'zh-CN') return source

  /** 保留模板排版所需的首尾空白。 */
  const leadingWhitespace = source.match(/^\s*/u)?.[0] ?? ''
  /** 保留模板排版所需的尾部空白。 */
  const trailingWhitespace = source.match(/\s*$/u)?.[0] ?? ''
  /** 去除排版空白后的可翻译源文案。 */
  const normalizedSource = source.slice(
    leadingWhitespace.length,
    source.length - trailingWhitespace.length
  )
  /** 完整源文案对应的英语翻译。 */
  const exactTranslation = enUSSourceMessages[normalizedSource]
  if (exactTranslation !== undefined) {
    return `${leadingWhitespace}${exactTranslation}${trailingWhitespace}`
  }

  for (const rule of sourceMessagePatterns) {
    /** 当前占位符规则对实际文案的匹配结果。 */
    const match = normalizedSource.match(rule.pattern)
    if (!match) continue
    return `${leadingWhitespace}${fillSourceMessagePattern(rule.target, match.slice(1))}${trailingWhitespace}`
  }
  return source
}

/** 按稳定错误码本地化跨进程错误，并阻止英文界面泄漏中文内部错误。 */
export function translatePublicError(error: LocalizableError): string {
  if (currentLocale.value === 'zh-CN') return error.message

  /** 当前稳定错误码对应的语言包键。 */
  const errorKey = error.code ? errorMessageKeys[error.code] : undefined
  if (errorKey) return messages.value.errors[errorKey]

  /** 兼容尚未分配稳定错误码的已收录界面错误。 */
  const translatedMessage = translateSourceText(error.message)
  if (translatedMessage !== error.message) return translatedMessage
  return /\p{Script=Han}/u.test(error.message) ? messages.value.errors.generic : error.message
}

/** 把捕获到的未知异常收敛为当前界面语言的安全消息。 */
export function translateCaughtError(error: unknown, fallbackSource: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    /** 从异常对象读取的可展示消息。 */
    const message = String(error.message)
    /** 从异常对象读取的可选稳定错误码。 */
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    return translatePublicError({ message, ...(code ? { code } : {}) })
  }
  return translateSourceText(fallbackSource)
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
  translateSourceText: (source: string) => string
} {
  return { locale, messages, setLocale, t, translateSourceText }
}
