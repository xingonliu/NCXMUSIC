// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import FluidMeshBackground from '../../src/renderer/features/music/components/FluidMeshBackground.vue'
import { FluidMeshRenderer } from '../../src/renderer/features/music/fluid-mesh-renderer'
import { disposePlayer } from '../../src/renderer/features/music/use-player'

// ========= 类型 =========

/** 测试可观察的最小动态背景渲染器接口。 */
interface RendererMock {
  /** 释放当前 Pixi 实例。 */
  destroy: ReturnType<typeof vi.fn>
  /** 更新实时音频能量读取器。 */
  setAudioEnergyProvider: ReturnType<typeof vi.fn>
  /** 更新系统减少动态效果状态。 */
  setReducedMotion: ReturnType<typeof vi.fn>
  /** 更新播放驱动的运动状态。 */
  setMotionActive: ReturnType<typeof vi.fn>
  /** 上传当前歌曲封面。 */
  setArtwork: ReturnType<typeof vi.fn>
  /** 清空当前歌曲封面。 */
  clearArtwork: ReturnType<typeof vi.fn>
  /** 更新渲染尺寸。 */
  resize: ReturnType<typeof vi.fn>
  /** 启动渲染循环。 */
  start: ReturnType<typeof vi.fn>
  /** 停止渲染循环。 */
  stop: ReturnType<typeof vi.fn>
}

/** 图片替身单次请求应派发的完成结果。 */
type ImageLoadOutcome = 'load' | 'error'

// ========= 变量 =========

/** 测试环境原始图片构造器。 */
const originalImage = globalThis.Image

/** 测试环境原始媒体查询函数。 */
const originalMatchMedia = window.matchMedia

/** 每次 Pixi 创建调用依次返回的渲染器替身。 */
const rendererQueue: RendererMock[] = []

/** 指定图片地址后续各次请求依次使用的加载结果。 */
const imageLoadOutcomes = new Map<string, ImageLoadOutcome[]>()

/** 每个图片地址已经发起的请求次数。 */
const imageRequestCounts = new Map<string, number>()

// ========= 函数 =========

/** 创建具备组件所需完整控制面的 Pixi 渲染器替身。 */
function createRendererMock(): RendererMock {
  return {
    destroy: vi.fn(),
    setAudioEnergyProvider: vi.fn(),
    setReducedMotion: vi.fn(),
    setMotionActive: vi.fn(),
    setArtwork: vi.fn(),
    clearArtwork: vi.fn(),
    resize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }
}

/** 建立设置地址后在微任务中完成加载的图片替身。 */
class LoadedImageMock extends EventTarget {
  /** 图片解码策略。 */
  decoding: HTMLImageElement['decoding'] = 'auto'

  /** 图片跨域策略。 */
  crossOrigin: string | null = null

  /** 当前图片地址。 */
  private currentSource = ''

  /** 返回当前图片地址。 */
  get src(): string {
    return this.currentSource
  }

  /** 设置图片地址并异步派发加载完成事件。 */
  set src(source: string) {
    this.currentSource = source
    if (!source) return
    imageRequestCounts.set(source, (imageRequestCounts.get(source) ?? 0) + 1)
    /** 当前地址本次请求应产生的加载结果。 */
    const outcome = imageLoadOutcomes.get(source)?.shift() ?? 'load'
    queueMicrotask(() => this.dispatchEvent(new Event(outcome)))
  }
}

// ========= 生命周期 =========

beforeEach(() => {
  rendererQueue.length = 0
  imageLoadOutcomes.clear()
  imageRequestCounts.clear()
  globalThis.Image = LoadedImageMock as unknown as typeof Image
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true)
  }))
  vi.spyOn(FluidMeshRenderer, 'create').mockImplementation(async () => {
    /** 当前创建调用应接管的渲染器替身。 */
    const nextRenderer = rendererQueue.shift()
    if (!nextRenderer) throw new Error('Missing renderer mock.')
    return nextRenderer as unknown as FluidMeshRenderer
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.Image = originalImage
  window.matchMedia = originalMatchMedia
  disposePlayer()
  document.body.innerHTML = ''
})

// ========= 测试 =========

describe('沉浸歌词动态背景', () => {
  it('现有 Pixi 实例切换封面失败时用当前封面自动重建', async () => {
    /** 初次挂载使用、第二次上传封面时模拟失效的 Pixi 实例。 */
    const initialRenderer = createRendererMock()
    initialRenderer.setArtwork
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('WebGL texture upload failed.')
      })
    /** 原地恢复后接管 Canvas 的新 Pixi 实例。 */
    const recoveredRenderer = createRendererMock()
    rendererQueue.push(initialRenderer, recoveredRenderer)

    /** 使用首张封面挂载的动态背景组件。 */
    const wrapper = mount(FluidMeshBackground, {
      props: {
        artworkUrl: 'https://example.com/artwork-a.jpg',
        playing: true
      }
    })
    await vi.waitFor(() => expect(initialRenderer.setArtwork).toHaveBeenCalledTimes(1))

    await wrapper.setProps({ artworkUrl: 'https://example.com/artwork-b.jpg' })

    await vi.waitFor(() => expect(FluidMeshRenderer.create).toHaveBeenCalledTimes(2))
    expect(initialRenderer.destroy).toHaveBeenCalledTimes(1)
    expect(recoveredRenderer.setArtwork).toHaveBeenCalledTimes(1)
    expect(wrapper.classes()).toContain('fluid-mesh-background--ready')

    wrapper.unmount()
  })

  it('切歌封面首次加载失败时自动重试并继续动态背景', async () => {
    /** 跨两首歌曲持续复用的健康 Pixi 实例。 */
    const renderer = createRendererMock()
    rendererQueue.push(renderer)
    /** 第二张封面模拟一次瞬时网络失败后恢复。 */
    const nextArtworkUrl = 'https://example.com/artwork-retry.jpg'
    imageLoadOutcomes.set(nextArtworkUrl, ['error', 'load'])

    /** 使用首张封面挂载的动态背景组件。 */
    const wrapper = mount(FluidMeshBackground, {
      props: {
        artworkUrl: 'https://example.com/artwork-initial.jpg',
        playing: true
      }
    })
    await vi.waitFor(() => expect(renderer.setArtwork).toHaveBeenCalledTimes(1))

    await wrapper.setProps({ artworkUrl: nextArtworkUrl })

    await vi.waitFor(() => expect(renderer.setArtwork).toHaveBeenCalledTimes(2), {
      timeout: 1_000
    })
    expect(imageRequestCounts.get(nextArtworkUrl)).toBe(2)
    expect(renderer.clearArtwork).not.toHaveBeenCalled()
    expect(wrapper.classes()).toContain('fluid-mesh-background--ready')

    wrapper.unmount()
  })
})
