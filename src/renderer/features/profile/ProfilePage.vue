<script setup lang="ts">
import { Crown, Headphones, ListMusic, LockKeyhole, LogIn, LogOut, Play, Sparkles, UserRound } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type {
  StandardPlaylist,
  StandardSong,
  StandardUser
} from '../../../shared/schemas/music'
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
import { useAgentStore } from '../agent/agent-store'
import Cover from '../music/components/Cover.vue'
import { standardSongToTrackSummary } from '../music/music-entity'
import { usePlayer } from '../music/use-player'

// ========= 类型 =========

/** 个人页核心标签。 */
type ProfileTab = 'history' | 'created' | 'subscribed'

/** 听歌排行周期。 */
type HistoryPeriod = 'week' | 'all'

/** 个人信息页支持的账户会话操作。 */
type AccountAction = 'login' | 'logout' | 'switch'

// ========= 变量 =========

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 应用作用域 Agent Store，用于展示账户隔离音乐画像。 */
const agent = useAgentStore()

/** 页面路由实例。 */
const router = useRouter()

/** 应用播放器接口。 */
const player = usePlayer()

/** 标准用户实体。 */
const user = ref<StandardUser | null>(null)

/** 当前用户全部创建与收藏歌单。 */
const playlists = ref<StandardPlaylist[]>([])

/** 最近一周听歌排行。 */
const weekHistory = ref<StandardSong[]>([])

/** 所有时间听歌排行。 */
const allHistory = ref<StandardSong[]>([])

/** 页面加载状态。 */
const loading = ref<boolean>(true)

/** 页面错误文案。 */
const errorMessage = ref<string>('')

/** 当前核心标签。 */
const activeTab = ref<ProfileTab>('history')

/** 当前听歌排行周期。 */
const historyPeriod = ref<HistoryPeriod>('week')

/** 退出登录确认框状态。 */
const logoutDialogVisible = ref<boolean>(false)

/** 当前进行中的账户操作。 */
const busyAction = ref<AccountAction | null>(null)

/** 最近一次资料请求 ID，用于丢弃旧账户迟到响应。 */
let latestProfileRequestId = ''

/** 当前网易云用户 ID。 */
const userId = computed<string | null>(() => {
  /** 当前活动账户。 */
  const active = account.snapshot.value?.activeAccount
  return active?.kind === 'netease' ? active.neteaseUserId : null
})

/** 页面展示名称。 */
const displayName = computed<string>(() => {
  /** 当前账户快照。 */
  const snapshot = account.snapshot.value
  if (snapshot?.activeAccount.kind === 'netease') {
    return user.value?.nickname ?? snapshot.activeAccount.displayName ?? '正在加载账户资料'
  }
  return '游客'
})

/** 页面头像地址。 */
const avatarUrl = computed<string>(() => {
  /** 当前活动账户。 */
  const active = account.snapshot.value?.activeAccount
  return user.value?.avatarUrl ?? (active?.kind === 'netease' ? active.avatarUrl ?? '' : '')
})

/** 当前展示周期对应的听歌排行。 */
const visibleHistory = computed<StandardSong[]>(() => historyPeriod.value === 'week' ? weekHistory.value : allHistory.value)

/** 用户创建的歌单，并确保“我喜欢的音乐”常驻第一位。 */
const createdPlaylists = computed<StandardPlaylist[]>(() => playlists.value
  .filter((playlist) => playlist.owned)
  .sort((left, right) => Number(isLikedPlaylist(right)) - Number(isLikedPlaylist(left))))

/** 用户收藏的其他歌单。 */
const subscribedPlaylists = computed<StandardPlaylist[]>(() => playlists.value.filter((playlist) => !playlist.owned))

/** 用户村龄展示文本。 */
const villageAge = computed<string>(() => {
  if (!user.value?.createTime) return '暂未公开'
  /** 从注册时间至今的完整年数。 */
  const years = Math.max(0, Math.floor((Date.now() - user.value.createTime) / (365.2425 * 24 * 60 * 60 * 1000)))
  return `${years} 年`
})

