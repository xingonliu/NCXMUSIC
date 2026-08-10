<script setup lang="ts">
import { ArrowUp, Square } from '@lucide/vue'
import { computed, ref, type DeepReadonly } from 'vue'

import type { AgentSnapshot } from '../../../../shared/schemas/agent'
import SafetyControl from './SafetyControl.vue'

// ========= 类型 =========

/** AgentComposer 输入。 */
interface AgentComposerProps {
  /** 当前 Agent 快照。 */
  readonly snapshot: DeepReadonly<AgentSnapshot>
}

/** AgentComposer 输出。 */
interface AgentComposerEmits {
  /** 提交新的用户消息。 */
  (event: 'send', content: string): void
  /** 停止当前 Turn。 */
  (event: 'stop'): void
  /** 音乐安全等级改变。 */
  (event: 'music-safety', level: AgentSnapshot['musicSafetyLevel']): void
  /** 命令安全等级改变。 */
  (event: 'command-safety', level: AgentSnapshot['commandSafetyLevel']): void
}

// ========= 变量 =========

/** Composer 输入。 */
const props = defineProps<AgentComposerProps>()

/** Composer 事件。 */
const emit = defineEmits<AgentComposerEmits>()

/** 当前输入文本。 */
const content = ref<string>('')

/** 当前是否有活动 Turn。 */
const active = computed<boolean>(() => !['idle', 'completed', 'cancelled', 'failed'].includes(props.snapshot.turnStatus))

/** 是否允许发送。 */
const canSend = computed<boolean>(() => content.value.trim().length > 0 && props.snapshot.configured)

// ========= 函数 =========

/** 提交并清空输入；新消息由 Runtime 负责取代旧 Turn。 */
function submit(): void {
  /** 去除首尾空白后的用户输入。 */
  const trimmed = content.value.trim()
  if (!trimmed || !props.snapshot.configured) return
  content.value = ''
  emit('send', trimmed)
}

/** Enter 提交、Shift+Enter 换行，并尊重输入法组合状态。 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  submit()
}
</script>

<template>
  <section
    class="agent-composer"
    aria-label="给小云发送消息"
  >
    <div class="agent-composer-input">
      <textarea
        v-model="content"
        rows="1"
        :disabled="!snapshot.configured"
        :placeholder="snapshot.configured ? '告诉小云你想听什么，或让它管理音乐…' : '请先配置模型'"
        @keydown="handleKeydown"
      />
      <button
        v-if="active"
        type="button"
        class="agent-composer-action is-stop"
        aria-label="停止当前任务"
        @click="emit('stop')"
      >
        <Square
          :size="13"
          fill="currentColor"
        />
      </button>
      <button
        v-else
        type="button"
        class="agent-composer-action"
        aria-label="发送消息"
        :disabled="!canSend"
        @click="submit"
      >
        <ArrowUp
          :size="17"
          :stroke-width="2.2"
        />
      </button>
    </div>
    <div class="agent-composer-controls">
      <SafetyControl
        kind="music"
        :model-value="snapshot.musicSafetyLevel"
        @update:model-value="emit('music-safety', $event as AgentSnapshot['musicSafetyLevel'])"
      />
      <SafetyControl
        kind="command"
        :model-value="snapshot.commandSafetyLevel"
        @update:model-value="emit('command-safety', $event as AgentSnapshot['commandSafetyLevel'])"
      />
      <span>小云会通过真实工具回执确认操作结果</span>
    </div>
  </section>
</template>
