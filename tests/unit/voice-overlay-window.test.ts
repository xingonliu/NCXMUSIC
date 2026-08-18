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

  it('使用参考 HUD 的紧凑磨砂胶囊、彩虹光球和流体波形', () => {
    expect(mainSource).toContain('height: 42px')
    expect(mainSource).toContain('--voice-overlay-bg: rgba(22, 22, 26, 0.88)')
    expect(mainSource).toContain('background: conic-gradient(')
    expect(mainSource).toContain('class="voice-overlay-wave"')
    expect(mainSource).toContain('function drawVoiceOverlayWave()')
    expect(mainSource).toContain('function syncVoiceOverlayWaveAnimation()')
    expect(mainSource).toContain("voiceOverlayPhase === 'listening'")
    expect(mainSource).not.toContain('background:#1b1b20')
  })

  it('参考样式的类名和动画名全部改为 voice-overlay 语义', () => {
    expect(mainSource).toContain('class="voice-overlay-shell"')
    expect(mainSource).toContain('class="voice-overlay-capsule"')
    expect(mainSource).toContain('@keyframes voice-overlay-spin')
    expect(mainSource).not.toMatch(/class="siri-/i)
    expect(mainSource).not.toMatch(/@keyframes siri-/i)
  })
})
