<script setup lang="ts">
import {
  FolderPlus,
  Heart,
  ListPlus,
  Play,
  Users
} from '@lucide/vue'
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
  CommonContextMenu,
  CommonEmptyState,
  CommonErrorState,
  CommonIconButton,
  CommonSpinner,
  type CommonMenuItem
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { useAccountSessionStore } from '../account/account-session-store'
import { copyText } from '../foundation/clipboard'
import AddTrackToPlaylistDialog from '../music/components/AddTrackToPlaylistDialog.vue'
import Cover from '../music/components/Cover.vue'
import { mutateMusic, playSongNext } from '../music/music-actions'
import {
  formatMusicDuration,
  standardSongToTrackSummary,
  standardSongsToTrackSummaries
} from '../music/music-entity'
import { usePlayer } from '../music/use-player'
import { translatePublicError } from '../../i18n'

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

/** 当前等待选择目标歌单的歌曲。 */
const playlistTarget = ref<StandardSong | null>(null)

/** 最近一次资料请求 ID，用于丢弃旧账户迟到响应。 */
let latestProfileRequestId = ''

/** 当前播放歌曲 ID。 */
const activeTrackId = computed<string | null>(() => player.snapshot.value.playback.track?.trackId ?? null)

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
  const years = Math.max(0, Math.floor((Date.now() - user.value.createTime) / (365.2425 * 24 * 60 * 60 * 1000)))
  return `${years} 年`
})

/** 用户星座展示文本。 */
const zodiacLabel = computed<string>(() => formatZodiac(user.value?.birthday))

// ========= 函数 =========

/** 判断歌单是否为网易云喜欢歌单。 */
function isLikedPlaylist(playlist: StandardPlaylist): boolean {
  return playlist.name.includes('喜欢的音乐') || playlist.name.includes('我喜欢')
}

/** 根据生日时间戳计算星座。 */
function formatZodiac(birthday: number | undefined): string {
  if (!birthday || birthday <= 0) return '未公开'
  const date = new Date(birthday)
  const signs: ReadonlyArray<[number, string]> = [
    [120, '摩羯座'], [219, '水瓶座'], [321, '双鱼座'], [420, '白羊座'],
    [521, '金牛座'], [622, '双子座'], [723, '巨蟹座'], [823, '狮子座'],
    [923, '处女座'], [1024, '天秤座'], [1123, '天蝎座'], [1222, '射手座'], [1232, '摩羯座']
  ]
  const marker = (date.getMonth() + 1) * 100 + date.getDate()
  return signs.find(([boundary]) => marker < boundary)?.[1] ?? '摩羯座'
}

