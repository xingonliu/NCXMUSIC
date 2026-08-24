<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

// ========= 类型 =========

/** 通用分页器属性。 */
interface CommonPaginationProps {
  /** 当前页码，从 1 开始。 */
  readonly currentPage: number
  /** 总页数，至少展示为 1。 */
  readonly totalPages: number
  /** 是否禁用分页交互。 */
  readonly disabled?: boolean
  /** 分页器可访问名称。 */
  readonly ariaLabel?: string
  /** 上一页按钮文案。 */
  readonly previousLabel?: string
  /** 下一页按钮文案。 */
  readonly nextLabel?: string
  /** 同时展示的数字页码数量。 */
  readonly windowSize?: number
}

/** 通用分页器事件。 */
interface CommonPaginationEmits {
  /** 同步当前页码。 */
  (event: 'update:currentPage', page: number): void
  /** 通知外层跳页。 */
  (event: 'change', page: number): void
}

// ========= 变量 =========

/** 分页器入参及默认值。 */
const props = withDefaults(defineProps<CommonPaginationProps>(), {
  ariaLabel: '分页',
  previousLabel: '上一页',
  nextLabel: '下一页',
  windowSize: 5
})

/** 分页器事件出口。 */
const emit = defineEmits<CommonPaginationEmits>()

/** 规范化后的总页数。 */
const normalizedTotalPages = computed<number>(() => Math.max(1, Math.floor(props.totalPages)))

/** 规范化后的当前页。 */
const normalizedCurrentPage = computed<number>(() => {
  /** 页码下限保护后的候选页。 */
  const page = Math.max(1, Math.floor(props.currentPage))
  return Math.min(normalizedTotalPages.value, page)
})

/** 当前窗口内展示的数字页码。 */
const visiblePageNumbers = computed<number[]>(() => {
  /** 数字页码窗口大小。 */
  const windowSize = Math.max(1, Math.floor(props.windowSize))
  /** 页码窗口允许的最大起点。 */
  const maximumStart = Math.max(1, normalizedTotalPages.value - windowSize + 1)
  /** 以当前页为中心计算出的页码窗口起点。 */
  const start = Math.min(maximumStart, Math.max(1, normalizedCurrentPage.value - Math.floor(windowSize / 2)))
  /** 当前窗口实际包含的页码数量。 */
  const count = Math.min(windowSize, normalizedTotalPages.value)
  return Array.from({ length: count }, (_, index) => start + index)
})

// ========= 函数 =========

/** 请求切换到指定页码。 */
function requestPage(page: number): void {
  if (props.disabled) return
  /** 约束后的目标页码。 */
  const targetPage = Math.min(normalizedTotalPages.value, Math.max(1, Math.floor(page)))
  if (targetPage === normalizedCurrentPage.value) return
  emit('update:currentPage', targetPage)
  emit('change', targetPage)
}
</script>

<template>
  <nav
    v-if="normalizedTotalPages > 1"
    class="common-pagination"
    :aria-label="ariaLabel"
  >
    <button
      class="common-pagination-action"
      type="button"
      :disabled="disabled || normalizedCurrentPage <= 1"
      @click="requestPage(normalizedCurrentPage - 1)"
    >
      <ChevronLeft :size="14" />
      <span>{{ previousLabel }}</span>
    </button>

    <div class="common-pagination-pages">
      <button
        v-for="page in visiblePageNumbers"
        :key="page"
        class="common-pagination-page"
        type="button"
        :class="{ active: page === normalizedCurrentPage }"
        :aria-current="page === normalizedCurrentPage ? 'page' : undefined"
        :aria-label="$tSource(`第 ${page} 页`)"
        :disabled="disabled"
        @click="requestPage(page)"
      >
        {{ page }}
      </button>
    </div>

    <button
      class="common-pagination-action"
      type="button"
      :disabled="disabled || normalizedCurrentPage >= normalizedTotalPages"
      @click="requestPage(normalizedCurrentPage + 1)"
    >
      <span>{{ nextLabel }}</span>
      <ChevronRight :size="14" />
    </button>
  </nav>
</template>

<style scoped>
.common-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding-top: 18px;
}

.common-pagination-action,
.common-pagination-page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  color: var(--ncx-color-text-secondary);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-variant-numeric: tabular-nums;
  transition:
    color var(--ncx-motion-fast),
    background-color var(--ncx-motion-fast),
    box-shadow var(--ncx-motion-fast),
    transform var(--ncx-motion-fast);
}

.common-pagination-action {
  min-height: 30px;
  gap: 5px;
  padding: 0 11px;
  border-radius: var(--ncx-squircle-radius-full);
  background: color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ncx-color-text-primary) 8%, transparent);
  font-size: 12px;
}

.common-pagination-pages {
  display: flex;
  gap: 6px;
}

.common-pagination-page {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: var(--ncx-squircle-radius-full);
}

.common-pagination-action:hover,
.common-pagination-page:hover,
.common-pagination-page.active {
  color: var(--ncx-color-text-primary);
  background: color-mix(in srgb, var(--ncx-color-text-primary) 10%, transparent);
}

.common-pagination-page.active {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ncx-color-text-primary) 10%, transparent);
}

.common-pagination-action:active,
.common-pagination-page:active {
  transform: scale(0.96);
}

.common-pagination-action:disabled,
.common-pagination-page:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
}

@media (width < 720px) {
  .common-pagination {
    gap: 8px;
  }

  .common-pagination-action {
    padding: 0 9px;
  }

  .common-pagination-page {
    width: 30px;
    height: 30px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .common-pagination-action,
  .common-pagination-page {
    transition: none !important;
  }

  .common-pagination-action:active,
  .common-pagination-page:active {
    transform: none;
  }
}
</style>
