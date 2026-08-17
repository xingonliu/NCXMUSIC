<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type {
  VoiceRuntimeResult,
  VoiceShortcutKey,
  VoiceShortcutSnapshot
} from '../../../shared/schemas/voice'
import type {
  VoiceLocalLoadMode,
  VoiceLocalModelId,
  VoiceRecognitionSource,
  VoiceServiceEvent,
  VoiceSettingsSnapshot
} from '../../../shared/schemas/voice-settings'
import {
  CommonButton,
  CommonInput,
  CommonProgress,
  CommonRadioGroup,
  CommonSelect,
  CommonSwitch
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { readMicrophonePermission, type MicrophonePermissionState } from '../voice/use-voice-input'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'

// ========= 变量 =========

/** 当前全局快捷键快照。 */
const shortcut = ref<VoiceShortcutSnapshot | null>(null)

/** 当前语音来源、本地模型和独立云端设置。 */
const voiceSettings = ref<VoiceSettingsSnapshot | null>(null)

/** 当前 Provider ASR 状态。 */
const conversationAsr = ref<Extract<VoiceRuntimeResult, { operation: 'status' }> | null>(null)

/** 当前 Chromium 麦克风权限。 */
const microphonePermission = ref<MicrophonePermissionState>('unknown')

/** 是否正在录制新的组合键。 */
const recordingShortcut = ref<boolean>(false)

/** 本次录制期间按下的受限按键。 */
const recordedKeys = new Set<VoiceShortcutKey>()

/** 云端服务地址编辑值。 */
const cloudBaseUrl = ref<string>('https://api.openai.com/v1')

/** 云端模型 ID 编辑值。 */
const cloudModelId = ref<string>('gpt-4o-mini-transcribe')

/** 云端 API Key 编辑值；不会从 Main 回显。 */
const cloudApiKey = ref<string>('')

/** 云端自定义 Header JSON 编辑值。 */
const cloudHeaders = ref<string>('{}')

/** 云端保存中状态。 */
const savingCloud = ref<boolean>(false)

/** 语音服务事件订阅清理函数。 */
let unsubscribeVoiceSettings: (() => void) | undefined

/** 三种默认识别来源。 */
const sourceOptions = [
  { label: '本地', value: 'local' },
  { label: '大模型', value: 'cloud' },
  { label: '当前对话模型', value: 'conversation' }
]

/** 本地模型加载策略。 */
const loadModeOptions = [
  { label: '按需加载', value: 'on-demand' },
  { label: '常驻内存后台', value: 'resident' }
]

/** 首版独立云端协议适配器。 */
const cloudProtocolOptions = [{ label: 'OpenAI Transcriptions 兼容', value: 'openai-transcriptions' }]

/** 快捷键状态文案。 */
const shortcutStatusText = computed<string>(() => {
  if (!shortcut.value) return '读取中'
  if (shortcut.value.availability === 'ready') return '全局按住说话可用'
  if (shortcut.value.availability === 'disabled') return '全局按住说话已关闭'
  if (shortcut.value.availability === 'permission_denied') return shortcut.value.reason ?? '未授予辅助功能权限（需在系统设置中允许）'
  if (shortcut.value.availability === 'conflict') return shortcut.value.reason ?? '快捷键已被系统或其他应用占用'
  if (shortcut.value.availability === 'hook_failed') return shortcut.value.reason ?? '按键监听服务启动失败'
  return shortcut.value.reason ?? shortcut.value.availability
})

/** 当前对话模型 ASR 文案。 */
const conversationStatusText = computed<string>(() => {
  if (!conversationAsr.value?.configured) return '尚未配置当前对话模型'
  if (conversationAsr.value.capability === 'supported') return '当前模型已验证支持 ASR'
  if (conversationAsr.value.capability === 'unsupported') return '当前对话模型不支持语音识别'
  return '首次使用时验证能力'
})

/** 麦克风权限文案。 */
const microphoneStatusText = computed<string>(() => {
  if (microphonePermission.value === 'granted') return '麦克风权限已授予'
  if (microphonePermission.value === 'denied') return '麦克风权限已拒绝'
  if (microphonePermission.value === 'prompt') return '首次录音时请求麦克风权限'
  return '当前平台无法预读麦克风权限'
})

// ========= 函数 =========

/** 刷新快捷键、麦克风、语音设置和当前模型 ASR 状态。 */
async function refreshStatus(): Promise<void> {
  /** 并行读取 Main 与 Utility 状态。 */
  const [shortcutResult, settingsResult, conversationResult, permission] = await Promise.all([
    window.ncx.voiceShortcut.snapshot().catch(() => null),
    window.ncx.voiceSettings.request({ operation: 'snapshot' }).catch(() => null),
    window.ncx.runtime.voice({ operation: 'status' }).catch(() => undefined),
    readMicrophonePermission()
  ])
  shortcut.value = shortcutResult
  if (settingsResult) applyVoiceSnapshot(settingsResult.snapshot)
  conversationAsr.value = conversationResult?.ok && conversationResult.data.operation === 'status' ? conversationResult.data : null
  microphonePermission.value = permission
}

/** 应用 Main 返回的语音快照并同步非秘密表单字段。 */
function applyVoiceSnapshot(snapshot: VoiceSettingsSnapshot): void {
  voiceSettings.value = snapshot
  cloudBaseUrl.value = snapshot.cloud.baseUrl
  cloudModelId.value = snapshot.cloud.modelId
}

/** 处理语音服务的模型进度事件。 */
function handleVoiceSettingsEvent(event: VoiceServiceEvent): void {
  if (event.type === 'snapshot') applyVoiceSnapshot(event.snapshot)
}

/** 修改默认语音来源。 */
async function setSource(value: string | number): Promise<void> {
  /** 受单选项限制的来源。 */
  const source = String(value) as VoiceRecognitionSource
  /** 更新结果。 */
  const result = await window.ncx.voiceSettings.request({ operation: 'setSource', source })
  applyVoiceSnapshot(result.snapshot)
}

/** 保存当前本地模型、流式选项和加载策略。 */
async function saveLocal(overrides: Partial<{ modelId: VoiceLocalModelId; streaming: boolean; loadMode: VoiceLocalLoadMode }>): Promise<void> {
  /** 当前本地设置。 */
  const current = voiceSettings.value?.local
  if (!current) return
  /** 更新结果。 */
  const result = await window.ncx.voiceSettings.request({
    operation: 'setLocal',
    modelId: overrides.modelId ?? current.modelId,
    streaming: overrides.streaming ?? current.streaming,
    loadMode: overrides.loadMode ?? current.loadMode
  })
  applyVoiceSnapshot(result.snapshot)
}

/** 安装、取消或删除一个内置模型。 */
async function manageModel(modelId: VoiceLocalModelId, operation: 'installModel' | 'cancelModelInstall' | 'removeModel'): Promise<void> {
  try {
    /** Main 返回的最新模型状态。 */
    const result = await window.ncx.voiceSettings.request({ operation, modelId })
    applyVoiceSnapshot(result.snapshot)
    if (result.message) showToast(result.message, 'success')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '模型操作失败。', 'warning')
  }
}

