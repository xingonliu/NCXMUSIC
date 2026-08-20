<script setup lang="ts">
import { Music2, Play } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { adaptArtworkUrl, type MediaArtworkSize } from '../music-entity'

/** 为单词文件名提供符合 Vue 规范的多词组件名。 */
defineOptions({ name: 'MusicCover' })

// ========= 类型与属性 =========

/** 封面组件属性。 */
const props = withDefaults(
  defineProps<{
    /** 封面图片 URL。 */
    src?: string | undefined
    /** 图片替代文案。 */
    alt?: string
    /** 封面语义尺寸。 */
    size?: MediaArtworkSize
    /** 封面形状形态。'square' 为常规圆角方形，'circle' 为歌手圆形。 */
    shape?: 'square' | 'circle'
    /** 是否启用 Hover 彩色阴影与微移特效。 */
    hoverEffect?: boolean
    /** 是否常显彩色阴影。为 true 时默认显示彩色阴影，否则只在 hover 时显示。 */
    alwaysShowShadow?: boolean
    /** 是否在 Hover 时显示悬浮播放按钮。 */
    showPlayButton?: boolean
  }>(),
  {
    alt: '',
    size: 'feature',
    shape: 'square',
    hoverEffect: true,
    alwaysShowShadow: false,
    showPlayButton: true
  }
)

/** 封面触发事件。 */
const emit = defineEmits<{
  (event: 'click', e: MouseEvent): void
  (event: 'play', e: MouseEvent): void
}>()

// ========= 变量 =========

/** 焦点/鼠标移入状态。 */
const isHovered = ref<boolean>(false)

/** 适配后的图片加载完整地址。 */
const artworkUrl = computed<string | undefined>(() => adaptArtworkUrl(props.src, props.size))

/** 当前封面地址是否已经触发图片加载错误。 */
const artworkLoadFailed = ref<boolean>(false)

/** 当前能够安全渲染的封面地址。 */
const displayArtworkUrl = computed<string | undefined>(() => {
  return artworkLoadFailed.value ? undefined : artworkUrl.value
})

/** 阴影层样式，复用同源图片 URL 实现 YesPlayMusic 的彩色光晕阴影。 */
const shadowStyles = computed<Record<string, string>>(() => {
  if (!displayArtworkUrl.value) return {}
  const styles: Record<string, string> = {
    backgroundImage: `url("${displayArtworkUrl.value}")`
  }
  if (props.shape === 'circle') {
    styles.borderRadius = '50%'
  }
  return styles
})

// ========= 函数 =========

/** 鼠标进入卡片。 */
function handleMouseEnter(): void {
  if (props.hoverEffect) {
    isHovered.value = true
  }
}

/** 鼠标离开卡片。 */
function handleMouseLeave(): void {
  if (props.hoverEffect) {
    isHovered.value = false
  }
}

/** 点击整个封面容器。 */
function handleClick(e: MouseEvent): void {
  emit('click', e)
}

/** 点击悬浮播放按钮。 */
function handlePlayClick(e: MouseEvent): void {
  e.stopPropagation()
  emit('play', e)
}

/** 图片加载失败后切换到纯灰占位封面。 */
function handleArtworkError(): void {
  artworkLoadFailed.value = true
}

// ========= 生命周期 =========

watch(artworkUrl, () => {
  artworkLoadFailed.value = false
})
</script>

