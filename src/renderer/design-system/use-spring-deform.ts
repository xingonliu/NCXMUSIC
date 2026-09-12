// ==========================================
// 液态玻璃触控形变与弹簧物理引擎
//
// 移植自 Android Compose / Kyant AndroidLiquidGlass:
// 1. Spring: 闭式解析解弹簧阻尼模拟器
// 2. calculateButtonDeform: tanh 向心阻尼与方向性 squash/stretch 形变
// 3. useSpringDeform: Vue 3 Composable，驱动 DOM 元素硬件加速形变
// ==========================================

import { onMounted, onUnmounted, reactive, watch, type Ref } from 'vue'

// -- Type Definitions

/** 弹簧形变当前几何状态。 */
export interface SpringDeformState {
  /** X 轴向心平移位移 (px)。 */
  tx: number
  /** Y 轴向心平移位移 (px)。 */
  ty: number
  /** X 轴拉伸/挤压比例。 */
  sx: number
  /** Y 轴拉伸/挤压比例。 */
  sy: number
  /** 当前按压进度 (0~1)。 */
  progress: number
  /** 是否处于按压交互中。 */
  isPressed: boolean
}

/** useSpringDeform 配置项。 */
export interface SpringDeformOptions {
  /** 是否禁用弹簧形变。 */
  disabled?: boolean | Ref<boolean> | (() => boolean)
  /** 弹簧阻尼比 (dampingRatio)，默认 0.85 (欠阻尼微回弹)。 */
  dampingRatio?: number
  /** 弹簧刚度 (stiffness)，默认 380。 */
  stiffness?: number
  /** 最大形变位移上限系数，默认 1。 */
  offsetScale?: number
  /** 按压状态或形变更新时的回调。 */
  onUpdate?: (state: SpringDeformState) => void
}

// -- Constants

/** 弹簧微小速度与位移的静止阈值。 */
const SPRING_SETTLE_THRESHOLD = 0.0008

/** 触点 tanh 向心阻尼敏感度系数。 */
const TANH_DAMPING_FACTOR = 0.05

// -- Section: Spring Simulation Engine

/**
 * 闭式解析解弹簧阻尼器 (基于 androidx.compose.animation.core.SpringSimulation)。
 * 支持过阻尼 (z > 1)、临界阻尼 (z = 1) 与欠阻尼 (z < 1)。
 */
export class Spring {
  /** 当前值。 */
  value: number
  /** 目标值。 */
  target: number
  /** 当前速度。 */
  velocity: number
  /** 阻尼比 (damping ratio, zeta)。 */
  readonly dampingRatio: number
  /** 自然频率 (natural frequency, omega = sqrt(stiffness))。 */
  readonly naturalFrequency: number

  constructor(value: number, dampingRatio = 0.85, stiffness = 380) {
    this.value = value
    this.target = value
    this.velocity = 0
    this.dampingRatio = Math.max(0.01, dampingRatio)
    this.naturalFrequency = Math.sqrt(Math.max(1, stiffness))
  }

  /** 设定新目标值。 */
  setTarget(target: number): void {
    this.target = target
  }

  /** 立即瞬移到目标值并清零速度。 */
  snapTo(target: number): void {
    this.value = target
    this.target = target
    this.velocity = 0
  }

  /** 判断弹簧是否已充分静止。 */
  get isSettled(): boolean {
    const displacement = Math.abs(this.value - this.target)
    const speed = Math.abs(this.velocity)
    return displacement < SPRING_SETTLE_THRESHOLD && speed < SPRING_SETTLE_THRESHOLD * 25
  }

