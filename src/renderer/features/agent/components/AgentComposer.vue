<script setup lang="ts">
import { ArrowUp, ChevronDown, Folder, Plus, Square } from '@lucide/vue'
import { computed, ref, type DeepReadonly } from 'vue'

import type { AgentSnapshot } from '../../../../shared/schemas/agent'
import { CommonIconButton } from '../../../design-system/components'
import SafetyControl from './SafetyControl.vue'

// ========= 类型 =========

interface AgentComposerProps {
  readonly snapshot: DeepReadonly<AgentSnapshot>
  readonly contextLabel?: string
}

interface AgentComposerEmits {
  (event: 'send', content: string): void
  (event: 'stop'): void
  (event: 'music-safety', level: AgentSnapshot['musicSafetyLevel']): void
  (event: 'command-safety', level: AgentSnapshot['commandSafetyLevel']): void
}

const props = defineProps<AgentComposerProps>()
const emit = defineEmits<AgentComposerEmits>()

const content = ref<string>('')

const active = computed<boolean>(() => !['idle', 'completed', 'cancelled', 'failed'].includes(props.snapshot.turnStatus))

const canSend = computed<boolean>(() => content.value.trim().length > 0 && props.snapshot.configured)

function submit(): void {
  const trimmed = content.value.trim()
  if (!trimmed || !props.snapshot.configured) return
  content.value = ''
  emit('send', trimmed)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  submit()
}
</script>

<template>
  <section
    class="agent-composer"
    aria-label="给 Agent 发送消息"
  >
    <!-- Floating Context Pill above composer -->
    <div
      v-if="contextLabel"
      class="agent-composer-context-pill"
    >
      <Folder :size="13" />
      <span>{{ contextLabel }}</span>
    </div>

    <!-- Composer Rounded Container -->
    <div class="agent-composer-box">
      <textarea
        v-model="content"
        rows="1"
        :disabled="!snapshot.configured"
        :placeholder="snapshot.configured ? '随心输入' : '请先配置语言模型'"
        @keydown="handleKeydown"
      />
      <div class="agent-composer-bottom-bar">
        <div class="agent-composer-left-controls">
          <CommonIconButton
            label="添加文件或上下文"
            size="default"
            variant="ghost"
          >
            <Plus :size="16" />
          </CommonIconButton>
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
        </div>
        <div class="agent-composer-right-controls">
          <span class="agent-model-select-pill">
            NCX Agent 极高
            <ChevronDown :size="12" />
          </span>
          <CommonIconButton
            v-if="active"
            label="停止当前任务"
            class="agent-composer-send-btn is-stop"
            @click="emit('stop')"
          >
            <Square
              :size="12"
              fill="currentColor"
            />
          </CommonIconButton>
          <CommonIconButton
            v-else
            label="发送消息"
            class="agent-composer-send-btn"
            :disabled="!canSend"
            @click="submit"
          >
            <ArrowUp
              :size="16"
              :stroke-width="2.2"
            />
          </CommonIconButton>
        </div>
      </div>
    </div>
  </section>
</template>

