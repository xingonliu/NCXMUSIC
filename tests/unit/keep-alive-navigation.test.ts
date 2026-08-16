import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** AppShell 源码。 */
const appShellSource = readFileSync(
  join(process.cwd(), 'src/renderer/design-system/patterns/AppShell.vue'),
  'utf8'
)

/** AppShell 样式源码。 */
const appShellCssSource = readFileSync(
  join(process.cwd(), 'src/renderer/design-system/patterns/app-shell.css'),
  'utf8'
)

/** RouteMeta 类型声明源码。 */
const routeMetaSource = readFileSync(
  join(process.cwd(), 'src/renderer/app/route-meta.d.ts'),
  'utf8'
)

/** Router 源码。 */
const routerSource = readFileSync(
  join(process.cwd(), 'src/renderer/app/router.ts'),
  'utf8'
)

// ========= 函数 =========

/** 提取指定 route name 的路由 meta 配置代码片段。 */
function extractRouteMeta(name: string): string {
  const matched = routerSource.match(new RegExp(`name:\\s*'${name}',[\\s\\S]*?meta:\\s*{([^}]+)}`))
  return matched?.[1] ?? ''
}

// ========= 测试 =========

describe('主 Tab 页面 KeepAlive 与滚动条独立管理契约测试', () => {
  it('RouteMeta 类型声明中包含 keepAlive 属性', () => {
    expect(routeMetaSource).toContain('keepAlive?: boolean')
  })

  it('一级主导航与核心 Tab 路由配置了 keepAlive: true', () => {
    const keepAliveRoutes = ['discover', 'search', 'browse', 'agent', 'profile', 'settings', 'design-system-lab']
    for (const routeName of keepAliveRoutes) {
      const meta = extractRouteMeta(routeName)
      expect(meta).toContain('keepAlive: true')
    }
  })

  it('二级详情页（如歌单、专辑、歌手、歌曲详情）默认不开启 keepAlive 避免内存泄漏', () => {
    const transientRoutes = ['playlist-detail', 'album-detail', 'artist-detail', 'song-detail', 'search-results']
    for (const routeName of transientRoutes) {
      const meta = extractRouteMeta(routeName)
      expect(meta).not.toContain('keepAlive')
    }
  })

  it('AppShell 使用 KeepAlive 对 keepAlive 页面进行缓存，并保留刷新代次 key 机制', () => {
    expect(appShellSource).toContain('<KeepAlive>')
    expect(appShellSource).toContain('v-if="activeRoute.meta.keepAlive"')
    expect(appShellSource).toContain(':key="`${String(activeRoute.name)}:${routeRefreshKey}`"')
    expect(appShellSource).toContain('v-if="!activeRoute.meta.keepAlive"')
    expect(appShellSource).toContain(':key="`${activeRoute.fullPath}:${routeRefreshKey}`"')
  })

  it('AppShell 为外层内容区绑定 ref 并通过 scrollPositions 与路由守卫精准还原/重置滚动高度', () => {
    expect(appShellSource).toContain('ref="contentAreaRef"')
    expect(appShellSource).toContain('const scrollPositions = new Map<string, number>()')
    expect(appShellSource).toContain('router.beforeEach')
    expect(appShellSource).toContain('resolveScrollKey')
    expect(appShellSource).toContain("behavior: 'instant'")
  })

  it('移除全局 content-area 的 smooth 声明以避免页面切换时滚动条动画撕裂', () => {
    expect(appShellCssSource).not.toMatch(/\.ncx-content-area\s*{[^}]*scroll-behavior:\s*smooth/)
  })

  it('AppShell 在处于搜索相关页面时隐藏顶栏冗余的搜索按钮', () => {
    expect(appShellSource).toContain("isSearchPage = computed<boolean>(() => route.name === 'search' || route.name === 'search-results')")
    expect(appShellSource).toContain('!isStandalonePage && !isSettingsPage && !isSearchPage')
  })
})
