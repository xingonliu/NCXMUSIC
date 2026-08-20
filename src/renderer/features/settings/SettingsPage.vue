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
import { isSupportedLocale, SUPPORTED_LOCALES, useI18n , translatePublicError} from '../../i18n'
import { useAccountSessionStore } from '../account/account-session-store'
import { usePlayer } from '../music/use-player'
import {
  type LyricAlignmentPreset,
  type LyricFontSizePreset,
  type LyricFontWeightPreset,
  type LyricMotionPreset,
  useAppPreferences
} from './app-preferences'
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

/** 响应当前语言变化的界面文案。 */
const i18n = useI18n()

/** 当前设置路由。 */
const route = useRoute()

/** 设置页路由控制器。 */
const router = useRouter()

/** 播放文案集合。 */
const playerText = computed(() => i18n.messages.value.player)

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
const qualityOptions = computed<CommonOption[]>(() => [
  { label: '自动（最高可用）', value: 'auto' },
  { label: playerText.value.quality.standard, value: 'standard' },
  { label: playerText.value.quality.higher, value: 'higher' },
  { label: playerText.value.quality.exhigh, value: 'exhigh' },
  { label: playerText.value.quality.lossless, value: 'lossless' },
  { label: playerText.value.quality.hires, value: 'hires' },
  { label: playerText.value.quality.jyeffect, value: 'jyeffect' },
  { label: playerText.value.quality.sky, value: 'sky' },
  { label: playerText.value.quality.dolby, value: 'dolby' },
  { label: playerText.value.quality.jymaster, value: 'jymaster' }
])

/** 应用支持的界面语言选项。 */
const languageOptions: CommonOption[] = SUPPORTED_LOCALES.map((option) => ({
  label: option.label,
  value: option.value
}))

/** 关闭窗口行为选项。 */
const closeBehaviorOptions: CommonOption[] = [
  { label: '关闭到托盘并继续播放', value: 'minimize' },
  { label: '退出应用', value: 'quit' }
]

/** 当前歌词垂直焦点的用户级预设。 */
const lyricAlignmentOptions: CommonOption[] = [
  { label: '靠上', value: 'upper' },
  { label: '居中', value: 'center' },
  { label: '靠下', value: 'lower' }
]

/** 歌词空间动效强度的用户级预设。 */
const lyricMotionOptions: CommonOption[] = [
  { label: '完整', value: 'full' },
  { label: '轻柔', value: 'soft' },
  { label: '简洁', value: 'minimal' }
]

/** 沉浸歌词字号的用户级预设。 */
const lyricFontSizeOptions: CommonOption[] = [
  { label: '紧凑', value: 'compact' },
  { label: '标准', value: 'standard' },
  { label: '大号', value: 'large' },
  { label: '超大号', value: 'extraLarge' }
]

