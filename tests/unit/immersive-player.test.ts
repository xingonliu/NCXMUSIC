// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LyricsPanel from '../../src/renderer/features/music/components/LyricsPanel.vue'
import lyricsPanelSource from '../../src/renderer/features/music/components/LyricsPanel.vue?raw'
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
    expect(wrapper.findAll('.lyric-line-primary')[2]?.text()).toBe('第三行')
    expect(wrapper.findAll('.lyrics-line button')[2]?.attributes('aria-label')).toBe('第三行')
    expect(wrapper.text()).not.toContain('女：')

    await wrapper.findAll('.lyrics-line button')[2]?.trigger('click')
    expect(wrapper.emitted('seek')).toEqual([[12_000]])
    wrapper.unmount()
  })

  it('普通 LRC 只创建逐行状态，不伪造逐字节点', async () => {
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-line-timed',
          lines: [
            { lineStartMs: 0, lineDurationMs: 800, text: '第一行', words: [] },
            { lineStartMs: 1_000, lineDurationMs: 800, text: '第二行', words: [] }
          ],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-line-timed',
        positionMs: 1_050,
        playing: false,
        immersive: true
      }
    })

    await vi.waitFor(() => expect(wrapper.findAll('.lyrics-line')).toHaveLength(2))
    expect(wrapper.findAll('.lyric-word')).toHaveLength(0)
    expect(wrapper.findAll('.lyrics-line')[0]?.classes()).toContain('lyrics-line--past')
    expect(wrapper.findAll('.lyrics-line')[1]?.classes()).toContain('lyrics-line--active')
    expect(wrapper.findAll('.lyrics-line')[1]?.classes()).toContain('lyrics-line--line-timed')
    expect(wrapper.findAll('.lyric-line-text')).toHaveLength(2)

    wrapper.unmount()
  })

  it('严格按原始音节时长填充并将基础悬浮保持到下一行接管', async () => {
    vi.useFakeTimers()
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-word-progress',
          lines: [
            {
              lineStartMs: 1_000,
              lineDurationMs: 200,
              text: '逐字',
              words: [
                { text: '逐', startMs: 1_000, durationMs: 100 },
                { text: '字', startMs: 1_100, durationMs: 100 }
              ]
            },
            {
              lineStartMs: 2_000,
              lineDurationMs: 500,
              text: '换行',
              words: []
            }
          ],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    /** 暂停状态下使用固定位置验证逐字遮罩的歌词面板。 */
    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-word-progress',
        positionMs: 1_050,
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
    expect(firstWord?.element.style.getPropertyValue('--word-fill')).toBe('50.000%')
    expect(secondWord?.element.style.getPropertyValue('--word-fill')).toBe('0.000%')
    expect(firstWord?.element.style.getPropertyValue('--progress')).toBe('')
    expect(firstWord?.element.style.getPropertyValue('--word-glow')).toBe('')
    expect(firstWord?.attributes('data-state')).toBe('active')
    expect(secondWord?.attributes('data-state')).toBe('future')
    expect(Number.parseFloat(firstWord?.element.style.getPropertyValue('--word-lift') ?? '0'))
      .toBeLessThan(0)
    const firstWordLiftDuringAttack = Number.parseFloat(
      firstWord?.element.style.getPropertyValue('--word-lift') ?? '0'
    )
    expect(firstWord?.attributes('data-word-text')).toBe('逐')
    expect(lyricsPanelSource).toContain('mask-image: linear-gradient(')
    expect(lyricsPanelSource).toContain('var(--lyric-accent-color)')
    expect(lyricsPanelSource).toContain('background-clip: text')
    expect(lyricsPanelSource).toContain('translate3d(0, var(--word-lift), 0)')
    expect(lyricsPanelSource).toContain('smoothstepProgress')
    expect(lyricsPanelSource).toContain('const peakLiftEm =')
    expect(lyricsPanelSource).not.toContain('scale(var(--word-scale))')
    expect(lyricsPanelSource).toContain(
      '.lyrics-line--word-timed:is(.lyrics-line--active, .lyrics-line--singing) .lyric-word'
    )
    expect(lyricsPanelSource).not.toContain('smoothPositionMs +=')
    expect(lyricsPanelSource).not.toContain('clip-path:')
    expect(lyricsPanelSource).not.toContain('drop-shadow(')
    expect(lyricsPanelSource).not.toContain('filter: blur(')

    await wrapper.setProps({ positionMs: 1_100 })
    await wrapper.vm.$nextTick()
    expect(firstWord?.element.style.getPropertyValue('--word-fill')).toBe('100.000%')
    expect(firstWord?.attributes('data-state')).toBe('past')
    expect(secondWord?.attributes('data-state')).toBe('active')
    /** 音节收音后基础悬浮仍然保持，不随起音强调一起落回。 */
    expect(Number.parseFloat(firstWord?.element.style.getPropertyValue('--word-lift') ?? '0'))
      .toBeLessThan(0)
    /** 强调层跨越多个动画帧沿单一方向抵达峰值，而不是在起音帧瞬移。 */
    expect(Number.parseFloat(firstWord?.element.style.getPropertyValue('--word-lift') ?? '0'))
      .toBeLessThan(firstWordLiftDuringAttack)

    await wrapper.setProps({ positionMs: 1_500 })
    await wrapper.vm.$nextTick()
    expect(Number.parseFloat(secondWord?.element.style.getPropertyValue('--word-lift') ?? '0'))
      .toBeLessThan(0)
    /** 回落只抵达稳定悬浮位，之后不再被另一条基础曲线反向拉扯。 */
    expect(firstWord?.element.style.getPropertyValue('--word-lift')).toBe('-0.0500em')

    /** 下一行接管焦点后，上一行的基础悬浮才统一复位。 */
    await wrapper.setProps({ positionMs: 2_000 })
    await wrapper.vm.$nextTick()
    expect(firstWord?.element.style.getPropertyValue('--word-lift')).toBe('0.0000em')
    expect(secondWord?.element.style.getPropertyValue('--word-lift')).toBe('0.0000em')

    await wrapper.find('.lyrics-panel').trigger('wheel')
    expect(wrapper.classes()).toContain('lyrics-panel--manual')

    await vi.advanceTimersByTimeAsync(4_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('lyrics-panel--manual')

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('隐藏逐字副唱标签并允许超长音节在面板宽度内换行', async () => {
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-long-duet-line',
          lines: [{
            lineStartMs: 0,
            lineDurationMs: 2_000,
            text: '（女：演唱者）这是一句不会越过歌词面板边界的超长歌词',
            words: [
              { text: '（女：演唱者）', startMs: 0, durationMs: 200 },
              {
                text: '这是一句不会越过歌词面板边界的超长歌词',
                startMs: 200,
                durationMs: 1_800
              }
            ],
            vocalRole: 'background'
          }],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    /** 启用沉浸模式的合唱歌词面板。 */
    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-long-duet-line',
        positionMs: 500,
        immersive: true
      }
    })

    await vi.waitFor(() => expect(wrapper.findAll('.lyrics-line')).toHaveLength(1))

    expect(wrapper.findAll('.lyric-word')).toHaveLength(1)
    expect(wrapper.find('.lyric-line-primary').text()).toBe(
      '这是一句不会越过歌词面板边界的超长歌词'
    )
    expect(wrapper.find('.lyrics-line button').attributes('aria-label')).toBe(
      '这是一句不会越过歌词面板边界的超长歌词'
    )
    expect(lyricsPanelSource).toContain('overflow-wrap: anywhere')
    expect(lyricsPanelSource).toContain('width: 96.5%')
    expect(lyricsPanelSource).toContain('white-space: inherit')

    wrapper.unmount()
  })

  it('播放期间在离散播放器采样之间保持单调等速的逐帧扫光', async () => {
    getLyrics.mockResolvedValue({
      ok: true,
      data: {
        kind: 'lyrics',
        entity: {
          kind: 'lyrics',
          trackId: 'track-steady-word-progress',
          lines: [{
            lineStartMs: 0,
            lineDurationMs: 1_000,
            text: '稳定',
            words: [{ text: '稳定', startMs: 0, durationMs: 1_000 }]
          }],
          sources: [{ api: 'test.lyrics', observedAt }],
          updatedAt: observedAt
        }
      }
    })

    /** 受测试控制的全部待执行动画帧。 */
    const pendingFrames = new Map<number, FrameRequestCallback>()
    /** 下一个动画帧的测试 ID。 */
    let nextFrameId = 0
    /** 当前模拟的高精度页面时钟。 */
    let frameTime = 0
    /** 测试期间接管的页面时钟。 */
    const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => frameTime)
    /** 测试期间接管的动画帧调度器。 */
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      /** 本次调度分配的稳定帧 ID。 */
      const frameId = ++nextFrameId
      pendingFrames.set(frameId, callback)
      return frameId
    })
    /** 测试期间接管的动画帧取消器。 */
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      pendingFrames.delete(frameId)
    })

    /** 在暂停状态完成歌词 DOM 初始化的测试面板。 */
    const wrapper = mount(LyricsPanel, {
      props: {
        trackId: 'track-steady-word-progress',
        positionMs: 0,
        playing: false,
        immersive: true
      }
    })

    try {
      await vi.waitFor(() => expect(wrapper.findAll('.lyric-word')).toHaveLength(1))
      await wrapper.setProps({ playing: true })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      /** 每一帧扫光进度相对上一帧的增量。 */
      const progressDeltas: number[] = []
      /** 上一帧已经渲染的扫光进度。 */
      let previousProgress = 0

      for (let frameIndex = 1; frameIndex <= 30; frameIndex += 1) {
        frameTime = frameIndex * (1_000 / 60)
        if (frameIndex === 15) {
          /** 模拟迟到 180ms 的原生 timeupdate；视觉时钟不得因此向后抖动。 */
          await wrapper.setProps({ positionMs: Math.round(frameTime - 180) })
        } else if (frameIndex === 30) {
          await wrapper.setProps({ positionMs: Math.round(frameTime) })
        }

        /** 当前刷新周期真正有效的动画帧回调。 */
        const scheduledFrames = [...pendingFrames.values()]
        pendingFrames.clear()
        scheduledFrames.forEach((callback) => callback(frameTime))

        /** 当前字本帧已经填充的百分比。 */
        const currentFill = Number.parseFloat(
          wrapper.find<HTMLElement>('.lyric-word').element.style.getPropertyValue('--word-fill')
        )
        /** 由填充比例还原的线性逐字进度。 */
        const currentProgress = currentFill / 100
        progressDeltas.push(currentProgress - previousProgress)
        previousProgress = currentProgress
      }

      expect(progressDeltas.every((delta) => delta > 0)).toBe(true)
      expect(Math.max(...progressDeltas) - Math.min(...progressDeltas)).toBeLessThan(0.0002)
      expect(previousProgress).toBeCloseTo(0.5, 3)

      /** 模拟主线程卡顿 400ms；下一帧应直接回到媒体锚点对应位置，而不是只补 50ms。 */
      frameTime = 900
      const delayedFrames = [...pendingFrames.values()]
      pendingFrames.clear()
      delayedFrames.forEach((callback) => callback(frameTime))
      const fillAfterDroppedFrames = Number.parseFloat(
        wrapper.find<HTMLElement>('.lyric-word').element.style.getPropertyValue('--word-fill')
      )
      expect(fillAfterDroppedFrames).toBeCloseTo(90, 3)
    } finally {
      wrapper.unmount()
      performanceNow.mockRestore()
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
    }
  })
})
