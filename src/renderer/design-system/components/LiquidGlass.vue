<script setup lang="ts">
// ==========================================
// Inspira UI - LiquidGlass 组件
//
// 基于 SVG displacement map 与 backdrop-filter 的液态玻璃材质。
// 滤镜只作用在背景层，内容层保持原始清晰度。
// ==========================================

import { computed, useId } from 'vue'

// ========= 类型定义 =========

/** LiquidGlass 组件属性接口 */
export interface LiquidGlassProps {
  /** 玻璃容器圆角半径（像素） */
  radius?: number
  /** 相对边框厚度（影响滤镜内边距） */
  border?: number
  /** HSL 亮度 (0-100) */
  lightness?: number
  /** CSS 混合模式 (如 "difference") */
  blend?: string
  /** 水平置换通道 ('R' | 'G' | 'B') */
  xChannel?: 'R' | 'G' | 'B'
  /** 垂直置换通道 ('R' | 'G' | 'B') */
  yChannel?: 'R' | 'G' | 'B'
  /** 叠加层透明度 (0-1) */
  alpha?: number
  /** 高斯模糊半径 */
  blur?: number
  /** 红色置换通道偏移 */
  rOffset?: number
  /** 绿色置换通道偏移 */
  gOffset?: number
  /** 蓝色置换通道偏移 */
  bOffset?: number
  /** 基础置换缩放系数 */
  scale?: number
  /** 磨砂玻璃背景叠加强度 (0-1) */
  frost?: number
  /** 内容 slot 容器附加类名 */
  class?: string
  /** 外层 container 附加类名 */
  containerClass?: string
}

// ========= 变量 =========

