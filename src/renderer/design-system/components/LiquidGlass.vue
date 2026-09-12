<script setup lang="ts">
// ==========================================
// Inspira & Kyant - LiquidGlass 分级液态玻璃组件
//
// 融合 Inspira 实时 SVG 位移透镜与 Kyant AndroidLiquidGlass:
// 1. full: 完整透明液态玻璃 (位移透镜 + 菲涅尔边缘高光 + 内阴影)
// 2. tinted: 完整带颜色液态玻璃 (语义染色 + 胶囊表面光泽)
// 3. lightweight: 轻量级高斯模糊 (无置换计算，零重绘负担)
// 4. dialog: 模态专属深度玻璃 (大圆角 + 强模糊 + 景深内阴影)
// ==========================================

import { computed, onMounted, onUnmounted, reactive, ref, useId, type HTMLAttributes } from 'vue'

import { useSpringDeform } from '../use-spring-deform'

// -- Type Definitions

/** LiquidGlass 材质分级变体。 */
export type LiquidGlassVariant = 'full' | 'tinted' | 'lightweight' | 'dialog'

/** LiquidGlass 可用的标准 Squircle 尺寸。 */
export type LiquidGlassSquircleSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/** LiquidGlass 组件属性接口。 */
export interface LiquidGlassProps {
  /** 材质分级变体。 */
  variant?: LiquidGlassVariant
  /** 玻璃容器使用的标准 Squircle 尺寸。 */
  squircleSize?: LiquidGlassSquircleSize
  /** 自定义染色 (语义色名称 primary/accent/danger 或合法 CSS 颜色值)。 */
  tint?: 'primary' | 'accent' | 'danger' | string | undefined
  /** 是否启用按压触控物理弹簧形变。 */
  interactive?: boolean
  /** 相对边框厚度，影响 displacement map 内层边距。 */
  border?: number
  /** HSL 亮度 (0-100)，用于中间磨砂填充。 */
  lightness?: number
  /** 最终高斯模糊位移扩散强度。 */
  displace?: number
  /** 红蓝 displacement 图层混合模式。 */
  blend?: string
  /** 水平置换通道。 */
  xChannel?: 'R' | 'G' | 'B'
  /** 垂直置换通道。 */
  yChannel?: 'R' | 'G' | 'B'
  /** 中间磨砂填充透明度。 */
  alpha?: number
  /** 中间磨砂填充 blur 半径。 */
  blur?: number
  /** 红色通道位移偏移。 */
  rOffset?: number
  /** 绿色通道位移偏移。 */
  gOffset?: number
  /** 蓝色通道位移偏移。 */
  bOffset?: number
  /** 位移基础缩放值。 */
  scale?: number
  /** 玻璃底色磨砂强度。 */
  frost?: number
  /** 深色模式下的玻璃底色磨砂强度。 */
  darkFrost?: number
  /** 浅色模式背景模糊半径。 */
  backdropBlur?: number
  /** 深色模式背景模糊半径。 */
  darkBackdropBlur?: number
  /** 浅色模式背景饱和度倍率。 */
  saturation?: number
  /** 深色模式背景饱和度倍率。 */
  darkSaturation?: number
  /** 浅色模式背景亮度倍率。 */
  brightness?: number
  /** 深色模式背景亮度倍率。 */
  darkBrightness?: number
  /** 内容容器附加 class。 */
  class?: HTMLAttributes['class']
  /** 外层容器附加 class。 */
  containerClass?: HTMLAttributes['class']
}

// -- Constants

/** 与 CSS Squircle radius token 保持一致的像素值。 */
const SQUIRCLE_RADIUS_BY_SIZE: Record<LiquidGlassSquircleSize, number> = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 30
}

// -- State and Variables

/** 组件属性与默认值。 */
const props = withDefaults(defineProps<LiquidGlassProps>(), {
  variant: 'full',
  squircleSize: 'lg',
  tint: undefined,
  interactive: false,
  border: 0.07,
  lightness: 50,
  displace: 0,
  blend: 'difference',
  xChannel: 'R',
  yChannel: 'B',
  alpha: 0.93,
  blur: 11,
  rOffset: 0,
  gOffset: 10,
  bOffset: 20,
  scale: -180,
  frost: 0.05,
  darkFrost: 0.16,
  backdropBlur: 8,
  darkBackdropBlur: 10,
  saturation: 1.35,
  darkSaturation: 1.2,
  brightness: 1.04,
  darkBrightness: 0.84,
  class: '',
  containerClass: ''
})

