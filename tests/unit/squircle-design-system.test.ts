import { globSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// -- Constants

const SQUIRCLE_RADIUS_TOKENS = [
  ['xs', '6px'],
  ['sm', '10px'],
  ['md', '14px'],
  ['lg', '18px'],
  ['xl', '24px'],
  ['2xl', '30px'],
  ['full', '9999px']
] as const

const foundationSource = readFileSync('src/renderer/design-system/tokens/foundation.css', 'utf8')
const globalStyleSource = readFileSync('src/renderer/design-system/styles/global.css', 'utf8')
const voiceOverlaySource = readFileSync('src/main/index.ts', 'utf8')
const rendererStyleSources = globSync([
  'src/renderer/**/*.css',
  'src/renderer/**/*.vue'
]).map((path) => ({ path, source: readFileSync(path, 'utf8') }))

const unstandardizedRadiusPattern = /border-(?:(?:top|bottom)-(?:left|right)-)?radius\s*:[^;}\n]*(?:\d+(?:\.\d+)?(?:px|%|em|rem)|--ncx-(?:radius)-|calc\()/g
const unstandardizedInlineRadiusPattern = /borderRadius\s*[:=]\s*['"`]\d/g

// -- Tests

describe('Squircle 设计系统规范', () => {
  it('定义固定的 60% 平滑度与七级尺寸阶梯', () => {
    expect(foundationSource).toContain('--ncx-squircle-smoothing: 60%;')

    for (const [name, value] of SQUIRCLE_RADIUS_TOKENS) {
      expect(foundationSource).toContain(`--ncx-squircle-radius-${name}: ${value};`)
    }
  })

  it('为 Renderer 和隔离语音窗口全局启用 Squircle 平滑', () => {
    expect(globalStyleSource).toMatch(/\*,\s*\*::before,\s*\*::after\s*{[^}]*-electron-corner-smoothing:/)
    expect(globalStyleSource).toContain('-electron-corner-smoothing: var(--ncx-squircle-smoothing);')
    expect(voiceOverlaySource).toMatch(/\*,\s*\*::before,\s*\*::after\s*{[^}]*-electron-corner-smoothing:/)
    expect(voiceOverlaySource).toContain('--voice-overlay-squircle-smoothing: 60%;')
    expect(voiceOverlaySource).toContain('-electron-corner-smoothing: var(--voice-overlay-squircle-smoothing);')
  })

  it('Renderer 的圆角只使用标准 Squircle token', () => {
    const violations = rendererStyleSources.flatMap(({ path, source }) => {
      const cssDeclarations = source.match(unstandardizedRadiusPattern) ?? []
      const inlineDeclarations = source.match(unstandardizedInlineRadiusPattern) ?? []
      return [...cssDeclarations, ...inlineDeclarations].map((declaration) => `${path}: ${declaration}`)
    })

    expect(violations).toEqual([])
  })
})
