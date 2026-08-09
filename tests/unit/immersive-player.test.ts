// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LyricsPanel from '../../src/renderer/features/music/components/LyricsPanel.vue'
import { useImmersivePlayerPresentation } from '../../src/renderer/features/music/immersive-player-presentation'

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
    runtime: {
      getLyrics
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
  await useImmersivePlayerPresentation().close()
  document.body.innerHTML = ''
})

// ========= 测试 =========

describe('应用级沉浸播放展示', () => {
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
