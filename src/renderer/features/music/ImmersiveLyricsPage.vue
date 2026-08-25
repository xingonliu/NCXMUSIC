<script setup lang="ts">
import {
  Copy,
  Heart,
  ListMusic,
  Maximize2,
  Minimize2,
  Minus,
  Repeat,
  Repeat1,
  Shuffle,
  X
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { PlayMode } from '../../../domains/player/types'
import type {
  DesktopPlatform,
  WindowCommand,
  WindowSnapshot
} from '../../../shared/contracts/window-controls'
import {
  CommonHeaderGroupButton,
  CommonHeaderGroupItem,
  CommonIconButton
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { useI18n , translatePublicError} from '../../i18n'
import { copyText } from '../foundation/clipboard'
import { DEFAULT_LYRIC_ACCENT_COLOR } from './artwork-accent-color'
import FluidMeshBackground from './components/FluidMeshBackground.vue'
import LyricsPanel from './components/LyricsPanel.vue'
import MediaArtwork from './components/MediaArtwork.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import QueueDrawer from './components/QueueDrawer.vue'
import { mutateMusic } from './music-actions'
import { adaptArtworkUrl } from './music-entity'
import { usePlayer } from './use-player'

// ========= 事件 =========

/** 沉浸播放展示层事件定义。 */
const emit = defineEmits<{
  /** 请求关闭沉浸播放展示层。 */
  (event: 'close'): void
}>()

// ========= 变量 =========

/** 沉浸页根元素，用于打开后接管键盘焦点。 */
const pageRoot = ref<HTMLElement | null>(null)

/** 播放器接口，所有控制仍发送到唯一播放域。 */
const player = usePlayer()

/** 播放器只读快照。 */
const snapshot = player.snapshot

/** 当前曲目摘要。 */
const track = computed(() => snapshot.value.playback.track)

/** 当前曲目高清封面，与 PlayerBar 使用完全一致的图片资源。 */
const artworkUrl = computed<string | undefined>(() => track.value?.artwork?.at(-1)?.src ?? track.value?.artwork?.[0]?.src)

/** 沉浸页实际展示的封面，直接使用与 PlayerBar 一致的高清图。 */
const displayArtworkUrl = computed<string | undefined>(() => artworkUrl.value)

/** 动态歌词背景专用的 320×320 高保真网易云 CDN 封面。 */
const backdropArtworkUrl = computed<string | undefined>(() => (
  adaptArtworkUrl(artworkUrl.value, 'card') ?? artworkUrl.value
))

/** 当前封面提亮后的歌词前沿色，不区分页面深浅模式。 */
const lyricAccentColor = ref<string>(DEFAULT_LYRIC_ACCENT_COLOR)

/** 当前曲目歌手展示文本。 */
const artistText = computed<string>(() => track.value?.artists.join(' / ') ?? '')

/** 当前曲目是否已在本次沉浸会话中完成收藏。 */
const isLiked = ref<boolean>(false)

/** 沉浸页使用的国际化状态。 */
const i18n = useI18n()

/** 沉浸页本地化文案集合。 */
const text = computed(() => i18n.messages.value.player)

/** 播放模式循环顺序。 */
const MODE_CYCLE: PlayMode[] = ['loop', 'loop-one', 'shuffle']

/** 下一个播放模式。 */
const nextMode = computed<PlayMode>(() => {
  const current = snapshot.value.queue.mode
  const index = MODE_CYCLE.indexOf(current)
  return MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? 'loop'
})

/** 沉浸页播放队列抽屉是否打开。 */
const isQueueOpen = ref<boolean>(false)

/** Main 进程推送的真实窗口快照。 */
const windowSnapshot = ref<WindowSnapshot>({
  platform: window.ncx.platform as DesktopPlatform,
  maximized: false,
  fullscreen: false,
  focused: true
})

/** 当前运行平台是否为 Windows。 */
const isWindows = computed<boolean>(() => windowSnapshot.value.platform === 'win32')

/** 窗口状态监听清理函数。 */
let unsubscribeWindowSnapshot = (): void => {}

// ========= 函数 =========

/** 请求关闭沉浸播放展示层。 */
function closeImmersivePlayer(): void {
  emit('close')
}

/** 打开或关闭沉浸页播放队列。 */
function toggleQueueDrawer(): void {
  isQueueOpen.value = !isQueueOpen.value
}

/** 接收封面加载阶段一次性提取的歌词前沿色。 */
function updateLyricAccentColor(color: string): void {
  lyricAccentColor.value = color
}

/** 收藏当前歌曲，并通过全局 Toast 返回结果。 */
async function likeCurrentTrack(): Promise<void> {
  /** 当前可收藏的曲目。 */
  const currentTrack = track.value
  if (!currentTrack || isLiked.value) return

  /** 收藏当前曲目的标准写入响应。 */
  const response = await mutateMusic({
    operation: 'likeTrack',
    trackId: currentTrack.trackId,
    liked: true
  })

  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return
  }

  isLiked.value = true
  showToast(`已收藏《${currentTrack.name}》。`, 'success')
}

/** 把当前歌曲信息复制到系统剪贴板。 */
async function copyTrackInformation(): Promise<void> {
  /** 当前可复制信息的曲目。 */
  const currentTrack = track.value
  if (!currentTrack) return

  /** 由歌曲名和歌手组成的剪贴板文本。 */
  const information = `${currentTrack.name} - ${currentTrack.artists.join(' / ')}`
  await copyText(information, '歌曲信息已复制。')
}

/**
 * 发送窗口控制命令，并等待 Main 回传真实窗口状态。
 *
 * @param command 需要执行的窗口命令
 */
async function runWindowCommand(command: WindowCommand): Promise<void> {
  windowSnapshot.value = await window.ncx.windowControls.send(command)
}

/** 处理沉浸页全局键盘命令。 */
function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  if (isQueueOpen.value) {
    isQueueOpen.value = false
    return
  }
  closeImmersivePlayer()
}

