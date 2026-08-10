<script setup lang="ts">
import {
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
import {
  calculateImmersiveArtworkTransform,
  calculateImmersiveDismissVisualState,
  clampImmersiveDismissOffset,
  type ImmersiveArtworkGeometry,
  type ImmersiveArtworkRect,
  shouldCompleteImmersiveDismiss
} from './immersive-dismiss-gesture'
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

/** 短杆下拉手势当前产生的纵向位移。 */
const dismissDragOffsetY = ref<number>(0)

/** 用户是否正在拖动沉浸页关闭短杆。 */
const isDismissDragging = ref<boolean>(false)

/** 本次下拉开始时捕获的沉浸封面与 PlayerBar 封面矩形。 */
const dismissArtworkGeometry = ref<ImmersiveArtworkGeometry | null>(null)

/** 当前下拉位移对应的封面缩放与渐隐状态。 */
const dismissVisualState = computed(() => {
  return calculateImmersiveDismissVisualState(dismissDragOffsetY.value)
})

/** 当前下拉位移对应的封面源目标插值变换。 */
const dismissArtworkTransform = computed(() => {
  return calculateImmersiveArtworkTransform(
    dismissDragOffsetY.value,
    dismissArtworkGeometry.value
  )
})

/** 注入沉浸页样式的连续下拉手势变量。 */
const dismissGestureStyle = computed<Record<string, string>>(() => {
  /** 当前下拉视觉状态。 */
  const visualState = dismissVisualState.value
  /** 当前封面向 PlayerBar 靠拢的几何变换。 */
  const artworkTransform = dismissArtworkTransform.value

  return {
    '--immersive-drag-offset-y': `${dismissDragOffsetY.value}px`,
    '--immersive-artwork-translate-x': `${artworkTransform.translateX}px`,
    '--immersive-artwork-translate-y': `${artworkTransform.translateY}px`,
    '--immersive-artwork-scale': String(artworkTransform.scale),
    '--immersive-artwork-radius': `${artworkTransform.borderRadius}px`,
    '--immersive-supporting-opacity': String(visualState.supportingOpacity),
    '--immersive-backdrop-opacity': String(visualState.backdropOpacity),
    '--immersive-surface-opacity': String(visualState.surfaceOpacity)
  }
})

/** 当前曲目是否已在本次沉浸会话中完成收藏。 */
const isLiked = ref<boolean>(false)

/** 沉浸页播放队列抽屉是否打开。 */
const isQueueOpen = ref<boolean>(false)

/** 当前下拉手势占用的指针 ID。 */
let dismissPointerId: number | null = null

/** 当前下拉手势执行指针捕获的短杆元素。 */
let dismissCaptureElement: HTMLElement | null = null

/** 当前下拉手势按下时的纵向坐标。 */
let dismissDragStartY = 0

/** 最近一次手势采样的纵向坐标。 */
let dismissDragLastY = 0

/** 最近一次手势采样的事件时间戳。 */
let dismissDragLastTimestamp = 0

/** 最近一次手势采样计算出的纵向速度。 */
let dismissDragVelocityY = 0

/** 当前指针序列结束后是否需要忽略浏览器合成的点击。 */
let suppressNextCloseClick = false

/** 清除点击抑制标记的零延时定时器。 */
let closeClickResetTimer: number | undefined

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

/**
 * 读取封面元素参与拖拽插值所需的视口矩形和圆角。
 *
 * @param element 需要测量的封面根元素
 */
function measureArtworkRect(element: HTMLElement): ImmersiveArtworkRect {
  /** 元素当前未开始拖拽时的视口矩形。 */
  const rect = element.getBoundingClientRect()
  /** 元素当前计算样式，用于取得设计系统实际圆角。 */
  const styles = window.getComputedStyle(element)
  /** 左上圆角的像素值，无法解析时安全回退为 0。 */
  const borderRadius = Number.parseFloat(styles.borderTopLeftRadius) || 0

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    borderRadius
  }
}