/** 格式化大数字。 */
function formatCount(value: number | undefined): string {
  if (value === undefined) return '0'
  return new Intl.NumberFormat('zh-CN', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

/** 读取当前网易云用户资料和个人核心内容。 */
async function loadProfile(): Promise<void> {
  const snapshot = account.snapshot.value
  const active = snapshot?.activeAccount
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
  const [profileResponse, playlistsResponse, weekResponse, allResponse] = await Promise.all([
    window.ncx.runtime.getUser({ id: active.neteaseUserId, requestId }),
    window.ncx.runtime.getUserPlaylists({ userId: active.neteaseUserId, limit: 100 }),
    window.ncx.runtime.readMusic({ operation: 'getListeningHistory', userId: active.neteaseUserId, period: 'week', limit: 100 }),
    window.ncx.runtime.readMusic({ operation: 'getListeningHistory', userId: active.neteaseUserId, period: 'all', limit: 100 })
  ])
  const current = account.snapshot.value
  if (
    requestId !== latestProfileRequestId ||
    current?.activeAccount.accountId !== active.accountId ||
    current.accountGeneration !== snapshot.accountGeneration
  ) return
  loading.value = false
  if (!profileResponse.ok) {
    errorMessage.value = translatePublicError(profileResponse.error)
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
  const startIndex = visibleHistory.value.findIndex((item) => item.id === song.id)
  await player.playContext({
    tracks: standardSongsToTrackSummaries(visibleHistory.value),
    source: { kind: 'discover' },
    startIndex: Math.max(0, startIndex)
  })
}

/** 追加听歌排行歌曲到队列。 */
function enqueueHistorySong(song: StandardSong): void {
  player.enqueue([standardSongToTrackSummary(song)], { kind: 'discover' })
  showToast(`已将《${song.name}》加入播放队列。`, 'info')
}

/** 收藏当前歌曲。 */
async function toggleLikeSong(song: StandardSong): Promise<void> {
  const response = await mutateMusic({ operation: 'likeTrack', trackId: song.id, liked: true })
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return
  }
  showToast(`已收藏《${song.name}》。`, 'success')
}

/** 打开共享的自建歌单选择对话框。 */
function openAddToPlaylist(song: StandardSong): void {
  playlistTarget.value = song
}

/** 打开正式歌曲详情页。 */
function openSongDetails(song: StandardSong): void {
  void router.push({ name: 'song-detail', params: { songId: song.id } })
}

/** 将歌曲标准上下文交给小云入口。 */
function giveSongToAgent(song: StandardSong): void {
  void router.push({
    name: 'agent',
    query: { intent: 'track', trackId: song.id, title: song.name }
  })
}

/** 打开个人页歌单。 */
function openPlaylist(playlist: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: playlist.id } })
}

/** 获取单首歌曲右键上下文动作。 */
function getSongMenuItems(): CommonMenuItem[] {
  return [
    { value: 'play', label: '立即播放' },
    { value: 'play-next', label: '下一首播放' },
    { value: 'enqueue', label: '添加到队列末尾' },
    { value: 'separator-a', type: 'separator' },
    { value: 'like', label: '收藏歌曲' },
    { value: 'add-to-playlist', label: '添加到歌单' },
    { value: 'details', label: '查看歌曲详情' },
    { value: 'give-agent', label: '交给小云' },
    { value: 'copy-link', label: '复制网易云歌曲链接' }
  ]
}

