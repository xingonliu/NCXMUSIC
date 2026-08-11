// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LyricsPanel from '../../src/renderer/features/music/components/LyricsPanel.vue'
import ImmersiveLyricsPage from '../../src/renderer/features/music/ImmersiveLyricsPage.vue'
import { useImmersivePlayerPresentation } from '../../src/renderer/features/music/immersive-player-presentation'
import { disposePlayer } from '../../src/renderer/features/music/use-player'

// ========= 变量 =========

/** 标准歌词夹具的固定观测时间。 */
const observedAt = '2026-08-09T12:00:00.000Z'

/** 测试用歌词读取函数。 */
const getLyrics = vi.fn()

/** happy-dom 原始滚动方法。 */
const originalScrollTo = HTMLElement.prototype.scrollTo

/** 测试环境原始的 View Transition 入口。 */
const originalStartViewTransition = (
  document as unknown as {
    startViewTransition?: Document['startViewTransition']
  }
).startViewTransition

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
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: originalStartViewTransition
  })
  document.documentElement.removeAttribute('data-ncx-immersive-transition')
  document.body.innerHTML = ''
})

// ========= 测试 =========

describe('应用级沉浸播放展示', () => {
  it('顶部短杆忽略拖动并仅在点击时请求关闭', async () => {
    /** 使用空播放状态挂载的沉浸页测试实例。 */
    const wrapper = mount(ImmersiveLyricsPage, {
      global: {
        stubs: {
          CommonHeaderGroupButton: true,
          CommonHeaderGroupItem: true,
          CommonIconButton: true,
          FluidMeshBackground: true,
          LyricsPanel: true,
          MediaArtwork: true,
          PlaybackControls: true,
          QueueDrawer: true
        }
      }
    })
    /** 位于沉浸页根层的唯一关闭短杆。 */
    const closeHandle = wrapper.find('.immersive-close-handle')
    /** 沉浸播放页的根层元素。 */
    const page = wrapper.find('.immersive-lyrics-page')

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

    expect(wrapper.findAll('.immersive-close-handle')).toHaveLength(1)
    expect(closeHandle.element.parentElement).toBe(page.element)
    expect(wrapper.find('fluid-mesh-background-stub').exists()).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(closeHandle.findAll('line')).toHaveLength(1)

    await closeHandle.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
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

  it('共享元素开合期间写入明确方向并在动画结束后清理标记', async () => {
    /** 由测试手动结束的每一次 View Transition。 */
    const transitionResolvers: Array<() => void> = []
    /** 模拟浏览器执行状态更新并保持动画进行中的 View Transition 入口。 */
    const startViewTransition = vi.fn((
      updateCallback: () => Promise<void> | void
    ) => {
      void updateCallback()

      /** 当前过渡由测试控制完成时机的结束任务。 */
      const finished = new Promise<void>((resolve) => {
        transitionResolvers.push(resolve)
      })

      return { finished }
    })
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition
    })

    /** 应用级沉浸播放展示控制器。 */
    const immersivePlayer = useImmersivePlayerPresentation()
    /** 保持原生动画未结束的打开任务。 */
    const opening = immersivePlayer.open()

    await vi.waitFor(() => expect(immersivePlayer.isOpen.value).toBe(true))
    expect(document.documentElement.getAttribute(
      'data-ncx-immersive-transition'
    )).toBe('opening')
    transitionResolvers[0]?.()
    await opening
    expect(document.documentElement.hasAttribute(
      'data-ncx-immersive-transition'
    )).toBe(false)

    /** 保持原生动画未结束的关闭任务。 */
    const closing = immersivePlayer.close()

    await vi.waitFor(() => expect(immersivePlayer.isOpen.value).toBe(false))
    expect(document.documentElement.getAttribute(
      'data-ncx-immersive-transition'
    )).toBe('closing')
    transitionResolvers[1]?.()
    await closing
    expect(document.documentElement.hasAttribute(
      'data-ncx-immersive-transition'
    )).toBe(false)
    expect(startViewTransition).toHaveBeenCalledTimes(2)
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
            {
              lineStartMs: 0,
              lineDurationMs: 900,
              text: '第一行',
              words: []
            },
            {
              lineStartMs: 1_000,
              lineDurationMs: 900,
              text: '第二行',
              words: [
                { text: '第', startMs: 1_000, durationMs: 500 },
                { text: '二行', startMs: 1_500, durationMs: 400 }
              ],
              translation: 'Second line'
            },
            {
              lineStartMs: 12_000,
              lineDurationMs: 2_000,
              text: '女：第三行',
              words: [],
              vocalRole: 'background'
            }
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
    expect(wrapper.findAll('.lyrics-line')[0]?.attributes('data-state')).toBe('past')
    expect(wrapper.findAll('.lyrics-line')[2]?.attributes('data-state')).toBe('future')
    expect(wrapper.findAll('.lyric-word')).toHaveLength(2)
    expect(wrapper.find('.lyrics-instrumental').exists()).toBe(true)
    expect(wrapper.findAll('.lyrics-line')[2]?.classes()).toContain('lyrics-line--background')

    await wrapper.findAll('.lyrics-line button')[2]?.trigger('click')
    expect(wrapper.emitted('seek')).toEqual([[12_000]])
    wrapper.unmount()
  })

  it('uses precise word mask progress and resumes auto-follow after four idle seconds', async () => {
    vi.useFakeTimers()
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-word-progress',
          lines: [{
            lineStartMs: 1_000,
            lineDurationMs: 2_000,
            text: '逐字',
            words: [
              { text: '逐', startMs: 1_000, durationMs: 1_000 },
              { text: '字', startMs: 2_000, durationMs: 1_000 }
            ]
          }],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    /** 暂停状态下使用固定位置验证逐字遮罩的歌词面板。 */
    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-word-progress',
        positionMs: 1_500,
        playing: false,
        immersive: true
      }
    })

    await vi.waitFor(() => expect(wrapper.findAll('.lyric-word')).toHaveLength(2))
    await wrapper.vm.$nextTick()

    /** 播放到一半的第一个字。 */
    const firstWord = wrapper.findAll<HTMLElement>('.lyric-word')[0]
    /** 尚未开始播放的第二个字。 */
    const secondWord = wrapper.findAll<HTMLElement>('.lyric-word')[1]
    expect(firstWord?.element.style.getPropertyValue('--progress')).toBe('0.5000')
    expect(secondWord?.element.style.getPropertyValue('--progress')).toBe('0.0000')
    expect(firstWord?.element.style.getPropertyValue('--word-glow')).toBe('1.0000')
    expect(Number(firstWord?.element.style.getPropertyValue('--word-scale'))).toBeGreaterThan(1)
    expect(secondWord?.element.style.getPropertyValue('--word-scale')).toBe('1.0000')

    await wrapper.find('.lyrics-panel').trigger('wheel')
    expect(wrapper.classes()).toContain('lyrics-panel--manual')

    await vi.advanceTimersByTimeAsync(4_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('lyrics-panel--manual')

    wrapper.unmount()
    vi.useRealTimers()
  })
})
