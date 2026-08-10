// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'

import {
  CommonButton,
  CommonButtonGroup,
  CommonHeaderButton,
  CommonHeaderGroupButton,
  CommonHeaderGroupItem,
  CommonIconButton,
  CommonLinkButton
} from '../../src/renderer/design-system/components'

describe('macOS HIG & WWDC25 按钮族组件规范测试', () => {
  describe('CommonButton (通用按钮)', () => {
    it('默认状态正确渲染类名与 default 类型', () => {
      const wrapper = mount(CommonButton, {
        slots: { default: '点击操作' }
      })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.classes()).toContain('ncx-common-button')
      expect(wrapper.classes()).toContain('ncx-common-button-secondary')
      expect(wrapper.classes()).toContain('ncx-common-button-default')
      expect(wrapper.attributes('type')).toBe('button')
      expect(wrapper.text()).toBe('点击操作')
    })

    it('正确支持所有变体 (primary / secondary / ghost / danger)', () => {
      const variants = ['primary', 'secondary', 'ghost', 'danger'] as const

      for (const variant of variants) {
        const wrapper = mount(CommonButton, {
          props: { variant },
          slots: { default: variant }
        })
        expect(wrapper.classes()).toContain(`ncx-common-button-${variant}`)
      }
    })

    it('正确支持所有尺寸 (compact / default / prominent)', () => {
      const sizes = ['compact', 'default', 'prominent'] as const

      for (const size of sizes) {
        const wrapper = mount(CommonButton, {
          props: { size }
        })
        expect(wrapper.classes()).toContain(`ncx-common-button-${size}`)
      }
    })

    it('点击触发 click 事件', async () => {
      const wrapper = mount(CommonButton)
      await wrapper.trigger('click')
      expect(wrapper.emitted('click')).toHaveLength(1)
    })

    it('禁用态设置 disabled 属性与 aria-disabled，且拦截点击事件', async () => {
      const wrapper = mount(CommonButton, {
        props: { disabled: true }
      })

      expect(wrapper.attributes('disabled')).toBeDefined()
      expect(wrapper.attributes('aria-disabled')).toBe('true')

      await wrapper.trigger('click')
      expect(wrapper.emitted('click')).toBeUndefined()
    })

    it('加载态 (loading) 显示 Spinner、设置 aria-busy，且拦截点击事件', async () => {
      const wrapper = mount(CommonButton, {
        props: { loading: true },
        slots: { default: '保存中' }
      })

      expect(wrapper.classes()).toContain('ncx-common-button-loading')
      expect(wrapper.attributes('aria-busy')).toBe('true')
      expect(wrapper.attributes('aria-disabled')).toBe('true')
      expect(wrapper.find('.ncx-common-spinner').exists()).toBe(true)

      await wrapper.trigger('click')
      expect(wrapper.emitted('click')).toBeUndefined()
    })
  })

  describe('CommonIconButton (纯图标按钮)', () => {
    it('正确渲染无障碍 aria-label 且不产生原生 title 气泡', () => {
      const wrapper = mount(CommonIconButton, {
        props: { label: '播放音乐' },
        slots: { default: () => h('span', '▶') }
      })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.classes()).toContain('ncx-common-icon-button')
      expect(wrapper.attributes('aria-label')).toBe('播放音乐')
      expect(wrapper.attributes('title')).toBeUndefined()
      expect(wrapper.text()).toBe('▶')
    })

    it('悬停延迟后展示样式化气泡（CommonTooltip 面板），移出后隐藏', async () => {
      vi.useFakeTimers()
      try {
        const wrapper = mount(CommonIconButton, {
          attachTo: document.body,
          props: { label: '播放音乐' }
        })

        expect(document.querySelector('.ncx-common-tooltip-panel')).toBeNull()

        await wrapper.trigger('mouseenter')
        await vi.advanceTimersByTimeAsync(1_500)
        await nextTick()
        await nextTick()

        /** Teleport 到 body 的气泡面板。 */
        const panel = document.querySelector('.ncx-common-tooltip-panel')
        expect(panel).not.toBeNull()
        expect(panel?.getAttribute('role')).toBe('tooltip')
        expect(panel?.textContent).toBe('播放音乐')
        expect(panel?.classList.contains('ncx-common-tooltip-panel--top')).toBe(true)

        await wrapper.trigger('mouseleave')
        await nextTick()
        expect(document.querySelector('.ncx-common-tooltip-panel')).toBeNull()
        wrapper.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('支持显式指定气泡方向', async () => {
      /** 绑定到 document.body 的图标按钮包装器，用于验证 Teleport 气泡。 */
      const wrapper = mount(CommonIconButton, {
        attachTo: document.body,
        props: { label: '上一首', tooltipPlacement: 'left' }
      })

      await wrapper.trigger('focusin')
      await nextTick()
      await nextTick()

      /** 显式左侧定位的气泡面板。 */
      const panel = document.querySelector('.ncx-common-tooltip-panel')
      expect(panel?.classList.contains('ncx-common-tooltip-panel--left')).toBe(true)

      wrapper.unmount()
    })

    it('未指定气泡方向时根据按钮视口位置自动选择', async () => {
      /** 绑定到 document.body 的图标按钮包装器，用于模拟视口贴边位置。 */
      const wrapper = mount(CommonIconButton, {
        attachTo: document.body,
        props: { label: '靠左按钮' }
      })

      /** 模拟按钮靠近视口左侧。 */
      wrapper.element.getBoundingClientRect = vi.fn(() => new DOMRect(12, 120, 24, 24))

      await wrapper.trigger('focusin')
      await nextTick()
      await nextTick()

      /** 自动切换到右侧避免贴边的气泡面板。 */
      const panel = document.querySelector('.ncx-common-tooltip-panel')
      expect(panel?.classList.contains('ncx-common-tooltip-panel--right')).toBe(true)

      wrapper.unmount()
    })

    it('支持 selected 选定按下状态与 aria-pressed', () => {
      const wrapper = mount(CommonIconButton, {
        props: { label: '喜欢', selected: true }
      })

      expect(wrapper.classes()).toContain('ncx-common-icon-button-selected')
      expect(wrapper.attributes('aria-pressed')).toBe('true')
    })

    it('禁用状态不展示气泡且正确防护', async () => {
      vi.useFakeTimers()
      try {
        const wrapper = mount(CommonIconButton, {
          props: { label: '设置', disabled: true }
        })

        expect(wrapper.attributes('disabled')).toBeDefined()
        expect(wrapper.attributes('aria-disabled')).toBe('true')

        await wrapper.trigger('mouseenter')
        await vi.advanceTimersByTimeAsync(300)
        await nextTick()
        expect(wrapper.find('.ncx-common-tooltip-panel').exists()).toBe(false)

        await wrapper.trigger('click')
        expect(wrapper.emitted('click')).toBeUndefined()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('CommonButtonGroup (按钮组容器)', () => {
    it('正确渲染 role="group" 及连体 connected 变体', () => {
      const wrapper = mount(CommonButtonGroup, {
        slots: {
          default: () => [
            h(CommonButton, null, () => 'Btn 1'),
            h(CommonButton, null, () => 'Btn 2')
          ]
        }
      })

      expect(wrapper.attributes('role')).toBe('group')
      expect(wrapper.classes()).toContain('ncx-common-button-group')
      expect(wrapper.classes()).toContain('ncx-common-button-group-connected')
      expect(wrapper.findAll('.ncx-common-button')).toHaveLength(2)
    })

    it('支持 vertical 纵向排列', () => {
      const wrapper = mount(CommonButtonGroup, {
        props: { vertical: true }
      })

      expect(wrapper.classes()).toContain('ncx-common-button-group-vertical')
    })
  })

  describe('CommonLinkButton (链接型按钮)', () => {
    it('正确渲染 a 标签与 href 链接', () => {
      const wrapper = mount(CommonLinkButton, {
        props: { href: 'https://example.com' },
        slots: { default: '查看详情' }
      })

      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.classes()).toContain('ncx-common-link-button')
      expect(wrapper.attributes('href')).toBe('https://example.com')
      expect(wrapper.text()).toBe('查看详情')
    })

    it('禁用状态移除 href 并注入 aria-disabled，防护点击', async () => {
      const wrapper = mount(CommonLinkButton, {
        props: { href: 'https://example.com', disabled: true }
      })

      expect(wrapper.classes()).toContain('ncx-common-link-button-disabled')
      expect(wrapper.attributes('href')).toBeUndefined()
      expect(wrapper.attributes('aria-disabled')).toBe('true')

      await wrapper.trigger('click')
      expect(wrapper.emitted('click')).toBeUndefined()
    })
  })

  describe('CommonHeaderButton (Header 普通按钮)', () => {
    it('正确渲染 glass 按钮与 aria-label 属性', () => {
      const wrapper = mount(CommonHeaderButton, {
        props: { label: '返回上一页' },
        slots: { default: () => h('span', '←') }
      })

      expect(wrapper.element.tagName).toBe('BUTTON')
      expect(wrapper.classes()).toContain('ncx-common-header-button')
      expect(wrapper.classes()).toContain('ncx-glass-button')
      expect(wrapper.attributes('aria-label')).toBe('返回上一页')
      expect(wrapper.attributes('title')).toBeUndefined()
      expect(wrapper.text()).toBe('←')
    })

    it('悬停延迟后展示样式化 Tip 气泡，移出后隐藏', async () => {
      vi.useFakeTimers()
      const wrapper = mount(CommonHeaderButton, {
        props: { label: '搜索内容' }
      })

      expect(wrapper.find('.ncx-common-tooltip-panel').exists()).toBe(false)

      await wrapper.trigger('mouseenter')
      expect(wrapper.find('.ncx-common-tooltip-panel').exists()).toBe(false)

      vi.advanceTimersByTime(1_500)
      await nextTick()
      expect(wrapper.find('.ncx-common-tooltip-panel').exists()).toBe(true)
      expect(wrapper.find('.ncx-common-tooltip-content').text()).toBe('搜索内容')

      await wrapper.trigger('mouseleave')
      await nextTick()
      expect(wrapper.find('.ncx-common-tooltip-panel').exists()).toBe(false)
      vi.useRealTimers()
    })

    it('点击触发 click 事件，禁用态拦截点击', async () => {
      const wrapper = mount(CommonHeaderButton, { props: { label: '刷新' } })
      await wrapper.trigger('click')
      expect(wrapper.emitted('click')).toHaveLength(1)

      const disabledWrapper = mount(CommonHeaderButton, { props: { label: '刷新', disabled: true } })
      await disabledWrapper.trigger('click')
      expect(disabledWrapper.emitted('click')).toBeUndefined()
    })
  })

  describe('CommonHeaderGroupButton & CommonHeaderGroupItem (Header 成组按钮)', () => {
    it('通过插槽渲染成组按钮与关闭样式变体，并验证每一项的 Tip 气泡', async () => {
      vi.useFakeTimers()
      const wrapper = mount(CommonHeaderGroupButton, {
        props: { label: '窗口控制' },
        slots: {
          default: () => [
            h(CommonHeaderGroupItem, { label: '最小化' }, () => '-'),
            h(CommonHeaderGroupItem, { label: '关闭', variant: 'close' }, () => 'x')
          ]
        }
      })

      expect(wrapper.classes()).toContain('ncx-common-header-group-button')
      expect(wrapper.classes()).toContain('ncx-window-controls')

      const items = wrapper.findAllComponents(CommonHeaderGroupItem)
      expect(items).toHaveLength(2)

      const item0 = items[0]!
      const item1 = items[1]!

      expect(item0.classes()).toContain('ncx-common-header-group-item')
      expect(item0.classes()).toContain('ncx-window-control')
      expect(item0.attributes('aria-label')).toBe('最小化')

      expect(item1.classes()).toContain('ncx-window-control--close')
      expect(item1.attributes('aria-label')).toBe('关闭')

      // 测试第一个按钮 Hover 显示 Tip
      await item0.trigger('mouseenter')
      vi.advanceTimersByTime(1_500)
      await nextTick()
      expect(item0.find('.ncx-common-tooltip-panel').exists()).toBe(true)
      expect(item0.find('.ncx-common-tooltip-content').text()).toBe('最小化')

      vi.useRealTimers()
    })

    it('支持通过 items 配置项直接渲染组合按钮与分割线', () => {
      const handleClickMin = vi.fn()
      const wrapper = mount(CommonHeaderGroupButton, {
        props: {
          label: '窗口控制项',
          items: [
            { label: '最小化', onClick: handleClickMin },
            { label: '还原' },
            { label: '关闭', variant: 'close' }
          ]
        }
      })

      const items = wrapper.findAll('.ncx-common-header-group-item')
      expect(items).toHaveLength(3)

      const dividers = wrapper.findAll('.ncx-window-divider')
      expect(dividers).toHaveLength(2)
    })
  })
})
