import { zhCN } from '../locales/zh-CN'

// ========= 类型 =========

/** 本地化路由标题键。 */
type RouteTitleKey = keyof typeof zhCN.routes

// ========= 函数 =========

/** 将路由 meta.title 解析为可显示中文标题。 */
export function resolveRouteTitle(titleKey: string): string {
  if (titleKey in zhCN.routes) return zhCN.routes[titleKey as RouteTitleKey]
  return titleKey
}
