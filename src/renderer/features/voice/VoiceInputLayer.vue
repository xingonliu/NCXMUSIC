<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { CommonAlertDialog } from '../../design-system/components'
import { useAgentStore } from '../agent/agent-store'
import { useAppPreferences } from '../settings/app-preferences'
import { useVoiceInput } from './use-voice-input'

// ========= 变量 =========

/** 应用作用域语音输入控制器。 */
const voice = useVoiceInput()

/** 外置语音胶囊需要实时跟随的应用界面偏好。 */
const appPreferences = useAppPreferences()

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

/** 胶囊主题监听清理函数。 */
let stopOverlayThemeWatch: (() => void) | undefined

// ========= 函数 =========

/** 将语音胶囊状态镜像给 Main，由统一外置窗口负责展示。 */
function publishOverlayState(force = false): void {
  /** 当前时间。 */
  const now = performance.now()
  if (!force && now - lastOverlayPublishAt < 50) return
  lastOverlayPublishAt = now
  window.ncx.voiceSettings.publishOverlayState({
    phase: voice.state.value,
    text: voice.transcriptPreview.value,
    waveform: [...voice.waveform.value],
    theme: appPreferences.preferences.value.theme
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
  stopOverlayThemeWatch = watch(
    () => appPreferences.preferences.value.theme,
    () => publishOverlayState(true)
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
  stopOverlayThemeWatch?.()
  stopAgentStatusWatch?.()
  window.ncx.voiceSettings.publishOverlayState({
    phase: 'idle',
    text: '',
    waveform: Array.from({ length: 12 }, () => 0.08),
    theme: appPreferences.preferences.value.theme
  })
})
</script>

<template>
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