/** 保存独立云端 OpenAI Transcriptions 兼容配置。 */
async function saveCloud(): Promise<void> {
  if (!voiceSettings.value) return
  savingCloud.value = true
  try {
    /** 用户输入的 Header JSON。 */
    const decodedHeaders = JSON.parse(cloudHeaders.value) as unknown
    if (!decodedHeaders || Array.isArray(decodedHeaders) || typeof decodedHeaders !== 'object') {
      throw new Error('自定义 Header 必须是 JSON 对象。')
    }
    /** 只允许字符串键值。 */
    const customHeaders = Object.fromEntries(Object.entries(decodedHeaders).map(([name, value]) => {
      if (typeof value !== 'string') throw new Error(`Header ${name} 的值必须是字符串。`)
      return [name, value]
    }))
    /** 保存结果。 */
    const result = await window.ncx.voiceSettings.request({
      operation: 'saveCloud',
      cloud: {
        protocol: 'openai-transcriptions',
        baseUrl: cloudBaseUrl.value,
        modelId: cloudModelId.value,
        ...(cloudApiKey.value ? { apiKey: cloudApiKey.value } : {}),
        customHeaders,
        streaming: voiceSettings.value.cloud.streaming
      }
    })
    cloudApiKey.value = ''
    applyVoiceSnapshot(result.snapshot)
    showToast('独立大模型语音设置已保存。', 'success')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '云端语音设置保存失败。', 'warning')
  } finally {
    savingCloud.value = false
  }
}