/** 捕获沉浸大封面到 PlayerBar 小封面的实时几何关系。 */
function captureDismissArtworkGeometry(): ImmersiveArtworkGeometry | null {
  /** 沉浸歌词页中正在展示的大封面。 */
  const sourceArtwork = pageRoot.value?.querySelector<HTMLElement>(
    '[data-immersive-artwork-source]'
  )
  /** 沉浸层下方 PlayerBar 中的封面过渡终点。 */
  const targetArtwork = document.querySelector<HTMLElement>(
    '[data-immersive-artwork-target]'
  )

  if (!sourceArtwork || !targetArtwork) return null

  return {
    source: measureArtworkRect(sourceArtwork),
    target: measureArtworkRect(targetArtwork)
  }
}

/** 清理沉浸页下拉手势注册的全局指针监听。 */
function cleanupDismissPointerListeners(): void {
  window.removeEventListener('pointermove', handleDismissPointerMove)
  window.removeEventListener('pointerup', handleDismissPointerUp)
  window.removeEventListener('pointercancel', handleDismissPointerCancel)
}

/** 释放当前短杆持有的指针捕获。 */
function releaseDismissPointerCapture(): void {
  if (!dismissCaptureElement || dismissPointerId === null) return

  try {
    if (dismissCaptureElement.hasPointerCapture(dismissPointerId)) {
      dismissCaptureElement.releasePointerCapture(dismissPointerId)
    }
  } catch {
    // 忽略窗口切换或元素卸载导致的指针捕获释放失败。
  }
}

/** 在当前指针序列结束后短暂忽略浏览器合成的点击事件。 */
function suppressSyntheticCloseClick(): void {
  suppressNextCloseClick = true
  window.clearTimeout(closeClickResetTimer)
  closeClickResetTimer = window.setTimeout(() => {
    suppressNextCloseClick = false
    closeClickResetTimer = undefined
  }, 0)
}

/** 清空下拉手势的临时状态并让界面回弹到初始位置。 */
function resetDismissGesture(): void {
  dismissDragOffsetY.value = 0
  dismissDragVelocityY = 0
  dismissArtworkGeometry.value = null
  isDismissDragging.value = false
}

/** 清空当前活跃指针并移除全局手势监听。 */
function finishDismissPointerTracking(): void {
  releaseDismissPointerCapture()
  cleanupDismissPointerListeners()
  dismissPointerId = null
  dismissCaptureElement = null
  isDismissDragging.value = false
}

/**
 * 使用最新指针坐标更新下拉位移和瞬时速度。
 *
 * @param event 当前活跃指针的移动或释放事件
 */
function updateDismissGesture(event: PointerEvent): void {
  /** 本次指针采样距离上一采样的时间。 */
  const elapsedMs = event.timeStamp - dismissDragLastTimestamp

  if (elapsedMs > 0) {
    dismissDragVelocityY = (event.clientY - dismissDragLastY) / elapsedMs
  }

  dismissDragLastY = event.clientY
  dismissDragLastTimestamp = event.timeStamp

  /** 指针相对按下位置产生的原始纵向位移。 */
  const rawOffsetY = event.clientY - dismissDragStartY
  dismissDragOffsetY.value = clampImmersiveDismissOffset(
    rawOffsetY,
    window.innerHeight
  )
}

/**
 * 按下沉浸页短杆后开始跟踪下拉关闭手势。
 *
 * @param event 短杆收到的指针按下事件
 */
function handleDismissPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || dismissPointerId !== null) return
  event.preventDefault()

  dismissPointerId = event.pointerId
  dismissCaptureElement = event.currentTarget as HTMLElement
  dismissDragStartY = event.clientY
  dismissDragLastY = event.clientY
  dismissDragLastTimestamp = event.timeStamp
  dismissDragVelocityY = 0
  dismissDragOffsetY.value = 0
  dismissArtworkGeometry.value = captureDismissArtworkGeometry()
  isDismissDragging.value = true

  try {
    dismissCaptureElement.setPointerCapture(event.pointerId)
  } catch {
    // 指针捕获不可用时继续依赖窗口级监听。
  }

  window.addEventListener('pointermove', handleDismissPointerMove, { passive: false })
  window.addEventListener('pointerup', handleDismissPointerUp)
  window.addEventListener('pointercancel', handleDismissPointerCancel)
}

