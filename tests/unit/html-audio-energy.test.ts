import { describe, expect, it } from 'vitest'

import { calculateFrequencyBandEnergy } from '../../src/renderer/features/music/html-audio-adapter'

// ========= 测试 =========

describe('播放器低频能量分析', () => {
  it('按 sampleRate / fftSize 精确读取 50～120 Hz，而不是固定取前几个频点', () => {
    /** 48 kHz、2048 点 FFT 的频点宽度约为 23.44 Hz。 */
    const frequencyData = new Uint8Array(1_024)
    frequencyData[1] = 255
    frequencyData[3] = 255
    frequencyData[4] = 255
    frequencyData[5] = 255
    frequencyData[20] = 255

    expect(calculateFrequencyBandEnergy(frequencyData, 48_000, 2_048)).toBe(1)
  })

  it('忽略 50～120 Hz 以外的低频和人声频段', () => {
    const frequencyData = new Uint8Array(1_024)
    frequencyData[1] = 255
    frequencyData[6] = 255
    frequencyData[20] = 255

    expect(calculateFrequencyBandEnergy(frequencyData, 48_000, 2_048)).toBe(0)
  })
})
