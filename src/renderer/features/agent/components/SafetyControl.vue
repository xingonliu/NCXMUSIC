<script setup lang="ts">
import { computed } from 'vue'

import type { CommandSafetyLevel, MusicSafetyLevel } from '../../../../shared/schemas/agent'
import { CommonSelect } from '../../../design-system/components'

type SafetyControlKind = 'music' | 'command'

interface SafetyControlProps {
  readonly kind: SafetyControlKind
  readonly modelValue: MusicSafetyLevel | CommandSafetyLevel
}

interface SafetyControlEmits {
  (event: 'update:modelValue', value: MusicSafetyLevel | CommandSafetyLevel): void
}

const props = defineProps<SafetyControlProps>()
const emit = defineEmits<SafetyControlEmits>()

const options = computed(() => props.kind === 'music'
  ? [
      { value: 'M1', label: '音乐安全 · M1 全部审批' },
      { value: 'M2', label: '音乐安全 · M2 播放免审' },
      { value: 'M3', label: '音乐安全 · M3 常用免审' },
      { value: 'M4', label: '音乐安全 · M4 完全访问' }
    ]
  : [
      { value: 'S1', label: '命令安全 · S1 全部审批' },
      { value: 'S2', label: '命令安全 · S2 只读免审' },
      { value: 'S3', label: '命令安全 · S3 开发免审' },
      { value: 'S4', label: '命令安全 · S4 完全访问' }
    ])

function handleChange(val: string | number): void {
  emit('update:modelValue', String(val) as MusicSafetyLevel | CommandSafetyLevel)
}
</script>

<template>
  <div class="agent-safety-control">
    <CommonSelect
      :model-value="modelValue"
      :options="options"
      size="compact"
      @update:model-value="handleChange"
    />
  </div>
</template>