  /**
   * 按照给定时间增量 dt 推进弹簧状态（毫秒转换为秒）。
   * @param dtSeconds 推进步长（秒）
   */
  step(dtSeconds: number): number {
    if (dtSeconds <= 0) return this.value

    if (this.isSettled) {
      this.value = this.target
      this.velocity = 0
      return this.value
    }

    const z = this.dampingRatio
    const w = this.naturalFrequency
    const disp = this.value - this.target
    const v0 = this.velocity

    let nextValue: number
    let nextVelocity: number

    if (z > 1.0) {
      // 过阻尼 (Over-damped)
      const adj = Math.sqrt(z * z - 1)
      const gp = w * (z + adj)
      const gm = w * (z - adj)
      const b = (gm * disp - v0) / (gm - gp)
      const a = disp - b
      const e1 = Math.exp(-gm * dtSeconds)
      const e2 = Math.exp(-gp * dtSeconds)
      nextValue = a * e1 + b * e2
      nextVelocity = a * -gm * e1 + b * -gp * e2
    } else if (Math.abs(z - 1.0) < 1e-4) {
      // 临界阻尼 (Critically-damped)
      const a = disp
      const b = v0 + w * disp
      const e = Math.exp(-w * dtSeconds)
      nextValue = (a + b * dtSeconds) * e
      nextVelocity = (a + b * dtSeconds) * e * -w + b * e
    } else {
      // 欠阻尼 (Under-damped, 产生自然弹性微颤)
      const wd = w * Math.sqrt(1 - z * z)
      const a = disp
      const b = (1 / wd) * (z * w * disp + v0)
      const e = Math.exp(-z * w * dtSeconds)
      const s = Math.sin(wd * dtSeconds)
      const c = Math.cos(wd * dtSeconds)
      nextValue = e * (a * c + b * s)
      nextVelocity = nextValue * -z * w + e * (-wd * a * s + wd * b * c)
    }

    this.value = nextValue + this.target
    this.velocity = nextVelocity
    return this.value
  }
}

// -- Section: Button Deformation Math

/**
 * 根据触点相对元素中心的偏移 (ox, oy) 以及按压进度，计算向心拉伸形变参数。
 *
 * @param width 控件宽度
 * @param height 控件高度
 * @param offsetX 触点相对于几何中心的 X 偏移 (px)
 * @param offsetY 触点相对于几何中心的 Y 偏移 (px)
 * @param pressProgress 按压进度 (0~1)
 */
export function calculateButtonDeform(
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  pressProgress: number
): { tx: number; ty: number; sx: number; sy: number; progress: number } {
  const safeW = Math.max(1, width)
  const safeH = Math.max(1, height)
  const p = Math.max(0, Math.min(1, pressProgress))

  // 基础按压轻微缩放
  const baseScale = 1 - 0.04 * p
  const maxOffset = Math.min(safeW, safeH)

  // tanh 软饱和向心位移
  const tx = maxOffset * Math.tanh((TANH_DAMPING_FACTOR * offsetX) / Math.max(maxOffset, 1)) * p
  const ty = maxOffset * Math.tanh((TANH_DAMPING_FACTOR * offsetY) / Math.max(maxOffset, 1)) * p

  // 沿触摸拉动极角的 directional squash / stretch
  const maxDragScale = 4 / Math.max(safeH, 20)
  const angle = Math.atan2(offsetY, offsetX)
  const maxDim = Math.max(safeW, safeH)

  const stretchX = maxDragScale * Math.abs(Math.cos(angle) * (offsetX / maxDim)) * Math.min(safeW / safeH, 1) * p
  const stretchY = maxDragScale * Math.abs(Math.sin(angle) * (offsetY / maxDim)) * Math.min(safeH / safeW, 1) * p

  const sx = baseScale + stretchX
  const sy = baseScale + stretchY

  return {
    tx,
    ty,
    sx,
    sy,
    progress: p
  }
}

// -- Section: Composable

/**
 * 为任意 DOM 元素安装液态玻璃触控物理形变。
 * 自动接管 Pointer 事件与 RAF 弹簧循环，导出实时 CSS transform 变量与状态。
 */
