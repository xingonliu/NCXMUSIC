// -- Type Definitions

/** 无限歌词画布中的稳定三维坐标与镜头转角。 */
export interface SpatialPoint {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly pan: number
  readonly tilt: number
  readonly roll: number
}

/** 三维位置。 */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** 影院歌词动效强度，与界面偏好对齐。 */
export type CinematicMotionIntensity = 'full' | 'soft' | 'minimal'

/** 穿插歌词行的空间样条丝带。 */
export type CinematicSplineRibbon = 'primary' | 'secondary'

/** 当前仍挂载在三维画布中的歌词行半开区间。 */
export interface MountedLineWindow {
  readonly start: number
  readonly end: number
}

/** 按焦平面 Z 距算出的光学散焦。 */
export interface DepthOfFieldStyle {
  readonly blurPx: number
  readonly scale: number
  readonly opacity: number
  readonly zDistance: number
}

/** 世界空间中的一段三维样条。 */
export interface CinematicSplineSegment {
  readonly id: string
  readonly length: number
  readonly transform: string
  readonly opacity: number
  readonly blurPx: number
}

/** 生成空间样条所需的镜头与动效参数。 */
export interface CinematicSplineBuildOptions {
  readonly anchors: readonly Vec3[]
  readonly ribbon: CinematicSplineRibbon
  readonly camera: SpatialPoint
  readonly reducedMotion: boolean
  readonly motion: CinematicMotionIntensity
}

/** 光学散焦计算参数。 */
export interface DepthOfFieldOptions {
  readonly reducedMotion: boolean
  readonly motion: CinematicMotionIntensity
}

// -- Constants

/** 镜头前进时开始挂载的前后歌词行数。 */
export const MOUNT_LINE_RADIUS = 6

/** 离场歌词完全卸载前额外保留的行数，供景深消散。 */
export const UNMOUNT_LINE_RADIUS = 9

/** 空挂载窗口。 */
export const EMPTY_MOUNTED_WINDOW: MountedLineWindow = { start: 0, end: 0 }

/** 无歌词时用于休息姿态样条的索引。 */
export const REST_SPLINE_INDEXES = [-2, -1, 0, 1, 2, 3, 4] as const

/** 相邻歌词沿观看轴递进的 Z 向漂移。 */
const LINE_Z_DRIFT = 72

/** 样条在两句歌词之间的采样点数。 */
const SPLINE_SAMPLES_PER_SPAN = 6

/** 样条穿过歌词时的侧向门宽，避免完全埋进字形。 */
const SPLINE_GATE_X = 20

/** 样条穿过歌词时的深度门宽。 */
const SPLINE_GATE_Z = 10

/** 焦平面 Z 距达到该值时高斯模糊与缩放进入满幅。 */
const FOCUS_PLANE_RANGE_PX = 240

/** 完整动效下的最大高斯半径。 */
const MAX_BLUR_FULL_PX = 28

/** 轻柔动效下的最大高斯半径。 */
const MAX_BLUR_SOFT_PX = 14

/** 景深缩放下限。 */
const MIN_SCALE = 0.78

/** 视线深处的残留不透明度。 */
const MIN_OPACITY = 0.018

/** 角度转弧度。 */
const DEG_TO_RAD = Math.PI / 180

// -- Functions

/** 返回指定歌词索引在无限画布上的稳定坐标。 */
export function spatialPointForIndex(index: number): SpatialPoint {
  return {
    x: Math.round(Math.sin(index * 1.618) * 210),
    y: index * 270,
    z: Math.round(-index * LINE_Z_DRIFT + Math.cos(index * 1.127) * 130),
    pan: Math.sin(index * 0.73) * 7,
    tilt: Math.cos(index * 0.57) * 4,
    roll: Math.sin(index * 0.39) * 2.4
  }
}

/** 返回休息姿态下的样条锚点。 */
export function restSplineAnchors(): Vec3[] {
  return REST_SPLINE_INDEXES.map((index) => {
    const point = spatialPointForIndex(index)
    return { x: point.x, y: point.y, z: point.z }
  })
}

/**
 * 按相机 CSS 变换链把世界点转换到镜头空间。
 * 焦平面位于当前主镜头歌词，对应镜头空间 Z = 0。
 */
