<script setup lang="ts">
import { CheckCircle2, KeyRound, Plus, RefreshCw, Trash2 } from '@lucide/vue'
import { computed, onMounted, reactive, ref } from 'vue'

import type {
  ProviderCatalogVendor,
  ProviderModelCatalog,
  PublicProviderProfile
} from '../../../shared/schemas/provider-profile'
import {
  CommonAlertDialog,
  CommonButton,
  CommonDialog,
  CommonDropdownMenu,
  CommonInput,
  CommonSegmentedControl,
  CommonSelect,
  type CommonMenuItem,
  type CommonOption
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import SettingsSection from './SettingsSection.vue'

// ========= 类型 =========

/** 新增模型弹窗的配置方式。 */
type ModelEditorMode = 'preset' | 'custom'

/** 新增模型弹窗表单。 */
interface ModelEditor {
  /** 配置方式。 */
  mode: ModelEditorMode
  /** 预设目录中的供应商 ID。 */
  vendorId: string
  /** Profile 展示名或自定义供应商名。 */
  displayName: string
  /** 模型服务根地址。 */
  baseUrl: string
  /** 仅在保存时发送到 Main 安全存储的 API Key。 */
  apiKey: string
  /** 默认模型 ID。 */
  modelId: string
}

// ========= 变量 =========

/** 当前公开 Profile 列表。 */
const profiles = ref<PublicProviderProfile[]>([])

/** 当前默认 Profile ID。 */
const activeProfileId = ref<string | undefined>()

/** OpenRouter 最新模型目录。 */
const catalog = ref<ProviderModelCatalog | undefined>()

/** 模型目录是否正在加载。 */
const catalogLoading = ref<boolean>(false)

/** 模型目录加载错误文案。 */
const catalogError = ref<string>('')

/** 新增模型弹窗显示状态。 */
const addDialogVisible = ref<boolean>(false)

/** 等待用户确认删除的 Profile。 */
const deleteCandidate = ref<PublicProviderProfile | undefined>()

/** 当前正在执行操作的 Profile ID。 */
const busyProfileId = ref<string | undefined>()

/** 新增模型保存状态。 */
const saveBusy = ref<boolean>(false)

/** 新增模型表单。 */
const editor = reactive<ModelEditor>(createEmptyEditor())

/** 预设与自定义分段控制器选项。 */
const editorModeOptions: CommonOption[] = [
  { label: '预设', value: 'preset' },
  { label: '自定义', value: 'custom' }
]

/** 英文供应商名称排序器。 */
const vendorNameCollator = new Intl.Collator('en', { sensitivity: 'base' })

/** 当前选中的预设供应商。 */
const selectedVendor = computed<ProviderCatalogVendor | undefined>(() =>
  catalog.value?.vendors.find((vendor) => vendor.id === editor.vendorId)
)

/** 当前预设供应商由新到旧的模型选项。 */
const modelOptions = computed<CommonOption[]>(() =>
  selectedVendor.value?.models.map((model) => ({
    label: model.name,
    value: model.id
  })) ?? []
)

/** 供应商下拉项：置顶供应商在前，其余按首字母分组。 */
const vendorMenuItems = computed<CommonMenuItem[]>(() => buildVendorMenuItems(
  catalog.value?.vendors ?? [],
  editor.vendorId
))

/** 供应商下拉当前展示文案。 */
const vendorDropdownLabel = computed<string>(() =>
  selectedVendor.value?.name ?? (catalogLoading.value ? '正在加载厂商…' : '选择厂商')
)

/** 删除确认框说明。 */
const deleteDescription = computed<string>(() => {
  /** 待删除 Profile 的展示名。 */
  const name = deleteCandidate.value?.displayName ?? '此模型'
  /** 待删除 Profile 是否为当前默认项。 */
  const isDefault = deleteCandidate.value?.profileId === activeProfileId.value
  return isDefault
    ? `${name} 是当前默认模型。删除后将自动选择其他已启用模型；若没有其他模型，小云将暂停使用。此操作无法撤销。`
    : `将删除 ${name} 的模型配置与安全存储中的凭据。此操作无法撤销。`
})

// ========= 函数 =========

/** 创建空白新增模型表单。 */
function createEmptyEditor(): ModelEditor {
  return {
    mode: 'preset',
    vendorId: '',
    displayName: '',
    baseUrl: '',
    apiKey: '',
    modelId: ''
  }
}

/** 拉取 Main 持有的公开 Profile 快照。 */
async function loadProfiles(): Promise<void> {
  try {
    /** Profile 列表结果。 */
    const result = await window.ncx.providerProfiles.request({ operation: 'list' })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
  } catch (error) {
    showToast(error instanceof Error ? error.message : '模型列表加载失败。', 'warning')
  }
}

/** 通过 Main 拉取并校验 OpenRouter 最新模型目录。 */
async function loadCatalog(): Promise<void> {
  if (catalogLoading.value) return
  catalogLoading.value = true
  catalogError.value = ''
  try {
    /** 带目录的 Provider IPC 结果。 */
    const result = await window.ncx.providerProfiles.request({ operation: 'catalog' })
    if (!result.catalog) throw new Error('OpenRouter 模型目录响应为空。')
    catalog.value = result.catalog
  } catch (error) {
    catalogError.value = error instanceof Error ? error.message : 'OpenRouter 模型目录加载失败。'
  } finally {
    catalogLoading.value = false
  }
}

/** 构造置顶项和按 A-Z 分组的供应商菜单。 */
function buildVendorMenuItems(
  vendors: ProviderCatalogVendor[],
  selectedVendorId: string
): CommonMenuItem[] {
  /** 用户指定的置顶供应商。 */
  const priority = vendors
    .filter((vendor) => vendor.priorityRank !== undefined)
    .sort((left, right) => (left.priorityRank ?? 0) - (right.priorityRank ?? 0))
  /** 除置顶项外按名称 A-Z 排序的供应商。 */
  const alphabetical = vendors
    .filter((vendor) => vendor.priorityRank === undefined)
    .sort((left, right) => vendorNameCollator.compare(left.name, right.name))
  /** 输出到 CommonDropdownMenu 的菜单项。 */
  const items: CommonMenuItem[] = priority.map((vendor) => ({
    label: vendor.name,
    value: vendor.id,
    checked: vendor.id === selectedVendorId
  }))

  if (priority.length > 0 && alphabetical.length > 0) {
    items.push({ type: 'separator', label: '', value: 'priority-separator' })
  }
  /** 上一个已输出的首字母分组。 */
  let previousGroup = ''
  for (const vendor of alphabetical) {
    /** 当前供应商的 A-Z 首字母分组。 */
    const group = resolveVendorGroup(vendor.name)
    if (group !== previousGroup) {
      items.push({ type: 'header', label: group, value: `group-${group}` })
      previousGroup = group
    }
    items.push({
      label: vendor.name,
      value: vendor.id,
      checked: vendor.id === selectedVendorId,
      indented: true
    })
  }
  return items
}

/** 将供应商名称归入 A-Z 或 # 分组。 */
function resolveVendorGroup(name: string): string {
  /** 供应商名首字符的大写形式。 */
  const initial = name.trim().charAt(0).toUpperCase()
  return /^[A-Z]$/u.test(initial) ? initial : '#'
}

/** 打开并重置新增模型弹窗。 */
function openAddDialog(): void {
  Object.assign(editor, createEmptyEditor())
  addDialogVisible.value = true
  if (!catalog.value && !catalogLoading.value) void loadCatalog()
}

/** 在非保存状态下关闭新增模型弹窗。 */
function closeAddDialog(): void {
  if (saveBusy.value) return
  addDialogVisible.value = false
}

/** 切换新增模型配置方式并清除另一种方式的残留值。 */
function setEditorMode(value: string | number): void {
  /** 分段控制器返回的合法配置方式。 */
  const mode: ModelEditorMode = String(value) === 'custom' ? 'custom' : 'preset'
  Object.assign(editor, createEmptyEditor(), { mode })
}

/** 选择预设供应商，并自动填充固定 Base URL 与最新默认模型。 */
function selectVendor(value: string): void {
  /** 与菜单值对应的目录供应商。 */
  const vendor = catalog.value?.vendors.find((item) => item.id === value)
  if (!vendor || !catalog.value) return
  editor.vendorId = vendor.id
  editor.displayName = vendor.name
  editor.baseUrl = catalog.value.baseUrl
  editor.modelId = vendor.models[0]?.id ?? ''
}

/** 更新当前预设供应商的默认模型。 */
function setPresetModel(value: string | number): void {
  editor.modelId = String(value)
}

/** 保存新增模型，并让 Main 负责加密秘密字段。 */
async function saveProfile(): Promise<void> {
  /** 去除首尾空白后的供应商展示名。 */
  const displayName = editor.displayName.trim()
  /** 去除首尾空白后的服务地址。 */
  const baseUrl = editor.baseUrl.trim()
  /** 去除首尾空白后的模型 ID。 */
  const modelId = editor.modelId.trim()
  if (editor.mode === 'preset' && !selectedVendor.value) {
    showToast('请先选择厂商。', 'warning')
    return
  }
  if (!displayName || !baseUrl || !modelId) {
    showToast('请完整填写厂商、Base URL 和默认模型。', 'warning')
    return
  }
  if (editor.mode === 'preset' && !editor.apiKey.trim()) {
    showToast('预设模型需要填写 OpenRouter API Key。', 'warning')
    return
  }

  saveBusy.value = true
  try {
    /** 保存后的公开 Profile 快照。 */
    const result = await window.ncx.providerProfiles.request({
      operation: 'save',
      profile: {
        displayName,
        protocol: 'openai-compatible',
        baseUrl,
        modelId,
        ...(editor.apiKey ? { apiKey: editor.apiKey } : {}),
        customHeaders: {},
        enabled: true
      }
    })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
    addDialogVisible.value = false
    showToast('模型已添加，API Key 已交由系统安全存储。', 'success')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '模型保存失败。', 'warning')
  } finally {
    saveBusy.value = false
  }
}

