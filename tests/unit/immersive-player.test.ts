// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LyricsPanel from '../../src/renderer/features/music/components/LyricsPanel.vue'
import ImmersiveLyricsPage from '../../src/renderer/features/music/ImmersiveLyricsPage.vue'
import immersiveLyricsPageSource from '../../src/renderer/features/music/ImmersiveLyricsPage.vue?raw'
import { useImmersivePlayerPresentation } from '../../src/renderer/features/music/immersive-player-presentation'
import { disposePlayer } from '../../src/renderer/features/music/use-player'
import { useAppPreferences } from '../../src/renderer/features/settings/app-preferences'

// ========= 变量 =========

/** 标准歌词夹具的固定观测时间。 */
const observedAt = '2026-08-09T12:00:00.000Z'

/** 测试用歌词读取函数。 */
const getLyrics = vi.fn()

/** happy-dom 原始滚动方法。 */
const originalScrollTo = HTMLElement.prototype.scrollTo

/** happy-dom 原始 Web Animations 入口。 */
const originalAnimate = HTMLElement.prototype.animate

/** 测试环境原始的 View Transition 入口。 */
const originalStartViewTransition = (
  document as unknown as {
    startViewTransition?: Document['startViewTransition']
  }
).startViewTransition

// ========= 函数 =========

/** 创建足以驱动歌词引擎单元测试的 Web Animation 替身。 */
function createAnimationMock(
  _keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
  options?: number | KeyframeAnimationOptions
): Animation {
  /** 标准化后的动画时序选项。 */
  const timing = typeof options === 'number' ? { duration: options } : (options ?? {})
  /** 测试替身当前的播放状态。 */
  let playState: AnimationPlayState = 'idle'

  return {
    id: timing.id ?? '',
    currentTime: 0,
    playbackRate: 1,
    get playState(): AnimationPlayState {
      return playState
    },
    effect: {
      getComputedTiming: () => ({
        duration: Number(timing.duration ?? 0),
        delay: Number(timing.delay ?? 0)
      })
    },
    play: () => {
      playState = 'running'
    },
    pause: () => {
      playState = 'paused'
    },
    cancel: () => {
      playState = 'idle'
    }
  } as unknown as Animation
}

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
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: vi.fn(createAnimationMock)
  })
  getLyrics.mockReset()
  await useImmersivePlayerPresentation().close()
})

afterEach(async () => {
  HTMLElement.prototype.scrollTo = originalScrollTo
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: originalAnimate
  })
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
  it('主内容、封面列与歌词面板随窗口可用宽高伸展', () => {
    expect(immersiveLyricsPageSource).toContain(
      'width: calc(100% - clamp(72px, 6.25vw, 120px))'
    )
    expect(immersiveLyricsPageSource).toContain(
      'grid-template-columns: clamp(280px, 28vw, 520px) minmax(0, 1fr)'
    )
    expect(immersiveLyricsPageSource).toContain('height: calc(100dvh - 104px)')
    expect(immersiveLyricsPageSource).not.toContain(
      'width: min(1140px, calc(100% - 72px))'
    )
    expect(immersiveLyricsPageSource).not.toContain(
      'height: min(630px, calc(100vh - 138px))'
    )
  })

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
    /** 打开沉浸页前的原始地址。 */
    const originalHash = window.location.hash
    /** 模拟 PlayerBar 封面入口的按钮。 */
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()

    /** 应用级沉浸播放展示控制器。 */
    const immersivePlayer = useImmersivePlayerPresentation()
    await immersivePlayer.open(undefined, trigger)

    expect(immersivePlayer.isOpen.value).toBe(true)
    expect(window.location.hash).toBe(originalHash)

    await immersivePlayer.close()

    expect(immersivePlayer.isOpen.value).toBe(false)
    expect(window.location.hash).toBe(originalHash)
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


  it('使用内置 AMLL 引擎渲染逐字、间奏、背景声和双声部并保留精确 seek', async () => {
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-amll-engine',
          lines: [
            {
              lineStartMs: 0,
              lineDurationMs: 900,
              text: '第一行',
              words: []
            },
            {
              lineStartMs: 6_000,
              lineDurationMs: 1_000,
              text: '第二行',
              words: [
                { text: '第', startMs: 6_000, durationMs: 500 },
                { text: '二行', startMs: 6_500, durationMs: 500 }
              ],
              translation: 'Second line'
            },
            {
              lineStartMs: 6_200,
              lineDurationMs: 600,
              text: '和声：回响',
              words: [{ text: '和声：回响', startMs: 6_200, durationMs: 600 }],
              vocalRole: 'background'
            },
            {
              lineStartMs: 9_000,
              lineDurationMs: 900,
              text: '男：左声部',
              words: []
            },
            {
              lineStartMs: 11_000,
              lineDurationMs: 900,
              text: '女：右声部',
              words: []
            }
          ],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    /** 由本地源码歌词引擎驱动的沉浸歌词面板。 */
    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-amll-engine',
        positionMs: 6_400,
        playing: false,
        immersive: true
      }
    })

    await vi.waitFor(() => expect(wrapper.findAll('[data-amll-line]')).toHaveLength(5))

    /** 当前正在播放的主歌词行。 */
    const activeLine = wrapper.find('[data-amll-active="true"]')
    expect(activeLine.text()).toContain('第二行')
    expect(wrapper.findAll('[data-amll-word-start="6000"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-amll-word-start="6500"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-amll-background="true"]').text()).toContain('回响')
    expect(wrapper.find('[data-amll-duet="true"]').text()).toContain('右声部')
    expect(wrapper.text()).not.toContain('和声：')
    expect(wrapper.text()).not.toContain('男：')
    expect(wrapper.text()).not.toContain('女：')

    await wrapper.setProps({ positionMs: 3_000 })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-amll-interlude]').attributes('data-amll-interlude-start'))
        .toBeDefined()
    })

    /** 保持原始 11 秒时间戳的右侧双声部歌词行。 */
    const duetLine = wrapper.find('[data-amll-duet="true"]')
    await duetLine.trigger('click')
    expect(wrapper.emitted('seek')).toEqual([[11_000]])

    wrapper.unmount()
  })

  it('把歌词展示偏好直接映射到 AMLL 引擎控制面、字号和字重变量', async () => {
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-amll-preferences',
          lines: [{
            lineStartMs: 0,
            lineDurationMs: 1_000,
            text: '设置预览',
            words: []
          }],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    /** 用于验证字号和字重设置的应用偏好接口。 */
    const appPreferences = useAppPreferences()
    appPreferences.setLyricFontSize('extraLarge')
    appPreferences.setLyricFontWeight('heavy')

    /** 用于验证设置同步的歌词面板。 */
    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-amll-preferences',
        positionMs: 0,
        immersive: true
      }
    })

    await vi.waitFor(() => expect(wrapper.find('[data-amll-line]').exists()).toBe(true))
    expect(wrapper.attributes('style')).toContain('--amll-lp-font-size: 46px')
    expect(wrapper.attributes('style')).toContain('--amll-lp-font-weight: 900')

    wrapper.unmount()
    appPreferences.setLyricFontSize('standard')
    appPreferences.setLyricFontWeight('regular')
  })
})
