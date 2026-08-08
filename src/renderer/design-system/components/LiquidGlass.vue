<script setup lang="ts">
// ==========================================
// Inspira UI - LiquidGlass 组件
//
// 基于 SVG 置换滤镜（feDisplacementMap）实现的高光流体玻璃拟态效果组件。
// 参考 Apple Liquid Glass 视觉效果。
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

// ========= 计算属性 =========

/** 格式化后的滤镜 ID */
const filterId = computed(() => `inspira-liquid-glass-${rawId.replace(/:/g, '')}`)

/** HSL 叠加层颜色 */
const overlayColor = computed(() => `hsla(0, 0%, ${props.lightness}%, ${props.frost})`)

/** 容器圆角样式 */
const borderRadiusStyle = computed(() => `${props.radius}px`)
</script>

<template>
  <div
    :class="['inspira-liquid-glass-container', props.containerClass]"
    :style="{ borderRadius: borderRadiusStyle }"
  >
    <!-- SVG 滤镜定义（非渲染节点） -->
    <svg
      class="inspira-liquid-glass-svg-defs"
      aria-hidden="true"
    >
      <defs>
        <filter
          :id="filterId"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            :scale="props.scale"
            :xChannelSelector="props.xChannel"
            :yChannelSelector="props.yChannel"
            result="displaced"
          />
          <feGaussianBlur
            in="displaced"
            :stdDeviation="props.blur"
            result="blurred"
          />
        </filter>
      </defs>
    </svg>

    <!-- 玻璃表面高光与底图覆盖层 -->
    <div
      class="inspira-liquid-glass-backdrop"
      :style="{
        borderRadius: borderRadiusStyle,
        backgroundColor: overlayColor,
        backdropFilter: `url(#${filterId}) blur(${props.blur}px)`,
        WebkitBackdropFilter: `url(#${filterId}) blur(${props.blur}px)`
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
  overflow: hidden;
}

.inspira-liquid-glass-svg-defs {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  opacity: 0;
}

.inspira-liquid-glass-backdrop {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border: 1px solid color-mix(in srgb, white 20%, transparent);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 30%),
    inset 0 -1px 1px rgb(0 0 0 / 15%),
    0 12px 32px rgb(0 0 0 / 18%);
  transition: backdrop-filter 0.3s ease, background-color 0.3s ease;
}

.inspira-liquid-glass-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}
</style>
