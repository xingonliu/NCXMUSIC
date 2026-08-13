<script setup lang="ts">
import { Moon, Palette, Sun } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { MusicQualityPreference } from '../../../domains/player/types'
import type { AccountSessionSnapshot } from '../../../shared/schemas/account'
import type { AccountDataResult } from '../../../shared/schemas/account-data'
import type { AppTheme } from '../../../shared/schemas/storage'
import {
  CommonAlertDialog,
  CommonButton,
  CommonSelect,
  CommonSwitch,
  type CommonOption
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { zhCN } from '../../locales/zh-CN'
import { useAccountSessionStore } from '../account/account-session-store'
import { usePlayer } from '../music/use-player'
import { useAppPreferences } from './app-preferences'
import ExtensionsSettingsPanel from './ExtensionsSettingsPanel.vue'
import ModelSettingsPanel from './ModelSettingsPanel.vue'
import PersonalizationSettingsPanel from './PersonalizationSettingsPanel.vue'
import SecuritySettingsPanel from './SecuritySettingsPanel.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import VoiceSettingsPanel from './VoiceSettingsPanel.vue'
import {
  getSettingsNavigationItem,
  normalizeSettingsTab,
  type SettingsTab
} from './settings-navigation'
import './settings-page.css'

// ========= 变量 =========

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 播放器接口，用于设置全局音质偏好。 */
const player = usePlayer()

/** 应用界面偏好。 */
const appPreferences = useAppPreferences()

/** 当前设置路由。 */
const route = useRoute()

/** 设置页路由控制器。 */
const router = useRouter()

/** 播放文案集合。 */
const playerText = zhCN.player

/** 当前路由对应的合法设置标签。 */
const activeTab = computed<SettingsTab>(() => normalizeSettingsTab(route.query['tab']))

/** 当前设置标签的标题与说明。 */
const activeNavigationItem = computed(() => getSettingsNavigationItem(activeTab.value))

/** 清理缓存确认框显示状态。 */
const clearCacheDialogVisible = ref<boolean>(false)

/** 删除当前账户本地业务数据确认框显示状态。 */
const deleteLocalDataDialogVisible = ref<boolean>(false)

/** 当前账户数据库、缓存与 Journal 统计。 */
const dataStats = ref<Extract<AccountDataResult, { operation: 'getStats' }> | null>(null)

/** 账户数据操作是否正在执行。 */
const dataBusy = ref<boolean>(false)

/** 搜索定位高亮的清理定时器。 */
let highlightTimer: number | undefined

/** 音质偏好选项。 */
const qualityOptions: CommonOption[] = [
  { label: '自动（最高可用）', value: 'auto' },
  { label: playerText.quality.standard, value: 'standard' },
  { label: playerText.quality.higher, value: 'higher' },
  { label: playerText.quality.exhigh, value: 'exhigh' },
  { label: playerText.quality.lossless, value: 'lossless' },
  { label: playerText.quality.hires, value: 'hires' },
  { label: playerText.quality.jyeffect, value: 'jyeffect' },
  { label: playerText.quality.sky, value: 'sky' },
  { label: playerText.quality.dolby, value: 'dolby' },
  { label: playerText.quality.jymaster, value: 'jymaster' }
]

/** 关闭窗口行为选项。 */
const closeBehaviorOptions: CommonOption[] = [
  { label: '关闭到托盘并继续播放', value: 'minimize' },
  { label: '退出应用', value: 'quit' }
]

/** 当前账户安全快照。 */
const accountSnapshot = computed<AccountSessionSnapshot | undefined>(() => account.snapshot.value)

/** 当前展示账户引用。 */
const accountReference = computed<string>(() => accountSnapshot.value?.activeAccount.accountId ?? 'guest:local')

// ========= 函数 =========

/** 设置播放器全局音质偏好。 */
function setPlaybackQuality(value: string | number): void {
  /** 经通用选择器返回的音质值。 */
  const quality = String(value) as MusicQualityPreference
  void player.setQuality(quality)
  persistAccountPreference('playback.quality', quality)
}

/** 设置应用主题。 */
function setTheme(theme: AppTheme): void {
  appPreferences.setTheme(theme)
  persistAccountPreference('appearance.theme', theme)
}

/** 设置是否展示歌词翻译。 */
function setLyricTranslation(value: boolean): void {
  appPreferences.setShowLyricTranslation(value)
  persistAccountPreference('lyrics.showTranslation', value)
}

/** 将单个用户偏好写入当前账户 SQLite；账户切换后的迟到写入由 Utility 拒绝。 */
function persistAccountPreference(key: string, value: string | boolean): void {
  /** 写入开始时的账户快照。 */
  const snapshot = accountSnapshot.value
  if (!snapshot) return
  void window.ncx.runtime.accountData({
    operation: 'setPreference',
    accountId: snapshot.activeAccount.accountId,
    accountGeneration: snapshot.accountGeneration,
    key,
    value
  })
}

/** 从账户 SQLite 恢复主题、歌词翻译与音质偏好。 */
async function loadAccountPreferences(): Promise<void> {
  /** 读取开始时的账户快照。 */
  const snapshot = accountSnapshot.value
  if (!snapshot) return
  /** 当前账户的偏好读取响应。 */
  const response = await window.ncx.runtime.accountData({
    operation: 'getPreferences',
    accountId: snapshot.activeAccount.accountId,
    accountGeneration: snapshot.accountGeneration
  })
  if (!response.ok || response.data.operation !== 'getPreferences') return
  /** 当前账户持久偏好字典。 */
  const preferences = response.data.preferences
  /** 已校验的账户主题偏好。 */
  const theme = preferences['appearance.theme']
  if (theme === 'system' || theme === 'light' || theme === 'dark') {
    appPreferences.hydrateTheme(theme)
  }
  /** 已校验的歌词翻译显示偏好。 */
  const showTranslation = preferences['lyrics.showTranslation']
  if (typeof showTranslation === 'boolean') {
    appPreferences.hydrateShowLyricTranslation(showTranslation)
  }
  /** 已校验的账户播放音质偏好。 */
  const quality = preferences['playback.quality']
  if (typeof quality === 'string' && qualityOptions.some((option) => option.value === quality)) {
    await player.setQuality(quality as MusicQualityPreference)
  }
}

/** 设置主窗口关闭行为并通知 Main。 */
function setCloseBehavior(value: string | number): void {
  /** 收敛后的窗口关闭行为。 */
  const behavior = String(value) === 'quit' ? 'quit' : 'minimize'
  appPreferences.setCloseWindowBehavior(behavior)
  void window.ncx.windowControls.send({ type: 'window.setCloseBehavior', behavior })
}

/** 清理可重建缓存并保留应用偏好。 */
async function clearCache(): Promise<void> {
  clearCacheDialogVisible.value = false
  /** 清理开始时的账户快照。 */
  const snapshot = accountSnapshot.value
  if (!snapshot) return
  dataBusy.value = true
  /** Main 完成缓存清理后的响应。 */
  const response = await window.ncx.runtime.accountData({
    operation: 'clearCache',
    accountId: snapshot.activeAccount.accountId,
    accountGeneration: snapshot.accountGeneration
  })
  appPreferences.clearRendererCache()
  dataBusy.value = false
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  if (response.data.operation !== 'clearCache') {
    showToast('缓存清理响应类型不匹配。', 'warning')
    return
  }
  showToast(`已清理 ${formatBytes(response.data.clearedBytes)} 可重建缓存。`, 'success')
  await loadDataStats()
}

/** 读取当前账户数据统计。 */
async function loadDataStats(): Promise<void> {
  /** 读取开始时的账户快照。 */
  const snapshot = accountSnapshot.value
  if (!snapshot) return
  /** 当前账户的统计读取响应。 */
  const response = await window.ncx.runtime.accountData({
    operation: 'getStats',
    accountId: snapshot.activeAccount.accountId,
    accountGeneration: snapshot.accountGeneration
  })
  dataStats.value = response.ok && response.data.operation === 'getStats' ? response.data : null
}

/** 删除当前账户业务目录并保留 Main 持有的登录 Cookie。 */
async function deleteCurrentLocalData(): Promise<void> {
  deleteLocalDataDialogVisible.value = false
  /** 删除开始时的账户快照。 */
  const snapshot = accountSnapshot.value
  if (!snapshot) return
  dataBusy.value = true
  /** Main 完成当前账户数据删除后的响应。 */
  const response = await window.ncx.runtime.accountData({
    operation: 'deleteLocalData',
    accountId: snapshot.activeAccount.accountId,
    accountGeneration: snapshot.accountGeneration
  })
  if (response.ok) await player.clear()
  dataBusy.value = false
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  showToast('当前账户本地数据已删除，登录状态保持不变。', 'success')
  await loadDataStats()
}

/** 将字节数格式化为易读文本。 */
function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

/** 从小云设置打开当前账户数据与记忆管理。 */
function openAccountDataSettings(): void {
  void router.replace({
    name: 'settings',
    query: { ...route.query, tab: 'data', setting: 'setting-account-data' }
  })
}

/** 滚动并短暂高亮侧栏搜索指定的设置项。 */
function focusRequestedSetting(): void {
  /** 当前路由指定的设置项 ID。 */
  const requestedSetting = route.query['setting']
  if (typeof requestedSetting !== 'string') return
  void nextTick(() => {
    /** 与搜索结果对应的页面元素。 */
    const target = document.getElementById(requestedSetting)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.remove('settings-target-highlight')
    void target.offsetWidth
    target.classList.add('settings-target-highlight')
    if (highlightTimer !== undefined) window.clearTimeout(highlightTimer)
    highlightTimer = window.setTimeout(() => {
      target.classList.remove('settings-target-highlight')
      highlightTimer = undefined
    }, 1_800)
  })
}

// ========= 生命周期 =========

onMounted(async () => {
  await account.initialize()
  /** Main 持久化并在启动时恢复的权威关闭行为。 */
  const snapshot = await window.ncx.windowControls.snapshot()
  if (snapshot.closeBehavior) {
    appPreferences.hydrateCloseWindowBehavior(snapshot.closeBehavior)
  }
})

/** 账户切换后刷新隔离空间统计。 */
watch(
  () => [accountSnapshot.value?.activeAccount.accountId, accountSnapshot.value?.accountGeneration],
  () => {
    void loadDataStats()
    void loadAccountPreferences()
  },
  { immediate: true }
)

/** 标签或搜索定位变化后滚动到具体设置项。 */
watch(
  () => [route.query['tab'], route.query['setting']],
  focusRequestedSetting,
  { immediate: true }
)

onBeforeUnmount(() => {
  if (highlightTimer !== undefined) window.clearTimeout(highlightTimer)
})
</script>

<template>
  <section
    class="settings-page"
    aria-labelledby="settings-title"
  >
    <header class="settings-heading">
      <h1 id="settings-title">
        {{ activeNavigationItem.label }}
      </h1>
      <p>{{ activeNavigationItem.description }}</p>
    </header>

    <SettingsSection
      v-if="activeTab === 'general'"
      title="应用行为"
      description="控制主窗口关闭后应用如何继续运行。"
    >
      <SettingsRow
        setting-id="setting-close-window"
        title="关闭窗口"
        description="关闭到托盘时主窗口隐藏，AudioHost 与播放队列保持运行。"
      >
        <CommonSelect
          class="settings-control"
          :model-value="appPreferences.preferences.value.closeWindowBehavior"
          :options="closeBehaviorOptions"
          @update:model-value="setCloseBehavior"
        />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection
      v-else-if="activeTab === 'music'"
      title="播放"
      description="这些偏好会立即应用到当前账户和播放会话。"
    >
      <SettingsRow
        setting-id="setting-playback-quality"
        title="播放音质"
        description="播放中切换会重新解析当前歌曲并尽量保持进度。"
      >
        <CommonSelect
          class="settings-control"
          :model-value="player.snapshot.value.quality"
          :options="qualityOptions"
          @update:model-value="setPlaybackQuality"
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-lyric-translation"
        title="歌词翻译"
        description="在普通歌词与沉浸歌词中显示翻译行。"
      >
        <CommonSwitch
          :model-value="appPreferences.preferences.value.showLyricTranslation"
          label="显示歌词翻译"
          @update:model-value="setLyricTranslation"
        />
      </SettingsRow>
    </SettingsSection>

    <ModelSettingsPanel v-else-if="activeTab === 'models'" />

    <PersonalizationSettingsPanel
      v-else-if="activeTab === 'agent'"
      @open-data="openAccountDataSettings"
    />

    <ExtensionsSettingsPanel
      v-else-if="activeTab === 'mcp'"
      mode="mcp"
    />

    <ExtensionsSettingsPanel
      v-else-if="activeTab === 'skill'"
      mode="skill"
    />

    <VoiceSettingsPanel v-else-if="activeTab === 'voice'" />

    <SecuritySettingsPanel v-else-if="activeTab === 'security'" />

    <SettingsSection
      v-else-if="activeTab === 'appearance'"
      title="界面"
      description="主题会跟随当前账户保存，并即时更新整个应用。"
    >
      <SettingsRow
        setting-id="setting-theme"
        title="主题"
        description="选择跟随系统、浅色或深色外观。"
      >
        <div
          class="settings-theme-options"
          role="group"
          aria-label="主题"
        >
          <CommonButton
            :variant="appPreferences.preferences.value.theme === 'system' ? 'primary' : 'secondary'"
            @click="setTheme('system')"
          >
            <Palette :size="14" />系统
          </CommonButton>
          <CommonButton
            :variant="appPreferences.preferences.value.theme === 'light' ? 'primary' : 'secondary'"
            @click="setTheme('light')"
          >
            <Sun :size="14" />浅色
          </CommonButton>
          <CommonButton
            :variant="appPreferences.preferences.value.theme === 'dark' ? 'primary' : 'secondary'"
            @click="setTheme('dark')"
          >
            <Moon :size="14" />深色
          </CommonButton>
        </div>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection
      v-else
      title="本地存储"
      description="危险操作只影响当前账户在本机保存的数据。"
    >
      <SettingsRow
        setting-id="setting-account-data"
        title="账户数据"
      >
        <template #description>
          当前空间 {{ accountReference }} · 数据库 {{ formatBytes(dataStats?.databaseBytes ?? 0) }} ·
          对话 {{ dataStats?.chatMessages ?? 0 }} 条 · 记忆块 {{ dataStats?.conversationBlocks ?? 0 }} 个 ·
          画像 v{{ dataStats?.profileVersion ?? 0 }} · Journal {{ dataStats?.journalEvents ?? 0 }} 条
        </template>
        <CommonButton
          variant="danger"
          :loading="dataBusy"
          @click="deleteLocalDataDialogVisible = true"
        >
          删除本地数据
        </CommonButton>
      </SettingsRow>
      <SettingsRow
        setting-id="setting-rebuildable-cache"
        title="可重建缓存"
        :description="`当前 ${formatBytes(dataStats?.cacheBytes ?? 0)}；清理后不删除账户数据库、Cookie 或播放快照。`"
      >
        <CommonButton
          variant="danger"
          :loading="dataBusy"
          @click="clearCacheDialogVisible = true"
        >
          清理缓存
        </CommonButton>
      </SettingsRow>
    </SettingsSection>

    <CommonAlertDialog
      :visible="clearCacheDialogVisible"
      title="清理可重建缓存？"
      description="账户数据库、登录会话和播放快照不会被删除。"
      type="warning"
      confirm-text="清理"
      @cancel="clearCacheDialogVisible = false"
      @confirm="clearCache"
    />

    <CommonAlertDialog
      :visible="deleteLocalDataDialogVisible"
      title="删除当前账户本地数据？"
      description="将删除当前账户的聊天、长期记忆、画像、基础资料、播放快照、偏好、Action Journal 与可重建缓存，但不会删除登录 Cookie 或网易云云端数据。此操作无法撤销。"
      confirm-text="删除本地数据"
      @cancel="deleteLocalDataDialogVisible = false"
      @confirm="deleteCurrentLocalData"
    />
  </section>
</template>
