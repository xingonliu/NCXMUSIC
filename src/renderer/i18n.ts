import { zhCN } from './locales/zh-CN'

// ========= 类型 =========

/** 翻译参数支持字符串与数字替换。 */
export type TranslationParams = Readonly<Record<string, string | number>>

// ========= 函数 =========

/** 解析稳定本地化键，并对 `{name}` 参数执行安全替换。 */
export function t(key: string, params: TranslationParams = {}): string {
  /** 兼容历史 routes 对象使用完整键名的存储方式。 */
  let message: unknown = key in zhCN.routes
    ? zhCN.routes[key as keyof typeof zhCN.routes]
    : zhCN

  if (!(key in zhCN.routes)) {
    for (const segment of key.split('.')) {
      if (!message || typeof message !== 'object' || !(segment in message)) {
        message = key
        break
      }
      message = (message as Record<string, unknown>)[segment]
    }
  }

  const text = typeof message === 'string' ? message : key
  return text.replace(/\{([a-zA-Z0-9_]+)\}/gu, (_match, name: string) => String(params[name] ?? `{${name}}`))
}