/** 执行单首歌曲上下文菜单动作。 */
function handleSongMenuSelect(song: StandardSong, value: string | number): void {
  const action = String(value)
  if (action === 'play') void playHistorySong(song)
  else if (action === 'play-next') playSongNext(song, { kind: 'discover' })
  else if (action === 'enqueue') enqueueHistorySong(song)
  else if (action === 'like') void toggleLikeSong(song)
  else if (action === 'add-to-playlist') openAddToPlaylist(song)
  else if (action === 'details') openSongDetails(song)
  else if (action === 'give-agent') giveSongToAgent(song)
  else if (action === 'copy-link') {
    void copyText(`https://music.163.com/song?id=${song.id}`, '歌曲链接已复制。')
  }
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
  <div class="profile-container">
    <div
      v-if="loading"
      class="profile-state"
    >
      <CommonSpinner :label="$tSource('正在加载个人资料')" />
      <span>{{ $tSource("正在加载个人空间...") }}</span>
    </div>

    <CommonErrorState
      v-else-if="errorMessage"
      :title="$tSource('个人资料读取失败')"
      :description="errorMessage"
      @retry="loadProfile"
    />

    <CommonEmptyState
      v-else-if="!userId"
      :title="$tSource('未登录网易云')"
      :description="$tSource('登录后查看个人听歌记录、自建歌单和收藏内容。')"
    >
      <CommonButton
        variant="primary"
        :loading="busyAction === 'login'"
        :disabled="!account.snapshot.value?.canLogin"
        @click="runAccountAction('login')"
      >
        <Users :size="14" /> {{ $tSource("登录账户") }}
      </CommonButton>
    </CommonEmptyState>

    <div
      v-else
      class="profile-content"
    >
      <!-- 极简自然个人 Header (左右对齐、无多余大框) -->
      <header class="profile-header">
        <div
          v-if="user?.backgroundUrl"
          class="profile-header-bg"
          :style="{ backgroundImage: `url(${user.backgroundUrl})` }"
          aria-hidden="true"
        />

        <div class="profile-header-main">
          <div class="profile-avatar-box">
            <CommonAvatar
              :name="displayName"
              :src="avatarUrl"
              :size="84"
            />
          </div>

          <div class="profile-info">
            <div class="profile-name-row">
              <h1 id="profile-title">
                {{ displayName }}
              </h1>
              <span
                v-if="(user?.vipType ?? 0) > 0"
                class="profile-vip-tag"
              >VIP</span>
              <span
                v-if="user?.level"
                class="profile-level-tag"
              >Lv.{{ user.level }}</span>
            </div>

            <p
              v-if="user?.signature"
              class="profile-bio"
            >
              {{ user.signature }}
            </p>

            <div class="profile-meta-text">
              <span>{{ $tSource("村龄") }} {{ $tSource(villageAge) }}</span>
              <span v-if="zodiacLabel !== '未公开'">·</span>
              <span v-if="zodiacLabel !== '未公开'">{{ $tSource(zodiacLabel) }}</span>
              <span v-if="user?.location">·</span>
              <span v-if="user?.location">{{ user.location }}</span>
              <span>·</span>
              <span>{{ formatCount(user?.follows) }} {{ $tSource("关注") }}</span>
              <span>·</span>
              <span>{{ formatCount(user?.followeds) }} {{ $tSource("粉丝") }}</span>
              <span>·</span>
              <span>{{ $tSource("累积听歌") }} {{ formatCount(user?.listenSongs) }} {{ $tSource("首") }}</span>
            </div>
          </div>
        </div>

        <div class="profile-header-actions">
          <CommonButton
            variant="secondary"
            size="compact"
            :loading="busyAction === 'switch'"
            @click="runAccountAction('switch')"
          >
            {{ $tSource("切换账户") }}
          </CommonButton>
          <CommonButton
            variant="ghost"
            size="compact"
            @click="logoutDialogVisible = true"
          >
            {{ $tSource("退出") }}
          </CommonButton>
        </div>
      </header>

      <!-- Tab 切换 (极简纯净下划线 Tab) -->
      <nav
        class="profile-tab-nav"
        :aria-label="$tSource('个人内容分类')"
      >
        <button
          type="button"
          class="profile-tab-btn"
          :class="{ active: activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          {{ $tSource("听歌排行") }}
        </button>
        <button
          type="button"
          class="profile-tab-btn"
          :class="{ active: activeTab === 'created' }"
          @click="activeTab = 'created'"
        >
          {{ $tSource("创建的歌单") }} <span class="profile-tab-num">{{ createdPlaylists.length }}</span>
        </button>
        <button
          type="button"
          class="profile-tab-btn"
          :class="{ active: activeTab === 'subscribed' }"
          @click="activeTab = 'subscribed'"
        >
          {{ $tSource("收藏的歌单") }} <span class="profile-tab-num">{{ subscribedPlaylists.length }}</span>
        </button>
      </nav>

      <!-- 模块一：听歌排行 -->
      <section
        v-if="activeTab === 'history'"
        class="profile-pane"
      >
        <div class="profile-pane-toolbar">
          <span class="profile-pane-count">{{ $tSource("共") }} {{ visibleHistory.length }} {{ $tSource("首歌曲") }}</span>
          <div class="profile-period-switch">
            <button
              type="button"
              :class="{ selected: historyPeriod === 'week' }"
              @click="historyPeriod = 'week'"
            >
              {{ $tSource("最近一周") }}
            </button>
            <button
              type="button"
              :class="{ selected: historyPeriod === 'all' }"
              @click="historyPeriod = 'all'"
            >
              {{ $tSource("所有时间") }}
            </button>
          </div>
        </div>

        <CommonEmptyState
          v-if="visibleHistory.length === 0"
          :title="$tSource('暂无听歌排行')"
          :description="$tSource('该账户暂无当前周期的听歌记录。')"
        />

        <div
          v-else
          class="profile-track-table"
        >
          <div class="profile-track-header">
            <span class="col-index">#</span>
            <span class="col-title">{{ $tSource("标题") }}</span>
            <span class="col-album">{{ $tSource("专辑") }}</span>
            <span class="col-plays">{{ $tSource("听歌次数") }}</span>
            <span class="col-time">{{ $tSource("时长") }}</span>
          </div>

          <CommonContextMenu
            v-for="(song, index) in visibleHistory"
            :key="`${song.id}-${index}`"
            :items="getSongMenuItems()"
            @select="handleSongMenuSelect(song, $event)"
          >
            <div
              class="profile-track-item"
              :class="{ 'is-active': activeTrackId === song.id }"
              role="button"
              tabindex="0"
              @click="playHistorySong(song)"
              @keydown.enter.prevent="playHistorySong(song)"
              @keydown.space.prevent="playHistorySong(song)"
            >
              <!-- 序号 / 播放中图标 -->
              <div class="col-index">
                <span
                  v-if="activeTrackId !== song.id"
                  class="track-number"
                >{{ index + 1 }}</span>
                <Play
                  v-else
                  :size="12"
                  fill="currentColor"
                  class="playing-icon"
                />
              </div>

              <!-- 封面与标题歌手 -->
              <div class="col-title">
                <Cover
                  :src="song.album?.artworkUrl"
                  :alt="song.name"
                  size="compact"
                  :show-play-button="false"
                />
                <div class="track-info">
                  <div class="track-name-row">
                    <span class="track-name">{{ song.name }}</span>
                    <span
                      v-if="song.access?.badges?.includes('vip')"
                      class="badge-vip"
                    >VIP</span>
                  </div>
                  <span class="track-artist">
                    {{ $tSource(song.artists.map((artist) => artist.name).join(' / ') || '未知歌手') }}
                  </span>
                </div>
              </div>

              <!-- 专辑 -->
              <div class="col-album">
                <span class="track-album-text">{{ song.album?.name || '—' }}</span>
              </div>

              <!-- 听歌次数 -->
              <div class="col-plays">
                <span class="track-plays-text">{{ song.listeningCount ?? 0 }} {{ $tSource("次") }}</span>
              </div>

              <!-- 时长 & 快捷动作 -->
              <div class="col-time">
                <div class="track-hover-actions">
                  <CommonIconButton
                    size="compact"
                    variant="ghost"
                    :label="$tSource('加入队列')"
                    @click.stop="enqueueHistorySong(song)"
                  >
                    <ListPlus :size="13" />
                  </CommonIconButton>
                  <CommonIconButton
                    size="compact"
                    variant="ghost"
                    :label="$tSource('收藏')"
                    @click.stop="toggleLikeSong(song)"
                  >
                    <Heart :size="13" />
                  </CommonIconButton>
                  <CommonIconButton
                    size="compact"
                    variant="ghost"
                    :label="$tSource('添加到歌单')"
                    @click.stop="openAddToPlaylist(song)"
                  >
                    <FolderPlus :size="13" />
                  </CommonIconButton>
                </div>
                <span class="track-duration-text">{{ formatMusicDuration(song.durationMs) }}</span>
              </div>
            </div>
          </CommonContextMenu>
        </div>
      </section>

      <!-- 模块二 & 三：歌单列表 -->
      <section
        v-else
        class="profile-pane"
      >
        <CommonEmptyState
          v-if="(activeTab === 'created' ? createdPlaylists : subscribedPlaylists).length === 0"
          :title="$tSource(activeTab === 'created' ? '暂无创建的歌单' : '暂无收藏的歌单')"
          :description="$tSource('可在歌曲菜单或歌单页面中添加。')"
        />

        <div
          v-else
          class="profile-grid"
        >
          <div
            v-for="playlist in activeTab === 'created' ? createdPlaylists : subscribedPlaylists"
            :key="playlist.id"
            class="profile-grid-card"
            role="button"
            tabindex="0"
            @click="openPlaylist(playlist)"
            @keydown.enter.prevent="openPlaylist(playlist)"
            @keydown.space.prevent="openPlaylist(playlist)"
          >
            <div class="profile-grid-cover">
              <Cover
                :src="playlist.artworkUrl"
                :alt="playlist.name"
                size="feature"
                :hover-effect="true"
                :show-play-button="false"
              />
              <span
                v-if="isLikedPlaylist(playlist)"
                class="liked-heart-mark"
                :title="$tSource('我喜欢的音乐')"
              >
                <Heart
                  :size="12"
                  fill="currentColor"
                />
              </span>
            </div>
            <div class="profile-grid-details">
              <h3
                class="profile-grid-title"
                :title="playlist.name"
              >
                {{ playlist.name }}
              </h3>
              <p class="profile-grid-subtitle">
                {{ playlist.trackCount ?? 0 }} {{ $tSource("首") }} <template v-if="!playlist.owned && playlist.creator?.nickname">
                  · by {{ playlist.creator.nickname }}
                </template>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 添加到歌单对话框 -->
    <AddTrackToPlaylistDialog
      :song="playlistTarget"
      @close="playlistTarget = null"
    />

    <!-- 退出登录确认弹窗 -->
    <CommonAlertDialog
      :visible="logoutDialogVisible"
      :title="$tSource('退出当前账户？')"
      :description="$tSource('退出后播放队列将切换到游客空间，本地保存的账户数据仍会保留。')"
      type="warning"
      :confirm-text="$tSource('退出登录')"
      @cancel="logoutDialogVisible = false"
      @confirm="confirmLogout"
    />
  </div>
</template>

<style scoped>
/* ========= 页面整体容器 ========= */

.profile-container {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 32px 0 64px;
}

.profile-state {
  display: flex;
  min-height: 280px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ========= 个人 Header ========= */

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--ncx-color-border-subtle);
}

