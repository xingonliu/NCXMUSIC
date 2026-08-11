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

/** 悬浮预览百分比（0-100）。 */
const hoverPercentage = ref<number | null>(null)

/** 悬浮预览时间值（毫秒）。 */
const hoverValue = ref<number | null>(null)

/** 悬浮提示框的 X 轴像素位置。 */
const hoverX = ref<number>(0)

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

/** 格式化后的悬浮时间文本。 */
const formattedHoverTime = computed<string>(() => {
  if (hoverValue.value === null) return ''
  const totalSeconds = Math.max(0, Math.floor(hoverValue.value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

// ========= 函数 =========

/**
 * 根据指针坐标计算对应的进度数值与绝对偏移像素。
 *
 * @param clientX 指针相对视口的 X 坐标
 */
function calculateValueAndPositionFromClientX(clientX: number): {
  value: number
  ratioPercentage: number
  offsetX: number
} {
  if (!trackRef.value) {
    return { value: props.modelValue, ratioPercentage: 0, offsetX: 0 }
  }
  const rect = trackRef.value.getBoundingClientRect()
  if (rect.width <= 0) {
    return { value: props.min, ratioPercentage: 0, offsetX: 0 }
  }

  /** 指针相对轨道左侧的偏移像素。 */
  const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left))
  /** 比例。 */
  const ratio = offsetX / rect.width
  /** 范围差值。 */
  const range = props.max - props.min
  /** 未量化的目标值。 */
  const rawValue = props.min + ratio * range

  let finalValue: number
  if (props.step <= 0) {
    finalValue = Math.round(rawValue)
  } else {
    finalValue = Math.round(rawValue / props.step) * props.step
  }

  const clampedValue = Math.max(props.min, Math.min(props.max, finalValue))
  return {
    value: clampedValue,
    ratioPercentage: ratio * 100,
    offsetX
  }
}

/**
 * 处理悬浮或指针移动时的预览更新。
 *
 * @param event 指针移动事件
 */
function handleTrackMouseMove(event: MouseEvent): void {
  if (props.disabled) return
  const { value, ratioPercentage, offsetX } = calculateValueAndPositionFromClientX(event.clientX)
  hoverValue.value = value
  hoverPercentage.value = ratioPercentage
  hoverX.value = offsetX
}

/** 鼠标离开进度条区域。 */
function handleMouseLeave(): void {
  isHovered.value = false
  if (!isDragging.value) {
    hoverPercentage.value = null
    hoverValue.value = null
  }
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
  const { value, ratioPercentage, offsetX } = calculateValueAndPositionFromClientX(event.clientX)
  dragValue.value = value
  hoverValue.value = value
  hoverPercentage.value = ratioPercentage
  hoverX.value = offsetX

  emit('dragStart')
  emit('update:modelValue', value)

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

  const { value, ratioPercentage, offsetX } = calculateValueAndPositionFromClientX(event.clientX)
  dragValue.value = value
  hoverValue.value = value
  hoverPercentage.value = ratioPercentage
  hoverX.value = offsetX

  emit('update:modelValue', value)
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

  const { value } = calculateValueAndPositionFromClientX(event.clientX)
  isDragging.value = false
  dragValue.value = null
  activePointerId = null

  if (!isHovered.value) {
    hoverPercentage.value = null
    hoverValue.value = null
  }

  cleanupListeners()

  emit('update:modelValue', value)
  emit('change', value)
  emit('dragEnd', value)
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
    @mousemove="handleTrackMouseMove"
    @mouseleave="handleMouseLeave"
    @keydown="handleKeyDown"
  >
    <!-- 悬浮时间气泡 Tooltip -->
    <Transition name="tooltip-fade">
      <div
        v-if="hoverValue !== null && (isHovered || isDragging) && !props.disabled"
        class="music-progress-tooltip"
        :style="{ left: `${hoverX}px` }"
      >
        {{ formattedHoverTime }}
      </div>
    </Transition>

    <div class="music-progress-rail">
      <!-- 悬浮预览轻微高亮轨 -->
      <div
        v-if="hoverPercentage !== null && hoverPercentage > percentage && !props.disabled"
        class="music-progress-hover-fill"
        :style="{
          left: `${percentage}%`,
          width: `${hoverPercentage - percentage}%`
        }"
      />

      <!-- 已播放进度条 -->
      <div
        class="music-progress-fill"
        :style="{ width: `${percentage}%` }"
      >
        <!-- Apple 物理圆环滑块 Thumb -->
        <div class="music-progress-thumb" />
      </div>

      <!-- 缓冲/加载 Shimmer 效果 -->
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
  height: 20px;
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

/* Apple 风格半透明轨道：常态 6px 饱满质感，悬浮与拖拽加粗至 9px */
.music-progress-rail {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ncx-color-text-primary, #ffffff) 20%, transparent);
  overflow: visible;
  transition: height 0.22s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.2s ease;
}

.music-progress-bar:hover:not(.music-progress-bar--disabled) .music-progress-rail,
.music-progress-bar--dragging .music-progress-rail {
  height: 9px;
  background: color-mix(in srgb, var(--ncx-color-text-primary, #ffffff) 28%, transparent);
}

/* 已播放填充轨 */
.music-progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  border-radius: 999px;
  background: var(--ncx-color-text-primary, #ffffff);
  transition: width 0.05s linear;
}

/* 悬浮预看轨 */
.music-progress-hover-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ncx-color-text-primary, #ffffff) 32%, transparent);
  pointer-events: none;
  transition: opacity 0.15s ease;
}

/* Apple 物理圆环滑块 Thumb */
.music-progress-thumb {
  position: absolute;
  top: 50%;
  right: 0;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #ffffff;
  transform: translate(50%, -50%) scale(0);
  opacity: 0;
  pointer-events: none;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
}

/* Hover / Active 状态弹出滑块，消除原先极富盗版感的强发光 */
.music-progress-bar:hover:not(.music-progress-bar--disabled) .music-progress-thumb {
  opacity: 1;
  transform: translate(50%, -50%) scale(1);
}

.music-progress-bar--dragging .music-progress-thumb {
  opacity: 1;
  transform: translate(50%, -50%) scale(1.18);
  box-shadow:
    0 3px 10px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 0, 0, 0.1);
}

/* 精致悬浮时间气泡 */
.music-progress-tooltip {
  position: absolute;
  bottom: 100%;
  margin-bottom: 8px;
  transform: translateX(-50%);
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(24, 24, 28, 0.82);
  color: #ffffff;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.12);
  z-index: 10;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}

/* 缓冲/加载 shimmer 效果 */
.music-progress-busy-glow {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
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
