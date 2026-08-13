<script setup lang="ts">
import { Check, ListChecks, X } from '@lucide/vue'
import { computed, onUnmounted, ref, watch, type DeepReadonly } from 'vue'

import type { SelectionSnapshot } from '../../../../shared/schemas/agent'
import { CommonButton } from '../../../design-system/components'

// ========= 类型 =========

interface SelectionCardProps {
  /** 选项卡快照数据 */
  readonly selection: DeepReadonly<SelectionSnapshot>
}

interface SelectionCardEmits {
  /** 提交选择事件 */
  (event: 'submit', selectionId: string, keys: string[]): void
  /** 取消选择事件 */
  (event: 'cancel', selectionId: string): void
}

// ========= 变量 =========

const props = defineProps<SelectionCardProps>()
const emit = defineEmits<SelectionCardEmits>()

/** 当前选中的选项 Key 列表 */
const selectedKeys = ref<string[]>([...props.selection.selectedOptionKeys])

/** 当前时间戳 */
const now = ref<number>(Date.now())

/** 倒计时更新定时器 */
const timer = setInterval(() => {
  now.value = Date.now()
}, 1_000)

// ========= 计算属性 =========

/** 是否处于待选择且未超时状态 */
const pending = computed<boolean>(() => props.selection.status === 'pending' && props.selection.expiresAt > now.value)

/** 剩余等待时间文本 */
const remaining = computed<string>(() => {
  const seconds = Math.max(0, Math.ceil((props.selection.expiresAt - now.value) / 1_000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

// ========= 函数 =========

/** 切换或选择指定选项 */
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

/** 获取选项的实体标题/歌曲名 */
function entityTitle(option: DeepReadonly<SelectionSnapshot>['options'][number]): string {
  if (option.kind === 'text') return option.label
  return 'name' in option.entity ? option.entity.name : ''
}

/** 获取选项的实体描述/歌手名 */
function entityDescription(option: DeepReadonly<SelectionSnapshot>['options'][number]): string {
  if (option.kind === 'text') return option.description ?? ''
  if (option.entity.kind === 'song') return option.entity.artists.map((artist) => artist.name).join(' / ')
  if (option.entity.kind === 'album') return option.entity.artist?.name ?? '专辑'
  return option.entity.kind === 'artist' ? '歌手' : '歌单'
}

/** 获取选项的实体封面图地址 */
function entityArtwork(option: DeepReadonly<SelectionSnapshot>['options'][number]): string | undefined {
  if (option.kind === 'text') return undefined
  if (option.entity.kind === 'song') return option.entity.album?.artworkUrl
  return option.entity.artworkUrl
}

// ========= 监听与生命周期 =========

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
      <ListChecks
        :size="16"
        :stroke-width="2"
      />
      <div>
        <strong>{{ selection.prompt }}</strong>
        <small v-if="pending">SELECT OPTION · EXPIRES IN {{ remaining }}</small>
        <small v-else>STATUS: {{ selection.status.toUpperCase() }}</small>
      </div>
    </header>
    <div
      class="agent-selection-options"
      role="group"
      :aria-label="selection.prompt"
    >
      <button
        v-for="(option, index) in selection.options"
        :key="option.optionKey"
        type="button"
        :disabled="!pending"
        :class="{ 'is-selected': selectedKeys.includes(option.optionKey) }"
        @click="toggleOption(option.optionKey)"
      >
        <span class="agent-selection-opt-num">{{ index + 1 }}</span>
        <img
          v-if="entityArtwork(option)"
          :src="entityArtwork(option)"
          alt=""
          class="agent-selection-opt-cover"
        >
        <span
          v-else
          class="agent-selection-option-placeholder"
        ><ListChecks :size="14" /></span>
        <span class="agent-selection-option-copy">
          <strong>{{ entityTitle(option) }}</strong>
          <small>{{ entityDescription(option) }}</small>
        </span>
        <Check
          v-if="selectedKeys.includes(option.optionKey)"
          :size="14"
          aria-hidden="true"
          class="agent-selection-opt-check"
        />
      </button>
    </div>
    <footer v-if="pending">
      <CommonButton
        variant="secondary"
        size="compact"
        @click="emit('cancel', selection.selectionId)"
      >
        <X :size="13" />取消
      </CommonButton>
      <CommonButton
        v-if="selection.mode === 'multiple'"
        variant="primary"
        size="compact"
        :disabled="selectedKeys.length === 0"
        @click="emit('submit', selection.selectionId, selectedKeys)"
      >
        提交选择
      </CommonButton>
    </footer>
  </article>
</template>
