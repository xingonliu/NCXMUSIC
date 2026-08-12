<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// ========= 属性 =========

/** 音乐进度条组件属性。 */
const props = withDefaults(
  defineProps<{
    /** 当前播放进度数值（通常为毫秒数）。 */
    modelValue?: number
    /** 进度条最小值。 */
    min?: number
    /** 进度条最大值。 */
    max?: number
    /** 键盘或拖拽调整步长。 */
    step?: number
    /** 是否禁用进度条交互。 */
    disabled?: boolean
    /** 是否处于缓冲或加载状态。 */
    busy?: boolean
    /** 可读的无障碍说明文本。 */
    label?: string
  }>(),
  {
    modelValue: 0,
    min: 0,
    max: 100,
    step: 1000,
    disabled: false,
    busy: false,
    label: '音乐播放进度'
  }
)

// ========= 事件 =========

/** 音乐进度条组件发出的事件定义。 */
const emit = defineEmits<{
  /** 拖动过程中的本地预览值。 */
  (event: 'update:modelValue', value: number): void
  /** 点击或拖动释放后确认的播放进度。 */
  (event: 'change', value: number): void
  /** 开始拖动进度条。 */
  (event: 'dragStart'): void
  /** 结束拖动进度条。 */
  (event: 'dragEnd', value: number): void
}>()

// ========= 变量 =========

/** 进度条可交互根元素。 */
const trackRef = ref<HTMLElement | null>(null)

/** 用户是否正在按住进度条。 */
const isDragging = ref<boolean>(false)

/** 是否正处于点击或快进 Seek 状态。 */
const isSeeking = ref<boolean>(false)

/** Seek 状态弹性过渡重置定时器。 */
let seekResetTimer: number | undefined

/** 拖动期间的本地预览值。 */
const dragValue = ref<number | null>(null)

/** 当前由进度条跟踪的唯一指针 ID。 */
let activePointerId: number | null = null

/** 当前用于绘制进度条的数值。 */
const currentValue = computed<number>(() => {
  return isDragging.value && dragValue.value !== null
    ? dragValue.value
    : props.modelValue
})

/** 当前已播放百分比。 */
const percentage = computed<number>(() => {
  /** 进度条可用数值范围。 */
  const range = props.max - props.min
  if (range <= 0) return 0
  /** 当前数值在合法范围内的比例。 */
  const ratio = (currentValue.value - props.min) / range
  return Math.max(0, Math.min(100, ratio * 100))
})

// ========= 函数 =========

/**
 * 触发一次 Seek 缓动平滑过渡。
 *
 * @param durationMs 缓动维持时长（默认 350ms）
 */
function triggerSeekAnimation(durationMs = 350): void {
  isSeeking.value = true
  if (seekResetTimer !== undefined) {
    window.clearTimeout(seekResetTimer)
  }
  seekResetTimer = window.setTimeout(() => {
    isSeeking.value = false
  }, durationMs)
}

watch(() => props.modelValue, (nextValue, previousValue) => {
  if (isDragging.value) return
  /** 若数值离散大跳跃（如点击 Seek 或切歌），激活 Seek 弹性缓动。 */
  if (Math.abs(nextValue - previousValue) > 2500) {
    triggerSeekAnimation()
  }
})

/**
 * 把原始进度值按步长量化并限制在合法范围内。
 *
 * @param value 需要规范化的原始进度值
 */
function normalizeValue(value: number): number {
  /** 按最小值对齐后的量化进度。 */
  const steppedValue = props.step > 0
    ? props.min + Math.round((value - props.min) / props.step) * props.step
    : Math.round(value)
  return Math.max(props.min, Math.min(props.max, steppedValue))
}

/**
 * 使用参考实现的横向百分比算法计算指针对应的进度值。
 *
 * @param clientX 指针相对视口的横向坐标
 */
function valueFromClientX(clientX: number): number {
  const element = trackRef.value
  if (!element) return props.modelValue

  /** 当前进度条在视口中的真实矩形。 */
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0) return props.min

  /** 指针在轨道中的横向像素偏移。 */
  const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left))
  /** 与参考实现一致的横向百分比。 */
  const ratio = offsetX / rect.width
  /** 百分比映射回组件数值范围后的原始进度。 */
  const rawValue = props.min + ratio * (props.max - props.min)
  return normalizeValue(rawValue)
}

/** 注册拖动期间所需的窗口级指针监听。 */
function registerPointerListeners(): void {
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
  window.addEventListener('blur', handleWindowBlur)
}

/** 移除拖动期间注册的窗口级指针监听。 */
function cleanupPointerListeners(): void {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerCancel)
  window.removeEventListener('blur', handleWindowBlur)
}

/** 释放当前进度条持有的指针捕获。 */
function releaseActivePointerCapture(): void {
  const element = trackRef.value
  if (!element || activePointerId === null) return
  try {
    if (element.hasPointerCapture(activePointerId)) {
      element.releasePointerCapture(activePointerId)
    }
  } catch {
    // 元素卸载或窗口切换时，原生指针捕获可能已经由浏览器释放。
  }
}

/** 清空当前拖动状态并释放所有临时监听。 */
function resetPointerInteraction(): void {
  releaseActivePointerCapture()
  cleanupPointerListeners()
  isDragging.value = false
  dragValue.value = null
  activePointerId = null
}

/**
 * 按下进度条后开始本地预览。
 *
 * @param event 指针按下事件
 */