// ========= 生命周期 =========

watch(() => track.value?.trackId, () => {
  isLiked.value = false
})

onMounted(async () => {
  window.addEventListener('keydown', handleWindowKeydown)
  unsubscribeWindowSnapshot = window.ncx.windowControls.onSnapshot((nextSnapshot) => {
    windowSnapshot.value = nextSnapshot
  })
  windowSnapshot.value = await window.ncx.windowControls.snapshot()
  pageRoot.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  unsubscribeWindowSnapshot()
})
</script>

<template>
  <section
    ref="pageRoot"
    class="immersive-lyrics-page"
    :class="[
      isWindows ? 'immersive-lyrics-page--windows' : 'immersive-lyrics-page--macos',
      windowSnapshot.fullscreen ? 'immersive-lyrics-page--fullscreen' : ''
    ]"
    role="dialog"
    aria-modal="true"
    aria-labelledby="immersive-lyrics-title"
    tabindex="-1"
  >
    <FluidMeshBackground
      class="immersive-backdrop"
      :artwork-url="backdropArtworkUrl"
      :playing="snapshot.playback.status === 'playing'"
      @accent-color="updateLyricAccentColor"
    />

    <button
      type="button"
      class="immersive-close-handle"
      :aria-label="$tSource('收起沉浸播放页')"
      @click="closeImmersivePlayer"
    >
      <svg
        class="immersive-close-svg"
        width="44"
        height="18"
        viewBox="0 0 44 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <line
          x1="7"
          y1="9"
          x2="37"
          y2="9"
          stroke="currentColor"
          stroke-width="6"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <header class="immersive-toolbar">
      <div class="immersive-toolbar-output">
        <CommonHeaderGroupButton
          v-if="isWindows"
          :label="$tSource('窗口控制')"
        >
          <CommonHeaderGroupItem
            :label="$tSource('最小化')"
            @click="runWindowCommand({ type: 'window.minimize' })"
          >
            <Minus :size="16" />
          </CommonHeaderGroupItem>
          <CommonHeaderGroupItem
            :label="$tSource(windowSnapshot.maximized ? '还原窗口' : '最大化窗口')"
            @click="runWindowCommand({ type: 'window.toggleMaximize' })"
          >
            <Minimize2
              v-if="windowSnapshot.maximized"
              :size="16"
            />
            <Maximize2
              v-else
              :size="16"
            />
          </CommonHeaderGroupItem>
          <CommonHeaderGroupItem
            :label="$tSource('关闭窗口')"
            variant="close"
            @click="runWindowCommand({ type: 'window.requestClose' })"
          >
            <X :size="16" />
          </CommonHeaderGroupItem>
        </CommonHeaderGroupButton>
      </div>
    </header>

    <main
      v-if="track"
      class="immersive-content"
    >
      <section
        class="immersive-now-playing"
        :aria-label="$tSource('正在播放')"
      >
        <MediaArtwork
          :src="displayArtworkUrl"
          :alt="track.name"
          size="hero"
          :adapt-source="false"
          loading="eager"
          class="immersive-artwork"
        />

        <div class="immersive-track-title-row">
          <h1 id="immersive-lyrics-title">
            {{ track.name }}
          </h1>

          <div class="immersive-track-actions">
            <CommonIconButton
              size="default"
              variant="ghost"
              :selected="isLiked"
              :label="$tSource(isLiked ? '已收藏当前歌曲' : '收藏当前歌曲')"
              @click="likeCurrentTrack"
            >
              <Heart
                :size="18"
                :fill="isLiked ? 'currentColor' : 'none'"
              />
            </CommonIconButton>
            <CommonIconButton
              size="default"
              variant="ghost"
              :label="$tSource('复制歌曲信息')"
              @click="copyTrackInformation"
            >
              <Copy :size="18" />
            </CommonIconButton>
            <CommonIconButton
              size="default"
              variant="ghost"
              :label="text.mode[snapshot.queue.mode]"
              @click="player.setMode(nextMode)"
            >
              <Shuffle
                v-if="snapshot.queue.mode === 'shuffle'"
                :size="18"
              />
              <Repeat1
                v-else-if="snapshot.queue.mode === 'loop-one'"
                :size="18"
              />
              <Repeat
                v-else
                :size="18"
              />
            </CommonIconButton>
          </div>
        </div>

        <p class="immersive-track-artist">
          {{ artistText }}<span v-if="track.album"> · {{ track.album }}</span>
        </p>

        <PlaybackControls
          prominent
          immersive
        />
      </section>

      <LyricsPanel
        class="immersive-lyrics-panel"
        immersive
        :track-id="track.trackId"
        :position-ms="snapshot.playback.positionMs"
        :playing="snapshot.playback.status === 'playing'"
        :accent-color="lyricAccentColor"
        @seek="player.seek"
      />
    </main>

    <div
      v-else
      class="immersive-empty-state"
    >
      <h1 id="immersive-lyrics-title">
        {{ $tSource("还没有播放内容") }}
      </h1>
      <p>{{ $tSource("收起页面并选择一首歌曲开始播放。") }}</p>
    </div>

    <footer class="immersive-footer">
      <CommonIconButton
        size="default"
        variant="ghost"
        :selected="isQueueOpen"
        :label="$tSource('播放队列')"
        @click="toggleQueueDrawer"
      >
        <ListMusic :size="18" />
      </CommonIconButton>
    </footer>

    <QueueDrawer
      :visible="isQueueOpen"
      @close="isQueueOpen = false"
    />
  </section>
