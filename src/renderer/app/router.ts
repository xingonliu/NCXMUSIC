import { createRouter, createWebHashHistory } from 'vue-router'

import FoundationPage from '../features/foundation/FoundationPage.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'foundation',
      component: FoundationPage,
      meta: {
        pageLevel: 1,
        title: 'foundation.title',
        playerBar: 'hide'
      }
    }
  ]
})