/** 验证连接、流式与 Tool Call 能力。 */
async function verifyProfile(profileId: string): Promise<void> {
  busyProfileId.value = profileId
  try {
    /** 验证结果。 */
    const result = await window.ncx.providerProfiles.request({ operation: 'verify', profileId })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
    /** 验证后的目标 Profile。 */
    const profile = result.profiles.find((item) => item.profileId === profileId)
    showToast(
      result.verificationMessage ?? '验证完成。',
      profile?.capabilitySnapshot?.toolCalls ? 'success' : 'warning'
    )
  } catch (error) {
    showToast(error instanceof Error ? error.message : '模型验证失败。', 'warning')
  } finally {
    busyProfileId.value = undefined
  }
}

/** 设置默认 Agent Profile。 */
async function setDefault(profileId: string): Promise<void> {
  busyProfileId.value = profileId
  try {
    /** 切换默认项后的公开 Profile 快照。 */
    const result = await window.ncx.providerProfiles.request({ operation: 'setDefault', profileId })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
  } catch (error) {
    showToast(error instanceof Error ? error.message : '默认模型切换失败。', 'warning')
  } finally {
    busyProfileId.value = undefined
  }
}

/** 打开指定 Profile 的删除确认弹窗。 */
function requestDelete(profile: PublicProviderProfile): void {
  deleteCandidate.value = profile
}

