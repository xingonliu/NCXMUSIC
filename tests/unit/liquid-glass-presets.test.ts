import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buttonDeform, InteractiveHighlight, lerp, tanh } from '../../src/renderer/design-system/materials/liquid-glass-physics'
import {
  CLEAR_SURFACE,
  COMPLETE_BUTTON_OPTICS,
  DIALOG_DIM,
  FROST_SURFACE,
  PANEL_OPTICS,
  PANEL_SURFACE,
  TINTED_ALPHA
} from '../../src/renderer/design-system/materials/liquid-glass-presets'

const rendererSource = readFileSync('src/renderer/design-system/materials/liquid-glass-renderer.js', 'utf8')
const demoRendererSource = readFileSync('D:/code/chat/docs/liquid-glass/renderer.js', 'utf8')

describe('液态玻璃预设与 demo 对齐', () => {
  it('完整按钮光学来自 drawButton 的 2/12/24', () => {
    expect(COMPLETE_BUTTON_OPTICS).toMatchObject({
      blur: 2,
      refractionHeight: 12,
      refractionAmount: 24,
      vibrancy: true,
      highlight: 'default'
    })
  })

  it('面板光学来自 Dialog 的 16/24/48 与 depth', () => {
    expect(PANEL_OPTICS).toMatchObject({
      blur: 16,
      refractionHeight: 24,
      refractionAmount: 48,
      depthEffect: true,
      brightness: 0.2,
      saturation: 1.5,
      highlight: 'plain'
    })
    expect(PANEL_SURFACE[3]).toBeCloseTo(0.6)
    expect(TINTED_ALPHA).toBe(0.75)
    expect(CLEAR_SURFACE[3]).toBe(0)
    expect(FROST_SURFACE[3]).toBeCloseTo(0.3)
    expect(DIALOG_DIM[3]).toBeCloseTo(0.23)
  })

  it('WebGL 着色器与用户 demo 的 FS_GLASS 保持同一套', () => {
    expect(rendererSource).toContain('float circleMap(float x)')
    expect(rendererSource).toContain('uRefractionHeight')
    expect(rendererSource).toContain('uChromaticAberration')
    expect(demoRendererSource).toContain('float circleMap(float x)')
    const demoShader = demoRendererSource.slice(
      demoRendererSource.indexOf('const FS_GLASS'),
      demoRendererSource.indexOf('function compile')
    )
    const portedShader = rendererSource.slice(
      rendererSource.indexOf('const FS_GLASS'),
      rendererSource.indexOf('function compile')
    )
    expect(portedShader).toBe(demoShader)
  })
})

describe('液态玻璃按压形变', () => {
  it('buttonDeform 在未按下时保持单位变换', () => {
    const highlight = new InteractiveHighlight()
    const deform = buttonDeform(240, 48, highlight)
    expect(deform.sx).toBeCloseTo(1)
    expect(deform.sy).toBeCloseTo(1)
    expect(deform.tx).toBeCloseTo(0)
    expect(deform.ty).toBeCloseTo(0)
    expect(lerp(1, 2, 0.5)).toBe(1.5)
    expect(tanh(0)).toBe(0)
  })
})
