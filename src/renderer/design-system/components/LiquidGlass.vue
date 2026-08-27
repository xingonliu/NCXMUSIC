<script setup lang="ts">
// ==========================================
// Inspira UI - LiquidGlass 组件
//
// 基于 Inspira registry 的 LiquidGlass.vue 适配：
// 使用 ResizeObserver 生成实时 displacement map，并通过 backdrop-filter 应用。
// ==========================================

import { computed, onMounted, onUnmounted, reactive, ref, useId, type HTMLAttributes } from 'vue'

// ========= 类型定义 =========

/** LiquidGlass 组件属性接口。 */
export interface LiquidGlassProps {
  /** 玻璃容器使用的标准 Squircle 尺寸。 */
  squircleSize?: LiquidGlassSquircleSize
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
  /** 内容容器附加 class。 */
  class?: HTMLAttributes['class']
  /** 外层容器附加 class。 */
  containerClass?: HTMLAttributes['class']
}

/** LiquidGlass 可用的标准 Squircle 尺寸。 */
export type LiquidGlassSquircleSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

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

/** 组件默认属性定义，圆角尺寸使用 Ncxmusic 标准阶梯。 */
const props = withDefaults(defineProps<LiquidGlassProps>(), {
  squircleSize: 'lg',
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
  class: '',
  containerClass: ''
})

/** 组件根元素引用，用于 ResizeObserver 获取真实尺寸。 */
const liquidGlassRoot = ref<HTMLElement | null>(null)

/** 组件实例 ID，用于生成唯一 SVG filter id。 */
const rawId = useId()

/** 组件实时尺寸，用于生成与容器等大的 displacement map。 */
const dimensions = reactive({
  /** 当前玻璃容器宽度。 */
  width: 0,
  /** 当前玻璃容器高度。 */
  height: 0
})

/** ResizeObserver 实例，挂载后开始观察容器尺寸。 */
let observer: ResizeObserver | null = null

// -- Derived Values

/** 当前标准尺寸对应的 Squircle 圆角半径。 */
const squircleRadius = computed(() => SQUIRCLE_RADIUS_BY_SIZE[props.squircleSize])

/** 唯一滤镜 ID，避免多实例共享固定 id 导致串扰。 */
const filterId = computed(() => `inspira-liquid-glass-${rawId.replace(/:/g, '')}`)

/** 外层容器基础样式，注入 Inspira 组件需要的 CSS 变量。 */
const baseStyle = computed(() => {
  return {
    '--frost': props.frost,
    '--liquid-glass-filter': `url(#${filterId.value})`,
    '-electron-corner-smoothing': 'var(--ncx-squircle-smoothing)',
    borderRadius: `var(--ncx-squircle-radius-${props.squircleSize})`
  }
})

/** 实时生成的 displacement SVG，与 Inspira registry 组件结构保持一致。 */
const displacementImage = computed(() => {
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

/** displacement SVG 的 data URI，供 feImage 引用。 */
const displacementDataUri = computed(() => {
  return `data:image/svg+xml,${encodeURIComponent(displacementImage.value)}`
})

// -- Functions

/** 建立 ResizeObserver 并同步玻璃容器尺寸。 */
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

/** 断开 ResizeObserver，避免组件卸载后继续监听。 */
function unmountResizeObserver(): void {
  observer?.disconnect()
  observer = null
}

// -- Lifecycle Hooks

/** 组件挂载后开始读取真实尺寸。 */
onMounted(() => {
  mountResizeObserver()
})

/** 组件卸载时释放 ResizeObserver。 */
onUnmounted(() => {
  unmountResizeObserver()
})
</script>

<template>
  <div
    ref="liquidGlassRoot"
    :style="baseStyle"
    :class="['effect', props.containerClass]"
  >
    <div :class="['slot-container', props.class]">
      <slot />
    </div>

    <svg
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
  position: fixed;
  display: block;
  opacity: 1;
  border-radius: inherit;
  backdrop-filter: var(--liquid-glass-filter);
  background: light-dark(hsl(0 0% 100% / var(--frost, 0)), hsl(0 0% 0% / var(--frost, 0)));
  box-shadow:
    0 0 2px 1px
      light-dark(
        color-mix(in oklch, canvasText, #0000 85%),
        color-mix(in oklch, canvasText, #0000 90%)
      )
      inset,
    0 0 10px 4px
      light-dark(
        color-mix(in oklch, canvasText, #0000 90%),
        color-mix(in oklch, canvasText, #0000 95%)
      )
      inset,
    0 4px 16px rgb(17 17 26 / 5%),
    0 8px 24px rgb(17 17 26 / 5%),
    0 16px 56px rgb(17 17 26 / 5%),
    0 4px 16px rgb(17 17 26 / 5%) inset,
    0 8px 24px rgb(17 17 26 / 5%) inset,
    0 16px 56px rgb(17 17 26 / 5%) inset;
}

.slot-container {
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
</style>