/**
 * 处理短杆拖动并连续刷新封面缩放和其他元素透明度。
 *
 * @param event 窗口级指针移动事件
 */
function handleDismissPointerMove(event: PointerEvent): void {
  if (event.pointerId !== dismissPointerId || !isDismissDragging.value) return
  event.preventDefault()
  updateDismissGesture(event)
}

/**
 * 释放短杆后根据距离和速度决定完成收起或回弹。
 *
 * @param event 窗口级指针释放事件
 */
function handleDismissPointerUp(event: PointerEvent): void {
  if (event.pointerId !== dismissPointerId || !isDismissDragging.value) return
  updateDismissGesture(event)

  /** 本次交互是否已经形成可感知拖动。 */
  const movedBeyondClickTolerance = dismissDragOffsetY.value > 4
  /** 释放时是否满足距离或下甩速度阈值。 */
  const shouldDismiss = shouldCompleteImmersiveDismiss(
    dismissDragOffsetY.value,
    dismissDragVelocityY
  )

  finishDismissPointerTracking()
  if (movedBeyondClickTolerance) suppressSyntheticCloseClick()

  if (shouldDismiss) {
    closeImmersivePlayer()
    return
  }

  resetDismissGesture()
}

/**
 * 指针被系统取消时终止手势并让沉浸页回弹。
 *
 * @param event 窗口级指针取消事件
 */
function handleDismissPointerCancel(event: PointerEvent): void {
  if (event.pointerId !== dismissPointerId) return

  /** 取消前是否已经形成可感知拖动。 */
  const movedBeyondClickTolerance = dismissDragOffsetY.value > 4
  finishDismissPointerTracking()
  if (movedBeyondClickTolerance) suppressSyntheticCloseClick()
  resetDismissGesture()
}

/** 请求关闭沉浸播放展示层。 */
function closeImmersivePlayer(): void {
  cleanupDismissPointerListeners()
  emit('close')
}

/**
 * 点击短杆后请求关闭沉浸页。
 *
 * @param event 短杆按钮合成的点击事件
 */
function handleCloseClick(event: MouseEvent): void {
  if (suppressNextCloseClick) {
    event.preventDefault()
    suppressNextCloseClick = false
    return
  }

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
  finishDismissPointerTracking()
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
  cleanupDismissPointerListeners()
  window.clearTimeout(closeClickResetTimer)
  unsubscribeWindowSnapshot()
})
</script>

