<script setup lang="ts">
import { Check, ListChecks, X } from '@lucide/vue'
import { computed, onUnmounted, ref, watch, type DeepReadonly } from 'vue'

import type { SelectionSnapshot } from '../../../../shared/schemas/agent'
import { CommonButton } from '../../../design-system/components'

// ========= 类型 =========

interface SelectionCardProps {
  readonly selection: DeepReadonly<SelectionSnapshot>
}

interface SelectionCardEmits {
  (event: 'submit', selectionId: string, keys: string[]): void
  (event: 'cancel', selectionId: string): void
}

const props = defineProps<SelectionCardProps>()
const emit = defineEmits<SelectionCardEmits>()

const selectedKeys = ref<string[]>([...props.selection.selectedOptionKeys])

const now = ref<number>(Date.now())

const timer = setInterval(() => {
  now.value = Date.now()
}, 1_000)

const pending = computed<boolean>(() => props.selection.status === 'pending' && props.selection.expiresAt > now.value)

const remaining = computed<string>(() => {
  const seconds = Math.max(0, Math.ceil((props.selection.expiresAt - now.value) / 1_000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

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

function entityTitle(option: DeepReadonly<SelectionSnapshot>['options'][number]): string {
  if (option.kind === 'text') return option.label
  return 'name' in option.entity ? option.entity.name : ''
}

function entityDescription(option: DeepReadonly<SelectionSnapshot>['options'][number]): string {
  if (option.kind === 'text') return option.description ?? ''
  if (option.entity.kind === 'song') return option.entity.artists.map((artist) => artist.name).join(' / ')
  if (option.entity.kind === 'album') return option.entity.artist?.name ?? '专辑'
  return option.entity.kind === 'artist' ? '歌手' : '歌单'
}

function entityArtwork(option: DeepReadonly<SelectionSnapshot>['options'][number]): string | undefined {
  if (option.kind === 'text') return undefined
  if (option.entity.kind === 'song') return option.entity.album?.artworkUrl
  return option.entity.artworkUrl
}

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
