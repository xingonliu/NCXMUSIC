import type { RouteRecordName } from 'vue-router'

// ========= 类型 =========

/** 侧边栏导航条目的渲染数据。 */
export interface AppNavigationItem {
  /** 导航条目显示文案。 */
  readonly label: string
  /** 导航目标路由名称。 */
  readonly routeName: RouteRecordName
  /** 导航条目图标语义。 */
  readonly icon: 'discover' | 'search' | 'agent' | 'liked' | 'profile' | 'settings'
}

/** 侧边栏主导航分组。 */
export interface AppNavigationSection {
  readonly label: string
  readonly items: readonly AppNavigationItem[]
}

// ========= 变量 =========

/** AppShell 顶部主导航结构，对应发现、搜索和小云一级入口。 */
export const appPrimaryNavigationSections: readonly AppNavigationSection[] = [
  {
    label: '主导航',
    items: [
      { label: '发现音乐', routeName: 'discover', icon: 'discover' },
      { label: '搜索', routeName: 'search', icon: 'search' },
      { label: '小云', routeName: 'agent', icon: 'agent' },
      { label: '通用组件', routeName: 'design-system-lab', icon: 'settings' }
    ]
  }
] as const

/** AppShell 中部歌单次导航结构，后续歌单数据接入后继续扩展。 */
export const appPlaylistNavigationSections: readonly AppNavigationSection[] = [
  {
    label: '我的音乐',
    items: [{ label: '我喜欢', routeName: 'liked-songs', icon: 'liked' }]
  }
] as const

/** 底部账户行入口，保持与设置行分离。 */
export const appAccountNavigationItem: AppNavigationItem = {
  label: '个人资料',
  routeName: 'profile',
  icon: 'profile'
}

/** 底部第二行设置入口，仍复用普通页面激活样式。 */
export const appSettingsNavigationItem: AppNavigationItem = {
  label: '设置',
  routeName: 'settings',
  icon: 'settings'
}
