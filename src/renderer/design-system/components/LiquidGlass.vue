<script setup lang="ts">
// ==========================================
// Inspira UI - LiquidGlass 组件
//
// 基于 SVG 滤镜与 CSS Glassmorphism 实现的高光流体玻璃拟态效果组件。
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
  radius: 33,
  border: 0.07,
  lightness: 78,
  blend: 'difference',
  xChannel: 'R',
  yChannel: 'B',
  alpha: 0.82,
  blur: 24,
  rOffset: 0,
  gOffset: 10,
  bOffset: 20,
  scale: -20,
  frost: 0.15,
  class: '',
  containerClass: ''
})

/** 产生唯一 SVG 滤镜 ID */
const rawId = useId()

// ========= 计算属性 =========

/** 格式化后的滤镜 ID */
const filterId = computed(() => `inspira-liquid-glass-${rawId.replace(/:/g, '')}`)

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
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
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
        </filter>
      </defs>
    </svg>

    <!-- 玻璃表面高光与底图覆盖层 -->
    <div
      class="inspira-liquid-glass-backdrop"
      :style="{
        borderRadius: borderRadiusStyle
      }"
    />

    <!-- 液态玻璃边缘折射与光泽层 -->
    <div
      class="inspira-liquid-glass-refraction"
      :style="{
        borderRadius: borderRadiusStyle,
        filter: `url(#${filterId})`
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
  z-index: -1;
  pointer-events: none;
  background-color: var(--ncx-player-bar-glass-fill, color-mix(in srgb, var(--ncx-color-surface-overlay, #fff) 82%, transparent));
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--ncx-player-bar-glass-stroke, color-mix(in srgb, white 60%, transparent));
  box-shadow: var(
    --ncx-player-bar-glass-shadow,
    0 16px 36px rgb(0 0 0 / 15%),
    0 4px 12px rgb(0 0 0 / 6%),
    inset 0 1px 0 0 rgb(255 255 255 / 80%),
    inset 0 -1px 0 0 rgb(0 0 0 / 5%)
  );
  transition: backdrop-filter 0.3s ease, background-color 0.3s ease;
}

.inspira-liquid-glass-refraction {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border: 1.5px solid color-mix(in srgb, white 40%, transparent);
  box-shadow:
    inset 0 1.5px 3px rgb(255 255 255 / 50%),
    inset 0 -1.5px 3px rgb(0 0 0 / 10%);
  opacity: 0.85;
}

.inspira-liquid-glass-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}
</style>
