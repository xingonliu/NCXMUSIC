<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

// ========= 属性 =========

/** 音乐进度条组件属性。 */
const props = withDefaults(
  defineProps<{
    /** 当前播放进度数值（通常为毫秒数）。 */
    modelValue?: number
    /** 进度条最小值，默认 0。 */
    min?: number
    /** 进度条最大值，默认 100。 */
    max?: number
    /** 键盘或拖拽调整步长，默认 1000。 */
    step?: number
    /** 是否禁用进度条交互。 */
    disabled?: boolean
    /** 是否处于缓冲或加载等忙碌状态。 */
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
  /** 播放进度更新事件（拖拽过程或点按）。 */
  (event: 'update:modelValue', value: number): void
  /** 播放进度确认变更事件。 */
  (event: 'change', value: number): void
  /** 开始拖拽滑动条事件。 */
  (event: 'dragStart'): void
  /** 结束拖拽滑动条事件。 */
  (event: 'dragEnd', value: number): void
}>()

// ========= 变量 =========

/** 进度条 DOM 容器引用。 */
const trackRef = ref<HTMLElement | null>(null)

/** 鼠标或指针是否在进度条上方悬浮。 */
const isHovered = ref<boolean>(false)

/** 用户是否正在按住拖拽进度条。 */
const isDragging = ref<boolean>(false)

/** 拖拽过程中的实时预览数值。 */
const dragValue = ref<number | null>(null)

/** 活跃指针 ID，用于多触点/指针捕获释放。 */
let activePointerId: number | null = null

/** 当前展示的进度数值（拖拽优先使用预览值）。 */
const currentValue = computed<number>(() => {
  if (isDragging.value && dragValue.value !== null) {
    return dragValue.value
  }
  return props.modelValue
})

/** 进度条已播放百分比（限制在 0 至 100 之间）。 */
const percentage = computed<number>(() => {
  const range = props.max - props.min
  if (range <= 0) return 0
  const normalized = (currentValue.value - props.min) / range
  return Math.max(0, Math.min(100, normalized * 100))
})

// ========= 函数 =========

/**
 * 根据指针坐标计算对应的进度数值。
 *
 * @param clientX 指针相对视口的 X 坐标
 */
function calculateValueFromClientX(clientX: number): number {
  if (!trackRef.value) return props.modelValue
  const rect = trackRef.value.getBoundingClientRect()
  if (rect.width <= 0) return props.min

  /** 指针相对轨道左侧的偏移比例。 */
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  /** 范围差值。 */
  const range = props.max - props.min
  /** 未量化的目标值。 */
  const rawValue = props.min + ratio * range

  if (props.step <= 0) {
    return Math.round(rawValue)
  }

  /** 按步长量化后的值。 */
  const steppedValue = Math.round(rawValue / props.step) * props.step
  return Math.max(props.min, Math.min(props.max, steppedValue))
}

/**
 * 处理指针按下（PointerDown）事件，开始拖拽或直接 seek。
 *
 * @param event 指针按下事件
 */
function handlePointerDown(event: PointerEvent): void {
  if (props.disabled || event.button !== 0) return
  event.preventDefault()

  /** 标记正在拖拽。 */
  isDragging.value = true
  activePointerId = event.pointerId

  /** 获取进度条容器。 */
  const element = trackRef.value
  if (element) {
    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      // 忽略捕获失败兜底
    }
  }

  /** 计算按下位置对应数值。 */
  const nextValue = calculateValueFromClientX(event.clientX)
  dragValue.value = nextValue

  emit('dragStart')
  emit('update:modelValue', nextValue)

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerUp)
}

/**
 * 处理指针移动（PointerMove）事件。
 *
 * @param event 指针移动事件
 */
function handlePointerMove(event: PointerEvent): void {
  if (!isDragging.value) return
  event.preventDefault()

  const nextValue = calculateValueFromClientX(event.clientX)
  dragValue.value = nextValue
  emit('update:modelValue', nextValue)
}