.profile-header-main {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
  flex: 1;
}

.profile-avatar-box {
  flex-shrink: 0;
}

.profile-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5px;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profile-name-row h1 {
  margin: 0;
  color: var(--ncx-color-text-primary);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.profile-vip-tag {
  display: inline-block;
  padding: 1px 5px;
  border-radius: var(--ncx-squircle-radius-xs);
  color: #c98800;
  background: color-mix(in srgb, #ff9f0a 14%, transparent);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.profile-level-tag {
  display: inline-block;
  padding: 1px 5px;
  border-radius: var(--ncx-squircle-radius-xs);
  color: var(--ncx-color-text-secondary);
  background: var(--ncx-color-control-hover);
  font-size: 10.5px;
  font-weight: 600;
}

.profile-bio {
  max-width: 600px;
  margin: 0;
  overflow: hidden;
  color: var(--ncx-color-text-secondary);
  font-size: 12.5px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-meta-text {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--ncx-color-text-tertiary);
  font-size: 12px;
}

.profile-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ========= Tab 导航 ========= */

.profile-tab-nav {
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--ncx-color-border-subtle);
}

.profile-tab-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 0;
  border: 0;
  color: var(--ncx-color-text-secondary);
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.12s ease;
}

.profile-tab-btn:hover {
  color: var(--ncx-color-text-primary);
}

