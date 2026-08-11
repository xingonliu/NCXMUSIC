<script setup lang="ts">
import { AudioLines } from '@lucide/vue'
import { onMounted, onUnmounted } from 'vue'

import { CommonAlertDialog } from '../../design-system/components'
import { useAgentStore } from '../agent/agent-store'
import { useVoiceInput } from './use-voice-input'

// ========= 变量 =========

/** 应用作用域语音输入控制器。 */
const voice = useVoiceInput()

/** 识别文本进入唯一 Agent Runtime 的应用 Store。 */
const agent = useAgentStore()

/** 当前识别文本订阅清理函数。 */
let unsubscribeTranscript: (() => void) | undefined

// ========= 生命周期 =========

onMounted(() => {
  void voice.initialize()
  void agent.initialize()
  unsubscribeTranscript = voice.onTranscript((text) => {
    void agent.sendMessage(text)
  })
})

onUnmounted(() => {
  unsubscribeTranscript?.()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="voice.state.value === 'listening'"
      class="voice-listening-overlay"
      role="status"
      aria-live="polite"
    >
      <AudioLines :size="20" />
      <span>聆听中</span>
      <span class="voice-wave" aria-hidden="true">
        <i v-for="index in 5" :key="index" />
      </span>
    </div>
  </Teleport>

  <CommonAlertDialog
    :visible="voice.disclosureRequired.value"
    title="启用云端语音识别？"
    description="录音将仅发送给当前大模型 Provider 用于本次识别；NcxMusic 不把原始音频写入磁盘、聊天、缓存或日志。云端处理与留存仍受该 Provider 的政策约束。"
    type="warning"
    confirm-text="了解并启用"
    @cancel="voice.declineDisclosure"
    @confirm="voice.acceptDisclosure"
  />
</template>

<style scoped>
.voice-listening-overlay {
  position: fixed;
  z-index: 1200;
  bottom: 34px;
  left: 50%;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 18px;
  color: var(--ncx-text-primary);
  background: color-mix(in srgb, var(--ncx-surface-elevated) 78%, transparent);
  border: 1px solid var(--ncx-border-subtle);
  border-radius: 999px;
  box-shadow: var(--ncx-shadow-overlay);
  backdrop-filter: blur(24px) saturate(150%);
  transform: translateX(-50%);
}

.voice-wave {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  height: 20px;
}

.voice-wave i {
  width: 2px;
  height: 6px;
  background: var(--ncx-accent);
  border-radius: 99px;
  animation: voice-wave 760ms ease-in-out infinite alternate;
}

.voice-wave i:nth-child(2),
.voice-wave i:nth-child(4) {
  animation-delay: 140ms;
}

.voice-wave i:nth-child(3) {
  animation-delay: 280ms;
}

@keyframes voice-wave {
  to { height: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .voice-wave i { animation: none; }
}
</style>
