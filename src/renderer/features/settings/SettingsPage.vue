<script setup lang="ts">
import {
  Database,
  Headphones,
  LogIn,
  LogOut,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound
} from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import type { MusicQualityPreference } from '../../../domains/player/types'
import type { AccountSessionSnapshot } from '../../../shared/schemas/account'
import type { AccountDataResult } from '../../../shared/schemas/account-data'
import type { AppTheme } from '../../../shared/schemas/storage'
import {
  CommonAlertDialog,
  CommonButton,
  CommonSelect,
  CommonSwitch,
  CommonTabs,
  type CommonOption
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { zhCN } from '../../locales/zh-CN'
import { useAccountSessionStore } from '../account/account-session-store'
import { usePlayer } from '../music/use-player'
import { useAppPreferences } from './app-preferences'
import './settings-page.css'

// ========= 类型 =========

/** 设置页标签。 */
type SettingsTab = 'account' | 'music' | 'appearance' | 'data'

/** 账户操作类型。 */
type AccountAction = 'login' | 'logout' | 'switch'

// ========= 变量 =========

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 播放器接口，用于设置全局音质偏好。 */
const player = usePlayer()

/** 应用界面偏好。 */
const appPreferences = useAppPreferences()

/** 播放文案集合。 */
const playerText = zhCN.player

/** 当前设置标签。 */
const activeTab = ref<SettingsTab>('account')

/** 当前进行中的账户操作。 */
const busyAction = ref<AccountAction | null>(null)

/** 清理缓存确认框显示状态。 */
const clearCacheDialogVisible = ref<boolean>(false)

/** 删除当前账户本地业务数据确认框显示状态。 */
const deleteLocalDataDialogVisible = ref<boolean>(false)

/** 当前账户数据库、缓存与 Journal 统计。 */
const dataStats = ref<Extract<AccountDataResult, { operation: 'getStats' }> | null>(null)

/** 账户数据操作是否正在执行。 */
const dataBusy = ref<boolean>(false)

/** 设置标签选项。 */
const tabOptions: CommonOption[] = [
  { label: '账户', value: 'account' },
  { label: '音乐', value: 'music' },
  { label: '外观', value: 'appearance' },
  { label: '数据', value: 'data' }
]

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
  { label: '最小化并继续播放', value: 'minimize' },
  { label: '退出应用', value: 'quit' }
]

/** 当前账户安全快照。 */
const accountSnapshot = computed<AccountSessionSnapshot | undefined>(() => account.snapshot.value)

/** 当前展示账户名称。 */
const accountName = computed<string>(() => accountSnapshot.value?.activeAccount.displayName ?? '游客')

/** 当前展示账户引用。 */
const accountReference = computed<string>(() => accountSnapshot.value?.activeAccount.accountId ?? 'guest:local')

/** 当前登录状态标签。 */
const accountStateLabel = computed<string>(() => {
  const state = accountSnapshot.value?.state ?? 'logged_out'
  const labels: Record<AccountSessionSnapshot['state'], string> = {
    logged_out: '游客',
    opening_official_login: '打开登录',
    waiting_for_cookie: '等待登录',
    validating_cookie: '验证中',
    authenticated: '已登录',
    session_expired: '已过期',
    validation_failed: '验证失败',
    cancelled: '已取消'
  }
  return labels[state]
})

// ========= 函数 =========

/** 执行账户操作并刷新安全快照。 */
async function runAccountAction(action: AccountAction): Promise<void> {
  if (busyAction.value) return
  busyAction.value = action
  try {
    if (action === 'login') await window.ncx.account.login()
    else if (action === 'logout') await window.ncx.account.logout()
    else await window.ncx.account.switchAccount()
  } finally {
    busyAction.value = null
  }
}

/** 设置播放器全局音质偏好。 */
function setPlaybackQuality(value: string | number): void {
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
  const snapshot = accountSnapshot.value
  if (!snapshot) return
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
  const behavior = String(value) === 'quit' ? 'quit' : 'minimize'
  appPreferences.setCloseWindowBehavior(behavior)
  void window.ncx.windowControls.send({ type: 'window.setCloseBehavior', behavior })
}

