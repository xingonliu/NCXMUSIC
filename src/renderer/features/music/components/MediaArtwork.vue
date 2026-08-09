<script setup lang="ts">
import { Music2 } from '@lucide/vue'
import { computed } from 'vue'

import { adaptArtworkUrl, type MediaArtworkSize } from '../music-entity'

// ========= 属性 =========

/** 封面组件属性。 */
const props = withDefaults(defineProps<{
  /** 原始封面 URL。 */
  src: string | undefined
  /** 图片替代文本。 */
  alt: string
  /** 封面语义尺寸。 */
  size?: MediaArtworkSize
  /** 是否根据语义尺寸改写远程封面 URL。 */
  adaptSource?: boolean
  /** 浏览器图片加载优先级。 */
  loading?: 'eager' | 'lazy'
}>(), {
  size: 'compact',
  adaptSource: true,
  loading: 'lazy'
})

// ========= 变量 =========

/** 已按语义尺寸适配的图片地址。 */
const artworkUrl = computed<string | undefined>(() => {
  return props.adaptSource ? adaptArtworkUrl(props.src, props.size) : props.src
})
</script>

<template>
  <figure
    class="media-artwork"
    :class="`media-artwork--${props.size}`"
  >
    <img
      v-if="artworkUrl"
      :src="artworkUrl"
      :alt="props.alt"
      :loading="props.loading"
      decoding="async"
    >
    <Music2
      v-else
      class="media-artwork-placeholder"
      :size="props.size === 'hero' ? 54 : 22"
      aria-hidden="true"
    />
  </figure>
</template>

<style scoped>
.media-artwork {
  display: inline-flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin: 0;
  border-radius: var(--ncx-radius-md);
  color: var(--ncx-color-text-tertiary);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--ncx-color-accent) 18%, transparent), transparent),
    var(--ncx-color-surface-raised);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ncx-color-text-primary) 7%, transparent);
}

.media-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-artwork--thumbnail {
  width: 36px;
  height: 36px;
  border-radius: var(--ncx-radius-sm);
}

.media-artwork--compact {
  width: 48px;
  height: 48px;
}

.media-artwork--card {
  width: 118px;
  height: 118px;
  border-radius: var(--ncx-radius-lg);
}

.media-artwork--feature {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  border-radius: var(--ncx-radius-lg);
}

.media-artwork--hero {
  width: min(34vw, 360px);
  height: min(34vw, 360px);
  min-width: 220px;
  min-height: 220px;
  border-radius: var(--ncx-radius-xl);
  box-shadow: var(--ncx-shadow-elevation-3);
}

.media-artwork-placeholder {
  opacity: 0.76;
}
</style>
