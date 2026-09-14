import { describe, expect, it } from 'vitest'
import { lensDisplacement } from '../../src/renderer/design-system/materials/glass-optics'
import { GLASS_PRESETS } from '../../src/renderer/design-system/materials/glass-presets'

describe('glass lens profile', () => {
  const geometry = { width: 180, height: 48, radius: 14 }
  it('preserves the reading area and displaces opposite edges symmetrically', () => {
    expect(lensDisplacement(90, 24, geometry, GLASS_PRESETS.clear)).toEqual([0, 0])
    const left = lensDisplacement(1, 24, geometry, GLASS_PRESETS.clear)
    const right = lensDisplacement(179, 24, geometry, GLASS_PRESETS.clear)
    expect(left[0]).toBeLessThan(-10)
    expect(right[0]).toBeCloseTo(-left[0])
    expect(right[1]).toBe(0)
  })
  it('has no optical displacement at any point in simplified material', () => {
    for (let x = 0; x < 180; x += 3) for (let y = 0; y < 48; y += 3) {
      expect(lensDisplacement(x, y, geometry, GLASS_PRESETS.blur)).toEqual([0, 0])
    }
  })
  it('keeps clear and tinted optics identical and dialog thickness stronger', () => {
    expect(lensDisplacement(90, 2, geometry, GLASS_PRESETS.clear)).toEqual(lensDisplacement(90, 2, geometry, GLASS_PRESETS.tinted))
    expect(Math.abs(lensDisplacement(90, 2, geometry, GLASS_PRESETS.dialog)[1])).toBeGreaterThan(Math.abs(lensDisplacement(90, 2, geometry, GLASS_PRESETS.clear)[1]))
  })
  it('stays finite and bounded in compact / large shapes', () => {
    for (const size of [1, 16, 32, 48, 440, 1800]) {
      const shape = { width: size, height: size, radius: 9999 }
      for (let i = 0; i <= 20; i++) {
        const result = lensDisplacement(size * i / 20, size / 2, shape, GLASS_PRESETS.dialog)
        expect(result.every(Number.isFinite)).toBe(true)
        expect(Math.hypot(...result)).toBeLessThanOrEqual(GLASS_PRESETS.dialog.refractionAmount)
      }
    }
  })
})
