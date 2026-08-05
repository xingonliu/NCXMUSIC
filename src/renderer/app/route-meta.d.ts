import 'vue-router'

export {}

declare module 'vue-router' {
  interface RouteMeta {
    pageLevel: 1 | 2
    title: string
    playerBar: 'show' | 'hide'
    headerVariant?: 'default' | 'transparent'
  }
}
