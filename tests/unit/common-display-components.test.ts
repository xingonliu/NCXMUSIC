// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  CommonAvatar,
  CommonBadge,
  CommonCard,
  CommonSeparator,
  CommonSwitch,
  CommonTag,
  CommonTooltip
} from '../../src/renderer/design-system/components'

// ========= 测试套件 =========

describe('macOS HIG & WWDC25 规范组件测试', () => {
  describe('CommonAvatar (头像)', () => {
    it('正确生成首字兜底与图片展现', () => {
      const wrapperFallback = mount(CommonAvatar, {
        props: { name: 'Ncx Music', size: 'default', status: 'online' }
      })
      expect(wrapperFallback.text()).toContain('NM')
      expect(wrapperFallback.classes()).toContain('ncx-common-avatar--default')
      expect(wrapperFallback.classes()).toContain('ncx-common-avatar--circle')
      expect(wrapperFallback.find('.ncx-common-avatar-status--online').exists()).toBe(true)

      const wrapperImg = mount(CommonAvatar, {
        props: { name: 'User', src: 'https://example.com/avatar.png', shape: 'square' }
      })
      expect(wrapperImg.find('img').attributes('src')).toBe('https://example.com/avatar.png')
      expect(wrapperImg.classes()).toContain('ncx-common-avatar--square')
    })
  })

  describe('CommonBadge (状态徽标)', () => {
    it('支持 subtle, solid 与 dot 变体，并正确计算 count 上限', () => {
      const wrapper = mount(CommonBadge, {
        props: { type: 'danger', variant: 'solid', count: 120, max: 99 }
      })
      expect(wrapper.text()).toBe('99+')
      expect(wrapper.classes()).toContain('ncx-common-badge-danger')
      expect(wrapper.classes()).toContain('ncx-common-badge--solid')

      const wrapperDot = mount(CommonBadge, {
        props: { type: 'success', dot: true }
      })
      expect(wrapperDot.classes()).toContain('ncx-common-badge--dot')
    })

    it('子元素包裹模式生成 floating 右上角徽标', () => {
      const wrapper = mount(CommonBadge, {
        props: { count: 3, type: 'info' },
        slots: { default: '<span>Icon</span>' }
      })
      expect(wrapper.classes()).toContain('ncx-common-badge-wrapper')
      expect(wrapper.find('.ncx-common-badge--floating').text()).toBe('3')
    })
  })

  describe('CommonTag (标签)', () => {
    it('处理选中、颜色预设与关闭事件', async () => {
      const wrapper = mount(CommonTag, {
        props: { selected: true, closable: true, color: 'blue' }
      })
      expect(wrapper.classes()).toContain('ncx-common-tag--selected')
      expect(wrapper.classes()).toContain('ncx-common-tag--blue')

      const closeBtn = wrapper.find('.ncx-common-tag-close')
      expect(closeBtn.exists()).toBe(true)
      await closeBtn.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('CommonCard (卡片容器)', () => {
    it('渲染 header, title 与 交互动画 Class', () => {
      const wrapper = mount(CommonCard, {
        props: { title: 'Card Title', variant: 'glass', interactive: true },
        slots: { default: '<p>Body</p>', extra: '<button>More</button>' }
      })
      expect(wrapper.find('.ncx-common-card-title').text()).toBe('Card Title')
      expect(wrapper.find('.ncx-common-card-extra').text()).toBe('More')
      expect(wrapper.classes()).toContain('ncx-common-card--glass')
      expect(wrapper.classes()).toContain('ncx-common-card--interactive')
    })
  })

  describe('CommonSeparator (分隔线)', () => {
    it('正确渲染水平、垂直、带 Label 分隔线', () => {
      const wrapperHoriz = mount(CommonSeparator, {
        props: { vertical: false, label: 'SECTION' }
      })
      expect(wrapperHoriz.find('.ncx-common-separator-label').text()).toBe('SECTION')
      expect(wrapperHoriz.attributes('role')).toBe('separator')

      const wrapperVert = mount(CommonSeparator, {
        props: { vertical: true }
      })
      expect(wrapperVert.classes()).toContain('ncx-common-separator--vertical')
      expect(wrapperVert.attributes('aria-orientation')).toBe('vertical')
    })
  })

  describe('CommonTooltip (提示说明)', () => {
    it('悬停或聚焦时控制气泡弹出', async () => {
      const wrapper = mount(CommonTooltip, {
        props: { text: 'Help text', placement: 'top', delay: 0 },
        slots: { default: '<button>Target</button>' }
      })
      expect(wrapper.text()).toBe('Target')

      await wrapper.trigger('mouseenter')
      await new Promise((resolve) => setTimeout(resolve, 30))

      expect(wrapper.find('.ncx-common-tooltip-panel').exists()).toBe(true)
      expect(wrapper.find('.ncx-common-tooltip-content').text()).toBe('Help text')
    })
  })

  describe('CommonSwitch (开关)', () => {
    it('正确生成开关结构、无障碍属性及尺寸 Class', async () => {
      const wrapper = mount(CommonSwitch, {
        props: { modelValue: true, size: 'default', label: '启用快捷键' }
      })
      expect(wrapper.attributes('role')).toBe('switch')
      expect(wrapper.attributes('aria-checked')).toBe('true')
      expect(wrapper.classes()).toContain('ncx-common-switch--on')
      expect(wrapper.classes()).toContain('ncx-common-switch--default')
      expect(wrapper.find('.ncx-common-switch-track').exists()).toBe(true)
      expect(wrapper.find('.ncx-common-switch-knob').exists()).toBe(true)
      expect(wrapper.find('.ncx-common-switch-label').text()).toBe('启用快捷键')

      await wrapper.trigger('click')
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
      expect(wrapper.emitted('change')?.[0]).toEqual([false])
    })

    it('disabled 状态下不触发状态切换', async () => {
      const wrapper = mount(CommonSwitch, {
        props: { modelValue: false, disabled: true, label: '已禁用' }
      })
      expect(wrapper.classes()).toContain('ncx-common-switch--disabled')
      expect(wrapper.attributes('disabled')).toBeDefined()

      await wrapper.trigger('click')
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
      expect(wrapper.emitted('change')).toBeFalsy()
    })
  })
})