.profile-tab-btn.active {
  color: var(--ncx-color-text-primary);
}

.profile-tab-btn.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: var(--ncx-squircle-radius-xs);
  background: var(--ncx-color-accent);
}

.profile-tab-num {
  color: var(--ncx-color-text-tertiary);
  font-size: 11.5px;
  font-weight: 500;
}

/* ========= 内容面板与工具栏 ========= */

.profile-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-pane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
}

.profile-pane-count {
  color: var(--ncx-color-text-tertiary);
  font-size: 12.5px;
}

.profile-period-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--ncx-squircle-radius-sm);
  background: var(--ncx-color-control-hover);
}

.profile-period-switch button {
  padding: 4px 10px;
  border: 0;
  border-radius: var(--ncx-squircle-radius-xs);
  color: var(--ncx-color-text-secondary);
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.profile-period-switch button.selected {
  color: var(--ncx-color-text-primary);
  background: var(--ncx-color-surface-overlay);
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
}

/* ========= 听歌排行表格 ========= */

.profile-track-table {
  display: flex;
  flex-direction: column;
}

.profile-track-header {
  display: grid;
  grid-template-columns: 36px minmax(200px, 2.5fr) minmax(140px, 1.5fr) 90px 72px;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--ncx-color-border-subtle);
  color: var(--ncx-color-text-tertiary);
  font-size: 11.5px;
  font-weight: 550;
  user-select: none;
}