/**
 * 处理指针抬起或取消（PointerUp/PointerCancel）事件。
 *
 * @param event 指针释放事件
 */
function handlePointerUp(event: PointerEvent): void {
  if (!isDragging.value) return

  const element = trackRef.value
  if (element && activePointerId !== null) {
    try {
      element.releasePointerCapture(activePointerId)
    } catch {
      // 忽略释放失败兜底
    }
  }

  const finalValue = calculateValueFromClientX(event.clientX)
  isDragging.value = false
  dragValue.value = null
  activePointerId = null

  cleanupListeners()

  emit('update:modelValue', finalValue)
  emit('change', finalValue)
  emit('dragEnd', finalValue)
}

/** 清理未释放的全局指针监听。 */
function cleanupListeners(): void {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerUp)
}

/**
 * 键盘方向键微调进度。
 *
 * @param event 键盘事件
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (props.disabled) return

  /** 基础微调步长为 step 或 5 秒。 */
  const stepSize = props.step > 0 ? props.step : 5000
  let nextValue: number | null = null

  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    nextValue = Math.max(props.min, props.modelValue - stepSize)
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    nextValue = Math.min(props.max, props.modelValue + stepSize)
  } else if (event.key === 'Home') {
    nextValue = props.min
  } else if (event.key === 'End') {
    nextValue = props.max
  }

  if (nextValue !== null) {
    event.preventDefault()
    emit('update:modelValue', nextValue)
    emit('change', nextValue)
  }
}

// ========= 生命周期 =========

onBeforeUnmount(() => {
  cleanupListeners()
})
</script>

<template>
  <div
    ref="trackRef"
    class="music-progress-bar"
    :class="{
      'music-progress-bar--hover': isHovered,
      'music-progress-bar--dragging': isDragging,
      'music-progress-bar--busy': props.busy,
      'music-progress-bar--disabled': props.disabled
    }"
    role="slider"
    tabindex="0"
    :aria-valuemin="props.min"
    :aria-valuemax="props.max"
    :aria-valuenow="props.modelValue"
    :aria-disabled="props.disabled ? 'true' : undefined"
    :aria-label="props.label"
    @pointerdown="handlePointerDown"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @keydown="handleKeyDown"
  >
    <div class="music-progress-rail">
      <div
        class="music-progress-fill"
        :style="{ width: `${percentage}%` }"
      >
        <div class="music-progress-glow-tip" />
      </div>
      <div
        v-if="props.busy"
        class="music-progress-busy-glow"
      />
    </div>
  </div>
</template>

<style scoped>
.music-progress-bar {
  position: relative;
  display: flex;
  width: 100%;
  height: 16px;
  align-items: center;
  box-sizing: border-box;
  cursor: pointer;
  outline: none;
  touch-action: none;
  user-select: none;
}

.music-progress-bar--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.music-progress-rail {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ncx-color-text-primary, #ffffff) 22%, transparent);
  overflow: visible;
}

.music-progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  border-radius: 999px;
  background: #ffffff;
  transition: width 0.05s linear;
}

.music-progress-glow-tip {
  position: absolute;
  top: 50%;
  right: 0;
  width: 6px;
  height: 100%;
  border-radius: 999px;
  background: #ffffff;
  transform: translate(50%, -50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, box-shadow 0.18s ease;
}

.music-progress-bar:hover .music-progress-glow-tip,
.music-progress-bar--dragging .music-progress-glow-tip {
  opacity: 1;
  box-shadow:
    0 0 10px 3px rgba(255, 255, 255, 0.95),
    0 0 20px 6px rgba(255, 255, 255, 0.7);
}

.music-progress-busy-glow {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.5) 50%,
    transparent 100%
  );
  animation: music-progress-shimmer 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes music-progress-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.music-progress-bar:focus-visible .music-progress-rail {
  outline: 2px solid color-mix(in srgb, var(--ncx-color-accent, #3b82f6) 75%, white);
  outline-offset: 2px;
}
</style>
