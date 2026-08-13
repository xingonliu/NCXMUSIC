<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type {
  VoiceRuntimeResult,
  VoiceShortcutKey,
  VoiceShortcutSnapshot
} from '../../../shared/schemas/voice'
import { CommonButton, CommonSwitch } from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { readMicrophonePermission, type MicrophonePermissionState } from '../voice/use-voice-input'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'

// ========= 变量 =========

/** 当前全局快捷键快照。 */
const shortcut = ref<VoiceShortcutSnapshot | null>(null)

/** 当前 Provider ASR 状态。 */
const asr = ref<Extract<VoiceRuntimeResult, { operation: 'status' }> | null>(null)

/** 当前 Chromium 麦克风权限。 */
const microphonePermission = ref<MicrophonePermissionState>('unknown')

/** 是否正在录制新的组合键。 */
const recordingShortcut = ref<boolean>(false)

/** 本次录制期间按下的受限按键。 */
const recordedKeys = new Set<VoiceShortcutKey>()

/** 快捷键状态文案。 */
const shortcutStatusText = computed<string>(() => {
  if (!shortcut.value) return '读取中'
  if (shortcut.value.availability === 'ready') return '全局按住说话可用'
  if (shortcut.value.availability === 'disabled') return '全局按住说话已关闭'
  return shortcut.value.reason ?? shortcut.value.availability
})

/** ASR 状态文案。 */
const asrStatusText = computed<string>(() => {
  if (!asr.value?.configured) return '尚未配置当前大模型'
  if (asr.value.capability === 'supported') return '当前模型已验证支持 ASR'
  if (asr.value.capability === 'unsupported') return '当前大模型不支持语音识别（ASR）'
  return '首次录音时验证当前模型能力'
})

/** 麦克风权限文案。 */
const microphoneStatusText = computed<string>(() => {
  if (microphonePermission.value === 'granted') return '麦克风权限已授予'
  if (microphonePermission.value === 'denied') return '麦克风权限已拒绝'
  if (microphonePermission.value === 'prompt') return '首次录音时请求麦克风权限'
  return '当前平台无法预读麦克风权限'
})

// ========= 函数 =========

/** 刷新全局快捷键、麦克风与 ASR 三类状态。 */
async function refreshStatus(): Promise<void> {
  /** Main 持有的全局快捷键状态。 */
  shortcut.value = await window.ncx.voiceShortcut.snapshot().catch(() => null)
  /** Utility 持有的当前 Provider ASR 状态。 */
  const response = await window.ncx.runtime.voice({ operation: 'status' }).catch(() => undefined)
  asr.value = response?.ok && response.data.operation === 'status' ? response.data : null
  microphonePermission.value = await readMicrophonePermission()
}

/** 启用或关闭全局快捷键；应用内麦克风不受影响。 */
async function setShortcutEnabled(enabled: boolean): Promise<void> {
  /** 当前或默认快捷键。 */
  const chord = shortcut.value?.chord ?? ['AltLeft', 'Space']
  shortcut.value = await window.ncx.voiceShortcut.command({
    operation: 'configure',
    enabled,
    chord
  })
}

/** 进入组合键录制状态。 */
function startShortcutRecording(): void {
  recordedKeys.clear()
  recordingShortcut.value = true
  showToast('请按住至少一个修饰键，再按 Space。', 'info')
}

/** 收集录制期间的白名单物理按键。 */
function handleShortcutKeyDown(event: KeyboardEvent): void {
  if (!recordingShortcut.value) return
  /** 当前物理按键是否允许进入全局组合键。 */
  const key = toVoiceShortcutKey(event.code)
  if (!key) return
  event.preventDefault()
  recordedKeys.add(key)
}

/** 任一按键松开后尝试提交完整组合键。 */
function handleShortcutKeyUp(event: KeyboardEvent): void {
  if (!recordingShortcut.value) return
  /** 当前松开的白名单物理按键。 */
  const key = toVoiceShortcutKey(event.code)
  if (!key) return
  event.preventDefault()
  /** 本次候选组合键。 */
  const chord = [...recordedKeys]
  if (!chord.includes('Space') || chord.length < 2) return
  recordingShortcut.value = false
  void window.ncx.voiceShortcut.command({
    operation: 'configure',
    enabled: true,
    chord
  }).then((next) => {
    shortcut.value = next
    showToast(next.availability === 'ready' ? '语音快捷键已更新。' : (next.reason ?? '快捷键更新失败。'), next.availability === 'ready' ? 'success' : 'warning')
  })
}

/** 将浏览器物理按键名限制为语音组合键白名单。 */
function toVoiceShortcutKey(code: string): VoiceShortcutKey | undefined {
  /** 共享 Schema 允许的物理按键集合。 */
  const allowed = new Set<VoiceShortcutKey>([
    'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight',
    'ShiftLeft', 'ShiftRight', 'Space'
  ])
  return allowed.has(code as VoiceShortcutKey) ? code as VoiceShortcutKey : undefined
}

/** 打开当前平台权限设置。 */
async function openPermissionSettings(): Promise<void> {
  shortcut.value = await window.ncx.voiceShortcut.command({ operation: 'openPermissionSettings' })
}

// ========= 生命周期 =========

onMounted(() => {
  window.addEventListener('keydown', handleShortcutKeyDown, true)
  window.addEventListener('keyup', handleShortcutKeyUp, true)
  void refreshStatus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleShortcutKeyDown, true)
  window.removeEventListener('keyup', handleShortcutKeyUp, true)
})
</script>

<template>
  <SettingsSection
    title="语音输入"
    description="配置全局快捷键、系统权限和当前模型的语音识别能力。"
  >
    <SettingsRow
      setting-id="setting-voice-shortcut"
      title="全局按住说话"
      :description="`${shortcut?.accelerator ?? 'Alt+Space'} · ${shortcutStatusText}`"
    >
      <div class="settings-inline-actions">
        <CommonButton
          variant="secondary"
          @click="startShortcutRecording"
        >
          {{ recordingShortcut ? '等待组合键…' : '录制新快捷键' }}
        </CommonButton>
        <CommonSwitch
          :model-value="shortcut?.enabled ?? false"
          label="启用全局语音快捷键"
          @update:model-value="setShortcutEnabled"
        />
      </div>
    </SettingsRow>
    <SettingsRow
      setting-id="setting-microphone"
      title="麦克风"
      :description="`${microphoneStatusText}；输入区按住麦克风始终作为全局 Hook 的回退入口。`"
    >
      <CommonButton
        variant="secondary"
        @click="openPermissionSettings"
      >
        系统权限设置
      </CommonButton>
    </SettingsRow>
    <SettingsRow
      setting-id="setting-cloud-asr"
      title="云端 ASR"
      :description="`${asrStatusText}；仅复用当前模型配置，不自动切换供应商。`"
    >
      <CommonButton
        variant="secondary"
        @click="refreshStatus"
      >
        刷新状态
      </CommonButton>
    </SettingsRow>
    <SettingsRow
      setting-id="setting-audio-boundary"
      title="音频数据边界"
      description="原始录音只驻留内存，识别、失败、取消或超时后释放；NcxMusic 不实现 TTS 或本地离线 ASR。"
    />
  </SettingsSection>
</template>
