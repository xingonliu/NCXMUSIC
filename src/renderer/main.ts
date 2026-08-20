import { createApp } from 'vue'

import App from './App.vue'
import { router } from './app/router'
import './design-system/styles/global.css'
import FoundationPage from './features/foundation/FoundationPage.vue'

// ========= 变量 =========

/** Smoke 查询下只挂载运行时探针页，避免业务路由遮蔽既有握手入口。 */
const RootComponent = new URLSearchParams(window.location.search).has('smoke')
  ? FoundationPage
  : App

// ========= 应用启动 =========

createApp(RootComponent).use(router).mount('#app')
