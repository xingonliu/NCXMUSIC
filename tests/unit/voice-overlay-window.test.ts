import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { VoiceOverlayStateSchema } from '../../src/shared/schemas/voice-settings'

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
    expect(mainSource).toContain('icon: appIconEntryPath()')
    expect(mainSource.match(/applyWindowsWindowIdentity\(window\)/gu)).toHaveLength(2)
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

  it('浅色、深色与系统主题实时跟随 App 偏好', () => {
    expect(mainSource).toContain('.voice-overlay-shell[data-theme="light"]')
    expect(mainSource).toContain('@media (prefers-color-scheme: light)')
    expect(mainSource).toContain('voiceOverlayShell.dataset.theme = state.theme')
    expect(voiceLayerSource).toContain('theme: appPreferences.preferences.value.theme')
    expect(voiceLayerSource).toContain('stopOverlayThemeWatch = watch(')
    expect(voiceLayerSource).toContain('() => publishOverlayState(true)')
  })

  it('阴影在透明承载窗口内自然衰减且不会被底边裁切', () => {
    expect(mainSource).toContain('padding-bottom: 20px')
    expect(mainSource).toContain('0 8px 18px -6px rgba(0, 0, 0, 0.46)')
    expect(mainSource).not.toContain('0 14px 36px -4px rgba(0, 0, 0, 0.55)')
  })

  it('IPC 展示状态只接受 App 支持的三种主题值', () => {
    /** 合法浅色主题状态。 */
    const lightState = VoiceOverlayStateSchema.parse({
      phase: 'idle',
      text: '',
      waveform: Array.from({ length: 12 }, () => 0.08),
      theme: 'light'
    })

    expect(lightState.theme).toBe('light')
    expect(VoiceOverlayStateSchema.safeParse({ ...lightState, theme: 'auto' }).success).toBe(false)
  })
})