<template>
  <figure
    class="ncx-cover"
    :class="[
      `ncx-cover--${props.size}`,
      `ncx-cover--${props.shape}`,
      {
        'is-hovered': isHovered,
        'has-hover-effect': props.hoverEffect,
        'always-show-shadow': props.alwaysShowShadow
      }
    ]"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
  >
    <!-- 封面主图展示框 -->
    <div class="ncx-cover-media">
      <img
        v-if="displayArtworkUrl"
        class="ncx-cover-img"
        :src="displayArtworkUrl"
        :alt="props.alt"
        loading="lazy"
        decoding="async"
        @error="handleArtworkError"
      >
      <div
        v-else
        class="ncx-cover-placeholder"
      >
        <Music2
          :size="props.size === 'hero' ? 56 : 28"
          aria-hidden="true"
        />
      </div>

      <!-- Hover 播放悬浮层（仅在 showPlayButton 为 true 时在 Hover/alwaysShowShadow 下显示） -->
      <div
        v-if="props.showPlayButton && (isHovered || props.alwaysShowShadow)"
        class="ncx-cover-shade"
      >
        <button
          type="button"
          class="ncx-cover-play-btn"
          :aria-label="$tSource('播放')"
          @click="handlePlayClick"
        >
          <Play
            class="ncx-cover-play-icon"
            fill="currentColor"
          />
        </button>
      </div>
    </div>

    <!-- YesPlayMusic 核心：彩色光晕阴影背板 -->
    <transition name="ncx-cover-fade">
      <div
        v-if="displayArtworkUrl && (isHovered || props.alwaysShowShadow)"
        class="ncx-cover-shadow"
        :style="shadowStyles"
        aria-hidden="true"
      />
    </transition>
  </figure>
</template>

<style scoped>
/* ========= 容器布局与尺寸 ========= */

.ncx-cover {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  flex-shrink: 0;
  margin: 0;
  cursor: pointer;
  user-select: none;
}

.ncx-cover-media {
  position: relative;
  z-index: 2;
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: var(--ncx-radius-lg);
  background: var(--ncx-color-surface-raised);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent);
  transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.ncx-cover--circle .ncx-cover-media {
  border-radius: 50%;
}

.ncx-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.ncx-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--ncx-color-text-tertiary);
  background: var(--ncx-color-surface-raised);
}

/* ========= 各种尺寸规范 ========= */

.ncx-cover--thumbnail {
  width: 36px;
  height: 36px;
}
.ncx-cover--thumbnail .ncx-cover-media {
  border-radius: var(--ncx-radius-sm);
}

.ncx-cover--compact {
  width: 48px;
  height: 48px;
}

.ncx-cover--card {
  width: 118px;
  height: 118px;
}

.ncx-cover--feature {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
}

.ncx-cover--hero {
  width: min(34vw, 360px);
  height: min(34vw, 360px);
  min-width: 220px;
  min-height: 220px;
}
.ncx-cover--hero .ncx-cover-media {
  border-radius: var(--ncx-radius-xl);
}
.ncx-cover--hero .ncx-cover-shadow {
  border-radius: var(--ncx-radius-xl);
}

/* ========= Hover 遮浮层与播放按钮 ========= */

.ncx-cover-shade {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.ncx-cover-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26%;
  height: 26%;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(8px);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.ncx-cover-play-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.ncx-cover-play-btn:active {
  transform: scale(0.94);
}

.ncx-cover-play-icon {
  width: 48%;
  height: 48%;
  margin-left: 2px;
}

/* ========= YesPlayMusic 彩色光晕阴影背板 (Shadow Layer) ========= */

.ncx-cover-shadow {
  position: absolute;
  top: 12px;
  left: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  border-radius: var(--ncx-radius-lg);
  background-position: center;
  background-size: cover;
  filter: blur(18px) opacity(0.68);
  transform: scale(0.92, 0.95) translateY(2px);
  pointer-events: none;
  transition: filter 0.3s ease, transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
}

.ncx-cover--circle .ncx-cover-shadow {
  border-radius: 50%;
}

/* ========= Hover 状态与常显 Hover 效果提升 ========= */

.ncx-cover.always-show-shadow .ncx-cover-media,
.ncx-cover.has-hover-effect:hover .ncx-cover-media {
  transform: translateY(-2px);
}

.ncx-cover.always-show-shadow .ncx-cover-shadow,
.ncx-cover.has-hover-effect:hover .ncx-cover-shadow {
  filter: blur(20px) opacity(0.85);
  transform: scale(0.96, 0.98) translateY(8px);
}

/* ========= Fade 动画 ========= */

.ncx-cover-fade-enter-active,
.ncx-cover-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.ncx-cover-fade-enter-from,
.ncx-cover-fade-leave-to {
  opacity: 0;
}
</style>
