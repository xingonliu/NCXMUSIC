/// <reference types="vite/client" />

import type { DesktopBridge } from '../shared/contracts/desktop-bridge'

declare module 'vue' {
  interface ComponentCustomProperties {
    /** 翻译尚在按语义键迁移中的 Vue 模板中文源文案。 */
    $tSource: (source: string) => string
  }
}

declare global {
  interface Window {
    readonly ncx: DesktopBridge
  }
}

export {}