/** 组件根元素引用。 */
const liquidGlassRoot = ref<HTMLElement | null>(null)

/** 唯一滤镜 ID 发生器。 */
const rawId = useId()

/** 实时容器尺寸。 */
const dimensions = reactive({
  width: 0,
  height: 0
})

/** ResizeObserver 实例。 */
let observer: ResizeObserver | null = null

// -- Functions: Physics Deform Setup

// 挂载物理弹簧阻尼引擎（当 interactive 为 true 时生效）
useSpringDeform(liquidGlassRoot, {
  disabled: () => !props.interactive
})

// -- Derived Values

/** 当前变体是否需要运行 SVG 置换滤镜。 */
const needsDisplacementFilter = computed(() => {
  return props.variant === 'full' || props.variant === 'dialog'
})

/** 当前标准尺寸对应的 Squircle 圆角半径 (Dialog 变体默认放大到 40px)。 */
const squircleRadius = computed(() => {
  if (props.variant === 'dialog') {
    return 40
  }
  return SQUIRCLE_RADIUS_BY_SIZE[props.squircleSize]
})

/** 唯一滤镜 ID。 */
const filterId = computed(() => `ncx-liquid-glass-${rawId.replace(/:/g, '')}`)

/** 解析染色样式。 */
const resolvedTint = computed<string | undefined>(() => {
  if (!props.tint) return undefined
  if (props.tint === 'primary') return 'var(--ncx-liquid-glass-tint-primary)'
  if (props.tint === 'accent') return 'var(--ncx-liquid-glass-tint-accent)'
  if (props.tint === 'danger') return 'var(--ncx-liquid-glass-tint-danger)'
  return props.tint
})

/** 外层容器样式。 */
const baseStyle = computed(() => {
  const isDialog = props.variant === 'dialog'

  const effectiveBlur = isDialog ? Math.max(16, props.backdropBlur) : props.backdropBlur
  const effectiveDarkBlur = isDialog ? Math.max(18, props.darkBackdropBlur) : props.darkBackdropBlur
  const effectiveSaturation = isDialog ? 1.6 : props.saturation
  const effectiveFrost = isDialog ? 0.35 : props.frost
  const effectiveDarkFrost = isDialog ? 0.45 : props.darkFrost

  return {
    '--liquid-glass-filter': needsDisplacementFilter.value ? `url(#${filterId.value})` : 'none',
    '--liquid-glass-frost-light': effectiveFrost,
    '--liquid-glass-frost-dark': effectiveDarkFrost,
    '--liquid-glass-blur-light': `${effectiveBlur}px`,
    '--liquid-glass-blur-dark': `${effectiveDarkBlur}px`,
    '--liquid-glass-saturation-light': effectiveSaturation,
    '--liquid-glass-saturation-dark': props.darkSaturation,
    '--liquid-glass-brightness-light': props.brightness,
    '--liquid-glass-brightness-dark': props.darkBrightness,
    '--liquid-glass-tint': resolvedTint.value ?? 'transparent',
    borderRadius: isDialog ? '40px' : `var(--ncx-squircle-radius-${props.squircleSize})`,
    '-electron-corner-smoothing': 'var(--ncx-squircle-smoothing)'
  }
})

