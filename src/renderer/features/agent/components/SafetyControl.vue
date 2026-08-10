<script setup lang="ts">
import { ShieldCheck, TerminalSquare } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { CommandSafetyLevel, MusicSafetyLevel } from '../../../../shared/schemas/agent'

// ========= 类型 =========

/** 双安全控件类型。 */
type SafetyControlKind = 'music' | 'command'

/** 安全控件输入。 */
interface SafetyControlProps {
  /** 音乐或命令权限。 */
  readonly kind: SafetyControlKind
  /** 当前 M/S 等级。 */
  readonly modelValue: MusicSafetyLevel | CommandSafetyLevel
}

/** 安全控件输出。 */
interface SafetyControlEmits {
  /** 安全等级即时变更。 */
  (event: 'update:modelValue', value: MusicSafetyLevel | CommandSafetyLevel): void
}

// ========= 变量 =========

/** 控件输入。 */
const props = defineProps<SafetyControlProps>()

/** 控件事件。 */
const emit = defineEmits<SafetyControlEmits>()

/** 等级面板是否展开。 */
const open = ref<boolean>(false)

/** 当前类型的等级说明。 */
const options = computed(() => props.kind === 'music'
  ? [
      { value: 'M1', title: '全部审批', description: '所有小云音乐代操作都先询问。' },
      { value: 'M2', title: '播放免审', description: '播放与队列控制可直接执行。' },
      { value: 'M3', title: '日常管理免审', description: '再放行收藏、歌单和公开社交。' },
      { value: 'M4', title: '注册能力免审', description: '全部已注册音乐能力可直接执行。' }
    ]
  : [
      { value: 'S1', title: '全部审批', description: '所有 Shell 命令都先询问。' },
      { value: 'S2', title: '只读免审', description: '确定性只读查看与搜索可执行。' },
      { value: 'S3', title: '工作区开发', description: '授权工作区内常规开发命令可执行。' },
      { value: 'S4', title: '工作区完整', description: '通过作用域审查的联网与安装也可执行。' }
    ])

/** 控件标题。 */
const label = computed<string>(() => props.kind === 'music' ? '音乐安全' : '命令安全')

// ========= 函数 =========

/** 选择等级并关闭面板；M4 无额外确认。 */
function selectLevel(value: string): void {
  emit('update:modelValue', value as MusicSafetyLevel | CommandSafetyLevel)
  open.value = false
}
</script>

<template>
  <div class="agent-safety-control">
    <button
      type="button"
      :aria-expanded="open"
      @click="open = !open"
    >
      <component
        :is="kind === 'music' ? ShieldCheck : TerminalSquare"
        :size="14"
        :stroke-width="1.8"
      />
      <span>{{ label }}</span>
      <strong>{{ modelValue }}</strong>
    </button>
    <div
      v-if="open"
      class="agent-safety-popover"
      role="menu"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :class="{ 'is-selected': option.value === modelValue }"
        role="menuitemradio"
        :aria-checked="option.value === modelValue"
        @click="selectLevel(option.value)"
      >
        <span><strong>{{ option.value }} · {{ option.title }}</strong><small>{{ option.description }}</small></span>
      </button>
    </div>
  </div>
</template>
