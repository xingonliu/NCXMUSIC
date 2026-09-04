import { describe, expect, it } from 'vitest'

import {
  buildCinematicSpline,
  cameraSpacePoint,
  depthOfFieldForPoint,
  EMPTY_MOUNTED_WINDOW,
  focalPlaneZDistance,
  MOUNT_LINE_RADIUS,
  nextMountedLineWindow,
  orientSegment,
  restSplineAnchors,
  sampleRibbonPath,
  spatialPointForIndex,
  UNMOUNT_LINE_RADIUS,
  type Vec3
} from '../../src/renderer/features/music/cinematic-lyrics-space'

// ========= 函数 =========

/** 两点之间的欧氏距离。 */
function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** 路径采样点到指定锚点的最近距离。 */
function nearestDistance(samples: readonly Vec3[], anchor: Vec3): number {
  return samples.reduce((nearest, sample) => Math.min(nearest, distance3(sample, anchor)), Number.POSITIVE_INFINITY)
}

/** 读取 matrix3d 平移分量。 */
function matrixTranslation(transform: string): Vec3 {
  const values = transform.replace('matrix3d(', '').replace(')', '').split(',').map(Number)
  return {
    x: values[12] ?? Number.NaN,
    y: values[13] ?? Number.NaN,
    z: values[14] ?? Number.NaN
  }
}

// ========= 测试 =========

describe('影院歌词三维空间', () => {
  it('为歌词行提供带 Z 向漂移的稳定世界坐标', () => {
    const first = spatialPointForIndex(0)
    const second = spatialPointForIndex(1)
    const tenth = spatialPointForIndex(10)

    expect(first.y).toBe(0)
    expect(second.y).toBe(270)
    expect(tenth.z).toBeLessThan(first.z)
    expect(second.x).not.toBe(first.x)
  })

  it('镜头空间把焦平面上的当前行映射到原点', () => {
    const camera = spatialPointForIndex(4)
    const focused = cameraSpacePoint(camera, camera)

    expect(focused.x).toBeCloseTo(0, 8)
    expect(focused.y).toBeCloseTo(0, 8)
    expect(focused.z).toBeCloseTo(0, 8)
    expect(focalPlaneZDistance(camera, camera)).toBeCloseTo(0, 8)
  })

  it('按焦平面 Z 轴绝对距离连续计算高斯模糊与缩放衰减', () => {
    const camera = spatialPointForIndex(5)
    const focused = depthOfFieldForPoint(camera, camera, {
      reducedMotion: false,
      motion: 'full'
    })
    const near = depthOfFieldForPoint(
      { x: camera.x, y: camera.y, z: camera.z - 80 },
      camera,
      { reducedMotion: false, motion: 'full' }
    )
    const far = depthOfFieldForPoint(
      { x: camera.x, y: camera.y, z: camera.z - 240 },
      camera,
      { reducedMotion: false, motion: 'full' }
    )
    const softFar = depthOfFieldForPoint(
      { x: camera.x, y: camera.y, z: camera.z - 240 },
      camera,
      { reducedMotion: false, motion: 'soft' }
    )
    const reducedFar = depthOfFieldForPoint(
      { x: camera.x, y: camera.y, z: camera.z - 240 },
      camera,
      { reducedMotion: true, motion: 'full' }
    )

    expect(focused.blurPx).toBeCloseTo(0, 8)
    expect(focused.scale).toBeCloseTo(1, 8)
    expect(focused.opacity).toBeCloseTo(1, 8)
    expect(near.blurPx).toBeGreaterThan(focused.blurPx)
    expect(far.blurPx).toBeGreaterThan(near.blurPx)
    expect(far.scale).toBeLessThan(near.scale)
    expect(far.opacity).toBeLessThan(near.opacity)
    expect(softFar.blurPx).toBeLessThan(far.blurPx)
    expect(reducedFar.blurPx).toBe(0)
    expect(far.blurPx).toBeGreaterThan(20)
  })

  it('挂载窗口立即扩到镜头半径，并在卸载半径内保留离场歌词', () => {
    const first = nextMountedLineWindow(EMPTY_MOUNTED_WINDOW, 10, 40)
    expect(first).toEqual({
      start: 10 - MOUNT_LINE_RADIUS,
      end: 10 + MOUNT_LINE_RADIUS + 1
    })

    const expanded = nextMountedLineWindow(first, 12, 40)
    expect(expanded.start).toBe(first.start)
    expect(expanded.end).toBe(12 + MOUNT_LINE_RADIUS + 1)

    const lagged = nextMountedLineWindow(expanded, 16, 40)
    expect(lagged.start).toBe(16 - UNMOUNT_LINE_RADIUS)
    expect(lagged.end).toBe(16 + MOUNT_LINE_RADIUS + 1)
    expect(lagged.end - lagged.start).toBeGreaterThan(MOUNT_LINE_RADIUS * 2 + 1)
  })

  it('空间样条穿过当前与前后歌词锚点并在其间三维穿插', () => {
    const anchors = [3, 4, 5].map((index) => {
      const point = spatialPointForIndex(index)
      return { x: point.x, y: point.y, z: point.z }
    })
    const first = anchors[0]
    const current = anchors[1]
    const next = anchors[2]
    expect(first && current && next).toBeTruthy()
    if (!first || !current || !next) return

    const samples = sampleRibbonPath(anchors, 'primary')
    expect(samples.length).toBeGreaterThan(8)
    expect(nearestDistance(samples, first)).toBeLessThan(26)
    expect(nearestDistance(samples, current)).toBeLessThan(26)
    expect(nearestDistance(samples, next)).toBeLessThan(26)

    const midpoints = samples.filter((sample) => (
      sample.y > first.y + 40 && sample.y < next.y - 40
    ))
    expect(midpoints.some((sample) => distance3(sample, current) > 60)).toBe(true)
    expect(new Set(samples.map((sample) => sample.z.toFixed(1))).size).toBeGreaterThan(4)
  })

  it('样条段以世界坐标定向，并随焦平面距离写入散焦', () => {
    const from = { x: 0, y: 0, z: 0 }
    const to = { x: 30, y: 40, z: 120 }
    const oriented = orientSegment(from, to)
    const translation = matrixTranslation(oriented.transform)

    expect(oriented.length).toBeCloseTo(Math.hypot(30, 40, 120), 6)
    expect(oriented.transform.startsWith('matrix3d(')).toBe(true)
    expect(translation.x).toBeCloseTo(0, 4)
    expect(translation.y).toBeCloseTo(0, 4)
    expect(translation.z).toBeCloseTo(0, 4)

    const camera = spatialPointForIndex(4)
    const anchors = restSplineAnchors()
    const segments = buildCinematicSpline({
      anchors,
      ribbon: 'primary',
      camera,
      reducedMotion: false,
      motion: 'full'
    })
    const secondary = buildCinematicSpline({
      anchors,
      ribbon: 'secondary',
      camera,
      reducedMotion: false,
      motion: 'full'
    })

    expect(segments.length).toBeGreaterThan(10)
    expect(secondary.length).toBeGreaterThan(10)
    expect(segments.some((segment) => segment.blurPx > 0)).toBe(true)
    expect(segments.every((segment) => segment.transform.includes('matrix3d('))).toBe(true)
    expect(Math.max(...secondary.map((segment) => segment.opacity)))
      .toBeLessThan(Math.max(...segments.map((segment) => segment.opacity)))
  })
})