/** 清理可重建缓存并保留应用偏好。 */
async function clearCache(): Promise<void> {
  clearCacheDialogVisible.value = false
  const snapshot = accountSnapshot.value
  if (!snapshot) return
  dataBusy.value = true
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
  const snapshot = accountSnapshot.value
  if (!snapshot) return
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
  const snapshot = accountSnapshot.value
  if (!snapshot) return
  dataBusy.value = true
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

/** 切换设置标签。 */
function setActiveTab(value: string | number): void {
  activeTab.value = String(value) as SettingsTab
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
</script>

<template>
  <section class="settings-page" aria-labelledby="settings-title">
    <header class="settings-heading">
      <p class="settings-eyebrow">偏好设置</p>
      <h1 id="settings-title">设置</h1>
    </header>

    <CommonTabs
      class="settings-tabs"
      :model-value="activeTab"
      :options="tabOptions"
      variant="segmented"
      @update:model-value="setActiveTab"
    />

    <div v-if="activeTab === 'account'" class="settings-list">
      <section class="settings-row settings-row--profile">
        <span class="settings-row-icon"><UserRound :size="19" /></span>
        <div class="settings-row-copy">
          <h2>{{ accountName }}</h2>
          <p>{{ accountReference }} · generation {{ accountSnapshot?.accountGeneration ?? 0 }}</p>
        </div>
        <span class="settings-state">{{ accountStateLabel }}</span>
      </section>
      <section class="settings-row">
        <span class="settings-row-icon"><ShieldCheck :size="19" /></span>
        <div class="settings-row-copy">
          <h2>账户会话</h2>
          <p>Renderer 凭据不可读，Cookie 只在 Utility 租约内使用。</p>
        </div>
        <div class="settings-actions">
          <CommonButton
            variant="primary"
            :loading="busyAction === 'login'"
            :disabled="!accountSnapshot?.canLogin"
            @click="runAccountAction('login')"
          ><LogIn :size="14" />登录</CommonButton>
          <CommonButton
            variant="secondary"
            :loading="busyAction === 'switch'"
            :disabled="!accountSnapshot?.canSwitchAccount"
            @click="runAccountAction('switch')"
          >切换账号</CommonButton>
          <CommonButton
            variant="danger"
            :loading="busyAction === 'logout'"
            :disabled="!accountSnapshot?.canLogout"
            @click="runAccountAction('logout')"
          ><LogOut :size="14" />退出</CommonButton>
        </div>
      </section>
    </div>

    <div v-else-if="activeTab === 'music'" class="settings-list">
      <section class="settings-row">
        <span class="settings-row-icon"><Headphones :size="19" /></span>
        <div class="settings-row-copy">
          <h2>播放音质</h2>
          <p>播放中切换会重新解析当前歌曲并尽量保持进度。</p>
        </div>
        <CommonSelect
          class="settings-control"
          :model-value="player.snapshot.value.quality"
          :options="qualityOptions"
          @update:model-value="setPlaybackQuality"
        />
      </section>
      <section class="settings-row">
        <span class="settings-row-icon"><Headphones :size="19" /></span>
        <div class="settings-row-copy">
          <h2>歌词翻译</h2>
          <p>在普通歌词与沉浸歌词中显示翻译行。</p>
        </div>
        <CommonSwitch
          :model-value="appPreferences.preferences.value.showLyricTranslation"
          label="显示歌词翻译"
          @update:model-value="setLyricTranslation"
        />
      </section>
      <section class="settings-row">
        <span class="settings-row-icon"><Headphones :size="19" /></span>
        <div class="settings-row-copy">
          <h2>关闭窗口</h2>
          <p>最小化时 AudioHost 与播放队列保持运行。</p>
        </div>
        <CommonSelect
          class="settings-control"
          :model-value="appPreferences.preferences.value.closeWindowBehavior"
          :options="closeBehaviorOptions"
          @update:model-value="setCloseBehavior"
        />
      </section>
    </div>

    <div v-else-if="activeTab === 'appearance'" class="settings-list">
      <section class="settings-row">
        <span class="settings-row-icon"><Palette :size="19" /></span>
        <div class="settings-row-copy">
          <h2>主题</h2>
          <p>选择跟随系统、浅色或深色外观。</p>
        </div>
        <div class="settings-theme-options" role="group" aria-label="主题">
          <CommonButton
            :variant="appPreferences.preferences.value.theme === 'system' ? 'primary' : 'secondary'"
            @click="setTheme('system')"
          ><Palette :size="14" />系统</CommonButton>
          <CommonButton
            :variant="appPreferences.preferences.value.theme === 'light' ? 'primary' : 'secondary'"
            @click="setTheme('light')"
          ><Sun :size="14" />浅色</CommonButton>
          <CommonButton
            :variant="appPreferences.preferences.value.theme === 'dark' ? 'primary' : 'secondary'"
            @click="setTheme('dark')"
          ><Moon :size="14" />深色</CommonButton>
        </div>
      </section>
    </div>

    <div v-else class="settings-list">
      <section class="settings-row">
        <span class="settings-row-icon"><Database :size="19" /></span>
        <div class="settings-row-copy">
          <h2>账户数据</h2>
          <p>
            当前空间 {{ accountReference }} · 数据库 {{ formatBytes(dataStats?.databaseBytes ?? 0) }} ·
            Journal {{ dataStats?.journalEvents ?? 0 }} 条
          </p>
        </div>
        <CommonButton
          variant="danger"
          :loading="dataBusy"
          @click="deleteLocalDataDialogVisible = true"
        >删除本地数据</CommonButton>
      </section>
      <section class="settings-row">
        <span class="settings-row-icon"><Database :size="19" /></span>
        <div class="settings-row-copy">
          <h2>可重建缓存</h2>
          <p>当前 {{ formatBytes(dataStats?.cacheBytes ?? 0) }}；清理后不删除账户数据库、Cookie 或播放快照。</p>
        </div>
        <CommonButton variant="danger" :loading="dataBusy" @click="clearCacheDialogVisible = true">清理缓存</CommonButton>
      </section>
    </div>

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
      description="将删除当前账户的 SQLite、播放快照、偏好与 Action Journal，但不会删除登录 Cookie。此操作无法撤销。"
      confirm-text="删除本地数据"
      @cancel="deleteLocalDataDialogVisible = false"
      @confirm="deleteCurrentLocalData"
    />
  </section>
</template>