/** 更新云端流式设置并立即保存其他表单字段。 */
function setCloudStreaming(streaming: boolean): void {
  if (!voiceSettings.value) return
  voiceSettings.value = {
    ...voiceSettings.value,
    cloud: { ...voiceSettings.value.cloud, streaming }
  }
}

/** 启用或关闭全局快捷键。 */
async function setShortcutEnabled(enabled: boolean): Promise<void> {
  /** 当前或默认快捷键。 */
  const chord = shortcut.value?.chord ?? ['ControlLeft', 'ShiftLeft', 'KeyQ']
  shortcut.value = await window.ncx.voiceShortcut.command({ operation: 'configure', enabled, chord })
}

/** 进入组合键录制状态。 */
function startShortcutRecording(): void {
  recordedKeys.clear()
  recordingShortcut.value = true
  showToast('请按住至少一个修饰键，再按 Q 或 Space。', 'info')
}

/** 收集录制期间的白名单物理按键。 */
function handleShortcutKeyDown(event: KeyboardEvent): void {
  if (!recordingShortcut.value) return
  /** 当前白名单物理按键。 */
  const key = toVoiceShortcutKey(event.code)
  if (!key) return
  event.preventDefault()
  recordedKeys.add(key)
}

/** 任一触发键松开后提交完整组合键。 */
function handleShortcutKeyUp(event: KeyboardEvent): void {
  if (!recordingShortcut.value) return
  /** 当前松开的白名单物理按键。 */
  const key = toVoiceShortcutKey(event.code)
  if (!key) return
  event.preventDefault()
  /** 本次候选组合键。 */
  const chord = [...recordedKeys]
  if ((!chord.includes('KeyQ') && !chord.includes('Space')) || chord.length < 2) return
  recordingShortcut.value = false
  void window.ncx.voiceShortcut.command({ operation: 'configure', enabled: true, chord }).then((next) => {
    shortcut.value = next
    showToast(next.availability === 'ready' ? '语音快捷键已更新。' : (next.reason ?? '快捷键更新失败。'), next.availability === 'ready' ? 'success' : 'warning')
  })
}

/** 将浏览器物理按键名限制为语音组合键白名单。 */
function toVoiceShortcutKey(code: string): VoiceShortcutKey | undefined {
  /** 共享 Schema 允许的物理按键集合。 */
  const allowed = new Set<VoiceShortcutKey>([
    'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight',
    'ShiftLeft', 'ShiftRight', 'KeyQ', 'Space'
  ])
  return allowed.has(code as VoiceShortcutKey) ? code as VoiceShortcutKey : undefined
}

/** 打开当前平台权限设置。 */
async function openPermissionSettings(): Promise<void> {
  shortcut.value = await window.ncx.voiceShortcut.command({ operation: 'openPermissionSettings' })
}