export function cameraSpacePoint(point: Vec3, camera: SpatialPoint): Vec3 {
  let x = point.x - camera.x
  let y = point.y - camera.y
  let z = point.z - camera.z

  const roll = -camera.roll * DEG_TO_RAD
  const cosZ = Math.cos(roll)
  const sinZ = Math.sin(roll)
  const rotatedZx = x * cosZ - y * sinZ
  const rotatedZy = x * sinZ + y * cosZ
  x = rotatedZx
  y = rotatedZy

  const pan = -camera.pan * DEG_TO_RAD
  const cosY = Math.cos(pan)
  const sinY = Math.sin(pan)
  const rotatedYx = x * cosY + z * sinY
  const rotatedYz = -x * sinY + z * cosY
  x = rotatedYx
  z = rotatedYz

  const tilt = -camera.tilt * DEG_TO_RAD
  const cosX = Math.cos(tilt)
  const sinX = Math.sin(tilt)
  const rotatedXy = y * cosX - z * sinX
  const rotatedXz = y * sinX + z * cosX
  y = rotatedXy
  z = rotatedXz

  return { x, y, z }
}

/** 返回世界点相对虚拟相机焦平面的 Z 轴绝对距离。 */
export function focalPlaneZDistance(point: Vec3, camera: SpatialPoint): number {
  return Math.abs(cameraSpacePoint(point, camera).z)
}

/** 根据焦平面 Z 距计算渐进式高斯模糊、缩放衰减与消散。 */
export function depthOfFieldForPoint(
  point: Vec3,
  camera: SpatialPoint,
  options: DepthOfFieldOptions
): DepthOfFieldStyle {
  const zDistance = focalPlaneZDistance(point, camera)
  const t = Math.min(1, zDistance / FOCUS_PLANE_RANGE_PX)
  const eased = t * t * (3 - 2 * t)
  const reduced = options.reducedMotion || options.motion === 'minimal'
  const maxBlur = reduced
    ? 0
    : options.motion === 'soft'
      ? MAX_BLUR_SOFT_PX
      : MAX_BLUR_FULL_PX
  const scaleFloor = reduced ? 0.94 : MIN_SCALE
  const opacityFloor = reduced ? 0.08 : MIN_OPACITY
  return {
    blurPx: maxBlur * eased,
    scale: 1 - (1 - scaleFloor) * eased,
    opacity: 1 - (1 - opacityFloor) * (t ** 0.82),
    zDistance
  }
}

/** 在歌词行前进时立即扩窗，仅在超出卸载半径后收窗。 */
export function nextMountedLineWindow(
  current: MountedLineWindow,
  activeIndex: number,
  total: number
): MountedLineWindow {
  if (activeIndex < 0 || total <= 0) return EMPTY_MOUNTED_WINDOW
  const mountStart = Math.max(0, activeIndex - MOUNT_LINE_RADIUS)
  const mountEnd = Math.min(total, activeIndex + MOUNT_LINE_RADIUS + 1)
  const unmountStart = Math.max(0, activeIndex - UNMOUNT_LINE_RADIUS)
  const unmountEnd = Math.min(total, activeIndex + UNMOUNT_LINE_RADIUS + 1)
  if (current.end <= current.start) return { start: mountStart, end: mountEnd }
  return {
    start: Math.min(mountStart, Math.max(unmountStart, current.start)),
    end: Math.max(mountEnd, Math.min(unmountEnd, current.end))
  }
}

/** 生成穿插当前与前后歌词的连续三维样条段。 */
export function buildCinematicSpline(
  options: CinematicSplineBuildOptions
): readonly CinematicSplineSegment[] {
  const samples = sampleRibbonPath(options.anchors, options.ribbon)
  if (samples.length < 2) return []

  const opacityScale = options.ribbon === 'primary' ? 0.82 : 0.38
  const segments: CinematicSplineSegment[] = []
  for (let index = 0; index < samples.length - 1; index += 1) {
    const from = samples[index]
    const to = samples[index + 1]
    if (!from || !to) continue
    const oriented = orientSegment(from, to)
    if (oriented.length < 0.5) continue
    const midpoint = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      z: (from.z + to.z) / 2
    }
    const depth = depthOfFieldForPoint(midpoint, options.camera, {
      reducedMotion: options.reducedMotion,
      motion: options.motion
    })
    segments.push({
      id: `${options.ribbon}-${Math.round(from.x)}-${Math.round(from.y)}-${Math.round(from.z)}-${Math.round(to.x)}-${Math.round(to.y)}-${Math.round(to.z)}`,
      length: oriented.length,
      transform: oriented.transform,
      opacity: Math.max(0.03, depth.opacity * opacityScale),
      blurPx: depth.blurPx * 0.45
    })
  }
  return segments
}

