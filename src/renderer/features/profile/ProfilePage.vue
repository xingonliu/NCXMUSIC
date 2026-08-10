<script setup lang="ts">
import { CalendarCheck, Database, LogIn, LogOut, Music2, ShieldCheck, Trash2 } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import type { MusicReadResult, StandardUser } from '../../../shared/schemas/music'
import {
  CommonAlertDialog,
  CommonAvatar,
  CommonButton,
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { useAccountSessionStore } from '../account/account-session-store'
import { useDailySignin } from '../music/daily-signin'
import { useAppPreferences } from '../settings/app-preferences'

// ========= 类型 =========

/** 个人信息页支持的账户会话操作。 */
type AccountAction = 'login' | 'logout' | 'switch'

// ========= 变量 =========

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 个人资料页与发现页共享的每日签到控制器。 */
const dailySignin = useDailySignin()

/** 应用界面偏好与可重建缓存控制。 */
const appPreferences = useAppPreferences()

/** 标准用户实体。 */
const user = ref<StandardUser | null>(null)

/** 页面加载状态。 */
const loading = ref<boolean>(true)

/** 页面错误文案。 */
const errorMessage = ref<string>('')

/** 退出登录确认框状态。 */
const logoutDialogVisible = ref<boolean>(false)

/** 当前进行中的账户操作。 */
const busyAction = ref<AccountAction | null>(null)

/** 最近一次资料请求 ID，用于丢弃旧账户迟到响应。 */
let latestProfileRequestId = ''

/** 当前网易云用户 ID。 */
const userId = computed<string | null>(() => {
  const active = account.snapshot.value?.activeAccount
  return active?.kind === 'netease' ? active.neteaseUserId : null
})

/** 页面展示名称。 */
const displayName = computed<string>(() => {
  const snapshot = account.snapshot.value
  if (snapshot?.activeAccount.kind === 'netease') {
    return user.value?.nickname ?? snapshot.activeAccount.displayName ?? '正在加载账户资料'
  }
  return '游客'
})

/** 页面头像地址。 */
const avatarUrl = computed<string>(() => {
  const active = account.snapshot.value?.activeAccount
  return user.value?.avatarUrl ?? (active?.kind === 'netease' ? active.avatarUrl ?? '' : '')
})

// ========= 函数 =========

/** 读取当前网易云用户公开资料。 */
async function loadProfile(): Promise<void> {
  /** 发起请求时绑定的账户快照。 */
  const snapshot = account.snapshot.value
  /** 发起请求时绑定的网易云账户。 */
  const active = snapshot?.activeAccount
  /** 当前资料请求唯一 ID。 */
  const requestId = crypto.randomUUID()
  latestProfileRequestId = requestId
  user.value = null
  errorMessage.value = ''
  if (!snapshot || snapshot.state !== 'authenticated' || active?.kind !== 'netease') {
    loading.value = false
    return
  }
  loading.value = true
  const response = await window.ncx.runtime.getUser({ id: active.neteaseUserId, requestId })
  /** 响应到达时的最新账户快照。 */
  const current = account.snapshot.value
  if (
    requestId !== latestProfileRequestId ||
    current?.activeAccount.accountId !== active.accountId ||
    current.accountGeneration !== snapshot.accountGeneration
  ) return
  loading.value = false
  if (!response.ok) {
    errorMessage.value = response.error.message
    return
  }
  const result: MusicReadResult = response.data
  if (result.kind !== 'user') {
    errorMessage.value = '用户资料响应类型不匹配。'
    return
  }
  user.value = result.entity
}

/** 执行个人信息页中的账户会话操作。 */
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

/** 执行每日签到。 */
async function signin(): Promise<void> {
  await dailySignin.signin()
}

/** 清理 Utility 冻结缓存目录与无敏感性的 Renderer UI 缓存。 */
async function clearCache(): Promise<void> {
  /** 当前账户隔离上下文。 */
  const snapshot = account.snapshot.value
  if (!snapshot) return
  /** Utility 可重建缓存清理结果。 */
  const response = await window.ncx.runtime.accountData({
    operation: 'clearCache',
    accountId: snapshot.activeAccount.accountId,
    accountGeneration: snapshot.accountGeneration
  })
  if (!response.ok) {
    showToast(response.error.message, 'warning')
    return
  }
  appPreferences.clearRendererCache()
  showToast('可重建缓存已清理。', 'success')
}

/** 退出当前网易云账户。 */
async function confirmLogout(): Promise<void> {
  logoutDialogVisible.value = false
  await runAccountAction('logout')
  user.value = null
  showToast('已退出当前账户，本地账户空间仍保留。', 'info')
}

// ========= 生命周期 =========

onMounted(async () => {
  await account.initialize()
})

watch(
  () => [
    account.snapshot.value?.state,
    account.snapshot.value?.activeAccount.accountId,
    account.snapshot.value?.accountGeneration
  ] as const,
  () => {
    void loadProfile()
  },
  { immediate: true }
)
</script>

<template>
  <section class="profile-page" aria-labelledby="profile-title">
    <div v-if="loading" class="profile-loading">
      <CommonSpinner label="正在加载个人资料" />
      <span>正在加载</span>
    </div>

    <CommonErrorState
      v-else-if="errorMessage"
      title="个人资料读取失败"
      :description="errorMessage"
      @retry="loadProfile"
    />

    <CommonEmptyState
      v-else-if="!userId"
      title="游客"
      description="游客模式不会读取网易云账户资料。"
    >
      <CommonButton
        variant="primary"
        :loading="busyAction === 'login'"
        :disabled="!account.snapshot.value?.canLogin"
        @click="runAccountAction('login')"
      >
        <LogIn :size="14" />
        登录账户
      </CommonButton>
    </CommonEmptyState>

    <template v-else>
      <header class="profile-hero">
        <CommonAvatar :name="displayName" :src="avatarUrl" :size="104" />
        <div>
          <p>个人资料</p>
          <h1 id="profile-title">{{ displayName }}</h1>
          <span>{{ user?.signature || '网易云音乐用户' }}</span>
        </div>
        <CommonButton
          variant="secondary"
          :loading="dailySignin.state.value === 'signing'"
          :disabled="!account.snapshot.value?.canMutateMusic"
          @click="signin"
        >
          <CalendarCheck :size="14" />
          {{ dailySignin.state.value === 'already-signed' ? '今日已签到' : '签到' }}
        </CommonButton>
      </header>

      <dl class="profile-facts">
        <div><dt>关注</dt><dd>{{ user?.follows ?? 0 }}</dd></div>
        <div><dt>粉丝</dt><dd>{{ user?.followeds ?? 0 }}</dd></div>
        <div><dt>账户空间</dt><dd>{{ account.snapshot.value?.activeAccount.accountId }}</dd></div>
      </dl>

      <div class="profile-sections">
        <section class="profile-section">
          <span class="profile-section-icon"><Music2 :size="20" /></span>
          <div>
            <h2>音乐人格画像</h2>
            <p>尚未生成</p>
          </div>
          <CommonButton variant="secondary" disabled>查看画像</CommonButton>
        </section>

        <section class="profile-section">
          <span class="profile-section-icon"><Database :size="20" /></span>
          <div>
            <h2>本地数据</h2>
            <p>账户数据与可重建缓存分开管理。</p>
          </div>
          <CommonButton variant="secondary" @click="clearCache">
            <Trash2 :size="14" />
            清理缓存
          </CommonButton>
        </section>

        <section class="profile-section">
          <span class="profile-section-icon"><ShieldCheck :size="20" /></span>
          <div>
            <h2>账户会话</h2>
            <p>在这里登录、切换或退出账户；退出不会删除本地数据。</p>
          </div>
          <div class="profile-account-actions">
            <CommonButton
              variant="primary"
              :loading="busyAction === 'login'"
              :disabled="!account.snapshot.value?.canLogin"
              @click="runAccountAction('login')"
            ><LogIn :size="14" />登录</CommonButton>
            <CommonButton
              variant="secondary"
              :loading="busyAction === 'switch'"
              :disabled="!account.snapshot.value?.canSwitchAccount"
              @click="runAccountAction('switch')"
            >切换账号</CommonButton>
            <CommonButton
              variant="danger"
              :loading="busyAction === 'logout'"
              :disabled="!account.snapshot.value?.canLogout"
              @click="logoutDialogVisible = true"
            ><LogOut :size="14" />退出</CommonButton>
          </div>
        </section>
      </div>
    </template>

    <CommonAlertDialog
      :visible="logoutDialogVisible"
      title="退出当前账户？"
      description="播放队列会切换到游客空间，本地账户数据仍会保留。"
      type="warning"
      confirm-text="退出登录"
      @cancel="logoutDialogVisible = false"
      @confirm="confirmLogout"
    />
  </section>
</template>

<style scoped>
.profile-page {
  width: min(960px, calc(100% - 32px));
  margin: 0 auto;
  padding: 52px 0 96px;
}

.profile-loading,
.profile-hero,
.profile-section {
  display: flex;
  align-items: center;
}

.profile-loading {
  min-height: 240px;
  justify-content: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
}

.profile-hero {
  gap: var(--ncx-space-5);
}

.profile-hero > div {
  min-width: 0;
  flex: 1;
}

.profile-hero p,
.profile-hero h1,
.profile-hero span,
.profile-section h2,
.profile-section p {
  margin: 0;
}

.profile-hero p {
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
}

.profile-hero h1 {
  margin: var(--ncx-space-1) 0;
  font-size: 38px;
}

.profile-hero span,
.profile-section p {
  color: var(--ncx-color-text-secondary);
}

.profile-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ncx-space-3);
  margin: var(--ncx-space-8) 0;
}

.profile-facts div,
.profile-section {
  padding: var(--ncx-space-5);
  border-radius: var(--ncx-radius-md);
  background: var(--ncx-color-surface);
}

.profile-facts dt {
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
}

.profile-facts dd {
  margin: var(--ncx-space-2) 0 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-sections {
  display: grid;
  gap: var(--ncx-space-3);
}

.profile-section {
  gap: var(--ncx-space-4);
}

.profile-section > div {
  min-width: 0;
  flex: 1;
}

.profile-section > .profile-account-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--ncx-space-2);
}

.profile-section h2 {
  font-size: 16px;
}

.profile-section p {
  margin-top: 3px;
  font-size: 13px;
}

.profile-section-icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: var(--ncx-radius-md);
  color: var(--ncx-color-accent);
  background: color-mix(in srgb, var(--ncx-color-accent) 12%, transparent);
}

</style>
