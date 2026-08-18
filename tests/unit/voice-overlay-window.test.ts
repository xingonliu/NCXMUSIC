import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** Main 进程入口源码。 */
const mainSource = readFileSync('src/main/index.ts', 'utf8')

/** Renderer 语音输入层源码。 */
const voiceLayerSource = readFileSync('src/renderer/features/voice/VoiceInputLayer.vue', 'utf8')

// ========= 测试 =========

describe('voice overlay window contract', () => {
  it('应用启动时只预热隐藏外置窗口，并在主窗口创建前开始加载', () => {
    /** 外置窗口预热调用位置。 */
    const overlayWarmupIndex = mainSource.indexOf('if (!isSmokeTest) ensureVoiceOverlayWindow()')
    /** 主窗口创建调用位置。 */
    const mainWindowCreationIndex = mainSource.indexOf('await createMainWindow()')

    expect(overlayWarmupIndex).toBeGreaterThan(0)
    expect(overlayWarmupIndex).toBeLessThan(mainWindowCreationIndex)
    expect(mainSource).toContain('show: false')
    expect(mainSource).toContain('window.showInactive()')
  })

  it('主窗口前后台统一展示外置窗口且不再渲染应用内胶囊', () => {
    expect(mainSource).toContain("if (event.data.type === 'pressed') {")
    expect(mainSource).not.toContain("event.data.type === 'pressed' && !window.isFocused()")
    expect(mainSource).not.toContain('owner?.isFocused()')
    expect(mainSource).not.toContain("window.on('focus', () => voiceOverlayWindow?.hide())")
    expect(voiceLayerSource).not.toContain('<Teleport to="body">')
    expect(voiceLayerSource).not.toContain('class="voice-capsule"')
  })

  it('胶囊缩小为 420 × 88 且实体背景完全不透明', () => {
    expect(mainSource).toContain('const VOICE_OVERLAY_WIDTH = 420')
    expect(mainSource).toContain('const VOICE_OVERLAY_HEIGHT = 88')
    expect(mainSource).toContain('background:#1b1b20')
    expect(mainSource).not.toContain('background:rgba(27,27,32,.88)')
    expect(mainSource).not.toContain('backdrop-filter:blur(24px)')
  })
})
