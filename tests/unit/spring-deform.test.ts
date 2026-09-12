import { describe, expect, it } from 'vitest'

import { calculateButtonDeform, Spring } from '../../src/renderer/design-system/use-spring-deform'

describe('Spring Simulation Engine', () => {
  it('initializes with target matching initial value and starts settled', () => {
    const spring = new Spring(10, 0.85, 380)
    expect(spring.value).toBe(10)
    expect(spring.target).toBe(10)
    expect(spring.velocity).toBe(0)
    expect(spring.isSettled).toBe(true)
  })

  it('steps towards target when target changes', () => {
    const spring = new Spring(0, 0.85, 380)
    spring.setTarget(1)
    expect(spring.isSettled).toBe(false)

    // 步进 16ms
    const val1 = spring.step(0.016)
    expect(val1).toBeGreaterThan(0)
    expect(val1).toBeLessThan(1.5)

    // 迭代步进直到稳定
    let iterations = 0
    while (!spring.isSettled && iterations < 300) {
      spring.step(0.016)
      iterations += 1
    }

    expect(spring.isSettled).toBe(true)
    expect(spring.value).toBeCloseTo(1, 2)
  })

  it('supports critically damped and overdamped regimes', () => {
    const critical = new Spring(0, 1.0, 300)
    critical.setTarget(10)
    critical.step(0.05)
    expect(critical.value).toBeGreaterThan(0)

    const overdamped = new Spring(0, 1.5, 300)
    overdamped.setTarget(10)
    overdamped.step(0.05)
    expect(overdamped.value).toBeGreaterThan(0)
  })

  it('snaps immediately to target without stepping', () => {
    const spring = new Spring(0, 0.85, 380)
    spring.snapTo(5)
    expect(spring.value).toBe(5)
    expect(spring.target).toBe(5)
    expect(spring.velocity).toBe(0)
    expect(spring.isSettled).toBe(true)
  })
})

describe('calculateButtonDeform Math', () => {
  it('returns baseline geometry when progress is 0', () => {
    const res = calculateButtonDeform(120, 48, 20, 10, 0)
    expect(res.tx).toBe(0)
    expect(res.ty).toBe(0)
    expect(res.sx).toBe(1)
    expect(res.sy).toBe(1)
    expect(res.progress).toBe(0)
  })

  it('calculates bounded tanh displacement when pressed', () => {
    const res = calculateButtonDeform(120, 48, 40, 20, 1)
    // 触点在右下方，tx 与 ty 应为正值，且不超过 min(w, h)
    expect(res.tx).toBeGreaterThan(0)
    expect(res.ty).toBeGreaterThan(0)
    expect(res.tx).toBeLessThanOrEqual(48)
    expect(res.ty).toBeLessThanOrEqual(48)
    expect(res.progress).toBe(1)
  })

  it('handles negative offsets towards top-left correctly', () => {
    const res = calculateButtonDeform(120, 48, -30, -15, 1)
    expect(res.tx).toBeLessThan(0)
    expect(res.ty).toBeLessThan(0)
  })

  it('clamps progress between 0 and 1 safely', () => {
    const under = calculateButtonDeform(100, 50, 0, 0, -0.5)
    expect(under.progress).toBe(0)

    const over = calculateButtonDeform(100, 50, 0, 0, 1.5)
    expect(over.progress).toBe(1)
  })
})
