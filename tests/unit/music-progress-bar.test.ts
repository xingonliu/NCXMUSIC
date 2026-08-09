// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MusicProgressBar from '../../src/renderer/features/music/components/MusicProgressBar.vue'

// ========= 变量 =========

/** 默认测试最大值与当前值。 */
const defaultMax = 180000
const defaultCurrent = 60000

// ========= 测试区 =========

describe('MusicProgressBar 独立音乐进度条组件单元测试', () => {
  it('正确计算并渲染已播放百分比与 ARIA 属性', () => {
    const wrapper = mount(MusicProgressBar, {
      props: {
        modelValue: defaultCurrent,
        min: 0,
        max: defaultMax,
        label: '播放进度'
      }
    })

    const root = wrapper.find('.music-progress-bar')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('slider')
    expect(root.attributes('aria-valuenow')).toBe(String(defaultCurrent))
    expect(root.attributes('aria-valuemin')).toBe('0')
    expect(root.attributes('aria-valuemax')).toBe(String(defaultMax))

    const fill = wrapper.find('.music-progress-fill')
    // 60000 / 180000 = 33.3333%
    expect(fill.attributes('style')).toContain('width: 33.3333')
  })

  it('处于 busy 状态时渲染 shimmer 光效并添加 busy 类名', () => {
    const wrapper = mount(MusicProgressBar, {
      props: {
        modelValue: 0,
        max: 100,
        busy: true
      }
    })

    expect(wrapper.find('.music-progress-bar--busy').exists()).toBe(true)
    expect(wrapper.find('.music-progress-busy-glow').exists()).toBe(true)
  })

  it('支持方向键键盘微调并发出 update:modelValue 与 change 事件', async () => {
    const wrapper = mount(MusicProgressBar, {
      props: {
        modelValue: 50000,
        min: 0,
        max: 100000,
        step: 5000
      }
    })

    const root = wrapper.find('.music-progress-bar')
    await root.trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')).toEqual([[55000]])
    expect(wrapper.emitted('change')).toEqual([[55000]])

    await root.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([45000])
  })

  it('正确响应悬浮 mouseenter 与 mouseleave 状态切换', async () => {
    const wrapper = mount(MusicProgressBar, {
      props: {
        modelValue: 10000,
        max: 50000
      }
    })

    const root = wrapper.find('.music-progress-bar')
    expect(root.classes()).not.toContain('music-progress-bar--hover')

    await root.trigger('mouseenter')
    expect(root.classes()).toContain('music-progress-bar--hover')

    await root.trigger('mouseleave')
    expect(root.classes()).not.toContain('music-progress-bar--hover')
  })
})
