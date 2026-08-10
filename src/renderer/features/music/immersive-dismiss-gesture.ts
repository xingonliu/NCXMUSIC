/** 沉浸播放页下拉关闭时的视觉状态。 */
export interface ImmersiveDismissVisualState {
  /** 已归一化到 0 至 1 的下拉进度。 */
  progress: number
  /** 标题、控制器与歌词等辅助元素的不透明度。 */
  supportingOpacity: number
  /** 模糊封面背景的不透明度。 */
  backdropOpacity: number
  /** 沉浸页底色的不透明度。 */
  surfaceOpacity: number
}

/** 参与沉浸封面拖拽插值的元素矩形。 */
export interface ImmersiveArtworkRect {
  /** 元素左边缘的视口坐标。 */
  left: number
  /** 元素上边缘的视口坐标。 */
  top: number
  /** 元素宽度。 */
  width: number
  /** 元素高度。 */
  height: number
  /** 元素未变换时的圆角半径。 */
  borderRadius: number
}

/** 沉浸封面与 PlayerBar 封面的源目标几何信息。 */
export interface ImmersiveArtworkGeometry {
  /** 沉浸歌词页大封面的初始矩形。 */
  source: ImmersiveArtworkRect
  /** PlayerBar 小封面的目标矩形。 */
  target: ImmersiveArtworkRect
}

/** 下拉过程中应用到沉浸封面的连续变换状态。 */
export interface ImmersiveArtworkTransform {
  /** 封面从源矩形向目标矩形靠拢的进度。 */
  progress: number
  /** 封面沿 X 轴向 PlayerBar 移动的距离。 */
  translateX: number
  /** 封面沿 Y 轴向 PlayerBar 移动的距离。 */
  translateY: number
  /** 封面向 PlayerBar 尺寸缩小的比例。 */
  scale: number
  /** 抵消整体缩放后应写入封面元素的圆角值。 */
  borderRadius: number
}

// ========= 变量 =========

/** 下拉到该距离后完成沉浸页收起。 */
export const IMMERSIVE_DISMISS_DISTANCE_PX = 220

/** 快速下甩触发收起所需的最小瞬时速度，单位为像素/毫秒。 */
export const IMMERSIVE_DISMISS_FLING_VELOCITY = 0.65

/** 快速下甩仍需达到的最小位移，避免轻触误收起。 */
export const IMMERSIVE_DISMISS_MIN_FLING_DISTANCE_PX = 40

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
 * 使用平滑步进让封面的横向归位形成自然收拢曲线。
 *
 * @param progress 已归一化的封面移动进度
 */
function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress)
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
    supportingOpacity: interpolate(1, IMMERSIVE_SUPPORTING_MIN_OPACITY, progress),
    backdropOpacity: interpolate(1, IMMERSIVE_BACKDROP_MIN_OPACITY, progress),
    surfaceOpacity: interpolate(1, IMMERSIVE_SURFACE_MIN_OPACITY, progress)
  }
}

/**
 * 根据手指下拉距离，把沉浸封面连续插值到 PlayerBar 封面。
 *
 * 纵向位置严格跟随手指，横向位置使用平滑曲线逐步收拢，尺寸和
 * 视觉圆角则线性靠近 PlayerBar，松手后可无跳变接续共享元素过渡。
 *
 * @param offsetY 当前向下拖动的像素距离
 * @param geometry 沉浸封面和 PlayerBar 封面的实时矩形
 */
export function calculateImmersiveArtworkTransform(
  offsetY: number,
  geometry: ImmersiveArtworkGeometry | null
): ImmersiveArtworkTransform {
  if (
    !geometry
    || geometry.source.width <= 0
    || geometry.source.height <= 0
    || geometry.target.width <= 0
    || geometry.target.height <= 0
  ) {
    return {
      progress: 0,
      translateX: 0,
      translateY: 0,
      scale: 1,
      borderRadius: geometry?.source.borderRadius ?? 16
    }
  }

  /** 大封面到 PlayerBar 封面顶部的有效纵向行程。 */
  const verticalTravel = Math.max(1, geometry.target.top - geometry.source.top)
  /** 手指位移映射到封面完整归位行程后的进度。 */
  const progress = clampUnit(offsetY / verticalTravel)
  /** 横向收拢使用的平滑插值进度。 */
  const horizontalProgress = smoothStep(progress)
  /** PlayerBar 封面相对大封面的等比缩放目标。 */
  const targetScale = Math.min(
    geometry.target.width / geometry.source.width,
    geometry.target.height / geometry.source.height
  )
  /** 当前封面尺寸缩放比例。 */
  const scale = interpolate(1, targetScale, progress)
  /** 当前进度期望呈现的视觉圆角。 */
  const visualBorderRadius = interpolate(
    geometry.source.borderRadius,
    geometry.target.borderRadius,
    progress
  )

  return {
    progress,
    translateX: (
      geometry.target.left - geometry.source.left
    ) * horizontalProgress,
    translateY: verticalTravel * progress,
    scale,
    borderRadius: visualBorderRadius / scale
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