/** 用户性别展示文本。 */
const genderLabel = computed<string>(() => ({ 1: '男', 2: '女' })[user.value?.gender ?? 0] ?? '未公开')

/** 用户星座展示文本。 */
const zodiacLabel = computed<string>(() => formatZodiac(user.value?.birthday))

/** 当前账户脱敏音乐人格画像。 */
const musicProfile = computed(() => agent.snapshot.value.personalization)

// ========= 函数 =========

/** 判断歌单是否为网易云喜欢歌单。 */
function isLikedPlaylist(playlist: StandardPlaylist): boolean {
  return playlist.name.includes('喜欢的音乐') || playlist.name.includes('我喜欢')
}

/** 根据生日时间戳计算星座。 */
function formatZodiac(birthday: number | undefined): string {
  if (!birthday || birthday <= 0) return '未公开'
  /** 生日日期。 */
  const date = new Date(birthday)
  /** 星座切换日期与名称。 */
  const signs: ReadonlyArray<[number, string]> = [
    [120, '摩羯座'], [219, '水瓶座'], [321, '双鱼座'], [420, '白羊座'],
    [521, '金牛座'], [622, '双子座'], [723, '巨蟹座'], [823, '狮子座'],
    [923, '处女座'], [1024, '天秤座'], [1123, '天蝎座'], [1222, '射手座'], [1232, '摩羯座']
  ]
  /** 用月日组合出的比较值。 */
  const marker = (date.getMonth() + 1) * 100 + date.getDate()
  return signs.find(([boundary]) => marker < boundary)?.[1] ?? '摩羯座'
}

