<script setup lang="ts">
import { CheckCircle2, Copy, KeyRound, Plus, RefreshCw, Trash2 } from '@lucide/vue'
import { onMounted, reactive, ref } from 'vue'

import type {
  ProviderProfileInput,
  PublicProviderProfile
} from '../../../shared/schemas/provider-profile'
import { PROVIDER_PRESETS } from '../../../shared/schemas/provider-profile'
import { CommonButton, CommonSelect, CommonSwitch, type CommonOption } from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'

// ========= 类型 =========

/** Profile 编辑表单。 */
interface ProviderEditor {
  /** 正在编辑的 Profile ID。 */
  profileId: string | undefined
  /** 展示名称。 */
  displayName: string
  /** 协议。 */
  protocol: ProviderProfileInput['protocol']
  /** 服务根地址。 */
  baseUrl: string
  /** API Key，仅本次提交到 Main。 */
  apiKey: string
  /** 模型 ID。 */
  modelId: string
  /** 每行 Name: Value 的自定义 Header。 */
  customHeadersText: string
  /** 是否启用。 */
  enabled: boolean
}

// ========= 变量 =========

/** 当前公开 Profile 列表。 */
const profiles = ref<PublicProviderProfile[]>([])

/** 当前默认 Profile ID。 */
const activeProfileId = ref<string | undefined>()

/** Profile 操作繁忙状态。 */
const busy = ref<boolean>(false)

/** 当前编辑器。 */
const editor = reactive<ProviderEditor>(createEmptyEditor())

/** 协议选项。 */
const protocolOptions: CommonOption[] = [
  { label: 'OpenAI Compatible', value: 'openai-compatible' },
  { label: 'Anthropic Messages', value: 'anthropic-messages' },
  { label: 'Gemini generateContent', value: 'gemini-generate-content' }
]

// ========= 函数 =========

/** 创建空白 Provider 编辑器。 */
function createEmptyEditor(): ProviderEditor {
  return {
    profileId: undefined,
    displayName: 'OpenAI Compatible',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelId: 'gpt-4.1-mini',
    customHeadersText: '',
    enabled: true
  }
}

/** 拉取 Main 持有的公开 Profile 快照。 */
async function loadProfiles(): Promise<void> {
  /** Profile 列表结果。 */
  const result = await window.ncx.providerProfiles.request({ operation: 'list' })
  profiles.value = result.profiles
  activeProfileId.value = result.activeProfileId
}

/** 应用内置最小预设，不猜测模型能力。 */
function applyPreset(preset: typeof PROVIDER_PRESETS[number]): void {
  editor.displayName = preset.label
  editor.protocol = preset.protocol
  editor.baseUrl = preset.baseUrl
}

/** 从公开快照进入编辑；秘密字段保持空白。 */
function editProfile(profile: PublicProviderProfile): void {
  editor.profileId = profile.profileId
  editor.displayName = profile.displayName
  editor.protocol = profile.protocol
  editor.baseUrl = profile.baseUrl
  editor.apiKey = ''
  editor.modelId = profile.modelId
  editor.customHeadersText = profile.headerNames.map((name) => `${name}: `).join('\n')
  editor.enabled = profile.enabled
}

/** 复制为新 Profile，秘密仍需用户重新填写。 */
function copyProfile(profile: PublicProviderProfile): void {
  editProfile(profile)
  editor.profileId = undefined
  editor.displayName = `${profile.displayName} 副本`
}

/** 重置为新增表单。 */
function resetEditor(): void {
  Object.assign(editor, createEmptyEditor())
  editor.profileId = undefined
}

/** 保存 Profile；API Key 和 Header 值只经过 contextBridge 发送 Main。 */
async function saveProfile(): Promise<void> {
  busy.value = true
  try {
    /** 已解析自定义 Header。 */
    const customHeaders = parseCustomHeaders(editor.customHeadersText)
    /** 保存结果。 */
    const result = await window.ncx.providerProfiles.request({
      operation: 'save',
      profile: {
        ...(editor.profileId ? { profileId: editor.profileId } : {}),
        displayName: editor.displayName,
        protocol: editor.protocol,
        baseUrl: editor.baseUrl,
        modelId: editor.modelId,
        ...(editor.apiKey ? { apiKey: editor.apiKey } : {}),
        customHeaders,
        enabled: editor.enabled
      }
    })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
    editor.apiKey = ''
    showToast('Provider Profile 已安全保存。', 'success')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Provider Profile 保存失败。', 'warning')
  } finally {
    busy.value = false
  }
}

/** 验证连接、流式与 Tool Call 能力。 */
async function verifyProfile(profileId: string): Promise<void> {
  busy.value = true
  try {
    /** 验证结果。 */
    const result = await window.ncx.providerProfiles.request({ operation: 'verify', profileId })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
    showToast(result.verificationMessage ?? '验证完成。', result.profiles.find((item) => item.profileId === profileId)?.capabilitySnapshot?.toolCalls ? 'success' : 'warning')
  } finally {
    busy.value = false
  }
}

/** 设置默认 Agent Profile。 */
async function setDefault(profileId: string): Promise<void> {
  /** 切换结果。 */
  const result = await window.ncx.providerProfiles.request({ operation: 'setDefault', profileId })
  profiles.value = result.profiles
  activeProfileId.value = result.activeProfileId
}

/** 删除指定 Profile。 */
async function deleteProfile(profileId: string): Promise<void> {
  /** 删除结果。 */
  const result = await window.ncx.providerProfiles.request({ operation: 'delete', profileId })
  profiles.value = result.profiles
  activeProfileId.value = result.activeProfileId
  if (editor.profileId === profileId) resetEditor()
}

