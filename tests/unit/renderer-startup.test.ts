import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import {
  RUNTIME_READY_WAIT_SLICE_MS,
  startRendererApplication,
  waitForRuntimeReadiness
} from '../../src/renderer/app/renderer-startup'

// ========= 测试 =========

describe('Renderer 启动开屏门禁', () => {
  it('Runtime hello 完成前不挂载业务应用', async () => {
    /** 由测试控制的 Runtime ready Promise 解析函数。 */
    let resolveReady: ((ready: boolean) => void) | undefined
    /** 模拟仍在握手中的 Runtime ready Promise。 */
    const runtimeReady = new Promise<boolean>((resolve) => {
      resolveReady = resolve
    })
    /** Runtime readiness 替身。 */
    const waitUntilRuntimeReady = vi.fn(() => runtimeReady)
    /** Vue 根应用挂载替身。 */
    const mountApplication = vi.fn()

    /** 尚未完成的 Renderer 启动任务。 */
    const startup = startRendererApplication({
      bypassRuntimeGate: false,
      waitUntilRuntimeReady,
      mountApplication
    })

    expect(mountApplication).not.toHaveBeenCalled()
    resolveReady?.(true)
    await startup

    expect(waitUntilRuntimeReady).toHaveBeenCalledWith(RUNTIME_READY_WAIT_SLICE_MS)
    expect(mountApplication).toHaveBeenCalledOnce()
  })

  it('单次等待超时后继续等待下一代 Utility ready', async () => {
    /** 先超时、随后 ready 的 Runtime readiness 替身。 */
    const waitUntilRuntimeReady = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    await waitForRuntimeReadiness(waitUntilRuntimeReady)

    expect(waitUntilRuntimeReady).toHaveBeenCalledTimes(2)
    expect(waitUntilRuntimeReady).toHaveBeenNthCalledWith(1, RUNTIME_READY_WAIT_SLICE_MS)
    expect(waitUntilRuntimeReady).toHaveBeenNthCalledWith(2, RUNTIME_READY_WAIT_SLICE_MS)
  })

  it('Smoke 探针保持原有直接挂载行为', async () => {
    /** 不应由 Smoke 调用的 Runtime readiness 替身。 */
    const waitUntilRuntimeReady = vi.fn()
    /** Smoke 根应用挂载替身。 */
    const mountApplication = vi.fn()

    await startRendererApplication({
      bypassRuntimeGate: true,
      waitUntilRuntimeReady,
      mountApplication
    })

    expect(waitUntilRuntimeReady).not.toHaveBeenCalled()
    expect(mountApplication).toHaveBeenCalledOnce()
  })

  it('静态入口在 Vue 加载前提供主题感知的居中 Logo 开屏', () => {
    /** Renderer 原始 HTML 入口。 */
    const rendererHtml = readFileSync('src/renderer/index.html', 'utf8')

    expect(rendererHtml).toContain('class="ncx-startup-splash"')
    expect(rendererHtml).toContain('class="ncx-startup-splash__logo"')
    expect(rendererHtml).toContain('src="/icon.png"')
    expect(rendererHtml).toContain("place-items: center")
    expect(rendererHtml).toContain("background: #fff")
    expect(rendererHtml).toContain("background: #1c1c1f")
    expect(rendererHtml).toContain("prefers-color-scheme: dark")
  })
})
