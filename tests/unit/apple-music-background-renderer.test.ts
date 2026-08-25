import type { Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'

import {
  APPLE_MUSIC_WEB_BACKGROUND_CONFIG,
  NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS,
  createAppleMusicArtworkLayerFrames,
  interpolateAppleMusicAudioEnergy,
  interpolateAppleMusicArtworkWeights,
  interpolateAppleMusicMotionScale,
  releaseAppleMusicArtworkTexture
} from '../../src/renderer/features/music/fluid-mesh-renderer'

// ========= 测试 =========

describe('Apple Music 网页端同形背景参数', () => {
  it('严格使用 125%、80%、50%、25% 四层封面和 15 fps 上限', () => {
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.layerSizeRatios)
      .toEqual([1.25, 0.8, 0.5, 0.25])
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.layerPhaseSpeeds)
      .toEqual([0.09, -0.24, -0.18, 0.12])
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.maximumFps).toBe(15)
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.artworkTransitionMs).toBe(1_667)
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.saturation).toBe(1.45)
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.brightness).toBe(0.88)
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.contrast).toBe(1.35)
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.warpStrength).toBe(1.2)
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.colorBoost).toBe(1.4)
    expect(APPLE_MUSIC_WEB_BACKGROUND_CONFIG.kawaseFilters).toEqual([
      { strength: 8, quality: 1 },
      { strength: 16, quality: 2 }
    ])
    expect(NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.motionTransitionMs).toBe(1_200)
    expect(NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.lowFrequencyScalePulse).toBe(0.1)
  })

  it('50～120 Hz 低频能量只叠加克制的缩放和角度脉冲', () => {
    /** 相同动画相位下无鼓点与满幅鼓点的图层状态。 */
    const quiet = createAppleMusicArtworkLayerFrames(1_000, 600, 10, 0)
    const beat = createAppleMusicArtworkLayerFrames(1_000, 600, 10, 1)

    expect(beat[0]?.size).toBeCloseTo((quiet[0]?.size ?? 0) * 1.1)
    expect((beat[0]?.rotation ?? 0) - (quiet[0]?.rotation ?? 0)).toBeCloseTo(0.2)
    expect(beat[2]?.centerX).not.toBeCloseTo(quiet[2]?.centerX ?? 0)
  })

  it('两张大封面原地反向旋转，两张小封面沿圆形轨道移动', () => {
    /** 横向歌词视口在动画起点的四层封面状态。 */
    const initial = createAppleMusicArtworkLayerFrames(1_000, 600, 0)

    expect(initial.map((layer) => layer.size)).toEqual([1_250, 800, 500, 250])
    expect(initial[0]).toMatchObject({ centerX: 500, centerY: 300, rotation: 0 })
    expect(initial[1]).toMatchObject({ centerX: 400, centerY: 240 })
    expect(initial[1]?.rotation).toBeCloseTo(0)
    expect(initial[2]).toMatchObject({ centerX: 750, centerY: 300 })
    expect(initial[2]?.rotation).toBeCloseTo(0)
    expect(initial[3]).toMatchObject({ centerX: 800, centerY: 350 })
    expect(initial[3]?.rotation).toBeCloseTo(0)

    /** 运动十秒后的四层封面状态。 */
    const moved = createAppleMusicArtworkLayerFrames(1_000, 600, 10)
    expect(moved[0]?.rotation).toBeCloseTo(0.9)
    expect(moved[1]?.rotation).toBeCloseTo(-2.4)
    expect(moved[2]?.rotation).toBeCloseTo(1.8)
    expect(moved[3]?.rotation).toBeCloseTo(-1.2)
    expect(moved[2]?.centerX).not.toBeCloseTo(initial[2]?.centerX ?? 0)
    expect(moved[2]?.centerY).not.toBeCloseTo(initial[2]?.centerY ?? 0)
    expect(moved[3]?.centerX).not.toBeCloseTo(initial[3]?.centerX ?? 0)
    expect(moved[3]?.centerY).not.toBeCloseTo(initial[3]?.centerY ?? 0)
  })

  it('切歌从当前三纹理权重线性过渡且不会越过端点', () => {
    /** 连续快速切歌时屏幕当前已有的混合权重。 */
    const current = [0.6, 0.4, 0] as const
    /** 新封面进入第三纹理槽后的最终权重。 */
    const target = [0, 0, 1] as const

    expect(interpolateAppleMusicArtworkWeights(current, target, -1)).toEqual(current)
    /** 四分之一时刻必须保持线性，而不是平滑起停曲线。 */
    const quarter = interpolateAppleMusicArtworkWeights(current, target, 0.25)
    expect(quarter[0]).toBeCloseTo(0.45)
    expect(quarter[1]).toBeCloseTo(0.3)
    expect(quarter[2]).toBeCloseTo(0.25)
    expect(interpolateAppleMusicArtworkWeights(current, target, 0.5)).toEqual([0.3, 0.2, 0.5])
    expect(interpolateAppleMusicArtworkWeights(current, target, 2)).toEqual(target)
  })

  it('暂停与恢复使用平滑起停速度且保持连续动画相位', () => {
    expect(interpolateAppleMusicMotionScale(1, 0, 0)).toBe(1)
    expect(interpolateAppleMusicMotionScale(1, 0, 0.5)).toBe(0.5)
    expect(interpolateAppleMusicMotionScale(1, 0, 1)).toBe(0)
    expect(interpolateAppleMusicMotionScale(0, 1, 0.5)).toBe(0.5)
  })

  it('低频律动快速起音、慢速释放并限制在有效范围', () => {
    const attack = interpolateAppleMusicAudioEnergy(0, 1, 65)
    const release = interpolateAppleMusicAudioEnergy(1, 0, 65)

    expect(attack).toBeGreaterThan(1 - release)
    expect(interpolateAppleMusicAudioEnergy(0, 2, 10_000)).toBeCloseTo(1)
    expect(interpolateAppleMusicAudioEnergy(1, -1, 10_000)).toBeCloseTo(0)
  })

  it('释放过渡旧封面时只卸载 GPU 数据，不销毁底层图片 source', () => {
    /** 代表 Pixi TextureSource 的最小可观察替身。 */
    const source = {
      unload: vi.fn(),
      destroy: vi.fn()
    }
    /** 代表 Pixi Texture 的最小可观察替身。 */
    const texture = {
      source,
      destroy: vi.fn()
    }

    releaseAppleMusicArtworkTexture(texture as unknown as Texture)

    expect(source.unload).toHaveBeenCalledTimes(1)
    expect(source.destroy).not.toHaveBeenCalled()
    expect(texture.destroy).toHaveBeenCalledWith(false)
  })
})