</template>

<style scoped>
.immersive-lyrics-page {
  position: fixed;
  z-index: var(--ncx-layer-presentation);
  inset: 0;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border-radius: var(--ncx-squircle-radius-lg);
  color: white;
  background: rgb(17 23 25);
  isolation: isolate;
  outline: none;
}

.immersive-lyrics-page--macos {
  border-radius: var(--ncx-squircle-radius-lg);
}

.immersive-lyrics-page--windows {
  border-radius: var(--ncx-squircle-radius-sm);
}

.immersive-lyrics-page--fullscreen {
  border-radius: 0;
}

.immersive-backdrop {
  position: absolute;
  inset: 0;
}

.immersive-backdrop {
  z-index: -1;
}

.immersive-toolbar {
  display: flex;
  min-height: 52px;
  flex: 0 0 52px;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ncx-space-4);
  padding: 8px 18px 0 18px;
  -webkit-app-region: drag;
}

.immersive-toolbar-output {
  display: flex;
  align-items: center;
  gap: var(--ncx-space-3);
  -webkit-app-region: no-drag;
}

.immersive-toolbar :deep(.ncx-common-header-group) {
  color: white;
  background: rgb(255 255 255 / 12%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 18%);
}

.immersive-close-handle {
  --immersive-handle-press-scale: 1;

  position: absolute;
  z-index: 3;
  top: 53px;
  left: 50%;
  display: inline-flex;
  width: 68px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--ncx-squircle-radius-full);
  color: #ffffff;
  background: transparent;
  cursor: pointer;
  user-select: none;
  -webkit-app-region: no-drag;
  transform: translateX(-50%) scale(var(--immersive-handle-press-scale));
  transition: transform 180ms ease;
}

