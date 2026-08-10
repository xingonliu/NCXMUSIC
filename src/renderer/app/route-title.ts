import { t } from '../i18n'

// ========= 函数 =========

/** 将路由 meta.title 解析为可显示中文标题。 */
export function resolveRouteTitle(titleKey: string): string {
  return t(titleKey)
}
