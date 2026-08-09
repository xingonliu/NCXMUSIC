<script setup lang="ts">
import {
  ChevronDown,
  Heart,
  ListMusic,
  Maximize2,
  Minimize2,
  Minus,
  Copy,
  X
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
import LyricsPanel from './components/LyricsPanel.vue'
import MediaArtwork from './components/MediaArtwork.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import QueueDrawer from './components/QueueDrawer.vue'
import { mutateMusic } from './music-actions'
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

/** 当前曲目高清封面。 */
const artworkUrl = computed<string | undefined>(() => track.value?.artwork?.at(-1)?.src)

/** PlayerBar 已加载的当前曲目缩略封面。 */
const previewArtworkUrl = computed<string | undefined>(() => track.value?.artwork?.[0]?.src)

/** 沉浸页实际展示的封面，先复用缩略图再无闪烁替换高清图。 */
const displayArtworkUrl = ref<string | undefined>(previewArtworkUrl.value ?? artworkUrl.value)

/** 当前曲目歌手展示文本。 */
const artistText = computed<string>(() => track.value?.artists.join(' / ') ?? '')

/** 当前封面驱动的全窗背景样式。 */
const backdropStyle = computed<Record<string, string>>(() => {
  return artworkUrl.value ? { backgroundImage: `url("${artworkUrl.value}")` } : {}
})

/** 当前曲目是否已在本次沉浸会话中完成收藏。 */
const isLiked = ref<boolean>(false)

/** 沉浸页播放队列抽屉是否打开。 */
const isQueueOpen = ref<boolean>(false)

/** 沉浸页关闭按钮是否处于按下/活动状态。 */
const isClosePressed = ref<boolean>(false)

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

/** 点击关闭按钮，触发下箭头图标并请求关闭沉浸页。 */
function handleCloseClick(): void {
  isClosePressed.value = true
  closeImmersivePlayer()
}

/** 打开或关闭沉浸页播放队列。 */
function toggleQueueDrawer(): void {
  isQueueOpen.value = !isQueueOpen.value
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
    showToast(response.error.message, 'warning')
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
  try {
    await navigator.clipboard.writeText(information)
    showToast('歌曲信息已复制。', 'success')
  } catch {
    showToast('无法访问系统剪贴板。', 'warning')
  }
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

watch([previewArtworkUrl, artworkUrl], ([previewUrl, highResolutionUrl], _previous, onCleanup) => {
  displayArtworkUrl.value = previewUrl ?? highResolutionUrl
  if (!highResolutionUrl || highResolutionUrl === displayArtworkUrl.value) return

  /** 标记当前曲目封面预载是否已经失效。 */
  let cancelled = false
  /** 共享元素动画结束后替换高清封面的延迟定时器。 */
  let highResolutionPromotionTimer: number | undefined
  /** 用于后台解码当前曲目高清封面的临时图片。 */
  const highResolutionImage = new Image()

  /** 解码高清封面，并在共享元素动画结束后无闪烁替换。 */
  async function promoteHighResolutionArtwork(): Promise<void> {
    await highResolutionImage.decode().catch(() => undefined)
    if (cancelled) return
    highResolutionPromotionTimer = window.setTimeout(() => {
      if (!cancelled) displayArtworkUrl.value = highResolutionUrl
    }, 520)
  }

  highResolutionImage.src = highResolutionUrl
  void promoteHighResolutionArtwork()

  onCleanup(() => {
    cancelled = true
    window.clearTimeout(highResolutionPromotionTimer)
  })
}, { immediate: true })

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
    <div
      class="immersive-backdrop"
      aria-hidden="true"
    >
      <div
        class="immersive-backdrop-artwork"
        :style="backdropStyle"
      />
      <div class="immersive-backdrop-veil" />
    </div>

    <header class="immersive-toolbar">
      <div class="immersive-toolbar-output">
        <CommonHeaderGroupButton
          v-if="isWindows"
          label="窗口控制"
        >
          <CommonHeaderGroupItem
            label="最小化"
            @click="runWindowCommand({ type: 'window.minimize' })"
          >
            <Minus :size="16" />
          </CommonHeaderGroupItem>
          <CommonHeaderGroupItem
            :label="windowSnapshot.maximized ? '还原窗口' : '最大化窗口'"
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
            label="关闭窗口"
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
        aria-label="正在播放"
      >
        <button
          type="button"
          class="immersive-close-handle"
          :class="{ 'immersive-close-handle--active': isClosePressed }"
          aria-label="收起沉浸播放页"
          @click="handleCloseClick"
          @mousedown="isClosePressed = true"
        >
          <ChevronDown
            class="immersive-close-icon"
            :size="18"
          />
          <span class="immersive-close-pill" />
        </button>

        <MediaArtwork
          :src="displayArtworkUrl"
          :alt="track.name"
          size="hero"
          :adapt-source="false"
          loading="eager"
          class="immersive-artwork"
          :style="{ viewTransitionName: 'ncx-now-playing-artwork' }"
        />

        <div class="immersive-track-row">
          <div class="immersive-track-copy">
            <h1 id="immersive-lyrics-title">
              {{ track.name }}
            </h1>
            <p>{{ artistText }}<span v-if="track.album"> · {{ track.album }}</span></p>
          </div>

          <div class="immersive-track-actions">
            <CommonIconButton
              size="default"
              variant="ghost"
              :selected="isLiked"
              :label="isLiked ? '已收藏当前歌曲' : '收藏当前歌曲'"
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
              label="复制歌曲信息"
              @click="copyTrackInformation"
            >
              <Copy :size="18" />
            </CommonIconButton>
          </div>
        </div>

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
        @seek="player.seek"
      />
    </main>

    <div
      v-else
      class="immersive-empty-state"
    >
      <button
        type="button"
        class="immersive-close-handle"
        :class="{ 'immersive-close-handle--active': isClosePressed }"
        aria-label="收起沉浸播放页"
        @click="handleCloseClick"
        @mousedown="isClosePressed = true"
      >
        <ChevronDown
          class="immersive-close-icon"
          :size="18"
        />
        <span class="immersive-close-pill" />
      </button>
      <h1 id="immersive-lyrics-title">
        还没有播放内容
      </h1>
      <p>收起页面并选择一首歌曲开始播放。</p>
    </div>

    <footer class="immersive-footer">
      <CommonIconButton
        size="default"
        variant="ghost"
        :selected="isQueueOpen"
        label="播放队列"
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
  border-radius: 16px;
  color: white;
  background: #111719;
  isolation: isolate;
  outline: none;
  view-transition-name: ncx-immersive-player;
}

.immersive-lyrics-page--macos {
  border-radius: 16px;
}

.immersive-lyrics-page--windows {
  border-radius: 8px;
}

.immersive-lyrics-page--fullscreen {
  border-radius: 0;
}

.immersive-backdrop,
.immersive-backdrop-artwork,
.immersive-backdrop-veil {
  position: absolute;
  inset: 0;
}

.immersive-backdrop {
  z-index: -1;
  overflow: hidden;
  background: #111719;
}

.immersive-backdrop-artwork {
  inset: -20%;
  background-position: center;
  background-size: cover;
  filter: blur(80px) saturate(1.65) brightness(0.8);
  opacity: 0.9;
  transform: scale(1.18);
  animation: ncx-backdrop-pulse 24s ease-in-out infinite alternate;
}

@keyframes ncx-backdrop-pulse {
  0% {
    transform: scale(1.15) rotate(0deg);
  }
  50% {
    transform: scale(1.22) rotate(2deg);
  }
  100% {
    transform: scale(1.16) rotate(-1deg);
  }
}

.immersive-backdrop-veil {
  background: rgb(5 12 14 / 34%);
  box-shadow: inset 0 0 180px rgb(0 0 0 / 18%);
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
  display: inline-flex;
  width: 44px;
  height: 28px;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: white;
  background: transparent;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition:
    background-color 0.2s ease,
    transform 0.15s ease;
}

.immersive-close-handle:hover,
.immersive-close-handle:focus-visible {
  background: rgb(255 255 255 / 16%);
}

.immersive-close-handle:active {
  transform: scale(0.92);
}

.immersive-close-pill {
  width: 36px;
  height: 5px;
  border-radius: 3px;
  background: rgb(255 255 255 / 45%);
  box-shadow: 0 1px 2px rgb(0 0 0 / 16%);
  transition: opacity 0.2s ease;
}

.immersive-close-icon {
  display: none;
}

.immersive-close-handle:hover .immersive-close-pill,
.immersive-close-handle--active .immersive-close-pill {
  display: none;
}

.immersive-close-handle:hover .immersive-close-icon,
.immersive-close-handle--active .immersive-close-icon {
  display: block;
}

.immersive-content {
  display: grid;
  width: min(1140px, calc(100% - 72px));
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: clamp(48px, 8vw, 112px);
  align-items: center;
  align-self: center;
  padding: 10px 0 30px;
}

.immersive-now-playing {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ncx-space-3);
}