<template>
  <section
    ref="pageRoot"
    class="immersive-lyrics-page"
    :class="[
      isWindows ? 'immersive-lyrics-page--windows' : 'immersive-lyrics-page--macos',
      windowSnapshot.fullscreen ? 'immersive-lyrics-page--fullscreen' : '',
      isDismissDragging ? 'immersive-lyrics-page--dragging' : ''
    ]"
    :style="dismissGestureStyle"
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
          aria-label="收起沉浸播放页"
          @click="handleCloseClick"
          @pointerdown="handleDismissPointerDown"
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

        <MediaArtwork
          :src="displayArtworkUrl"
          :alt="track.name"
          size="hero"
          :adapt-source="false"
          loading="eager"
          class="immersive-artwork"
          data-immersive-artwork-source
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
        aria-label="收起沉浸播放页"
        @click="handleCloseClick"
        @pointerdown="handleDismissPointerDown"
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
  background: rgb(17 23 25 / var(--immersive-surface-opacity, 1));
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
  opacity: var(--immersive-backdrop-opacity, 1);
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
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
  opacity: var(--immersive-supporting-opacity, 1);
  -webkit-app-region: drag;
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
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

  display: inline-flex;
  width: 68px;
  height: 32px;
  align-items: center;
  justify-content: center;
  align-self: center;
  margin-bottom: 4px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: #ffffff;
  background: transparent;
  opacity: 1;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-app-region: no-drag;
  transform:
    translate3d(0, var(--immersive-drag-offset-y, 0), 0)
    scale(var(--immersive-handle-press-scale));
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.immersive-lyrics-page--dragging .immersive-close-handle {
  cursor: grabbing;
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
.immersive-close-handle:focus-visible .immersive-close-svg,
.immersive-lyrics-page--dragging .immersive-close-svg {
  filter:
    drop-shadow(0 0 4px rgb(255 255 255 / 82%))
    drop-shadow(0 0 10px rgb(255 255 255 / 48%));
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
  z-index: 2;
  border-radius: var(--immersive-artwork-radius, 16px);
  box-shadow: 0 24px 70px rgb(0 0 0 / 38%);
  transform:
    translate3d(
      var(--immersive-artwork-translate-x, 0),
      var(--immersive-artwork-translate-y, 0),
      0
    )
    scale(var(--immersive-artwork-scale, 1));
  transform-origin: top left;
  transition:
    border-radius 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.immersive-track-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--ncx-space-4);
  opacity: var(--immersive-supporting-opacity, 1);
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.immersive-now-playing :deep(.playback-controls) {
  width: 100%;
  opacity: var(--immersive-supporting-opacity, 1);
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
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
  opacity: var(--immersive-supporting-opacity, 1);
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.immersive-empty-state {
  display: grid;
  flex: 1;
  place-content: center;
  opacity: var(--immersive-supporting-opacity, 1);
  text-align: center;
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
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
  opacity: var(--immersive-supporting-opacity, 1);
  -webkit-app-region: no-drag;
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.immersive-lyrics-page--dragging .immersive-backdrop,
.immersive-lyrics-page--dragging .immersive-toolbar,
.immersive-lyrics-page--dragging .immersive-close-handle,
.immersive-lyrics-page--dragging .immersive-artwork,
.immersive-lyrics-page--dragging .immersive-track-row,
.immersive-lyrics-page--dragging .immersive-now-playing :deep(.playback-controls),
.immersive-lyrics-page--dragging .immersive-lyrics-panel,
.immersive-lyrics-page--dragging .immersive-empty-state,
.immersive-lyrics-page--dragging .immersive-footer {
  transition: none;
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
}

::view-transition-image-pair(ncx-now-playing-artwork) {
  overflow: hidden;
  isolation: auto;
}

:root[data-ncx-immersive-transition='opening']::view-transition-group(ncx-now-playing-artwork) {
  animation-duration: 480ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

:root[data-ncx-immersive-transition='closing']::view-transition-group(ncx-now-playing-artwork) {
  animation-duration: 360ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

:root[data-ncx-immersive-transition='opening']::view-transition-image-pair(ncx-now-playing-artwork) {
  animation: ncx-artwork-radius-enter 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

:root[data-ncx-immersive-transition='closing']::view-transition-image-pair(ncx-now-playing-artwork) {
  animation: ncx-artwork-radius-exit 360ms cubic-bezier(0.4, 0, 0.2, 1) both;
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

@keyframes ncx-artwork-radius-enter {
  from {
    border-radius: var(--ncx-radius-md, 14px);
  }

  to {
    border-radius: 16px;
  }
}

@keyframes ncx-artwork-radius-exit {
  from {
    border-radius: 16px;
  }

  to {
    border-radius: var(--ncx-radius-md, 14px);
  }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(ncx-now-playing-artwork),
  ::view-transition-image-pair(ncx-now-playing-artwork),
  ::view-transition-new(ncx-immersive-player),
  ::view-transition-old(ncx-immersive-player) {
    animation-duration: 1ms;
  }
}
</style>
