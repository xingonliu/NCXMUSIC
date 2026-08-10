// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LyricsPanel from '../../src/renderer/features/music/components/LyricsPanel.vue'
import ImmersiveLyricsPage from '../../src/renderer/features/music/ImmersiveLyricsPage.vue'
import {
  calculateImmersiveDismissVisualState,
  clampImmersiveDismissOffset,
  IMMERSIVE_DISMISS_DISTANCE_PX,
  shouldCompleteImmersiveDismiss
} from '../../src/renderer/features/music/immersive-dismiss-gesture'
import { useImmersivePlayerPresentation } from '../../src/renderer/features/music/immersive-player-presentation'
import { disposePlayer } from '../../src/renderer/features/music/use-player'

// ========= 变量 =========

/** 标准歌词夹具的固定观测时间。 */
const observedAt = '2026-08-09T12:00:00.000Z'

/** 测试用歌词读取函数。 */
const getLyrics = vi.fn()

/** happy-dom 原始滚动方法。 */
const originalScrollTo = HTMLElement.prototype.scrollTo

// ========= 生命周期 =========

beforeEach(async () => {
  /** 测试所需的最小 Renderer Bridge。 */
  const bridge = {
    platform: 'win32',
    runtime: {
      getLyrics
    },
    windowControls: {
      send: vi.fn(async () => ({
        platform: 'win32',
        maximized: false,
        fullscreen: false,
        focused: true
      })),
      snapshot: vi.fn(async () => ({
        platform: 'win32',
        maximized: false,
        fullscreen: false,
        focused: true
      })),
      onSnapshot: vi.fn(() => () => {})
    }
  }
  Object.defineProperty(window, 'ncx', {
    configurable: true,
    value: bridge
  })
  HTMLElement.prototype.scrollTo = vi.fn()
  getLyrics.mockReset()
  await useImmersivePlayerPresentation().close()
})

afterEach(async () => {
  HTMLElement.prototype.scrollTo = originalScrollTo
  disposePlayer()
  await useImmersivePlayerPresentation().close()
  document.body.innerHTML = ''
})

// ========= 测试 =========

describe('应用级沉浸播放展示', () => {
  it('下拉短杆时连续缩小封面并降低其他元素不透明度', () => {
    /** 下拉关闭阈值一半位置对应的视觉状态。 */
    const halfwayState = calculateImmersiveDismissVisualState(
      IMMERSIVE_DISMISS_DISTANCE_PX / 2
    )
    /** 越过完整关闭阈值后的封顶视觉状态。 */
    const completedState = calculateImmersiveDismissVisualState(
      IMMERSIVE_DISMISS_DISTANCE_PX * 2
    )

    expect(halfwayState.progress).toBe(0.5)
    expect(halfwayState.artworkScale).toBeCloseTo(0.93)
    expect(halfwayState.supportingOpacity).toBeCloseTo(0.56)
    expect(completedState.progress).toBe(1)
    expect(completedState.artworkScale).toBe(0.86)
    expect(completedState.supportingOpacity).toBe(0.12)
  })

  it('只允许向下拖动并按距离或下甩速度决定是否收起', () => {
    expect(clampImmersiveDismissOffset(-80, 800)).toBe(0)
    expect(clampImmersiveDismissOffset(900, 800)).toBe(800)
    expect(shouldCompleteImmersiveDismiss(219, 0.2)).toBe(false)
    expect(shouldCompleteImmersiveDismiss(220, 0.2)).toBe(true)
    expect(shouldCompleteImmersiveDismiss(80, 0.7)).toBe(true)
    expect(shouldCompleteImmersiveDismiss(20, 1.2)).toBe(false)
  })

  it('达到下拉阈值后立即请求共享元素关闭而不先把封面滑出屏幕', async () => {
    /** 使用空播放状态挂载的沉浸页测试实例。 */
    const wrapper = mount(ImmersiveLyricsPage, {
      global: {
        stubs: {
          CommonHeaderGroupButton: true,
          CommonHeaderGroupItem: true,
          CommonIconButton: true,
          LyricsPanel: true,
          MediaArtwork: true,
          PlaybackControls: true,
          QueueDrawer: true
        }
      }
    })
    /** 可下拉收起沉浸页的单根 SVG 短杆。 */
    const closeHandle = wrapper.find('.immersive-close-handle')

    await closeHandle.trigger('pointerdown', {
      button: 0,
      pointerId: 1,
      clientY: 100
    })
    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 1,
      clientY: 320
    }))
    window.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 1,
      clientY: 320
    }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.find('.immersive-lyrics-page').attributes('style')).toContain(
      '--immersive-drag-offset-y: 220px'
    )
    expect(closeHandle.findAll('line')).toHaveLength(1)
  })

  it('打开和关闭不改变路由，并在关闭后把焦点还给触发按钮', async () => {
    /** 模拟 PlayerBar 封面入口的按钮。 */
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()

    /** 应用级沉浸播放展示控制器。 */
    const immersivePlayer = useImmersivePlayerPresentation()
    await immersivePlayer.open(undefined, trigger)

    expect(immersivePlayer.isOpen.value).toBe(true)

    await immersivePlayer.close()

    expect(immersivePlayer.isOpen.value).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('高清封面预热未完成时也立即进入展开状态', async () => {
    /** 测试前浏览器图片解码实现。 */
    const originalDecode = Image.prototype.decode
    /** 永不提前完成的高清封面解码任务。 */
    const pendingDecode = new Promise<void>(() => undefined)
    Image.prototype.decode = vi.fn(() => pendingDecode)

    try {
      /** 应用级沉浸播放展示控制器。 */
      const immersivePlayer = useImmersivePlayerPresentation()
      /** 不应等待高清封面预热的展开任务。 */
      const opening = immersivePlayer.open('https://example.com/high-resolution.jpg')

      await vi.waitFor(() => expect(immersivePlayer.isOpen.value).toBe(true))
      await opening
    } finally {
      Image.prototype.decode = originalDecode
    }
  })

  it('高亮当前歌词并在点击其他歌词时发出精确 seek 位置', async () => {
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-1',
          lines: [
            { timeMs: 0, text: '第一行' },
            { timeMs: 1_000, text: '第二行', translation: 'Second line' },
            { timeMs: 2_000, text: '第三行' }
          ],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    /** 沉浸歌词面板测试实例。 */
    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-1',
        positionMs: 1_050,
        immersive: true
      }
    })

    await vi.waitFor(() => expect(wrapper.findAll('.lyrics-line')).toHaveLength(3))

    /** 当前播放位置对应的第二行歌词。 */
    const activeLine = wrapper.findAll('.lyrics-line')[1]
    expect(activeLine?.classes()).toContain('lyrics-line--active')
    expect(activeLine?.attributes('aria-current')).toBe('true')

    await wrapper.findAll('.lyrics-line button')[2]?.trigger('click')
    expect(wrapper.emitted('seek')).toEqual([[2_000]])
  })
})
