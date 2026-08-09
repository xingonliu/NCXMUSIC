<script setup lang="ts">
import { Database, Headphones, LogIn, LogOut, ShieldCheck, UserRound } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { AccountSessionSnapshot } from '../../../shared/schemas/account'
import type { MusicQualityPreference } from '../../../domains/player/types'
import {
  CommonButton,
  CommonSelect,
  type CommonOption
} from '../../design-system/components'
import { zhCN } from '../../locales/zh-CN'
import { usePlayer } from '../music/use-player'
import './settings-page.css'

// ========= 类型 =========

/** 账户操作类型。 */
type AccountAction = 'login' | 'logout' | 'switch'

// ========= 变量 =========

/** 当前账户安全快照。 */
const accountSnapshot = ref<AccountSessionSnapshot>()

/** 播放器接口，用于设置全局音质偏好。 */
const player = usePlayer()

/** 播放文案集合。 */
const playerText = zhCN.player

/** 当前进行中的账户操作。 */
const busyAction = ref<AccountAction | null>(null)

/** 账户状态订阅清理函数。 */
let unsubscribeAccountSnapshot = (): void => {}

/** 当前展示账户名称。 */
const accountName = computed(() => accountSnapshot.value?.activeAccount.displayName ?? '游客')

/** 当前展示账户引用。 */
const accountReference = computed(() => accountSnapshot.value?.activeAccount.accountId ?? 'guest:local')

/** 当前登录状态标签。 */
const accountStateLabel = computed(() => {
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

// ========= 函数 =========

/** 刷新账户安全快照。 */
async function refreshAccountSnapshot(): Promise<void> {
  accountSnapshot.value = await window.ncx.account.snapshot()
}

/** 执行账户操作并刷新安全快照。 */
async function runAccountAction(action: AccountAction): Promise<void> {
  if (busyAction.value) return
  busyAction.value = action
  try {
    if (action === 'login') {
      accountSnapshot.value = await window.ncx.account.login()
    } else if (action === 'logout') {
      accountSnapshot.value = await window.ncx.account.logout()
    } else {
      accountSnapshot.value = await window.ncx.account.switchAccount()
    }
  } finally {
    busyAction.value = null
  }
}

/** 设置播放器全局音质偏好。 */
function setPlaybackQuality(value: string | number): void {
  void player.setQuality(String(value) as MusicQualityPreference)
}

// ========= 生命周期 =========

onMounted(async () => {
  unsubscribeAccountSnapshot = window.ncx.account.onSnapshot((snapshot) => {
    accountSnapshot.value = snapshot
  })
  await refreshAccountSnapshot()
})

onBeforeUnmount(() => {
  unsubscribeAccountSnapshot()
})
</script>

<template>
  <section
    class="settings-page"
    aria-labelledby="settings-title"
  >
    <div class="settings-heading">
      <p class="settings-eyebrow">
        Phase 2
      </p>
      <h1 id="settings-title">
        账户与数据
      </h1>
    </div>

    <div class="settings-grid">
      <article class="settings-panel settings-panel--wide">
        <div class="settings-panel-icon">
          <UserRound :size="20" />
        </div>
        <div class="settings-panel-main">
          <p class="settings-label">
            网易云账户
          </p>
          <h2>{{ accountName }}</h2>
          <p class="settings-muted">
            {{ accountReference }} · generation {{ accountSnapshot?.accountGeneration ?? 0 }}
          </p>
        </div>
        <span class="settings-state">{{ accountStateLabel }}</span>
        <div class="settings-actions">
          <CommonButton
            variant="primary"
            :loading="busyAction === 'login'"
            :disabled="!accountSnapshot?.canLogin"
            @click="runAccountAction('login')"
          >
            <LogIn :size="14" />
            登录
          </CommonButton>
          <CommonButton
            variant="secondary"
            :loading="busyAction === 'switch'"
            :disabled="!accountSnapshot?.canSwitchAccount"
            @click="runAccountAction('switch')"
          >
            切换账号
          </CommonButton>
          <CommonButton
            variant="danger"
            :loading="busyAction === 'logout'"
            :disabled="!accountSnapshot?.canLogout"
            @click="runAccountAction('logout')"
          >
            <LogOut :size="14" />
            退出
          </CommonButton>
        </div>
      </article>

      <article class="settings-panel">
        <div class="settings-panel-icon">
          <Database :size="20" />
        </div>
        <p class="settings-label">
          存储空间
        </p>
        <h2>账户隔离</h2>
        <dl class="settings-facts">
          <div>
            <dt>当前空间</dt>
            <dd>{{ accountReference }}</dd>
          </div>
          <div>
            <dt>日志保留</dt>
            <dd>30 天 / 10,000 条</dd>
          </div>
        </dl>
      </article>

      <article class="settings-panel">
        <div class="settings-panel-icon">
          <Headphones :size="20" />
        </div>
        <p class="settings-label">
          播放设置
        </p>
        <h2>全局音质</h2>
        <p class="settings-muted">
          当前播放中改动会重新解析当前歌曲并尽量保持进度。
        </p>
        <CommonSelect
          class="settings-select"
          :model-value="player.snapshot.value.quality"
          :options="qualityOptions"
          @update:model-value="setPlaybackQuality"
        />
      </article>

      <article class="settings-panel">
        <div class="settings-panel-icon">
          <ShieldCheck :size="20" />
        </div>
        <p class="settings-label">
          隐私边界
        </p>
        <h2>凭据不可读</h2>
        <dl class="settings-facts">
          <div>
            <dt>Renderer 凭据</dt>
            <dd>{{ accountSnapshot?.rendererCanReadSecrets ? '可读' : '不可读' }}</dd>
          </div>
          <div>
            <dt>Cookie 租约</dt>
            <dd>{{ accountSnapshot?.hasCredentialLease ? '活动' : '未活动' }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>