/** 实时生成的 displacement SVG。 */
const displacementImage = computed(() => {
  if (!needsDisplacementFilter.value) return ''

  const safeWidth = Math.max(1, dimensions.width)
  const safeHeight = Math.max(1, dimensions.height)
  const border = Math.min(safeWidth, safeHeight) * (props.border * 0.5)
  const yBorder = Math.min(safeWidth, safeHeight) * (props.border * 0.5)

  return `
    <svg viewBox="0 0 ${safeWidth} ${safeHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="red" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="red"/>
        </linearGradient>
        <linearGradient id="blue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${safeWidth}" height="${safeHeight}" fill="black"></rect>
      <rect x="0" y="0" width="${safeWidth}" height="${safeHeight}" rx="${squircleRadius.value}" fill="url(#red)" />
      <rect x="0" y="0" width="${safeWidth}" height="${safeHeight}" rx="${squircleRadius.value}" fill="url(#blue)" style="mix-blend-mode: ${props.blend}" />
      <rect
        x="${border}"
        y="${yBorder}"
        width="${safeWidth - border * 2}"
        height="${safeHeight - border * 2}"
        rx="${squircleRadius.value}"
        fill="hsl(0 0% ${props.lightness}% / ${props.alpha})"
        style="filter:blur(${props.blur}px)"
      />
    </svg>
  `
})

/** displacement SVG 的 data URI。 */
const displacementDataUri = computed(() => {
  if (!needsDisplacementFilter.value) return ''
  return `data:image/svg+xml,${encodeURIComponent(displacementImage.value)}`
})

// -- Functions: ResizeObserver

function mountResizeObserver(): void {
  if (!liquidGlassRoot.value) return

  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return

    if (entry.borderBoxSize?.length) {
      dimensions.width = entry.borderBoxSize[0]?.inlineSize ?? 0
      dimensions.height = entry.borderBoxSize[0]?.blockSize ?? 0
      return
    }

    dimensions.width = entry.contentRect.width
    dimensions.height = entry.contentRect.height
  })

  observer.observe(liquidGlassRoot.value)
}

function unmountResizeObserver(): void {
  observer?.disconnect()
  observer = null
}

// -- Lifecycle Hooks

onMounted(() => {
  mountResizeObserver()
})

onUnmounted(() => {
  unmountResizeObserver()
})
</script>

<template>
  <div
    ref="liquidGlassRoot"
    :style="baseStyle"
    :class="[
      'ncx-liquid-glass',
      'effect',
      `ncx-liquid-glass--${props.variant}`,
      props.interactive && 'ncx-liquid-glass--interactive',
      props.containerClass
    ]"
  >
    <div :class="['slot-container', props.class]">
      <slot />
    </div>

    <!-- 仅在 full 与 dialog 变体时挂载 SVG 位移滤镜，避免轻量级模式产生无谓消耗 -->
    <svg
      v-if="needsDisplacementFilter"
      class="filter"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter
          :id="filterId"
          color-interpolation-filters="sRGB"
        >
          <feImage
            x="0"
            y="0"
            width="100%"
            height="100%"
            :href="displacementDataUri"
            result="map"
          />
          <feDisplacementMap
            id="redchannel"
            in="SourceGraphic"
            in2="map"
            :xChannelSelector="props.xChannel"
            :yChannelSelector="props.yChannel"
            :scale="props.scale + props.rOffset"
            result="dispRed"
          />
          <feColorMatrix
            in="dispRed"
            type="matrix"
            values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="red"
          />
          <feDisplacementMap
            id="greenchannel"
            in="SourceGraphic"
            in2="map"
            :xChannelSelector="props.xChannel"
            :yChannelSelector="props.yChannel"
            :scale="props.scale + props.gOffset"
            result="dispGreen"
          />
          <feColorMatrix
            in="dispGreen"
            type="matrix"
            values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="green"
          />
          <feDisplacementMap
            id="bluechannel"
            in="SourceGraphic"
            in2="map"
            :xChannelSelector="props.xChannel"
            :yChannelSelector="props.yChannel"
            :scale="props.scale + props.bOffset"
            result="dispBlue"
          />
          <feColorMatrix
            in="dispBlue"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"
            result="blue"
          />
          <feBlend
            in="red"
            in2="green"
            mode="screen"
            result="rg"
          />
          <feBlend
            in="rg"
            in2="blue"
            mode="screen"
            result="output"
          />
          <feGaussianBlur :stdDeviation="props.displace" />
        </filter>
      </defs>
    </svg>
  </div>
</template>