/** 在歌词锚点之间采样带侧向穿插的 Catmull-Rom 丝带。 */
export function sampleRibbonPath(
  anchors: readonly Vec3[],
  ribbon: CinematicSplineRibbon
): Vec3[] {
  if (anchors.length === 0) return []
  if (anchors.length === 1) {
    const only = anchors[0]
    return only ? [gatePoint(only, ribbon)] : []
  }

  const gated = anchors.map((anchor) => gatePoint(anchor, ribbon))
  const padded = padCatmullRom(gated)
  const samples: Vec3[] = []
  const spanCount = gated.length - 1
  for (let span = 0; span < spanCount; span += 1) {
    const p0 = padded[span]
    const p1 = padded[span + 1]
    const p2 = padded[span + 2]
    const p3 = padded[span + 3]
    if (!p0 || !p1 || !p2 || !p3) continue
    const sampleLimit = span === spanCount - 1
      ? SPLINE_SAMPLES_PER_SPAN
      : SPLINE_SAMPLES_PER_SPAN - 1
    for (let step = 0; step <= sampleLimit; step += 1) {
      const t = step / SPLINE_SAMPLES_PER_SPAN
      const base = catmullRom(p0, p1, p2, p3, t)
      samples.push(weaveBetweenGates(base, t, span, ribbon))
    }
  }
  return samples
}

/** 把局部 +X 线段定向到世界空间中的两点。 */
export function orientSegment(
  from: Vec3,
  to: Vec3
): { length: number; transform: string } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const length = Math.hypot(dx, dy, dz)
  if (length < 1e-6) {
    return {
      length: 0,
      transform: `translate3d(${from.x}px, ${from.y}px, ${from.z}px) scale(0)`
    }
  }

  const xAxis = { x: dx / length, y: dy / length, z: dz / length }
  const up = Math.abs(xAxis.y) < 0.999
    ? { x: 0, y: 1, z: 0 }
    : { x: 1, y: 0, z: 0 }
  const zAxis = normalize(cross(xAxis, up))
  const yAxis = cross(zAxis, xAxis)
  const values = [
    xAxis.x, xAxis.y, xAxis.z, 0,
    yAxis.x, yAxis.y, yAxis.z, 0,
    zAxis.x, zAxis.y, zAxis.z, 0,
    from.x, from.y, from.z, 1
  ]
  return {
    length,
    transform: `matrix3d(${values.map((value) => value.toFixed(4)).join(', ')})`
  }
}

/** 歌词锚点处的样条门点，曲线在此穿过该行。 */
function gatePoint(anchor: Vec3, ribbon: CinematicSplineRibbon): Vec3 {
  const side = ribbon === 'primary' ? 1 : -1
  return {
    x: anchor.x + side * SPLINE_GATE_X,
    y: anchor.y,
    z: anchor.z + side * SPLINE_GATE_Z
  }
}

/**
 * 在两句歌词门点之间把样条甩向侧向 X/Z，使曲线穿插过字而不贴死字形中心。
 * t = 0/1 时偏移为 0，曲线仍穿过当前与下一句歌词。
 */
function weaveBetweenGates(
  base: Vec3,
  t: number,
  span: number,
  ribbon: CinematicSplineRibbon
): Vec3 {
  const bow = Math.sin(t * Math.PI)
  if (bow <= 1e-4) return base
  const side = ribbon === 'primary' ? 1 : -1
  const phase = ribbon === 'primary' ? 0.31 : 1.67
  return {
    x: base.x + side * bow * Math.sin(span * 1.21 + phase) * 148,
    y: base.y + side * bow * Math.sin(span * 0.47 + phase) * 16,
    z: base.z + side * bow * Math.cos(span * 0.93 + phase) * 124
  }
}

/** 为 Catmull-Rom 补上虚拟端点，使首尾锚点也被曲线穿过。 */
function padCatmullRom(points: readonly Vec3[]): Vec3[] {
  const first = points[0]
  const second = points[1]
  const last = points[points.length - 1]
  const previous = points[points.length - 2]
  if (!first || !second || !last || !previous) return [...points]
  return [
    {
      x: first.x * 2 - second.x,
      y: first.y * 2 - second.y,
      z: first.z * 2 - second.z
    },
    ...points,
    {
      x: last.x * 2 - previous.x,
      y: last.y * 2 - previous.y,
      z: last.z * 2 - previous.z
    }
  ]
}

/** 标准均匀 Catmull-Rom，t ∈ [0, 1] 时从 p1 走到 p2。 */
function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: catmullRomAxis(p0.x, p1.x, p2.x, p3.x, t2, t3, t),
    y: catmullRomAxis(p0.y, p1.y, p2.y, p3.y, t2, t3, t),
    z: catmullRomAxis(p0.z, p1.z, p2.z, p3.z, t2, t3, t)
  }
}

/** 单轴 Catmull-Rom。 */
function catmullRomAxis(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t2: number,
  t3: number,
  t: number
): number {
  return 0.5 * (
    (2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

/** 三维叉积。 */
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
}

/** 单位向量；零向量回退为 +Y。 */
function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length < 1e-8) return { x: 0, y: 1, z: 0 }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  }
}
