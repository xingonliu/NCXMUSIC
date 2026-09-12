// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  CommonButton,
  CommonDialog,
  CommonIconButton
} from '../../src/renderer/design-system/components'
import LiquidGlass from '../../src/renderer/design-system/components/LiquidGlass.vue'

describe('LiquidGlass.vue 分级变体测试', () => {
  it('默认以 full 变体渲染并挂载 SVG 位移滤镜', () => {
    const wrapper = mount(LiquidGlass, {
      slots: {
        default: '<span class="test-content">玻璃内容</span>'
      }
    })

    expect(wrapper.classes()).toContain('ncx-liquid-glass--full')
    expect(wrapper.find('svg.filter').exists()).toBe(true)
    expect(wrapper.find('.test-content').text()).toBe('玻璃内容')
  })

  it('lightweight 轻量级变体跳过 SVG 滤镜并应用轻量级类名', () => {
    const wrapper = mount(LiquidGlass, {
      props: {
        variant: 'lightweight'
      }
    })

    expect(wrapper.classes()).toContain('ncx-liquid-glass--lightweight')
    expect(wrapper.find('svg.filter').exists()).toBe(false)
  })

  it('dialog 深度模态变体包含 dialog 标识与 SVG 滤镜', () => {
    const wrapper = mount(LiquidGlass, {
      props: {
        variant: 'dialog'
      }
    })

    expect(wrapper.classes()).toContain('ncx-liquid-glass--dialog')
    expect(wrapper.find('svg.filter').exists()).toBe(true)
  })

  it('tinted 变体正确解析语义色 tint 变量', () => {
    const wrapper = mount(LiquidGlass, {
      props: {
        variant: 'tinted',
        tint: 'primary'
      }
    })

    expect(wrapper.classes()).toContain('ncx-liquid-glass--tinted')
    const style = wrapper.attributes('style')
    expect(style).toContain('--liquid-glass-tint: var(--ncx-liquid-glass-tint-primary)')
  })
})

describe('通用组件 Liquid Glass 集成测试', () => {
  it('CommonButton 在启用 glass 时附加对应分级类名', () => {
    const defaultBtn = mount(CommonButton)
    expect(defaultBtn.classes()).not.toContain('ncx-common-button-glass')

    const fullBtn = mount(CommonButton, {
      props: { glass: 'full' }
    })
    expect(fullBtn.classes()).toContain('ncx-common-button-glass')
    expect(fullBtn.classes()).toContain('ncx-common-button-glass--full')

    const tintedBtn = mount(CommonButton, {
      props: { glass: 'tinted' }
    })
    expect(tintedBtn.classes()).toContain('ncx-common-button-glass--tinted')

    const lightweightBtn = mount(CommonButton, {
      props: { glass: true }
    })
    expect(lightweightBtn.classes()).toContain('ncx-common-button-glass--lightweight')
  })

  it('CommonIconButton 在启用 glass 时附加对应分级类名', () => {
    const defaultIconBtn = mount(CommonIconButton, {
      props: { label: '搜索' }
    })
    expect(defaultIconBtn.classes()).not.toContain('ncx-common-icon-button-glass')

    const glassIconBtn = mount(CommonIconButton, {
      props: { label: '搜索', glass: 'full' }
    })
    expect(glassIconBtn.classes()).toContain('ncx-common-icon-button-glass')
    expect(glassIconBtn.classes()).toContain('ncx-common-icon-button-glass--full')
  })

  it('CommonDialog 默认启用 glass 并附加 ncx-common-modal--liquid 材质类', () => {
    const wrapper = mount(CommonDialog, {
      props: {
        visible: true,
        title: '测试对话框',
        glass: true
      },
      attachTo: document.body
    })

    const modal = document.body.querySelector('.ncx-common-modal')
    expect(modal).not.toBeNull()
    expect(modal?.classList.contains('ncx-common-modal--liquid')).toBe(true)

    wrapper.unmount()
  })
})
