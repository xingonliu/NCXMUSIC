<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'

import {
  CommonEmptyState,
  CommonErrorState,
  CommonIconButton,
  CommonSpinner
} from '../../../design-system/components'

// ========= 属性与事件 =========

/** 音乐页面独立 Section 属性。 */
const props = withDefaults(defineProps<{
  /** Section 稳定 ID。 */
  sectionId: string
  /** Section 标题。 */
  title: string
  /** Section 补充说明。 */
  description?: string
  /** Section 当前状态。 */
  state: 'loading' | 'empty' | 'error' | 'ready'
  /** 空状态说明。 */
  emptyText?: string
  /** 错误说明。 */
  errorText?: string
  /** Section 最小高度。 */
  minHeight?: string
}>(), {
  description: '',
  emptyText: '暂无内容。',
  errorText: '内容读取失败。',
  minHeight: '180px'
})

/** Section 重试事件。 */
const emit = defineEmits<{
  (event: 'retry'): void
}>()

// ========= 函数 =========

/** 请求重新读取当前 Section。 */
function retrySection(): void {
  emit('retry')
}
</script>

<template>
  <section
    class="music-section-shell"
    :aria-labelledby="`${props.sectionId}-title`"
    :style="{ minHeight: props.minHeight }"
  >
    <header class="music-section-header">
      <div>
        <h2 :id="`${props.sectionId}-title`">{{ props.title }}</h2>
        <p v-if="props.description">{{ props.description }}</p>
      </div>
      <div class="music-section-actions">
        <slot name="actions" />
        <CommonIconButton
          v-if="props.state === 'error'"
          size="compact"
          variant="ghost"
          label="重新加载"
          @click="retrySection"
        >
          <RotateCcw :size="14" />
        </CommonIconButton>
      </div>
    </header>

    <div v-if="props.state === 'loading'" class="music-section-loading">
      <CommonSpinner label="正在加载" />
      <span>正在加载</span>
    </div>
    <CommonErrorState
      v-else-if="props.state === 'error'"
      title="读取失败"
      :description="props.errorText"
      @retry="retrySection"
    />
    <CommonEmptyState
      v-else-if="props.state === 'empty'"
      title="暂无内容"
      :description="props.emptyText"
    />
    <div v-else class="music-section-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.music-section-shell {
  display: grid;
  align-content: start;
  gap: var(--ncx-space-4);
}

.music-section-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--ncx-space-4);
}

.music-section-header h2,
.music-section-header p {
  margin: 0;
}

.music-section-header h2 {
  font-size: 20px;
  line-height: 1.2;
}

.music-section-header p {
  margin-top: var(--ncx-space-1);
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
}

.music-section-actions,
.music-section-loading {
  display: flex;
  align-items: center;
  gap: var(--ncx-space-2);
}

.music-section-loading {
  min-height: 120px;
  justify-content: center;
  color: var(--ncx-color-text-secondary);
}

.music-section-content {
  min-width: 0;
}
</style>