.profile-track-item {
  display: grid;
  grid-template-columns: 36px minmax(200px, 2.5fr) minmax(140px, 1.5fr) 90px 72px;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  border-radius: var(--ncx-squircle-radius-md);
  color: var(--ncx-color-text-primary);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.profile-track-item:hover {
  background: var(--ncx-color-control-hover);
}

.profile-track-item.is-active {
  background: var(--ncx-color-control-selected);
}

.col-index {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ncx-color-text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.playing-icon {
  color: var(--ncx-color-accent);
}

.col-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.track-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.track-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.track-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-vip {
  display: inline-block;
  padding: 0 3px;
  border: 1px solid color-mix(in srgb, #ff9f0a 50%, transparent);
  border-radius: var(--ncx-squircle-radius-xs);
  color: #ff9f0a;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;
}

.track-artist {
  overflow: hidden;
  color: var(--ncx-color-text-secondary);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-album-text {
  color: var(--ncx-color-text-tertiary);
  font-size: 12px;
}

.col-plays {
  color: var(--ncx-color-text-tertiary);
  font-size: 12px;
}

.col-time {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: flex-end;
}

.track-hover-actions {
  display: none;
  align-items: center;
  gap: 2px;
}

.profile-track-item:hover .track-hover-actions,
.profile-track-item:focus-within .track-hover-actions {
  display: flex;
}

.profile-track-item:hover .track-duration-text,
.profile-track-item:focus-within .track-duration-text {
  display: none;
}

.track-duration-text {
  color: var(--ncx-color-text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* ========= 歌单网格 ========= */

.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px 16px;
  padding-top: 6px;
}

.profile-grid-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  user-select: none;
}

.profile-grid-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}

.liked-heart-mark {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: var(--ncx-squircle-radius-full);
  color: #fff;
  background: var(--ncx-color-accent);
}

.profile-grid-details {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.profile-grid-title {
  margin: 0;
  overflow: hidden;
  color: var(--ncx-color-text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-grid-subtitle {
  margin: 0;
  overflow: hidden;
  color: var(--ncx-color-text-tertiary);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========= 响应式 ========= */

@media (width < 860px) {
  .col-album {
    display: none;
  }

  .profile-track-header,
  .profile-track-item {
    grid-template-columns: 32px minmax(160px, 1fr) 80px 64px;
  }
}

@media (width < 640px) {
  .profile-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-header-actions {
    width: 100%;
  }

  .col-plays {
    display: none;
  }

  .profile-track-header,
  .profile-track-item {
    grid-template-columns: 28px minmax(0, 1fr) 56px;
  }

  .profile-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 14px 10px;
  }
}
</style>