/** 格式化模型体积。 */
function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 ** 2))} MiB`
}

// ========= 生命周期 =========

onMounted(() => {
  window.addEventListener('keydown', handleShortcutKeyDown, true)
  window.addEventListener('keyup', handleShortcutKeyUp, true)
  unsubscribeVoiceSettings = window.ncx.voiceSettings.onEvent(handleVoiceSettingsEvent)
  void refreshStatus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleShortcutKeyDown, true)
  window.removeEventListener('keyup', handleShortcutKeyUp, true)
  unsubscribeVoiceSettings?.()
})
</script>

<template>
  <SettingsSection
    title="语音输入"
    description="选择默认识别来源；本地模型按需下载，不进入应用安装包。"
  >
    <SettingsRow
      setting-id="setting-voice-source"
      title="默认使用"
      description="本地不上传音频；独立大模型使用单独配置；当前对话模型强制非流式。"
    >
      <CommonRadioGroup
        :model-value="voiceSettings?.source ?? 'local'"
        :options="sourceOptions"
        name="voice-source"
        @update:model-value="setSource"
      />
    </SettingsRow>

    <template v-if="voiceSettings?.source === 'local'">
      <div class="voice-model-list">
        <article
          v-for="model in voiceSettings.models"
          :key="model.id"
          class="voice-model-card"
          :class="{ 'voice-model-card--selected': voiceSettings.local.modelId === model.id }"
          @click="saveLocal({ modelId: model.id })"
        >
          <div class="voice-model-card__copy">
            <strong>{{ model.name }}</strong>
            <span>{{ model.description }}</span>
            <small>
              {{ model.languages.join(' / ') }} · 下载 {{ formatBytes(model.downloadBytes) }} · 安装 {{ formatBytes(model.installedBytes) }} · 约 {{ model.estimatedMemoryMiB }} MiB 内存
            </small>
            <a
              :href="model.licenseUrl"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >{{ model.licenseName }}</a>
            <CommonProgress
              v-if="model.installState === 'downloading'"
              :value="model.progress ?? 0"
            />
            <small
              v-if="model.error"
              class="voice-model-card__error"
            >{{ model.error }}</small>
          </div>
          <div
            class="voice-model-card__actions"
            @click.stop
          >
            <CommonButton
              v-if="model.installState === 'not-installed' || model.installState === 'failed'"
              variant="secondary"
              @click="manageModel(model.id, 'installModel')"
            >
              安装
            </CommonButton>
            <CommonButton
              v-else-if="model.installState === 'downloading'"
              variant="secondary"
              @click="manageModel(model.id, 'cancelModelInstall')"
            >
              取消
            </CommonButton>
            <CommonButton
              v-else
              variant="ghost"
              @click="manageModel(model.id, 'removeModel')"
            >
              删除
            </CommonButton>
          </div>
        </article>
      </div>
      <SettingsRow
        setting-id="setting-local-streaming"
        title="使用流式识别"
        :description="voiceSettings.local.modelId === 'light' ? '边说边出字。' : 'SenseVoice 通过 VAD 按语音片段增量出字。'"
      >
        <CommonSwitch
          :model-value="voiceSettings.local.streaming"
          label="启用本地流式结果"
          @update:model-value="saveLocal({ streaming: $event })"
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-local-load-mode"
        title="模型内存"
        description="按需加载会在识别结束并空闲 15 秒后释放进程；常驻可缩短下一次启动时间。"
      >
        <CommonRadioGroup
          :model-value="voiceSettings.local.loadMode"
          :options="loadModeOptions"
          name="voice-load-mode"
          @update:model-value="saveLocal({ loadMode: String($event) as VoiceLocalLoadMode })"
        />
      </SettingsRow>
    </template>

    <template v-else-if="voiceSettings?.source === 'cloud'">
      <SettingsRow
        setting-id="setting-cloud-protocol"
        title="厂商协议"
        description="首版支持 OpenAI Audio Transcriptions 兼容接口。"
      >
        <CommonSelect
          :model-value="voiceSettings.cloud.protocol"
          :options="cloudProtocolOptions"
          disabled
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-cloud-url"
        title="URL"
        description="填写 API 根地址，应用会请求 /audio/transcriptions。"
      >
        <CommonInput
          v-model="cloudBaseUrl"
          placeholder="https://api.openai.com/v1"
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-cloud-model"
        title="模型 ID"
        description="例如 gpt-4o-mini-transcribe；whisper-1 不支持流式 SSE。"
      >
        <CommonInput
          v-model="cloudModelId"
          placeholder="gpt-4o-mini-transcribe"
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-cloud-key"
        title="API Key"
        :description="voiceSettings.cloud.hasApiKey ? '已安全保存；留空将保留现有 Key。' : '使用系统安全存储加密，仅 Main 进程解密。'"
      >
        <CommonInput
          v-model="cloudApiKey"
          type="password"
          placeholder="sk-…"
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-cloud-headers"
        title="自定义 Headers"
        :description="`JSON 对象；当前已保存：${voiceSettings.cloud.headerNames.join(', ') || '无'}。保存会替换已有自定义 Header。`"
      >
        <CommonInput
          v-model="cloudHeaders"
          placeholder="{&quot;X-Header&quot;:&quot;value&quot;}"
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-cloud-streaming"
        title="使用流式响应"
        description="录音结束上传后接收 SSE 增量文本；这不是实时上传麦克风音频。"
      >
        <CommonSwitch
          :model-value="voiceSettings.cloud.streaming"
          :disabled="cloudModelId.trim().toLowerCase() === 'whisper-1'"
          label="启用云端流式响应"
          @update:model-value="setCloudStreaming"
        />
      </SettingsRow>
      <div class="voice-save-row">
        <CommonButton
          :loading="savingCloud"
          @click="saveCloud"
        >
          保存大模型设置
        </CommonButton>
      </div>
    </template>

    <SettingsRow
      v-else-if="voiceSettings?.source === 'conversation'"
      setting-id="setting-conversation-asr"
      title="当前对话模型"
      :description="`${conversationStatusText}；此路径只允许非流式转写，并复用当前 Agent Provider。`"
    >
      <CommonButton
        variant="secondary"
        @click="refreshStatus"
      >
        刷新状态
      </CommonButton>
    </SettingsRow>

    <SettingsRow
      setting-id="setting-voice-shortcut"
      title="全局按住说话"
      :description="`${shortcut?.accelerator ?? 'Control+Shift+Q'} · ${shortcutStatusText}`"
    >
      <div class="settings-inline-actions">
        <CommonButton
          v-if="shortcut?.enabled && shortcut?.availability !== 'ready'"
          variant="secondary"
          @click="openPermissionSettings"
        >
          授权/重新检测
        </CommonButton>
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
      :description="microphoneStatusText"
    >
      <CommonButton
        variant="secondary"
        @click="openPermissionSettings"
      >
        系统权限设置
      </CommonButton>
    </SettingsRow>
    <SettingsRow
      setting-id="setting-audio-boundary"
      title="音频数据边界"
      description="本地模式不上传；大模型模式上传给独立 ASR 服务；当前对话模型上传给当前 Provider。原始录音只驻留内存并在结束后清零。"
    />
  </SettingsSection>
</template>

<style scoped>
.voice-model-list {
  display: grid;
  gap: 10px;
  padding: 12px 0;
}

.voice-model-card {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  background: var(--ncx-surface-secondary);
  border: 1px solid var(--ncx-border-subtle);
  border-radius: 14px;
}

.voice-model-card--selected {
  border-color: var(--ncx-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ncx-accent) 35%, transparent);
}

.voice-model-card__copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.voice-model-card__copy span,
.voice-model-card__copy small {
  color: var(--ncx-text-secondary);
}

.voice-model-card__copy a {
  width: fit-content;
  color: var(--ncx-accent);
  font-size: 12px;
}

.voice-model-card__error {
  color: var(--ncx-color-danger) !important;
}

.voice-model-card__actions,
.settings-inline-actions,
.voice-save-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.voice-save-row {
  justify-content: flex-end;
  padding: 14px 0;
}
</style>
