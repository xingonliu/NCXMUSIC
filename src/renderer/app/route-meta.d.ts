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
    fallbackRoute?: string
  }
}
