<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'
import { watch } from 'vue'

import {
  CommonEmptyState,
  CommonErrorState,
  CommonIconButton,
  CommonSpinner
} from '../../../design-system/components'
import { showToast } from '../../../design-system/use-toast'

// ========= 属性与事件 =========

/** 音乐页面独立 Section 属性。 */
const props = withDefaults(defineProps<{
  /** Section 稳定 ID。 */
  sectionId: string
  /** Section 标题。 */
  title: string
  /** Section 当前状态。 */
  state: 'loading' | 'empty' | 'error' | 'ready'
  /** 空状态说明。 */
  emptyText?: string
  /** 错误说明。 */
  errorText?: string
  /** Section 最小高度。 */
  minHeight?: string
}>(), {
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

/** 通过全局 Toast 展示当前 Section 的空状态或错误详情。 */
function notifySectionState(): void {
  if (props.state === 'error') {
    showToast({
      message: props.errorText,
      title: `${props.title}读取失败`,
      type: 'warning'
    })
    return
  }

  if (props.state === 'empty') {
    showToast({
      message: props.emptyText,
      title: `${props.title}暂无内容`,
      type: 'info'
    })
  }
}

// ========= 生命周期 =========

watch(
  () => [props.state, props.errorText, props.emptyText],
  () => notifySectionState(),
  { immediate: true }
)
</script>

<template>
  <section
    class="music-section-shell"
    :aria-labelledby="`${props.sectionId}-title`"
    :style="{ minHeight: props.minHeight }"
  >
    <header class="music-section-header">
      <h2 :id="`${props.sectionId}-title`">{{ props.title }}</h2>
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
      @retry="retrySection"
    />
    <CommonEmptyState
      v-else-if="props.state === 'empty'"
      title="暂无内容"
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

.music-section-header h2 {
  margin: 0;
}

.music-section-header h2 {
  font-size: 20px;
  line-height: 1.2;
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
