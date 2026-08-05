import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { router } from './app/router'
import './design-system/styles/global.css'

createApp(App).use(createPinia()).use(router).mount('#app')