/** 关闭删除确认弹窗。 */
function cancelDelete(): void {
  if (busyProfileId.value === deleteCandidate.value?.profileId) return
  deleteCandidate.value = undefined
}

/** 删除已确认的 Profile。 */
async function confirmDelete(): Promise<void> {
  /** 用户当前确认删除的 Profile。 */
  const profile = deleteCandidate.value
  if (!profile || busyProfileId.value !== undefined) return
  busyProfileId.value = profile.profileId
  try {
    /** 删除后的公开 Profile 快照。 */
    const result = await window.ncx.providerProfiles.request({
      operation: 'delete',
      profileId: profile.profileId
    })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
    deleteCandidate.value = undefined
    showToast(`${profile.displayName} 已删除。`, 'success')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '模型删除失败。', 'warning')
  } finally {
    busyProfileId.value = undefined
  }
}

// ========= 生命周期 =========

onMounted(() => {
  void loadProfiles()
  void loadCatalog()
})
</script>

<template>
  <SettingsSection
    section-id="setting-provider-profiles"
    title="模型列表"
    description="管理小云可用的模型配置；API Key 始终由系统安全存储加密。"
  >
    <template #actions>
      <CommonButton
        size="compact"
        variant="primary"
        @click="openAddDialog"
      >
        <Plus :size="14" />新增模型
      </CommonButton>
    </template>

    <div
      v-for="profile in profiles"
      :key="profile.profileId"
      class="model-profile-row"
      :class="{ 'is-active': profile.profileId === activeProfileId }"
    >
      <span class="model-profile-icon"><KeyRound
        :size="17"
        :stroke-width="1.8"
      /></span>
      <span class="model-profile-copy">
        <strong>{{ profile.displayName }}</strong>
        <small>{{ profile.modelId }} · {{ profile.baseUrl }}</small>
      </span>
      <span class="model-profile-status">
        <CheckCircle2
          v-if="profile.capabilitySnapshot?.toolCalls"
          :size="15"
          class="model-profile-verified"
          aria-label="已通过工具调用验证"
        />
        <span
          v-if="profile.profileId === activeProfileId"
          class="model-profile-default"
        >默认</span>
      </span>
      <span class="model-profile-actions">
        <CommonButton
          v-if="profile.enabled"
          size="compact"
          variant="secondary"
          :loading="busyProfileId === profile.profileId"
          :disabled="busyProfileId !== undefined && busyProfileId !== profile.profileId"
          @click="verifyProfile(profile.profileId)"
        >
          <RefreshCw :size="13" />验证
        </CommonButton>
        <CommonButton
          v-if="profile.enabled && profile.profileId !== activeProfileId"
          size="compact"
          variant="secondary"
          :disabled="busyProfileId !== undefined"
          @click="setDefault(profile.profileId)"
        >
          设为默认
        </CommonButton>
        <CommonButton
          size="compact"
          variant="danger"
          :disabled="busyProfileId !== undefined"
          @click="requestDelete(profile)"
        >
          <Trash2 :size="13" />删除
        </CommonButton>
      </span>
    </div>

    <div
      v-if="profiles.length === 0"
      class="model-profile-empty"
    >
      <KeyRound :size="22" />
      <strong>还没有模型</strong>
      <span>新增预设或自定义模型后，小云即可开始工作。</span>
    </div>
  </SettingsSection>

  <CommonDialog
    :visible="addDialogVisible"
    title="新增模型"
    subtitle="从 OpenRouter 最新目录选择预设，或填写自定义兼容服务。"
    width="580px"
    :close-on-overlay-click="!saveBusy"
    :close-on-esc="!saveBusy"
    @close="closeAddDialog"
  >
    <div class="model-add-dialog">
      <CommonSegmentedControl
        class="model-editor-mode"
        :model-value="editor.mode"
        :options="editorModeOptions"
        @update:model-value="setEditorMode"
      />

      <p
        v-if="editor.mode === 'preset'"
        class="model-catalog-note"
      >
        预设目录来自 OpenRouter，当前共 {{ catalog?.modelCount ?? 0 }} 个模型。Base URL 固定为 OpenRouter，需填写 OpenRouter API Key。
      </p>

      <div
        v-if="editor.mode === 'preset'"
        class="model-editor-fields"
      >
        <label>
          <span>选择厂商</span>
          <CommonDropdownMenu
            class="model-provider-dropdown"
            :label="vendorDropdownLabel"
            :items="vendorMenuItems"
            :disabled="catalogLoading || !catalog"
            @select="selectVendor"
          />
        </label>
        <div
          v-if="catalogError"
          class="model-catalog-error"
        >
          <span>{{ catalogError }}</span>
          <CommonButton
            size="compact"
            variant="secondary"
            :loading="catalogLoading"
            @click="loadCatalog"
          >
            重试
          </CommonButton>
        </div>
        <label>
          <span>Base URL</span>
          <CommonInput
            :model-value="editor.baseUrl"
            disabled
            placeholder="选择厂商后自动填写"
          />
        </label>
        <label>
          <span>API KEY</span>
          <CommonInput
            v-model="editor.apiKey"
            type="password"
            clearable
            revealable
            autocomplete="new-password"
            placeholder="OpenRouter API Key"
          />
        </label>
        <label>
          <span>默认模型</span>
          <CommonSelect
            :model-value="editor.modelId"
            :options="modelOptions"
            :disabled="!selectedVendor"
            placeholder="选择模型"
            @update:model-value="setPresetModel"
          />
        </label>
      </div>

      <div
        v-else
        class="model-editor-fields"
      >
        <label>
          <span>厂商</span>
          <CommonInput
            v-model="editor.displayName"
            maxlength="80"
            placeholder="例如：本地 Ollama"
          />
        </label>
        <label>
          <span>Base URL</span>
          <CommonInput
            v-model="editor.baseUrl"
            type="url"
            placeholder="https://provider.example.com/v1"
          />
        </label>
        <label>
          <span>API KEY</span>
          <CommonInput
            v-model="editor.apiKey"
            type="password"
            clearable
            revealable
            autocomplete="new-password"
            placeholder="本地服务可留空"
          />
        </label>
        <label>
          <span>默认模型</span>
          <CommonInput
            v-model="editor.modelId"
            placeholder="模型 ID"
          />
        </label>
      </div>

      <p class="model-profile-data-disclosure">
        对话时只发送当前消息与上下文选择器选中的必要画像/记忆；画像分析只发送本地聚合特征和有限代表样本。使用云端 Provider 可能产生 Token 费用，不会发送 Cookie、账户数据库或完整歌单文件。
      </p>
    </div>

    <template #actions>
      <CommonButton
        variant="secondary"
        :disabled="saveBusy"
        @click="closeAddDialog"
      >
        取消
      </CommonButton>
      <CommonButton
        variant="primary"
        :loading="saveBusy"
        @click="saveProfile"
      >
        新增模型
      </CommonButton>
    </template>
  </CommonDialog>

  <CommonAlertDialog
    :visible="Boolean(deleteCandidate)"
    title="删除模型？"
    :description="deleteDescription"
    confirm-text="删除"
    @cancel="cancelDelete"
    @confirm="confirmDelete"
  />
</template>
