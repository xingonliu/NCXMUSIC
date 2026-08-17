<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { CommonAlertDialog } from '../../design-system/components'
import { useAgentStore } from '../agent/agent-store'
import { useVoiceInput } from './use-voice-input'

// ========= 变量 =========

/** 应用作用域语音输入控制器。 */
const voice = useVoiceInput()

/** 识别文本进入唯一 Agent Runtime 的应用 Store。 */
const agent = useAgentStore()

/** 通知点击后打开 Agent 页面。 */
const router = useRouter()

/** 当前识别文本订阅清理函数。 */
let unsubscribeTranscript: (() => void) | undefined

/** 语音服务事件订阅清理函数。 */
let unsubscribeVoiceEvents: (() => void) | undefined

/** 外置胶囊 IPC 最近发送时间。 */
let lastOverlayPublishAt = 0

/** 等待完成通知的语音 Agent 任务。 */
let waitingVoiceAgent = false

/** 当前语音 Agent 是否进入过非空闲执行态。 */
let voiceAgentStarted = false

/** 状态变化监听清理函数。 */
let stopAgentStatusWatch: (() => void) | undefined

/** 胶囊状态监听清理函数。 */
let stopOverlayWatch: (() => void) | undefined

// ========= 函数 =========

/** 将语音胶囊状态镜像给 Main；Main 只在主窗口后台时展示。 */
function publishOverlayState(force = false): void {
  /** 当前时间。 */
  const now = performance.now()
  if (!force && now - lastOverlayPublishAt < 50) return
  lastOverlayPublishAt = now
  window.ncx.voiceSettings.publishOverlayState({
    phase: voice.state.value,
    text: voice.transcriptPreview.value,
    waveform: [...voice.waveform.value]
  })
}

/** 提交语音文本并标记本次 Agent 完成后需要系统通知。 */
function submitVoiceTranscript(text: string): void {
  waitingVoiceAgent = true
  voiceAgentStarted = false
  void agent.sendMessage(text).catch(() => {
    waitingVoiceAgent = false
  })
}

/** 监听 Agent 生命周期并在语音任务完成时请求原生通知。 */
function handleAgentStatus(status: string): void {
  if (!waitingVoiceAgent) return
  if (status !== 'idle') {
    voiceAgentStarted = true
    return
  }
  if (!voiceAgentStarted) return
  waitingVoiceAgent = false
  voiceAgentStarted = false
  window.ncx.voiceSettings.notifyAgentComplete({
    title: '小云已完成语音任务',
    body: '点击返回 Ncxmusic 查看完整输出并继续交互。'
  })
}

// ========= 生命周期 =========

onMounted(() => {
  void voice.initialize()
  void agent.initialize()
  unsubscribeTranscript = voice.onTranscript(submitVoiceTranscript)
  unsubscribeVoiceEvents = window.ncx.voiceSettings.onEvent((event) => {
    if (event.type === 'open-agent') void router.push({ name: 'agent' })
  })
  stopOverlayWatch = watch(
    [() => voice.state.value, () => voice.transcriptPreview.value, () => voice.waveform.value],
    () => publishOverlayState(voice.state.value !== 'listening'),
    { deep: true, immediate: true }
  )
  stopAgentStatusWatch = watch(
    () => agent.snapshot.value.turnStatus,
    (status) => handleAgentStatus(status),
    { immediate: true }
  )
})

onUnmounted(() => {
  unsubscribeTranscript?.()
  unsubscribeVoiceEvents?.()
  stopOverlayWatch?.()
  stopAgentStatusWatch?.()
  window.ncx.voiceSettings.publishOverlayState({
    phase: 'idle',
    text: '',
    waveform: Array.from({ length: 12 }, () => 0.08)
  })
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="voice.state.value !== 'idle'"
      class="voice-capsule"
      :class="[`voice-capsule--${voice.state.value}`, { 'voice-capsule--expanded': voice.state.value === 'reviewing' }]"
      role="status"
      aria-live="polite"
    >
      <span
        class="voice-capsule__orb"
        aria-hidden="true"
      >
        <LoaderCircle
          v-if="voice.state.value !== 'listening'"
          :size="22"
        />
      </span>
      <span class="voice-capsule__copy">
        <small>
          {{ voice.state.value === 'starting' ? '准备中' : voice.state.value === 'listening' ? '倾听中' : voice.state.value === 'reviewing' ? '已识别' : '识别中' }}
        </small>
        <strong v-if="voice.state.value === 'reviewing'">{{ voice.transcriptPreview.value }}</strong>
      </span>
      <span
        v-if="voice.state.value !== 'reviewing'"
        class="voice-capsule__wave"
        aria-hidden="true"
      >
        <i
          v-for="(height, index) in voice.waveform.value"
          :key="index"
          :style="{ '--voice-wave-height': `${Math.max(4, height * 27)}px` }"
        />
      </span>
    </div>
  </Teleport>

  <CommonAlertDialog
    :visible="voice.disclosureRequired.value"
    title="启用云端语音识别？"
    description="选择“大模型”或“当前对话模型”时，录音会上传给相应 Provider。原始音频不写入磁盘、聊天、缓存或日志；云端处理与留存仍受 Provider 政策约束。本地模式不会上传音频。"
    type="warning"
    confirm-text="了解并启用"
    @cancel="voice.declineDisclosure"
    @confirm="voice.acceptDisclosure"
  />
</template>

<style scoped>
.voice-capsule {
  position: fixed;
  z-index: 1200;
  bottom: 34px;
  left: 50%;
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 240px;
  max-width: min(640px, calc(100vw - 40px));
  min-height: 62px;
  padding: 11px 18px;
  color: var(--ncx-text-primary);
  background: color-mix(in srgb, var(--ncx-surface-elevated) 84%, transparent);
  border: 1px solid var(--ncx-border-subtle);
  border-radius: 999px;
  box-shadow: var(--ncx-shadow-overlay);
  backdrop-filter: blur(24px) saturate(150%);
  transform: translateX(-50%);
  transition: width 220ms ease, opacity 200ms ease, transform 200ms ease;
}

.voice-capsule--expanded {
  width: min(620px, calc(100vw - 40px));
  border-radius: 24px;
}

.voice-capsule__orb {
  display: grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  color: var(--ncx-accent);
  border: 3px solid color-mix(in srgb, var(--ncx-accent) 25%, transparent);
  border-top-color: var(--ncx-accent);
  border-radius: 50%;
}

.voice-capsule:not(.voice-capsule--listening) .voice-capsule__orb {
  animation: voice-spin 800ms linear infinite;
}

.voice-capsule--listening .voice-capsule__orb {
  background: var(--ncx-accent);
  border: 0;
  animation: voice-pulse 1.15s ease-in-out infinite;
}

.voice-capsule__copy {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.voice-capsule__copy small {
  color: var(--ncx-text-secondary);
  font-size: 11px;
}

.voice-capsule__copy strong {
  overflow: hidden;
  font-size: 14px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-capsule__wave {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  height: 30px;
}

.voice-capsule__wave i {
  width: 3px;
  height: var(--voice-wave-height);
  background: var(--ncx-accent);
  border-radius: 99px;
  transition: height 70ms linear;
}

@keyframes voice-spin {
  to { transform: rotate(360deg); }
}

@keyframes voice-pulse {
  50% {
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--ncx-accent) 14%, transparent);
    transform: scale(0.74);
  }
}

@media (prefers-reduced-motion: reduce) {
  .voice-capsule,
  .voice-capsule__orb,
  .voice-capsule__wave i {
    animation: none !important;
    transition: none !important;
  }
}
</style>
