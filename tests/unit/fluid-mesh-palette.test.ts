import { describe, expect, it } from 'vitest'

import {
  createFallbackFluidMeshPalette,
  extractFluidMeshPalette,
  interpolateFluidMeshPalette,
  rgbToOklch,
  type FluidMeshPalette
} from '../../src/renderer/features/music/fluid-mesh-palette'

// ========= 函数 =========

/**
 * 按给定颜色和像素数量创建连续 RGBA 夹具。
 *
 * @param colors 每组颜色及其重复像素数量
 */
function createPixels(colors: Array<{ rgb: readonly [number, number, number], count: number }>): Uint8ClampedArray {
  /** 按 RGBA 顺序展开的像素通道。 */
  const channels: number[] = []
  for (const color of colors) {
    for (let index = 0; index < color.count; index += 1) {
      channels.push(color.rgb[0], color.rgb[1], color.rgb[2], 255)
    }
  }
  return new Uint8ClampedArray(channels)
}

// ========= 测试 =========

describe('流体网格调色板', () => {
  it('从封面聚类四种代表色并把 OKLCH 明度限制在 15% 到 45%', () => {
    /** 模拟深红、蓝绿、高光黄和深蓝区域的封面像素。 */
    const pixels = createPixels([
      { rgb: [188, 34, 72], count: 48 },
      { rgb: [20, 130, 145], count: 32 },
      { rgb: [244, 198, 64], count: 20 },
      { rgb: [8, 18, 48], count: 28 }
    ])
    /** 从像素聚类和修正后的 Shader 调色板。 */
    const palette = extractFluidMeshPalette(pixels)
    /** 四个节点的 OKLCH 明度。 */
    const lightnesses = palette.map((color) => rgbToOklch(color).lightness)

    expect(palette).toHaveLength(4)
    expect(lightnesses.every((lightness) => lightness >= 0.139 && lightness <= 0.551)).toBe(true)
    expect(new Set(palette.map((color) => color.map((channel) => channel.toFixed(3)).join(','))).size)
      .toBeGreaterThanOrEqual(3)
  })

  it('在 1.5 秒切歌过渡所需的 RGB 向量上执行严格线性插值', () => {
    /** 起始调色板。 */
    const from: FluidMeshPalette = [
      [0, 0, 0],
      [0.2, 0.3, 0.4],
      [0.4, 0.5, 0.6],
      [0.6, 0.7, 0.8]
    ]
    /** 目标调色板。 */
    const to: FluidMeshPalette = [
      [1, 1, 1],
      [0.6, 0.7, 0.8],
      [0.8, 0.9, 1],
      [1, 0.9, 0.8]
    ]
    /** 过渡到一半的调色板。 */
    const halfway = interpolateFluidMeshPalette(from, to, 0.5)

    expect(halfway[0]).toEqual([0.5, 0.5, 0.5])
    expect(halfway[1]).toEqual([0.4, 0.5, 0.6000000000000001])
    expect(halfway[3]).toEqual([0.8, 0.8, 0.8])
    expect(interpolateFluidMeshPalette(from, to, -1)).toEqual(from)
    expect(interpolateFluidMeshPalette(from, to, 2)).toEqual(to)
  })

  it('跨域像素不可读时为同一封面生成稳定且可区分的回退调色板', () => {
    /** 第一张封面的稳定回退色。 */
    const first = createFallbackFluidMeshPalette('https://example.com/album-a.jpg')
    /** 同一张封面再次生成的回退色。 */
    const repeated = createFallbackFluidMeshPalette('https://example.com/album-a.jpg')
    /** 第二张封面的稳定回退色。 */
    const second = createFallbackFluidMeshPalette('https://example.com/album-b.jpg')

    expect(repeated).toEqual(first)
    expect(second).not.toEqual(first)
  })
})