/** 组件默认属性定义 */
const props = withDefaults(defineProps<LiquidGlassProps>(), {
  radius: 16,
  border: 0.07,
  lightness: 50,
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

/** 产生唯一 SVG 滤镜 ID */
const rawId = useId()

/** SVG displacement map 的基准画布尺寸。 */
const DISPLACEMENT_MAP_SIZE = 100

/** backdrop-filter 的饱和度倍率，稳定模拟玻璃对背景的增强。 */
const BACKDROP_SATURATION = 180

// ========= 计算属性 =========

/** 格式化后的滤镜 ID */
const filterId = computed(() => `inspira-liquid-glass-${rawId.replace(/:/g, '')}`)

/** 容器圆角样式 */
const borderRadiusStyle = computed(() => `${props.radius}px`)

/** 边缘折射带宽度；限定在合理范围内避免大圆角时产生撕裂。 */
const borderInset = computed(() => {
  return clamp(props.border, 0.01, 0.45) * DISPLACEMENT_MAP_SIZE
})

/** SVG map 内的圆角百分比。 */
const mapRadius = computed(() => {
  return clamp((props.radius / DISPLACEMENT_MAP_SIZE) * 100, 0, 50)
})

/** CSS 玻璃背景颜色，按文档 lightness / alpha 映射到 HSL。 */
const glassTint = computed(() => {
  return `hsl(0 0% ${clamp(props.lightness, 0, 100)}% / ${clamp(props.alpha, 0, 1)})`
})

/** CSS 磨砂底色，按文档 frost 控制强度。 */
const frostTint = computed(() => {
  return `hsl(0 0% ${clamp(props.lightness, 0, 100)}% / ${clamp(props.frost, 0, 1)})`
})

/** 组件根节点样式，注入滤镜和玻璃材质变量。 */
const containerStyle = computed(() => {
  return {
    borderRadius: borderRadiusStyle.value,
    '--inspira-liquid-glass-filter': `url(#${filterId.value})`,
    '--inspira-liquid-glass-radius': borderRadiusStyle.value,
    '--inspira-liquid-glass-blur': `${Math.max(0, props.blur)}px`,
    '--inspira-liquid-glass-saturation': `${BACKDROP_SATURATION}%`,
    '--inspira-liquid-glass-tint': glassTint.value,
    '--inspira-liquid-glass-frost': frostTint.value
  }
})

/** SVG displacement map 的 data URI，供 feImage 稳定引用。 */
const displacementMapHref = computed(() => {
  const inset = borderInset.value
  const innerSize = DISPLACEMENT_MAP_SIZE - inset * 2
  const innerRadius = Math.max(0, mapRadius.value - inset)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DISPLACEMENT_MAP_SIZE} ${DISPLACEMENT_MAP_SIZE}">
      <defs>
        <linearGradient id="red" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgb(255,0,0)" />
          <stop offset="50%" stop-color="rgb(128,0,0)" />
          <stop offset="100%" stop-color="rgb(0,0,0)" />
        </linearGradient>
        <linearGradient id="blue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgb(0,0,255)" />
          <stop offset="50%" stop-color="rgb(0,0,128)" />
          <stop offset="100%" stop-color="rgb(0,0,0)" />
        </linearGradient>
        <mask id="edge">
          <rect width="100" height="100" rx="${mapRadius.value}" fill="white" />
          <rect x="${inset}" y="${inset}" width="${innerSize}" height="${innerSize}" rx="${innerRadius}" fill="black" />
        </mask>
      </defs>
      <rect width="100" height="100" fill="rgb(128,128,128)" />
      <rect width="100" height="100" rx="${mapRadius.value}" fill="url(#red)" mask="url(#edge)" />
      <rect width="100" height="100" rx="${mapRadius.value}" fill="url(#blue)" mask="url(#edge)" opacity="0.82" style="mix-blend-mode:${props.blend}" />
    </svg>
  `

  return `data:image/svg+xml,${encodeSvg(svg)}`
})

// ========= 函数 =========

/**
 * 把数值限制在指定闭区间。
 *
 * @param value 待限制的数值
 * @param min 最小值
 * @param max 最大值
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 压缩并转义 SVG 字符串，生成可放入 feImage href 的 data URI 内容。
 *
 * @param svg 未压缩的 SVG 字符串
 */
function encodeSvg(svg: string): string {
  return encodeURIComponent(svg.replace(/\s+/g, ' ').trim())
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
    .replace(/%22/g, "'")
}
</script>

<template>
  <div
    :class="['inspira-liquid-glass-container', props.containerClass]"
    :style="containerStyle"
  >
    <!-- SVG 滤镜定义（非渲染节点） -->
    <svg
      class="inspira-liquid-glass-svg-defs"
      aria-hidden="true"
    >
      <defs>
        <filter
          :id="filterId"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          filterUnits="objectBoundingBox"
        >
          <feImage
            x="0"
            y="0"
            width="100%"
            height="100%"
            result="DISPLACEMENT_MAP"
            :href="displacementMapHref"
            preserveAspectRatio="none"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="props.scale + props.rOffset"
            :xChannelSelector="props.xChannel"
            :yChannelSelector="props.yChannel"
            result="RED_DISPLACED"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="props.scale + props.gOffset"
            :xChannelSelector="props.xChannel"
            :yChannelSelector="props.yChannel"
            result="GREEN_DISPLACED"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            :scale="props.scale + props.bOffset"
            :xChannelSelector="props.xChannel"
            :yChannelSelector="props.yChannel"
            result="BLUE_DISPLACED"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />
          <feBlend
            in="RED_CHANNEL"
            in2="GREEN_CHANNEL"
            :mode="props.blend"
            result="RED_GREEN_CHANNELS"
          />
          <feBlend
            in="RED_GREEN_CHANNELS"
            in2="BLUE_CHANNEL"
            :mode="props.blend"
          />
        </filter>
      </defs>
    </svg>

    <!-- backdrop-filter 层：只折射背景，不影响内容可读性。 -->
    <div
      class="inspira-liquid-glass-backdrop"
      :style="{
        borderRadius: borderRadiusStyle
      }"
    />

    <!-- 高光与边缘描边层：模拟液态玻璃边界聚光。 -->
    <div
      class="inspira-liquid-glass-highlight"
      :style="{
        borderRadius: borderRadiusStyle
      }"
    />

    <!-- 内容区域 Slot -->
    <div :class="['inspira-liquid-glass-content', props.class]">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.inspira-liquid-glass-container {
  position: relative;
  isolation: isolate;
  overflow: visible;
}

.inspira-liquid-glass-svg-defs {
  position: absolute;
  top: -9999px;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
  pointer-events: none;
}

.inspira-liquid-glass-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 52%), rgb(255 255 255 / 12%) 46%, rgb(255 255 255 / 30%)),
    var(--ncx-player-bar-glass-fill, var(--inspira-liquid-glass-frost));
  backdrop-filter:
    var(--inspira-liquid-glass-filter)
    blur(var(--inspira-liquid-glass-blur))
    saturate(var(--inspira-liquid-glass-saturation));
  -webkit-backdrop-filter:
    blur(var(--inspira-liquid-glass-blur))
    saturate(var(--inspira-liquid-glass-saturation));
  border: 1px solid var(--ncx-player-bar-glass-stroke, rgb(255 255 255 / 46%));
  box-shadow: var(
    --ncx-player-bar-glass-shadow,
    0 16px 36px rgb(0 0 0 / 15%),
    0 4px 12px rgb(0 0 0 / 6%),
    inset 0 1px 0 0 rgb(255 255 255 / 80%),
    inset 0 -1px 0 0 rgb(0 0 0 / 5%)
  );
  transition: backdrop-filter 0.3s ease, background-color 0.3s ease;
}

.inspira-liquid-glass-backdrop::before {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
  background: var(--inspira-liquid-glass-tint);
  mix-blend-mode: soft-light;
  opacity: 0.38;
}

.inspira-liquid-glass-highlight {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 44%),
    inset 0 1.5px 2.5px rgb(255 255 255 / 66%),
    inset 0 -1.5px 2.5px rgb(0 0 0 / 8%);
}

.inspira-liquid-glass-highlight::before,
.inspira-liquid-glass-highlight::after {
  position: absolute;
  pointer-events: none;
  content: "";
}

.inspira-liquid-glass-highlight::before {
  inset: 1px;
  background:
    linear-gradient(120deg, rgb(255 255 255 / 70%) 0%, transparent 28%),
    radial-gradient(circle at 18% 0%, rgb(255 255 255 / 52%), transparent 38%);
  opacity: 0.58;
}

.inspira-liquid-glass-highlight::after {
  right: 14%;
  bottom: -38%;
  width: 46%;
  height: 70%;
  border-radius: 50%;
  background: rgb(255 255 255 / 30%);
  filter: blur(22px);
  opacity: 0.42;
}

.inspira-liquid-glass-content {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .inspira-liquid-glass-backdrop {
    background:
      linear-gradient(135deg, rgb(255 255 255 / 72%), rgb(255 255 255 / 44%)),
      var(--inspira-liquid-glass-frost);
  }
}
</style>
