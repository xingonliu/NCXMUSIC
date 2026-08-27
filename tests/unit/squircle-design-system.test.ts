import { globSync, readFileSync } from 'node:fs'

import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

import electronCornerSmoothingPostcss, {
  ELECTRON_CORNER_SMOOTHING_PROPERTY,
  ELECTRON_CORNER_SMOOTHING_VALUE
} from '../../scripts/electron-corner-smoothing-postcss'

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
const designSystemLabSource = readFileSync('src/renderer/features/design-system/DesignSystemLabPage.vue', 'utf8')
const coverSource = readFileSync('src/renderer/features/music/components/Cover.vue', 'utf8')
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

  it('只为 Renderer 的非零圆角规则注入 Squircle 平滑', async () => {
    const result = await postcss([electronCornerSmoothingPostcss()]).process(`
      .plain { color: red; }
      .square { border-radius: 0; }
      .rounded { border-radius: var(--ncx-squircle-radius-lg); }
      .partial { border-top-left-radius: var(--ncx-squircle-radius-sm); }
      .explicit {
        border-radius: var(--ncx-squircle-radius-md);
        -electron-corner-smoothing: 35%;
      }
    `, { from: undefined })

    expect(globalStyleSource).not.toContain(ELECTRON_CORNER_SMOOTHING_PROPERTY)
    expect(result.css).not.toMatch(/\.plain\s*{[^}]*-electron-corner-smoothing:/)
    expect(result.css).not.toMatch(/\.square\s*{[^}]*-electron-corner-smoothing:/)
    expect(result.css).toMatch(new RegExp(`\\.rounded\\s*\\{[^}]*${ELECTRON_CORNER_SMOOTHING_PROPERTY}: ${ELECTRON_CORNER_SMOOTHING_VALUE.replace(/[()]/g, '\\$&')}`))
    expect(result.css).toMatch(new RegExp(`\\.partial\\s*\\{[^}]*${ELECTRON_CORNER_SMOOTHING_PROPERTY}: ${ELECTRON_CORNER_SMOOTHING_VALUE.replace(/[()]/g, '\\$&')}`))
    expect(result.css.match(/\.explicit\s*{[^}]*-electron-corner-smoothing:/g)).toHaveLength(1)
    expect(result.css).toMatch(/-electron-corner-smoothing: 35%/)
  })

  it('只为隔离语音窗口和 Renderer 内联圆角显式启用平滑', () => {
    expect(voiceOverlaySource).not.toMatch(/\*,\s*\*::before,\s*\*::after\s*{[^}]*-electron-corner-smoothing:/)
    expect(voiceOverlaySource).toContain('--voice-overlay-squircle-smoothing: 60%;')
    expect(voiceOverlaySource.match(/-electron-corner-smoothing: var\(--voice-overlay-squircle-smoothing\);/g)).toHaveLength(4)
    expect(designSystemLabSource).toContain('-electron-corner-smoothing: var(--ncx-squircle-smoothing)')
    expect(coverSource).toContain("styles['-electron-corner-smoothing'] = 'var(--ncx-squircle-smoothing)'")

    const unsmoothedStaticInlineStyles = rendererStyleSources.flatMap(({ path, source }) => (
      (source.match(/style="[^"]*border-radius[^"]*"/g) ?? [])
        .filter((style) => !style.includes(ELECTRON_CORNER_SMOOTHING_PROPERTY))
        .map((style) => `${path}: ${style}`)
    ))
    expect(unsmoothedStaticInlineStyles).toEqual([])
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
