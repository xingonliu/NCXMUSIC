import 'vue-router'

export {}

declare module 'vue-router' {
  interface RouteMeta {
    pageLevel: 1 | 2
    title: string
    playerBar: 'show' | 'hide'
    /** 页面展示形态；immersive 页面由应用根层独占展示。 */
    presentation?: 'standard' | 'immersive'
    headerVariant?: 'default' | 'transparent'
    /** 首次引导等页面隐藏普通侧边栏。 */
    shell?: 'default' | 'standalone'
    fallbackRoute?: string
    /** 是否使用 KeepAlive 缓存组件实例，避免主 Tab 切走时销毁。 */
    keepAlive?: boolean
  }
}
