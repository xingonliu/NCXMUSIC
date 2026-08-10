// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import SearchPage from '../../src/renderer/features/music/SearchPage.vue'

// ========= 测试区 =========

describe('二级音乐内容页视觉结构', () => {
  it('保持搜索页为单一搜索控件而不叠加装饰卡片', async () => {
    /** 搜索页结构测试使用的内存路由。 */
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/search', component: SearchPage }]
    })
    await router.push('/search')
    await router.isReady()

    /** 当前搜索页组件包装器。 */
    const wrapper = mount(SearchPage, {
      global: { plugins: [router] }
    })

    expect(wrapper.classes()).toContain('music-content-page')
    expect(wrapper.get('h1').text()).toBe('搜索')
    expect(wrapper.find('.music-search-box').exists()).toBe(true)
    expect(wrapper.find('.music-search-panel').exists()).toBe(false)
  })
})
