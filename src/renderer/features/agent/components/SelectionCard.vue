<script setup lang="ts">
import { Check, ListChecks, X } from '@lucide/vue'
import { computed, onUnmounted, ref, watch, type DeepReadonly } from 'vue'

import type { SelectionSnapshot } from '../../../../shared/schemas/agent'
import { CommonButton } from '../../../design-system/components'

// ========= 类型 =========

/** SelectionCard 输入。 */
interface SelectionCardProps {
  /** Utility 权威选择快照。 */
  readonly selection: DeepReadonly<SelectionSnapshot>
}

/** SelectionCard 输出。 */
interface SelectionCardEmits {
  /** 提交无副作用答案。 */
  (event: 'submit', selectionId: string, keys: string[]): void
  /** 取消当前选择。 */
  (event: 'cancel', selectionId: string): void
}

// ========= 变量 =========

/** 选择卡输入。 */
const props = defineProps<SelectionCardProps>()

/** 选择卡事件。 */
const emit = defineEmits<SelectionCardEmits>()

/** Renderer 临时选中的 optionKey；不绑定业务动作。 */
const selectedKeys = ref<string[]>([...props.selection.selectedOptionKeys])

/** 当前时间。 */
const now = ref<number>(Date.now())

/** 每秒刷新剩余时间。 */
const timer = setInterval(() => {
  now.value = Date.now()
}, 1_000)

/** 选择是否仍可交互。 */
const pending = computed<boolean>(() => props.selection.status === 'pending' && props.selection.expiresAt > now.value)

/** 剩余时间。 */
const remaining = computed<string>(() => {
  /** 距选择过期的剩余秒数。 */
  const seconds = Math.max(0, Math.ceil((props.selection.expiresAt - now.value) / 1_000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

// ========= 函数 =========

/** 切换选项；单选点击后立即提交。 */
function toggleOption(optionKey: string): void {
  if (!pending.value) return
  if (props.selection.mode === 'single') {
    selectedKeys.value = [optionKey]
    emit('submit', props.selection.selectionId, [optionKey])
    return
  }
  selectedKeys.value = selectedKeys.value.includes(optionKey)
    ? selectedKeys.value.filter((key) => key !== optionKey)
    : [...selectedKeys.value, optionKey]
}

/** 读取实体选项的主标题。 */
function entityTitle(option: DeepReadonly<SelectionSnapshot>['options'][number]): string {
  if (option.kind === 'text') return option.label
  return 'name' in option.entity ? option.entity.name : ''
}

/** 读取实体选项的辅助信息。 */
function entityDescription(option: DeepReadonly<SelectionSnapshot>['options'][number]): string {
  if (option.kind === 'text') return option.description ?? ''
  if (option.entity.kind === 'song') return option.entity.artists.map((artist) => artist.name).join(' / ')
  if (option.entity.kind === 'album') return option.entity.artist?.name ?? '专辑'
  return option.entity.kind === 'artist' ? '歌手' : '歌单'
}

/** 读取实体公开封面。 */
function entityArtwork(option: DeepReadonly<SelectionSnapshot>['options'][number]): string | undefined {
  if (option.kind === 'text') return undefined
  if (option.entity.kind === 'song') return option.entity.album?.artworkUrl
  return option.entity.artworkUrl
}

// ========= 生命周期 =========

watch(() => props.selection.selectedOptionKeys, (keys) => {
  selectedKeys.value = [...keys]
})

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <article
    class="agent-selection-card"
    aria-label="用户选择"
  >
    <header>
      <span><ListChecks
        :size="17"
        :stroke-width="1.9"
      /></span>
      <div>
        <strong>{{ selection.prompt }}</strong>
        <small v-if="pending">无副作用选择 · {{ remaining }}</small>
        <small v-else>{{ selection.status === 'selected' ? '已选择' : selection.status === 'expired' ? '已过期' : '已取消' }}</small>
      </div>
    </header>
    <div
      class="agent-selection-options"
      role="group"
      :aria-label="selection.prompt"
    >
      <button
        v-for="option in selection.options"
        :key="option.optionKey"
        type="button"
        :disabled="!pending"
        :class="{ 'is-selected': selectedKeys.includes(option.optionKey) }"
        @click="toggleOption(option.optionKey)"
      >
        <img
          v-if="entityArtwork(option)"
          :src="entityArtwork(option)"
          alt=""
        >
        <span
          v-else
          class="agent-selection-option-placeholder"
        ><ListChecks :size="16" /></span>
        <span class="agent-selection-option-copy">
          <strong>{{ entityTitle(option) }}</strong>
          <small>{{ entityDescription(option) }}</small>
        </span>
        <Check
          v-if="selectedKeys.includes(option.optionKey)"
          :size="15"
          aria-hidden="true"
        />
      </button>
    </div>
    <footer v-if="pending">
      <CommonButton
        variant="secondary"
        @click="emit('cancel', selection.selectionId)"
      >
        <X :size="14" />取消
      </CommonButton>
      <CommonButton
        v-if="selection.mode === 'multiple'"
        variant="primary"
        :disabled="selectedKeys.length === 0"
        @click="emit('submit', selection.selectionId, selectedKeys)"
      >
        完成
      </CommonButton>
    </footer>
  </article>
</template>
