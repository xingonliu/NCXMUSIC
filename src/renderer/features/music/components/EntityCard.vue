<script setup lang="ts">
import { computed } from 'vue'

import Cover from './Cover.vue'

// ========= 属性与事件 =========

/** 音乐实体卡片属性。 */
const props = defineProps<{
  /** 实体标题。 */
  title: string
  /** 实体补充文案。 */
  subtitle?: string | undefined
  /** 实体原始封面地址。 */
  artworkUrl?: string | undefined
  /** 是否采用重点推荐封面。 */
  featured?: boolean
}>()

/** 实体卡片激活事件。 */
const emit = defineEmits<{
  (event: 'activate'): void
}>()

// ========= 变量 =========

/** 当前卡片使用的封面语义尺寸。 */
const artworkSize = computed<'card' | 'feature'>(() => (props.featured ? 'feature' : 'card'))

// ========= 函数 =========

/** 激活当前实体卡片。 */
function activateCard(): void {
  emit('activate')
}
</script>

<template>
  <article
    class="music-entity-card"
    role="button"
    tabindex="0"
    @click="activateCard"
    @keydown.enter.prevent="activateCard"
    @keydown.space.prevent="activateCard"
  >
    <Cover
      :src="props.artworkUrl"
      :alt="props.title"
      :size="artworkSize"
      :hover-effect="true"
      @play="activateCard"
    />
    <div class="music-entity-card-copy">
      <h3>{{ props.title }}</h3>
      <p v-if="props.subtitle">{{ props.subtitle }}</p>
    </div>
  </article>
</template>

<style scoped>
.music-entity-card {
  display: grid;
  min-width: 0;
  gap: var(--ncx-space-3);
  cursor: pointer;
}

.music-entity-card:focus-visible {
  border-radius: var(--ncx-radius-lg);
  outline: 2px solid var(--ncx-color-accent);
  outline-offset: 4px;
}

.music-entity-card-copy {
  min-width: 0;
}

.music-entity-card h3,
.music-entity-card p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-entity-card h3 {
  font-size: 14px;
  line-height: 1.35;
}

.music-entity-card p {
  margin-top: 3px;
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
}
</style>