.immersive-close-handle:hover,
.immersive-close-handle:focus-visible {
  background: transparent;
  outline: none;
}

.immersive-close-handle:active {
  --immersive-handle-press-scale: 0.94;
}

.immersive-close-svg {
  display: block;
  overflow: visible;
  filter: drop-shadow(0 0 0 rgb(255 255 255 / 0%));
  transition: filter 180ms ease;
}

.immersive-close-handle:hover .immersive-close-svg,
.immersive-close-handle:focus-visible .immersive-close-svg {
  filter:
    drop-shadow(0 0 4px rgb(255 255 255 / 82%))
    drop-shadow(0 0 10px rgb(255 255 255 / 48%));
}

.immersive-content {
  display: grid;
  width: calc(100% - clamp(32px, 3.5vw, 72px));
  max-width: 2000px;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(280px, 40%) minmax(320px, 60%);
  gap: clamp(16px, 2.5vw, 40px);
  align-items: center;
  align-self: center;
  padding: 10px 0 20px;
}

.immersive-now-playing {
  display: flex;
  min-width: 0;
  width: 100%;
  max-width: clamp(260px, 26vw, 400px);
  justify-self: center;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ncx-space-3-5, 14px);
}

.immersive-artwork {
  width: 100%;
  height: auto;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 1;
  z-index: 2;
  border-radius: var(--ncx-squircle-radius-lg);
  box-shadow: 0 24px 70px rgb(0 0 0 / 38%);
}

.immersive-track-title-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--ncx-space-3, 12px);
}

.immersive-now-playing :deep(.playback-controls) {
  width: 100%;
}

.immersive-track-title-row h1 {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: clamp(20px, 1.8vw, 26px);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.immersive-track-artist {
  width: 100%;
  margin: 0;
  overflow: hidden;
  color: rgb(255 255 255 / 68%);
  font-size: clamp(13px, 1vw, 15px);
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.immersive-track-actions {
  display: flex;
  flex: none;
  gap: var(--ncx-space-1);
}

.immersive-track-actions :deep(.ncx-common-icon-button),
.immersive-footer :deep(.ncx-common-icon-button) {
  color: white;
  background: rgb(255 255 255 / 12%);
}

.immersive-lyrics-panel {
  width: 100%;
  height: calc(100dvh - 104px);
  max-height: 100%;
  min-height: 0;
}

.immersive-empty-state {
  display: grid;
  flex: 1;
  place-content: center;
  text-align: center;
}

.immersive-empty-state h1,
.immersive-empty-state p {
  margin: 0;
}

.immersive-empty-state p {
  margin-top: var(--ncx-space-2);
  color: rgb(255 255 255 / 64%);
}

.immersive-footer {
  position: absolute;
  right: 20px;
  bottom: 18px;
  -webkit-app-region: no-drag;
}

@media (width < 1080px) {
  .immersive-content {
    width: calc(100% - 36px);
    grid-template-columns: minmax(240px, 40%) minmax(260px, 60%);
    gap: 20px;
  }

  .immersive-now-playing {
    max-width: 100%;
    justify-self: center;
  }
}

@media (height < 720px) {
  .immersive-toolbar {
    min-height: 60px;
    flex-basis: 60px;
  }

  .immersive-content {
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    padding-top: 8px;
  }

  .immersive-now-playing {
    max-width: 100%;
  }

  .immersive-lyrics-panel {
    height: calc(100vh - 104px);
    padding-left: 0;
  }
}
</style>