/** 解析每行 Header-Name: Header Value，并拒绝控制字符。 */
function parseCustomHeaders(text: string): Record<string, string> {
  /** 解析输出。 */
  const headers: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/u)) {
    /** 去除首尾空白后的 Header 行。 */
    const line = rawLine.trim()
    if (!line) continue
    /** Header 名与值的分隔位置。 */
    const separator = line.indexOf(':')
    if (separator <= 0) throw new Error('自定义 Header 必须使用“名称: 值”格式。')
    /** Header 名。 */
    const name = line.slice(0, separator).trim()
    /** Header 值。 */
    const value = line.slice(separator + 1).trim()
    if (!/^[A-Za-z0-9-]{1,80}$/u.test(name) || /[\r\n\0]/u.test(value)) {
      throw new Error('自定义 Header 包含非法字符。')
    }
    headers[name] = value
  }
  return headers
}

/** 切换协议选择。 */
function setProtocol(value: string | number): void {
  editor.protocol = String(value) as ProviderProfileInput['protocol']
}

// ========= 生命周期 =========

onMounted(() => { void loadProfiles() })
</script>

<template>
  <div class="model-settings-layout">
    <section
      class="model-profile-list"
      aria-label="Provider Profiles"
    >
      <header>
        <div><h2>Provider Profiles</h2><p>API Key 由系统安全存储加密，不写入普通设置。</p></div>
        <CommonButton
          size="compact"
          variant="secondary"
          @click="resetEditor"
        >
          <Plus :size="14" />新增
        </CommonButton>
      </header>
      <button
        v-for="profile in profiles"
        :key="profile.profileId"
        type="button"
        class="model-profile-item"
        :class="{ 'is-active': profile.profileId === activeProfileId }"
        @click="editProfile(profile)"
      >
        <span class="model-profile-icon"><KeyRound
          :size="16"
          :stroke-width="1.8"
        /></span>
        <span class="model-profile-copy">
          <strong>{{ profile.displayName }}</strong>
          <small>{{ profile.modelId }} · {{ profile.protocol }}</small>
        </span>
        <CheckCircle2
          v-if="profile.capabilitySnapshot?.toolCalls"
          :size="15"
          class="model-profile-verified"
        />
        <span
          v-if="profile.profileId === activeProfileId"
          class="model-profile-default"
        >默认</span>
      </button>
      <p
        v-if="profiles.length === 0"
        class="model-profile-empty"
      >
        还没有模型配置。选择预设或填写自定义服务。
      </p>
    </section>

    <section class="model-profile-editor">
      <header><h2>{{ editor.profileId ? '编辑 Profile' : '新增 Profile' }}</h2><p>兼容服务可自定义地址、模型 ID 与必要 Header。</p></header>
      <p class="model-profile-data-disclosure">
        对话时只发送当前消息与上下文选择器选中的必要画像/记忆；画像分析只发送本地聚合特征和有限代表样本。使用云端 Provider 可能产生 Token 费用，不会发送 Cookie、账户数据库或完整歌单文件。
      </p>
      <div class="model-preset-row">
        <button
          v-for="preset in PROVIDER_PRESETS"
          :key="preset.label"
          type="button"
          @click="applyPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>
      <label><span>名称</span><input
        v-model="editor.displayName"
        maxlength="80"
      ></label>
      <label><span>协议</span><CommonSelect
        :model-value="editor.protocol"
        :options="protocolOptions"
        @update:model-value="setProtocol"
      /></label>
      <label><span>Base URL</span><input
        v-model="editor.baseUrl"
        type="url"
      ></label>
      <label><span>API Key</span><input
        v-model="editor.apiKey"
        type="password"
        autocomplete="new-password"
        :placeholder="editor.profileId ? '留空则保留原凭据' : '只发送到系统安全存储'"
      ></label>
      <label><span>模型 ID</span><input v-model="editor.modelId"></label>
      <label><span>自定义 Headers</span><textarea
        v-model="editor.customHeadersText"
        rows="3"
        placeholder="Header-Name: value（每行一个）"
      /></label>
      <div class="model-profile-editor-switch">
        <span>启用此 Profile</span><CommonSwitch
          :model-value="editor.enabled"
          label="启用 Profile"
          @update:model-value="editor.enabled = $event"
        />
      </div>
      <footer>
        <CommonButton
          v-if="editor.profileId"
          variant="danger"
          size="compact"
          @click="deleteProfile(editor.profileId)"
        >
          <Trash2 :size="14" />删除
        </CommonButton>
        <CommonButton
          v-if="editor.profileId"
          variant="secondary"
          size="compact"
          @click="copyProfile(profiles.find((profile) => profile.profileId === editor.profileId)!)"
        >
          <Copy :size="14" />复制
        </CommonButton>
        <CommonButton
          v-if="editor.profileId && editor.enabled"
          variant="secondary"
          size="compact"
          :loading="busy"
          @click="verifyProfile(editor.profileId)"
        >
          <RefreshCw :size="14" />验证
        </CommonButton>
        <CommonButton
          v-if="editor.profileId && editor.enabled && editor.profileId !== activeProfileId"
          variant="secondary"
          size="compact"
          @click="setDefault(editor.profileId)"
        >
          设为默认
        </CommonButton>
        <CommonButton
          variant="primary"
          :loading="busy"
          @click="saveProfile"
        >
          保存 Profile
        </CommonButton>
      </footer>
    </section>
  </div>
</template>
