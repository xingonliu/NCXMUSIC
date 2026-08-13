<script setup lang="ts">
import { computed } from 'vue'

import type { CommandSafetyLevel, MusicSafetyLevel } from '../../../../shared/schemas/agent'
import { CommonSelect } from '../../../design-system/components'

// ========= 类型定义 =========
type SafetyControlKind = 'music' | 'command'

interface SafetyControlProps {
  readonly kind: SafetyControlKind
  readonly modelValue: MusicSafetyLevel | CommandSafetyLevel
}

interface SafetyControlEmits {
  (event: 'update:modelValue', value: MusicSafetyLevel | CommandSafetyLevel): void
}

// ========= 变量/Props/Emits =========
/** 组件属性定义 */
const props = defineProps<SafetyControlProps>()
/** 组件事件定义 */
const emit = defineEmits<SafetyControlEmits>()

/** 安全等级下拉选项配置 */
const options = computed(() => props.kind === 'music'
  ? [
      { value: 'M1', label: '音乐 M1' },
      { value: 'M2', label: '音乐 M2' },
      { value: 'M3', label: '音乐 M3' },
      { value: 'M4', label: '音乐 M4' }
    ]
  : [
      { value: 'S1', label: '命令 M1' },
      { value: 'S2', label: '命令 M2' },
      { value: 'S3', label: '命令 M3' },
      { value: 'S4', label: '命令 M4' }
    ])

// ======== 函数 ========
/** 处理下拉选项变更 */
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
