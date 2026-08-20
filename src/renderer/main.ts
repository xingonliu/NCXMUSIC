import { createApp } from 'vue'

import App from './App.vue'
import { router } from './app/router'
import { startRendererApplication } from './app/renderer-startup'
import './design-system/styles/global.css'
import FoundationPage from './features/foundation/FoundationPage.vue'

// ========= 变量 =========

/** 当前入口是否为专用 Runtime Smoke 探针。 */
const isRuntimeSmoke = new URLSearchParams(window.location.search).has('smoke')

/** Smoke 查询下只挂载运行时探针页，避免业务路由遮蔽既有握手入口。 */
const RootComponent = isRuntimeSmoke
  ? FoundationPage
  : App

// ========= 函数 =========

/** 创建并挂载当前入口对应的 Vue 根应用。 */
function mountApplication(): void {
  createApp(RootComponent).use(router).mount('#app')
}

// ========= 应用启动 =========

void startRendererApplication({
  bypassRuntimeGate: isRuntimeSmoke,
  waitUntilRuntimeReady: (timeoutMs) => window.ncx.runtime.waitUntilReady(timeoutMs),
  mountApplication
})