function handlePointerDown(event: PointerEvent): void {
  if (props.disabled || event.button !== 0 || activePointerId !== null) return
  event.preventDefault()

  /** 按下位置对应的初始预览进度。 */
  const nextValue = valueFromClientX(event.clientX)
  activePointerId = event.pointerId
  isDragging.value = true
  dragValue.value = nextValue

  try {
    trackRef.value?.setPointerCapture(event.pointerId)
  } catch {
    // 不支持指针捕获时继续使用窗口级监听完成拖动。
  }

  registerPointerListeners()
  emit('dragStart')
  emit('update:modelValue', nextValue)
}

/**
 * 使用当前活跃指针连续更新本地预览。
 *
 * @param event 指针移动事件
 */
function handlePointerMove(event: PointerEvent): void {
  if (!isDragging.value || event.pointerId !== activePointerId) return
  event.preventDefault()

  /** 当前移动位置对应的预览进度。 */
  const nextValue = valueFromClientX(event.clientX)
  dragValue.value = nextValue
  emit('update:modelValue', nextValue)
}

/**
 * 释放活跃指针并只提交一次最终播放进度。
 *
 * @param event 指针抬起事件
 */
function handlePointerUp(event: PointerEvent): void {
  if (!isDragging.value || event.pointerId !== activePointerId) return
  event.preventDefault()

  /** 释放位置对应的最终播放进度。 */
  const finalValue = valueFromClientX(event.clientX)
  resetPointerInteraction()
  triggerSeekAnimation()
  emit('update:modelValue', finalValue)
  emit('change', finalValue)
  emit('dragEnd', finalValue)
}

/**
 * 指针被系统取消时放弃预览，不把无效坐标提交给播放器。
 *
 * @param event 指针取消事件
 */
function handlePointerCancel(event: PointerEvent): void {
  if (!isDragging.value || event.pointerId !== activePointerId) return
  /** 取消前播放器拥有的稳定进度。 */
  const stableValue = props.modelValue
  resetPointerInteraction()
  emit('dragEnd', stableValue)
}

/** 窗口失焦时取消未完成的拖动，避免组件残留在 dragging 状态。 */
function handleWindowBlur(): void {
  if (!isDragging.value) return
  /** 失焦前播放器拥有的稳定进度。 */
  const stableValue = props.modelValue
  resetPointerInteraction()
  emit('dragEnd', stableValue)
}

/**
 * 使用键盘对播放进度进行离散调整。
 *
 * @param event 键盘事件
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (props.disabled) return

  /** 键盘每次调整使用的合法步长。 */
  const stepSize = props.step > 0 ? props.step : 5000
  /** 本次键盘输入计算出的目标进度。 */
  let nextValue: number | null = null

  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    nextValue = normalizeValue(props.modelValue - stepSize)
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    nextValue = normalizeValue(props.modelValue + stepSize)
  } else if (event.key === 'Home') {
    nextValue = props.min
  } else if (event.key === 'End') {
    nextValue = props.max
  }

  if (nextValue === null) return
  event.preventDefault()
  triggerSeekAnimation()
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
}

// ========= 生命周期 =========

onBeforeUnmount(() => {
  resetPointerInteraction()
  if (seekResetTimer !== undefined) {
    window.clearTimeout(seekResetTimer)
  }
})
</script>

<template>
  <div
    ref="trackRef"
    class="music-progress-bar"
    :class="{
      'music-progress-bar--dragging': isDragging,
      'music-progress-bar--seeking': isSeeking,
      'music-progress-bar--busy': props.busy,
      'music-progress-bar--disabled': props.disabled
    }"
    role="slider"
    :tabindex="props.disabled ? -1 : 0"
    :aria-valuemin="props.min"
    :aria-valuemax="props.max"
    :aria-valuenow="currentValue"
    :aria-disabled="props.disabled ? 'true' : undefined"
    :aria-busy="props.busy ? 'true' : undefined"
    :aria-label="props.label"
    @pointerdown="handlePointerDown"
    @keydown="handleKeyDown"
  >
    <div class="music-progress-rail" />
    <div
      class="music-progress-fill"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>

<style scoped>
.music-progress-bar {
  position: relative;
  width: 100%;
  height: 5px;
  box-sizing: content-box;
  padding: 10px 0;
  margin: -10px 0;
  outline: none;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.music-progress-bar--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.music-progress-rail,
.music-progress-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 10px;
  transform: translateY(-50%);
}

.music-progress-rail {
  width: 100%;
  border-radius: 10px;
  background-color: rgb(175 175 175 / 24.7%);
}

.music-progress-fill {
  max-width: 100%;
  border-radius: 10px 0 0 10px;
  background-color: rgb(255 255 255 / 94.5%);
  pointer-events: none;
  will-change: width;
  transition:
    width 350ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 500ms ease,
    box-shadow 500ms ease;
}

.music-progress-bar:hover:not(.music-progress-bar--disabled) .music-progress-fill,
.music-progress-bar--dragging .music-progress-fill {
  background-color: #ffffff;
  box-shadow: #ffffff 0 0 30px 2px;
}

.music-progress-bar--dragging .music-progress-fill {
  transition:
    width 0ms,
    background-color 120ms ease,
    box-shadow 120ms ease;
}

.music-progress-bar:focus-visible {
  border-radius: 10px;
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .music-progress-fill {
    transition: none;
  }
}
</style>