/** 格式化大数字。 */
function formatCount(value: number | undefined): string {
  if (value === undefined) return '—'
  return new Intl.NumberFormat('zh-CN', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

/** 读取当前网易云用户资料和个人核心内容。 */
async function loadProfile(): Promise<void> {
  /** 发起请求时绑定的账户快照。 */
  const snapshot = account.snapshot.value
  /** 发起请求时绑定的网易云账户。 */
  const active = snapshot?.activeAccount
  /** 当前资料请求唯一 ID。 */
  const requestId = crypto.randomUUID()
  latestProfileRequestId = requestId
  user.value = null
  playlists.value = []
  weekHistory.value = []
  allHistory.value = []
  errorMessage.value = ''
  if (!snapshot || snapshot.state !== 'authenticated' || active?.kind !== 'netease') {
    loading.value = false
    return
  }
  loading.value = true
  /** 用户资料、歌单与两种听歌排行并行响应。 */
  const [profileResponse, playlistsResponse, weekResponse, allResponse] = await Promise.all([
    window.ncx.runtime.getUser({ id: active.neteaseUserId, requestId }),
    window.ncx.runtime.getUserPlaylists({ userId: active.neteaseUserId, limit: 100 }),
    window.ncx.runtime.readMusic({ operation: 'getListeningHistory', userId: active.neteaseUserId, period: 'week', limit: 100 }),
    window.ncx.runtime.readMusic({ operation: 'getListeningHistory', userId: active.neteaseUserId, period: 'all', limit: 100 })
  ])
  /** 响应到达时的最新账户快照。 */
  const current = account.snapshot.value
  if (
    requestId !== latestProfileRequestId ||
    current?.activeAccount.accountId !== active.accountId ||
    current.accountGeneration !== snapshot.accountGeneration
  ) return
  loading.value = false
  if (!profileResponse.ok) {
    errorMessage.value = profileResponse.error.message
    return
  }
  if (profileResponse.data.kind !== 'user') {
    errorMessage.value = '用户资料响应类型不匹配。'
    return
  }
  user.value = profileResponse.data.entity
  if (playlistsResponse.ok && playlistsResponse.data.kind === 'playlistCollection') playlists.value = playlistsResponse.data.playlists
  if (weekResponse.ok && weekResponse.data.kind === 'songCollection') weekHistory.value = weekResponse.data.songs
  if (allResponse.ok && allResponse.data.kind === 'songCollection') allHistory.value = allResponse.data.songs
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

/** 退出当前网易云账户。 */
async function confirmLogout(): Promise<void> {
  logoutDialogVisible.value = false
  await runAccountAction('logout')
  user.value = null
  showToast('已退出当前账户，本地账户空间仍保留。', 'info')
}

/** 播放听歌排行中的歌曲。 */
async function playHistorySong(song: StandardSong): Promise<void> {
  await player.playTrack(standardSongToTrackSummary(song), { kind: 'discover' })
}

/** 打开个人页歌单。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

/** 打开设置页的小云画像管理入口。 */
function openPersonalizationSettings(): void {
  void router.push({ name: 'settings', query: { tab: 'agent' } })
}

// ========= 生命周期 =========

onMounted(async () => {
  await Promise.all([account.initialize(), agent.initialize()])
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
    <div v-if="loading" class="profile-loading"><CommonSpinner label="正在加载个人资料" /><span>正在加载</span></div>
    <CommonErrorState v-else-if="errorMessage" title="个人资料读取失败" :description="errorMessage" @retry="loadProfile" />
    <CommonEmptyState v-else-if="!userId" title="游客" description="登录后查看个人信息、听歌排行和歌单收藏。">
      <CommonButton variant="primary" :loading="busyAction === 'login'" :disabled="!account.snapshot.value?.canLogin" @click="runAccountAction('login')"><LogIn :size="14" />登录账户</CommonButton>
    </CommonEmptyState>

    <template v-else>
      <header class="profile-hero">
        <div class="profile-cover" :style="user?.backgroundUrl ? { backgroundImage: `url(${user.backgroundUrl})` } : {}" aria-hidden="true" />
        <div class="profile-hero-scrim" />
        <div class="profile-identity">
          <CommonAvatar :name="displayName" :src="avatarUrl" :size="112" />
          <div>
            <span class="profile-eyebrow">个人信息</span>
            <h1 id="profile-title">{{ displayName }}</h1>
            <p>{{ user?.signature || '网易云音乐用户' }}</p>
            <span v-if="(user?.vipType ?? 0) > 0" class="profile-vip"><Crown :size="13" fill="currentColor" /> VIP</span>
          </div>
        </div>
        <div class="profile-session-actions">
          <CommonButton variant="secondary" size="compact" :loading="busyAction === 'switch'" @click="runAccountAction('switch')">切换账户</CommonButton>
          <CommonButton variant="ghost" size="compact" @click="logoutDialogVisible = true"><LogOut :size="14" />退出</CommonButton>
        </div>
      </header>

      <section class="profile-summary" aria-label="基本资料与社交数据">
        <div class="profile-basics">
          <h2>基本信息</h2>
          <dl>
            <div><dt>昵称</dt><dd>{{ displayName }}</dd></div>
            <div><dt>村龄</dt><dd>{{ villageAge }}</dd></div>
            <div><dt>等级</dt><dd>Lv.{{ user?.level ?? '—' }}</dd></div>
            <div><dt>性别</dt><dd>{{ genderLabel }}</dd></div>
            <div><dt>星座</dt><dd>{{ zodiacLabel }}</dd></div>
            <div><dt>IP 属地</dt><dd>{{ user?.location || '未公开' }}</dd></div>
          </dl>
        </div>
        <dl class="profile-social">
          <div><dt>关注</dt><dd>{{ formatCount(user?.follows) }}</dd></div>
          <div><dt>粉丝</dt><dd>{{ formatCount(user?.followeds) }}</dd></div>
          <div title="网易云公开资料接口暂不提供全站获赞总数"><dt>获赞</dt><dd>暂未公开</dd></div>
        </dl>
      </section>

      <section class="profile-music-personality" aria-labelledby="profile-music-personality-title">
        <header>
          <span><Sparkles :size="16" /></span>
          <div>
            <h2 id="profile-music-personality-title">音乐人格画像</h2>
            <p v-if="musicProfile.usable">v{{ musicProfile.version }} · {{ musicProfile.paused ? '已暂停更新' : '可用于推荐与小云上下文' }}</p>
            <p v-else>只分析音乐证据支持的偏好，不推断敏感真实人格。</p>
          </div>
          <CommonButton variant="secondary" size="compact" @click="openPersonalizationSettings">
            {{ musicProfile.usable ? '管理画像' : '开始分析' }}
          </CommonButton>
        </header>
        <template v-if="musicProfile.usable">
          <p class="profile-music-personality-summary">{{ musicProfile.summary }}</p>
          <div class="profile-music-personality-insights">
            <article v-for="insight in musicProfile.insights.slice(0, 6)" :key="insight.insightId">
              <span>{{ insight.category }} · {{ Math.round(insight.confidence * 100) }}%</span>
              <strong>{{ insight.label }}</strong>
              <p>{{ insight.value }}</p>
            </article>
          </div>
        </template>
      </section>

      <nav class="profile-tabs" aria-label="个人内容">
        <button type="button" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'"><Headphones :size="15" />听歌排行</button>
        <button type="button" :class="{ active: activeTab === 'created' }" @click="activeTab = 'created'"><ListMusic :size="15" />创建的歌单</button>
        <button type="button" :class="{ active: activeTab === 'subscribed' }" @click="activeTab = 'subscribed'"><UserRound :size="15" />收藏的歌单</button>
      </nav>

      <section v-if="activeTab === 'history'" class="profile-tab-panel">
        <header class="profile-panel-heading">
          <div><span>Listening History</span><h2>累积听歌 {{ formatCount(user?.listenSongs) }} 首</h2></div>
          <div class="profile-period-toggle" role="tablist" aria-label="听歌排行周期">
            <button type="button" :class="{ active: historyPeriod === 'week' }" @click="historyPeriod = 'week'">最近一周</button>
            <button type="button" :class="{ active: historyPeriod === 'all' }" @click="historyPeriod = 'all'">所有时间</button>
          </div>
        </header>
        <CommonEmptyState v-if="visibleHistory.length === 0" title="暂无听歌排行" description="该账户尚未公开当前周期的听歌记录。" />
        <div v-else class="profile-history-list">
          <button v-for="(song, index) in visibleHistory" :key="song.id" type="button" @click="playHistorySong(song)">
            <span class="profile-history-rank">{{ index + 1 }}</span>
            <Cover :src="song.album?.artworkUrl" :alt="song.name" size="compact" :show-play-button="false" />
            <span class="profile-history-copy"><strong>{{ song.name }}</strong><small>{{ song.artists.map((artist) => artist.name).join(' / ') }}</small></span>
            <span class="profile-play-count">听过 {{ song.listeningCount ?? 0 }} 次</span>
            <Play :size="15" fill="currentColor" />
          </button>
        </div>
      </section>

      <section v-else class="profile-tab-panel">
        <header class="profile-panel-heading"><div><span>{{ activeTab === 'created' ? 'Created Playlists' : 'Subscribed Playlists' }}</span><h2>{{ activeTab === 'created' ? '创建的歌单' : '收藏的歌单' }}</h2></div></header>
        <div class="profile-playlist-grid">
          <button
            v-for="playlist in activeTab === 'created' ? createdPlaylists : subscribedPlaylists"
            :key="playlist.id"
            type="button"
            @click="openPlaylist(playlist)"
          >
            <span class="profile-playlist-cover">
              <Cover :src="playlist.artworkUrl" :alt="playlist.name" size="feature" :show-play-button="false" />
              <span v-if="isLikedPlaylist(playlist)" class="profile-lock"><LockKeyhole :size="13" /></span>
            </span>
            <strong>{{ playlist.name }}</strong>
            <span>{{ playlist.trackCount ?? 0 }} 首 · {{ formatCount(playlist.playCount) }} 次播放</span>
            <small>{{ formatCount(playlist.subscribedCount) }} 人收藏</small>
          </button>
        </div>
      </section>
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
.profile-page { display: grid; width: min(1120px, calc(100% - 36px)); gap: 28px; margin: 0 auto; padding: 40px 0 128px; }
.profile-loading { display: flex; min-height: 280px; align-items: center; justify-content: center; gap: 9px; color: var(--ncx-color-text-secondary); }
.profile-hero { position: relative; display: flex; overflow: hidden; min-height: 340px; align-items: end; gap: 24px; padding: 32px; border-radius: 30px; color: #fff; background: color-mix(in srgb, var(--ncx-color-accent) 24%, #24242a); }
.profile-cover, .profile-hero-scrim { position: absolute; inset: 0; }
.profile-cover { background-position: center; background-size: cover; transform: scale(1.03); }
.profile-hero-scrim { background: linear-gradient(180deg, rgba(0, 0, 0, .05) 20%, rgba(0, 0, 0, .82) 100%); }
.profile-identity, .profile-session-actions { position: relative; z-index: 2; }
.profile-identity { display: flex; min-width: 0; flex: 1; align-items: end; gap: 20px; }
.profile-identity h1, .profile-identity p { margin: 0; }
.profile-identity h1 { margin-top: 5px; font-size: clamp(34px, 5vw, 54px); line-height: 1; letter-spacing: -.035em; }
.profile-identity p { max-width: 50ch; margin-top: 9px; overflow: hidden; color: rgba(255, 255, 255, .75); text-overflow: ellipsis; white-space: nowrap; }
.profile-eyebrow { color: rgba(255, 255, 255, .7); font-size: 11px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.profile-vip { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 5px 8px; border-radius: 999px; color: #fff4c6; background: rgba(181, 133, 27, .58); backdrop-filter: blur(12px); font-size: 10px; font-weight: 800; }
.profile-session-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.profile-summary { display: grid; grid-template-columns: 1.35fr .85fr; gap: 16px; }
.profile-basics, .profile-social { margin: 0; padding: 22px; border-radius: var(--ncx-radius-xl); background: var(--ncx-color-surface); }
.profile-basics h2 { margin: 0 0 16px; font-size: 16px; }
.profile-basics dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 0; }
.profile-basics dt, .profile-social dt { color: var(--ncx-color-text-secondary); font-size: 11px; }
.profile-basics dd, .profile-social dd { margin: 4px 0 0; font-weight: 700; }
.profile-social { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; text-align: center; }
.profile-social div + div { border-left: 1px solid color-mix(in srgb, var(--ncx-color-text-primary) 8%, transparent); }
.profile-social dd { font-size: 20px; }
.profile-tabs { display: flex; gap: 7px; padding: 5px; border-radius: 999px; background: color-mix(in srgb, var(--ncx-color-surface) 80%, transparent); }
.profile-tabs button, .profile-period-toggle button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 15px; border: 0; border-radius: 999px; color: var(--ncx-color-text-secondary); background: transparent; cursor: pointer; }
.profile-tabs button.active, .profile-tabs button:hover, .profile-period-toggle button.active, .profile-period-toggle button:hover { color: var(--ncx-color-text-primary); background: color-mix(in srgb, var(--ncx-color-text-primary) 8%, transparent); }
.profile-tabs button:active, .profile-period-toggle button:active { transform: scale(.96); }
.profile-tab-panel { min-height: 320px; padding: 24px; border-radius: var(--ncx-radius-xl); background: var(--ncx-color-surface); }
.profile-panel-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.profile-panel-heading span, .profile-panel-heading h2 { margin: 0; }
.profile-panel-heading span { color: var(--ncx-color-accent); font-size: 10px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
.profile-panel-heading h2 { margin-top: 4px; font-size: 22px; letter-spacing: -.015em; }
.profile-period-toggle { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: color-mix(in srgb, var(--ncx-color-text-primary) 5%, transparent); }
.profile-period-toggle button { padding: 8px 12px; font-size: 12px; }
.profile-history-list { display: grid; gap: 4px; }
.profile-history-list > button { display: grid; grid-template-columns: 32px auto minmax(0, 1fr) auto 24px; align-items: center; gap: 12px; padding: 7px 10px; border: 0; border-radius: 14px; color: inherit; text-align: left; background: transparent; cursor: pointer; }
.profile-history-list > button:hover { background: color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent); }
.profile-history-list > button:active { transform: scale(.99); }
.profile-history-rank { color: var(--ncx-color-text-tertiary); font-size: 12px; text-align: center; }
.profile-history-copy { display: grid; min-width: 0; }
.profile-history-copy strong, .profile-history-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-history-copy strong { font-size: 13px; }
.profile-history-copy small, .profile-play-count { margin-top: 3px; color: var(--ncx-color-text-secondary); font-size: 11px; }
.profile-playlist-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 24px 18px; }
.profile-playlist-grid > button { display: grid; min-width: 0; gap: 5px; padding: 0; border: 0; color: inherit; text-align: left; background: transparent; cursor: pointer; }
.profile-playlist-cover { position: relative; display: block; }
.profile-lock { position: absolute; right: 8px; bottom: 8px; display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: rgba(18, 18, 20, .58); backdrop-filter: blur(12px); }
.profile-playlist-grid strong, .profile-playlist-grid > button > span:not(.profile-playlist-cover), .profile-playlist-grid small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-playlist-grid strong { margin-top: 8px; font-size: 13px; }
.profile-playlist-grid > button > span:not(.profile-playlist-cover), .profile-playlist-grid small { color: var(--ncx-color-text-secondary); font-size: 11px; }
.profile-music-personality { display: grid; gap: 14px; padding: 20px; border: 1px solid var(--ncx-color-border); border-radius: var(--ncx-radius-xl); background: var(--ncx-color-surface); }
.profile-music-personality > header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; }
.profile-music-personality > header > span { display: inline-flex; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 12px; color: var(--ncx-color-accent); background: color-mix(in srgb, var(--ncx-color-accent) 12%, transparent); }
.profile-music-personality h2, .profile-music-personality p { margin: 0; }
.profile-music-personality > header p, .profile-music-personality-summary { margin-top: 4px; color: var(--ncx-color-text-secondary); font-size: 12px; line-height: 1.55; }
.profile-music-personality-insights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.profile-music-personality-insights article { display: grid; gap: 4px; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--ncx-color-text-primary) 4%, transparent); }
.profile-music-personality-insights span { color: var(--ncx-color-text-secondary); font-size: 10px; }
.profile-music-personality-insights strong { font-size: 13px; }
.profile-music-personality-insights p { color: var(--ncx-color-text-secondary); font-size: 11px; line-height: 1.45; }
@media (width < 900px) { .profile-summary { grid-template-columns: 1fr; } .profile-playlist-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (width < 680px) { .profile-hero { align-items: start; flex-direction: column; } .profile-identity { align-items: start; flex-direction: column; } .profile-basics dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } .profile-music-personality > header { grid-template-columns: auto 1fr; } .profile-music-personality > header > .ncx-common-button { grid-column: 1 / -1; justify-self: start; } .profile-music-personality-insights { grid-template-columns: 1fr; } .profile-tabs { overflow-x: auto; border-radius: 18px; } .profile-tabs button { flex: 0 0 auto; } .profile-panel-heading { align-items: start; flex-direction: column; } .profile-play-count { display: none; } .profile-history-list > button { grid-template-columns: 24px auto minmax(0, 1fr) 20px; } .profile-playlist-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .profile-page button { transition: none !important; } .profile-page button:active { transform: none; } }
</style>
