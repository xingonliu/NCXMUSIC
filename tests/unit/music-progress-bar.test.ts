// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MusicProgressBar from '../../src/renderer/features/music/components/MusicProgressBar.vue'
import musicProgressBarSource from '../../src/renderer/features/music/components/MusicProgressBar.vue?raw'
import playbackControlsSource from '../../src/renderer/features/music/components/PlaybackControls.vue?raw'
import playerBarSource from '../../src/renderer/features/music/components/PlayerBar.vue?raw'

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

  it('处于 busy 状态时保留固定样式并暴露无障碍忙碌状态', () => {
    const wrapper = mount(MusicProgressBar, {
      props: {
        modelValue: 0,
        max: 100,
        busy: true
      }
    })

    expect(wrapper.find('.music-progress-bar--busy').exists()).toBe(true)
    expect(wrapper.find('.music-progress-bar').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.music-progress-busy-glow').exists()).toBe(false)
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

  it('完整保留 NcxMusicWeb 固定轨道、填充与 hover 光晕样式', () => {
    expect(musicProgressBarSource).toContain('rgb(175 175 175 / 24.7%)')
    expect(musicProgressBarSource).toContain('rgb(255 255 255 / 94.5%)')
    expect(musicProgressBarSource).toContain('box-shadow: #ffffff 0 0 30px 2px')
    expect(musicProgressBarSource).toContain('height: 10px')
    expect(musicProgressBarSource).not.toContain('music-progress-tooltip')
    expect(musicProgressBarSource).not.toContain('music-progress-thumb')
    expect(musicProgressBarSource).not.toContain('var(--ncx-color-text-primary')
  })

  it('音乐 Bar 与沉浸歌词页都只在进度确认后提交播放器 seek', () => {
    expect(playerBarSource).toContain('@change="onSeek"')
    expect(playerBarSource).not.toContain('@update:model-value="onSeek"')
    expect(playbackControlsSource).toContain('@change="handleSeek"')
    expect(playbackControlsSource).not.toContain('@update:model-value="handleSeek"')
  })

  it('拖动时只预览并在匹配指针释放后提交一次最终进度', async () => {
    const wrapper = mount(MusicProgressBar, {
      props: {
        modelValue: 10000,
        max: 100000,
        step: 1000
      }
    })

    const root = wrapper.find('.music-progress-bar')
    /** 固定为 left=100、width=200 的测试轨道矩形。 */
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      right: 300,
      top: 0,
      bottom: 10,
      width: 200,
      height: 10,
      toJSON: () => ({})
    })

    await root.trigger('pointerdown', {
      button: 0,
      pointerId: 7,
      clientX: 150
    })
    expect(wrapper.emitted('update:modelValue')).toEqual([[25000]])
    expect(wrapper.emitted('change')).toBeUndefined()

    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 8,
      clientX: 250
    }))
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)

    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 7,
      clientX: 250
    }))
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([75000])
    expect(wrapper.emitted('change')).toBeUndefined()

    window.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 7,
      clientX: 300
    }))
    expect(wrapper.emitted('change')).toEqual([[100000]])
    expect(wrapper.emitted('dragEnd')).toEqual([[100000]])
  })

  it('pointercancel 放弃拖动且不会把取消坐标提交给播放器', async () => {
    const wrapper = mount(MusicProgressBar, {
      props: {
        modelValue: 20000,
        max: 100000
      }
    })

    const root = wrapper.find('.music-progress-bar')
    /** 固定为 100px 宽的测试轨道矩形。 */
    vi.spyOn(root.element, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      right: 100,
      top: 0,
      bottom: 10,
      width: 100,
      height: 10,
      toJSON: () => ({})
    })

    await root.trigger('pointerdown', {
      button: 0,
      pointerId: 3,
      clientX: 60
    })
    window.dispatchEvent(new PointerEvent('pointercancel', {
      pointerId: 3,
      clientX: 0
    }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('dragEnd')).toEqual([[20000]])
    expect(root.classes()).not.toContain('music-progress-bar--dragging')
  })
})
