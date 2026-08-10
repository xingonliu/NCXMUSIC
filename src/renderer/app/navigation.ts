import type { RouteRecordName } from 'vue-router'

import { t } from '../i18n'

// ========= 类型 =========

/** 侧边栏导航条目的渲染数据。 */
export interface AppNavigationItem {
  /** 导航条目显示文案。 */
  readonly label: string
  /** 导航目标路由名称。 */
  readonly routeName: RouteRecordName
  /** 导航条目图标语义。 */
  readonly icon: 'discover' | 'browse' | 'search' | 'agent' | 'profile' | 'settings'
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
    label: '',
    items: [
      { label: t('navigation.discover'), routeName: 'discover', icon: 'discover' },
      { label: t('navigation.browse'), routeName: 'browse', icon: 'browse' },
      { label: t('navigation.search'), routeName: 'search', icon: 'search' },
      { label: t('navigation.agent'), routeName: 'agent', icon: 'agent' },
      { label: t('navigation.designSystem'), routeName: 'design-system-lab', icon: 'settings' }
    ]
  }
] as const

/** 底部账户行入口，保持与设置行分离。 */
export const appAccountNavigationItem: AppNavigationItem = {
  label: t('navigation.profile'),
  routeName: 'profile',
  icon: 'profile'
}

/** 底部第二行设置入口，仍复用普通页面激活样式。 */
export const appSettingsNavigationItem: AppNavigationItem = {
  label: t('navigation.settings'),
  routeName: 'settings',
  icon: 'settings'
}