export function useSpringDeform(
  targetRef: Ref<HTMLElement | null | undefined>,
  options: SpringDeformOptions = {}
) {
  // -- State and Variables
  const deformState = reactive<SpringDeformState>({
    tx: 0,
    ty: 0,
    sx: 1,
    sy: 1,
    progress: 0,
    isPressed: false
  })

  const pressSpring = new Spring(0, options.dampingRatio ?? 0.82, options.stiffness ?? 380)

  let pointerId: number | null = null
  let touchOffsetX = 0
  let touchOffsetY = 0
  let animationFrameId: number | null = null
  let lastTimestamp = 0

  // -- Functions

  /** 解析当前是否处于禁用状态。 */
  function isDeformDisabled(): boolean {
    if (typeof options.disabled === 'function') return options.disabled()
    if (options.disabled && typeof options.disabled === 'object' && 'value' in options.disabled) {
      return Boolean(options.disabled.value)
    }
    return Boolean(options.disabled)
  }

  /** 更新元素几何形变与 CSS 变量。 */
  function applyDeform(element: HTMLElement, tx: number, ty: number, sx: number, sy: number, p: number): void {
    deformState.tx = tx
    deformState.ty = ty
    deformState.sx = sx
    deformState.sy = sy
    deformState.progress = p

    // 写入 CSS 变量，供内部样式选择性应用或合成
    element.style.setProperty('--ncx-liquid-tx', `${tx.toFixed(2)}px`)
    element.style.setProperty('--ncx-liquid-ty', `${ty.toFixed(2)}px`)
    element.style.setProperty('--ncx-liquid-sx', `${sx.toFixed(4)}`)
    element.style.setProperty('--ncx-liquid-sy', `${sy.toFixed(4)}`)
    element.style.setProperty('--ncx-liquid-progress', `${p.toFixed(3)}`)

    options.onUpdate?.(deformState)
  }

  /** 弹簧动画主循环。 */
  function stepAnimation(timestamp: number): void {
    if (!lastTimestamp) lastTimestamp = timestamp
    const dtSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05)
    lastTimestamp = timestamp

    const element = targetRef.value
    if (!element) {
      animationFrameId = null
      return
    }

    const currentP = pressSpring.step(dtSeconds)
    const rect = element.getBoundingClientRect()
    const { tx, ty, sx, sy, progress } = calculateButtonDeform(
      rect.width,
      rect.height,
      touchOffsetX,
      touchOffsetY,
      currentP
    )

    applyDeform(element, tx, ty, sx, sy, progress)

    if (!pressSpring.isSettled || deformState.isPressed) {
      animationFrameId = requestAnimationFrame(stepAnimation)
    } else {
      // 彻底稳定，重置为基准态
      applyDeform(element, 0, 0, 1, 1, 0)
      animationFrameId = null
      lastTimestamp = 0
    }
  }

  /** 确保动画帧处于激活推进状态。 */
  function scheduleStep(): void {
    if (animationFrameId !== null) return
    lastTimestamp = 0
    animationFrameId = requestAnimationFrame(stepAnimation)
  }

  // -- Event Listeners

  function handlePointerDown(event: PointerEvent): void {
    if (isDeformDisabled() || event.button !== 0) return
    const element = targetRef.value
    if (!element) return

    pointerId = event.pointerId
    deformState.isPressed = true
    pressSpring.setTarget(1)

    const rect = element.getBoundingClientRect()
    touchOffsetX = event.clientX - (rect.left + rect.width / 2)
    touchOffsetY = event.clientY - (rect.top + rect.height / 2)

    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      // 无捕获支持环境静默回退
    }

    scheduleStep()
  }

  function handlePointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId || !deformState.isPressed) return
    const element = targetRef.value
    if (!element) return

    const rect = element.getBoundingClientRect()
    touchOffsetX = event.clientX - (rect.left + rect.width / 2)
    touchOffsetY = event.clientY - (rect.top + rect.height / 2)

    scheduleStep()
  }

  function handlePointerUp(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    releasePointer(event)
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    releasePointer(event)
  }

  function releasePointer(event: PointerEvent): void {
    deformState.isPressed = false
    pressSpring.setTarget(0)
    pointerId = null

    const element = targetRef.value
    if (element) {
      try {
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId)
        }
      } catch {
        // 静默处理
      }
    }

    scheduleStep()
  }

  // -- Lifecycle Hooks

  function attachListeners(el: HTMLElement): void {
    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointermove', handlePointerMove)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerCancel)
  }

  function detachListeners(el: HTMLElement): void {
    el.removeEventListener('pointerdown', handlePointerDown)
    el.removeEventListener('pointermove', handlePointerMove)
    el.removeEventListener('pointerup', handlePointerUp)
    el.removeEventListener('pointercancel', handlePointerCancel)
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  watch(targetRef, (newEl, oldEl) => {
    if (oldEl) detachListeners(oldEl)
    if (newEl) attachListeners(newEl)
  })

  onMounted(() => {
    if (targetRef.value) attachListeners(targetRef.value)
  })

  onUnmounted(() => {
    if (targetRef.value) detachListeners(targetRef.value)
  })

  return {
    deformState,
    pressSpring
  }
}
