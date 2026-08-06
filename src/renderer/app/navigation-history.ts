import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

// ========= 函数 =========

/** 二级页统一返回逻辑：优先返回浏览历史，否则回到路由声明的 fallbackRoute。 */
export function navigateBack(router: Router, route: RouteLocationNormalizedLoaded): void {
  if (window.history.length > 1) {
    router.back()
    return
  }

  const fallbackRoute = route.meta.fallbackRoute
  void router.push({ name: fallbackRoute ?? 'discover' })
}