.immersive-artwork {
  width: 100%;
  height: auto;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 1;
  border-radius: 16px;
  box-shadow: 0 24px 70px rgb(0 0 0 / 38%);
}

.immersive-track-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--ncx-space-4);
}

.immersive-now-playing :deep(.playback-controls) {
  width: 100%;
}

.immersive-track-copy {
  min-width: 0;
}

.immersive-track-copy h1,
.immersive-track-copy p {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.immersive-track-copy h1 {
  font-size: clamp(20px, 1.8vw, 26px);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.immersive-track-copy p {
  margin-top: 6px;
  color: rgb(255 255 255 / 68%);
  font-size: clamp(13px, 1vw, 15px);
  font-weight: 500;
  line-height: 1.4;
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
  height: min(630px, calc(100vh - 138px));
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
    width: calc(100% - 56px);
    grid-template-columns: minmax(230px, 300px) minmax(0, 1fr);
    gap: 48px;
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

  .immersive-lyrics-panel {
    height: calc(100vh - 104px);
  }
}
</style>

<style>
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-group(root) {
  z-index: 0;
}

::view-transition-group(ncx-immersive-player) {
  z-index: 1;
}

::view-transition-group(ncx-now-playing-artwork) {
  z-index: 2;
  overflow: hidden;
  border-radius: var(--ncx-radius-lg);
  animation-duration: 480ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

::view-transition-new(ncx-immersive-player) {
  animation: ncx-immersive-enter 440ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

::view-transition-old(ncx-immersive-player) {
  animation: ncx-immersive-exit 360ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes ncx-immersive-enter {
  from {
    opacity: 0.84;
    transform: translateY(100%);
  }
}

@keyframes ncx-immersive-exit {
  to {
    opacity: 0.8;
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(ncx-now-playing-artwork),
  ::view-transition-new(ncx-immersive-player),
  ::view-transition-old(ncx-immersive-player) {
    animation-duration: 1ms;
  }
}
</style>