/** 歌词字重的用户级预设。 */
const lyricFontWeightOptions: CommonOption[] = [
  { label: '细', value: 'light' },
  { label: '常规', value: 'regular' },
  { label: '中粗', value: 'semibold' },
  { label: '粗体', value: 'bold' },
  { label: '超粗体', value: 'heavy' }
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

/** 设置应用界面语言；未知值不会覆盖当前偏好。 */
function setApplicationLocale(value: string | number): void {
  /** 通用选择器返回的候选语言标签。 */
  const locale = String(value)
  if (isSupportedLocale(locale)) appPreferences.setLocale(locale)
}

/** 设置是否展示歌词翻译。 */
function setLyricTranslation(value: boolean): void {
  appPreferences.setShowLyricTranslation(value)
  persistAccountPreference('lyrics.showTranslation', value)
}

/** 设置当前歌词的垂直焦点预设。 */
function setLyricAlignment(value: string | number): void {
  /** 通用选择器返回的歌词焦点预设。 */
  const alignment = String(value) as LyricAlignmentPreset
  appPreferences.setLyricAlignment(alignment)
  persistAccountPreference('lyrics.alignment', alignment)
}

/** 设置歌词空间动效强度预设。 */
function setLyricMotion(value: string | number): void {
  /** 通用选择器返回的歌词动效预设。 */
  const motion = String(value) as LyricMotionPreset
  appPreferences.setLyricMotion(motion)
  persistAccountPreference('lyrics.motion', motion)
}

/** 设置沉浸歌词字号预设。 */
function setLyricFontSize(value: string | number): void {
  /** 通用选择器返回的歌词字号预设。 */
  const fontSize = String(value) as LyricFontSizePreset
  appPreferences.setLyricFontSize(fontSize)
  persistAccountPreference('lyrics.fontSize', fontSize)
}

/** 设置歌词字重预设。 */
function setLyricFontWeight(value: string | number): void {
  /** 通用选择器返回的歌词字重预设。 */
  const fontWeight = String(value) as LyricFontWeightPreset
  appPreferences.setLyricFontWeight(fontWeight)
  persistAccountPreference('lyrics.fontWeight', fontWeight)
}

/** 设置是否隐藏已经唱完的歌词行。 */
function setHidePassedLyrics(value: boolean): void {
  appPreferences.setHidePassedLyrics(value)
  persistAccountPreference('lyrics.hidePassed', value)
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
  /** 已校验的歌词焦点预设。 */
  const lyricAlignment = preferences['lyrics.alignment']
  if (lyricAlignment === 'upper' || lyricAlignment === 'center' || lyricAlignment === 'lower') {
    appPreferences.hydrateLyricAlignment(lyricAlignment)
  }
  /** 已校验的歌词动效强度预设。 */
  const lyricMotion = preferences['lyrics.motion']
  if (lyricMotion === 'full' || lyricMotion === 'soft' || lyricMotion === 'minimal') {
    appPreferences.hydrateLyricMotion(lyricMotion)
  }
  /** 已校验的沉浸歌词字号预设。 */
  const lyricFontSize = preferences['lyrics.fontSize']
  if (lyricFontSize === 'compact'
    || lyricFontSize === 'standard'
    || lyricFontSize === 'large'
    || lyricFontSize === 'extraLarge') {
    appPreferences.hydrateLyricFontSize(lyricFontSize)
  }
  /** 已校验的歌词字重预设。 */
  const lyricFontWeight = preferences['lyrics.fontWeight']
  if (lyricFontWeight === 'light'
    || lyricFontWeight === 'regular'
    || lyricFontWeight === 'semibold'
    || lyricFontWeight === 'bold'
    || lyricFontWeight === 'heavy') {
    appPreferences.hydrateLyricFontWeight(lyricFontWeight)
  }
  /** 已校验的隐藏已唱歌词偏好。 */
  const hidePassedLyrics = preferences['lyrics.hidePassed']
  if (typeof hidePassedLyrics === 'boolean') {
    appPreferences.hydrateHidePassedLyrics(hidePassedLyrics)
  }
  /** 已校验的账户播放音质偏好。 */
  const quality = preferences['playback.quality']
  if (typeof quality === 'string' && qualityOptions.value.some((option) => option.value === quality)) {
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
    showToast(translatePublicError(response.error), 'warning')
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
    showToast(translatePublicError(response.error), 'warning')
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
        {{ $tSource(activeNavigationItem.label) }}
      </h1>
      <p>{{ $tSource(activeNavigationItem.description) }}</p>
    </header>

    <SettingsSection
      v-if="activeTab === 'general'"
      :title="$tSource('应用行为')"
    >
      <SettingsRow
        setting-id="setting-close-window"
        :title="$tSource('关闭窗口')"
        :description="$tSource('关闭到托盘时主窗口隐藏，AudioHost 与播放队列保持运行。')"
      >
        <CommonSelect
          class="settings-control"
          :model-value="appPreferences.preferences.value.closeWindowBehavior"
          :options="closeBehaviorOptions"
          @update:model-value="setCloseBehavior"
        />
      </SettingsRow>
      <SettingsRow
        setting-id="setting-language"
        :title="$tSource('界面语言')"
        :description="$tSource('选择应用界面使用的语言；切换后立即生效。')"
      >
        <CommonSelect
          class="settings-control"
          :model-value="appPreferences.preferences.value.locale"
          :options="languageOptions"
          @update:model-value="setApplicationLocale"
        />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection
      v-else-if="activeTab === 'music'"
      :title="$tSource('播放')"
    >
      <SettingsRow
        setting-id="setting-playback-quality"
        :title="$tSource('播放音质')"
        :description="$tSource('播放中切换会重新解析当前歌曲并尽量保持进度。')"
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
        :title="$tSource('歌词翻译')"
        :description="$tSource('在普通歌词与沉浸歌词中显示翻译行。')"
      >
        <CommonSwitch
          :model-value="appPreferences.preferences.value.showLyricTranslation"
          :label="$tSource('显示歌词翻译')"
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

    <template v-else-if="activeTab === 'appearance'">
      <SettingsSection
        :title="$tSource('界面')"
      >
        <SettingsRow
          setting-id="setting-theme"
          :title="$tSource('主题')"
          :description="$tSource('选择跟随系统、浅色或深色外观。')"
        >
          <div
            class="settings-theme-options"
            role="group"
            :aria-label="$tSource('主题')"
          >
            <CommonButton
              :variant="appPreferences.preferences.value.theme === 'system' ? 'primary' : 'secondary'"
              @click="setTheme('system')"
            >
              <Palette :size="14" />{{ $tSource("系统") }}
            </CommonButton>
            <CommonButton
              :variant="appPreferences.preferences.value.theme === 'light' ? 'primary' : 'secondary'"
              @click="setTheme('light')"
            >
              <Sun :size="14" />{{ $tSource("浅色") }}
            </CommonButton>
            <CommonButton
              :variant="appPreferences.preferences.value.theme === 'dark' ? 'primary' : 'secondary'"
              @click="setTheme('dark')"
            >
              <Moon :size="14" />{{ $tSource("深色") }}
            </CommonButton>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        :title="$tSource('歌词页')"
      >
        <SettingsRow
          setting-id="setting-lyric-alignment"
          :title="$tSource('当前歌词位置')"
          :description="$tSource('选择当前歌词在沉浸视图中的垂直焦点。')"
        >
          <CommonSelect
            class="settings-control"
            :model-value="appPreferences.preferences.value.lyricAlignment"
            :options="lyricAlignmentOptions"
            @update:model-value="setLyricAlignment"
          />
        </SettingsRow>
        <SettingsRow
          setting-id="setting-lyric-motion"
          :title="$tSource('歌词动效')"
          :description="$tSource('完整包含弹簧、缩放和模糊；轻柔移除模糊；简洁保留同步扫光。')"
        >
          <CommonSelect
            class="settings-control"
            :model-value="appPreferences.preferences.value.lyricMotion"
            :options="lyricMotionOptions"
            @update:model-value="setLyricMotion"
          />
        </SettingsRow>
        <SettingsRow
          setting-id="setting-lyric-font-size"
          :title="$tSource('歌词字号')"
          :description="$tSource('调整沉浸歌词主行的整体字号。')"
        >
          <CommonSelect
            class="settings-control"
            :model-value="appPreferences.preferences.value.lyricFontSize"
            :options="lyricFontSizeOptions"
            @update:model-value="setLyricFontSize"
          />
        </SettingsRow>
        <SettingsRow
          setting-id="setting-lyric-font-weight"
          :title="$tSource('歌词字重')"
          :description="$tSource('调整主歌词、翻译与音译的粗细。')"
        >
          <CommonSelect
            class="settings-control"
            :model-value="appPreferences.preferences.value.lyricFontWeight"
            :options="lyricFontWeightOptions"
            @update:model-value="setLyricFontWeight"
          />
        </SettingsRow>
        <SettingsRow
          setting-id="setting-hide-passed-lyrics"
          :title="$tSource('已唱歌词')"
          :description="$tSource('隐藏后可减少视觉干扰，仍可滚动查看完整歌词。')"
        >
          <CommonSwitch
            :model-value="appPreferences.preferences.value.hidePassedLyrics"
            :label="$tSource('隐藏已唱歌词')"
            @update:model-value="setHidePassedLyrics"
          />
        </SettingsRow>
      </SettingsSection>
    </template>

    <SettingsSection
      v-else
      :title="$tSource('本地存储')"
    >
      <SettingsRow
        setting-id="setting-account-data"
        :title="$tSource('账户数据')"
      >
        <template #description>
          {{ $tSource("当前空间") }} {{ accountReference }} {{ $tSource("· 数据库") }} {{ formatBytes(dataStats?.databaseBytes ?? 0) }} {{ $tSource("· 对话") }} {{ dataStats?.chatMessages ?? 0 }} {{ $tSource("条 · 记忆块") }} {{ dataStats?.conversationBlocks ?? 0 }} {{ $tSource("个 · 画像 v") }}{{ dataStats?.profileVersion ?? 0 }} · Journal {{ dataStats?.journalEvents ?? 0 }} {{ $tSource("条") }}
        </template>
        <CommonButton
          variant="danger"
          :loading="dataBusy"
          @click="deleteLocalDataDialogVisible = true"
        >
          {{ $tSource("删除本地数据") }}
        </CommonButton>
      </SettingsRow>
      <SettingsRow
        setting-id="setting-rebuildable-cache"
        :title="$tSource('可重建缓存')"
        :description="$tSource(`当前 ${formatBytes(dataStats?.cacheBytes ?? 0)}；清理后不删除账户数据库、Cookie 或播放快照。`)"
      >
        <CommonButton
          variant="danger"
          :loading="dataBusy"
          @click="clearCacheDialogVisible = true"
        >
          {{ $tSource("清理缓存") }}
        </CommonButton>
      </SettingsRow>
    </SettingsSection>

    <CommonAlertDialog
      :visible="clearCacheDialogVisible"
      :title="$tSource('清理可重建缓存？')"
      :description="$tSource('账户数据库、登录会话和播放快照不会被删除。')"
      type="warning"
      :confirm-text="$tSource('清理')"
      @cancel="clearCacheDialogVisible = false"
      @confirm="clearCache"
    />

    <CommonAlertDialog
      :visible="deleteLocalDataDialogVisible"
      :title="$tSource('删除当前账户本地数据？')"
      :description="$tSource('将删除当前账户的聊天、长期记忆、画像、基础资料、播放快照、偏好、Action Journal 与可重建缓存，但不会删除登录 Cookie 或网易云云端数据。此操作无法撤销。')"
      :confirm-text="$tSource('删除本地数据')"
      @cancel="deleteLocalDataDialogVisible = false"
      @confirm="deleteCurrentLocalData"
    />
  </section>
</template>