<style scoped>
.effect {
  --liquid-glass-current-frost: var(--liquid-glass-frost-light);
  --liquid-glass-current-blur: var(--liquid-glass-blur-light);
  --liquid-glass-current-saturation: var(--liquid-glass-saturation-light);
  --liquid-glass-current-brightness: var(--liquid-glass-brightness-light);
  --liquid-glass-surface-rgb: 255 255 255;
  --liquid-glass-edge-highlight: rgb(255 255 255 / 58%);
  --liquid-glass-sheen: rgb(255 255 255 / 16%);
  --liquid-glass-lowlight: rgb(60 66 78 / 10%);

  position: relative;
  display: inline-block;
  opacity: 1;
  border-radius: inherit;
  backdrop-filter:
    blur(var(--liquid-glass-current-blur))
    saturate(var(--liquid-glass-current-saturation))
    brightness(var(--liquid-glass-current-brightness))
    var(--liquid-glass-filter);
  background:
    linear-gradient(var(--liquid-glass-tint), var(--liquid-glass-tint)),
    rgb(var(--liquid-glass-surface-rgb) / var(--liquid-glass-current-frost));
  box-shadow: 0 8px 30px rgb(35 38 45 / 12%);
  isolation: isolate;
  will-change: transform;
}

/* 触控交互形变集成 */
.ncx-liquid-glass--interactive {
  transform: translate(var(--ncx-liquid-tx, 0), var(--ncx-liquid-ty, 0))
    scale(var(--ncx-liquid-sx, 1), var(--ncx-liquid-sy, 1));
  transition: transform 0.04s linear;
  touch-action: none;
}

/* 轻量级模式：去除置换滤镜与重绘开销 */
.ncx-liquid-glass--lightweight {
  backdrop-filter:
    blur(var(--liquid-glass-current-blur))
    saturate(var(--liquid-glass-current-saturation));
}

/* 模态 Dialog 专属深度材质 */
.ncx-liquid-glass--dialog {
  box-shadow:
    0 24px 60px rgb(0 0 0 / 30%),
    var(--ncx-liquid-glass-inner-shadow);
}

/* 菲涅尔高光边缘伪元素 */
.effect::before {
  position: absolute;
  z-index: 0;
  padding: 1px;
  border-radius: inherit;
  background:
    radial-gradient(85% 120% at 16% 0%, var(--liquid-glass-edge-highlight), transparent 72%),
    radial-gradient(85% 120% at 84% 100%, var(--liquid-glass-lowlight), transparent 72%);
  content: '';
  inset: 0;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
}

/* 表面反光 Sheen */
.effect::after {
  position: absolute;
  z-index: 0;
  border-radius: inherit;
  background: radial-gradient(105% 80% at 18% -24%, var(--liquid-glass-sheen), transparent 66%);
  content: '';
  inset: 1px;
  pointer-events: none;
}

.slot-container {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
}

.filter {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

:global(:root[data-theme='dark'] .ncx-liquid-glass) {
  --liquid-glass-current-frost: var(--liquid-glass-frost-dark);
  --liquid-glass-current-blur: var(--liquid-glass-blur-dark);
  --liquid-glass-current-saturation: var(--liquid-glass-saturation-dark);
  --liquid-glass-current-brightness: var(--liquid-glass-brightness-dark);
  --liquid-glass-surface-rgb: 8 10 16;
  --liquid-glass-edge-highlight: rgb(255 255 255 / 24%);
  --liquid-glass-sheen: rgb(255 255 255 / 8%);
  --liquid-glass-lowlight: rgb(0 0 0 / 34%);
}

@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .ncx-liquid-glass) {
    --liquid-glass-current-frost: var(--liquid-glass-frost-dark);
    --liquid-glass-current-blur: var(--liquid-glass-blur-dark);
    --liquid-glass-current-saturation: var(--liquid-glass-saturation-dark);
    --liquid-glass-current-brightness: var(--liquid-glass-brightness-dark);
    --liquid-glass-surface-rgb: 8 10 16;
    --liquid-glass-edge-highlight: rgb(255 255 255 / 24%);
    --liquid-glass-sheen: rgb(255 255 255 / 8%);
    --liquid-glass-lowlight: rgb(0 0 0 / 34%);
  }
}
</style>
