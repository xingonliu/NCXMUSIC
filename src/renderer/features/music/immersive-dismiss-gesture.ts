/** 沉浸播放页下拉关闭时的视觉状态。 */
export interface ImmersiveDismissVisualState {
  /** 已归一化到 0 至 1 的下拉进度。 */
  progress: number
  /** 封面随下拉进度缩放的比例。 */
  artworkScale: number
  /** 标题、控制器与歌词等辅助元素的不透明度。 */
  supportingOpacity: number
  /** 模糊封面背景的不透明度。 */
  backdropOpacity: number
  /** 沉浸页底色的不透明度。 */
  surfaceOpacity: number
}

// ========= 变量 =========

/** 下拉到该距离后完成沉浸页收起。 */
export const IMMERSIVE_DISMISS_DISTANCE_PX = 220

/** 快速下甩触发收起所需的最小瞬时速度，单位为像素/毫秒。 */
export const IMMERSIVE_DISMISS_FLING_VELOCITY = 0.65

/** 快速下甩仍需达到的最小位移，避免轻触误收起。 */
export const IMMERSIVE_DISMISS_MIN_FLING_DISTANCE_PX = 40

/** 封面在完整下拉进度时保留的最小缩放比例。 */
const IMMERSIVE_ARTWORK_MIN_SCALE = 0.86

/** 辅助元素在完整下拉进度时保留的最小不透明度。 */
const IMMERSIVE_SUPPORTING_MIN_OPACITY = 0.12

/** 模糊背景在完整下拉进度时保留的最小不透明度。 */
const IMMERSIVE_BACKDROP_MIN_OPACITY = 0.42

/** 页面底色在完整下拉进度时保留的最小不透明度。 */
const IMMERSIVE_SURFACE_MIN_OPACITY = 0.28

// ========= 函数 =========

/**
 * 把数值限制到 0 至 1，供下拉进度和插值复用。
 *
 * @param value 需要限制的原始数值
 */
function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * 在起点和终点之间按进度执行线性插值。
 *
 * @param from 起点数值
 * @param to 终点数值
 * @param progress 已归一化的插值进度
 */
function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/**
 * 限制下拉偏移，禁止向上拖动并避免超出当前视口。
 *
 * @param offsetY 原始纵向偏移
 * @param viewportHeight 当前视口高度
 */
export function clampImmersiveDismissOffset(
  offsetY: number,
  viewportHeight: number
): number {
  /** 至少覆盖完成阈值的有效视口高度。 */
  const maximumOffset = Math.max(IMMERSIVE_DISMISS_DISTANCE_PX, viewportHeight)
  return Math.max(0, Math.min(maximumOffset, offsetY))
}

/**
 * 根据实时下拉偏移计算连续视觉状态。
 *
 * @param offsetY 当前向下拖动的像素距离
 */
export function calculateImmersiveDismissVisualState(
  offsetY: number
): ImmersiveDismissVisualState {
  /** 当前下拉距离映射到关闭阈值后的归一化进度。 */
  const progress = clampUnit(offsetY / IMMERSIVE_DISMISS_DISTANCE_PX)

  return {
    progress,
    artworkScale: interpolate(1, IMMERSIVE_ARTWORK_MIN_SCALE, progress),
    supportingOpacity: interpolate(1, IMMERSIVE_SUPPORTING_MIN_OPACITY, progress),
    backdropOpacity: interpolate(1, IMMERSIVE_BACKDROP_MIN_OPACITY, progress),
    surfaceOpacity: interpolate(1, IMMERSIVE_SURFACE_MIN_OPACITY, progress)
  }
}

/**
 * 判断释放手势后应完成收起还是回弹。
 *
 * @param offsetY 释放时的向下位移
 * @param velocityY 释放前的纵向瞬时速度，单位为像素/毫秒
 */
export function shouldCompleteImmersiveDismiss(
  offsetY: number,
  velocityY: number
): boolean {
  /** 是否已直接越过关闭距离阈值。 */
  const crossedDistanceThreshold = offsetY >= IMMERSIVE_DISMISS_DISTANCE_PX
  /** 是否满足最小位移后又快速向下甩动。 */
  const crossedFlingThreshold = (
    offsetY >= IMMERSIVE_DISMISS_MIN_FLING_DISTANCE_PX
    && velocityY >= IMMERSIVE_DISMISS_FLING_VELOCITY
  )

  return crossedDistanceThreshold || crossedFlingThreshold
}
