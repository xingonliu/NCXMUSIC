import { describe, expect, it } from 'vitest'

import {
  artworkAccentCssColor,
  lightenArtworkAccent,
  relativeColorLuminance,
  selectArtworkAccentColor
} from '../../src/renderer/features/music/artwork-accent-color'

describe('封面歌词前沿色', () => {
  it('在黑色背景封面中保留能代表封面的彩色主色', () => {
    const selectedColor = selectArtworkAccentColor([
      ...Array.from({ length: 80 }, () => ({ red: 4, green: 4, blue: 4 })),
      ...Array.from({ length: 20 }, () => ({ red: 220, green: 30, blue: 48 }))
    ])

    expect(selectedColor).toBeDefined()
    expect(selectedColor!.red).toBeGreaterThan(200)
    expect(selectedColor!.green).toBeLessThan(50)
    expect(selectedColor!.blue).toBeLessThan(60)
  })

  it('不区分主题并统一把过暗主色提亮至可读范围', () => {
    const lightenedColor = lightenArtworkAccent({ red: 8, green: 30, blue: 82 })

    expect(relativeColorLuminance(lightenedColor)).toBeGreaterThanOrEqual(0.56)
    expect(lightenedColor.blue).toBeGreaterThan(lightenedColor.green)
    expect(lightenedColor.green).toBeGreaterThan(lightenedColor.red)
    expect(artworkAccentCssColor({ red: 8, green: 30, blue: 82 })).toMatch(
      /^rgb\(\d+ \d+ \d+\)$/
    )
  })
})
