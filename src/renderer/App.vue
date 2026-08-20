<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppShell from './design-system/patterns/AppShell.vue'
import './design-system/patterns/app-shell.css'
import {
  dismissToast,
  pauseAllToastTimers,
  resumeAllToastTimers,
  toastList,
  type ToastItem
} from './design-system/use-toast'
import ImmersiveLyricsPage from './features/music/ImmersiveLyricsPage.vue'
import AudioHost from './features/music/components/AudioHost.vue'
import PlayerBar from './features/music/components/PlayerBar.vue'
import { useImmersivePlayerPresentation } from './features/music/immersive-player-presentation'
import { usePlayerKeyboardShortcuts } from './features/music/use-player-keyboard-shortcuts'
import VoiceInputLayer from './features/voice/VoiceInputLayer.vue'

// ========= 变量 =========

/** 当前路由对象，用于读取 PlayerBar 显示策略。 */
const route = useRoute()

/** 应用级沉浸播放展示控制器。 */
const immersivePlayer = useImmersivePlayerPresentation()

/** 沉浸播放展示层是否仍处于挂载状态。 */
const isImmersivePlayerOpen = immersivePlayer.isOpen

/** 沉浸播放展示层是否处于可见状态。 */
const isImmersivePlayerVisible = immersivePlayer.isVisible

/** 当前页面是否展示通用 PlayerBar。 */
const showPlayerBar = computed<boolean>(() => route.meta.playerBar === 'show')

// ========= Toast 堆叠与展开交互 =========

/** 是否正在悬停 Toast 通知区域。 */
const isToastHovered = ref(false)

/** 逆序排列的 Toast 列表，让最新生成的 Toast 始终处于最前（index 0）。 */
const orderedToasts = computed<ToastItem[]>(() => [...toastList.value].reverse())

/** 动态记录各 Toast 卡片实测渲染高度。 */
const toastHeights = ref<Record<string, number>>({})

/** 注册/解注册 Toast 元素并测量高度。 */
function setToastEl(id: string, el: unknown): void {
  if (el && el instanceof HTMLElement) {
    toastHeights.value[id] = el.offsetHeight
  } else {
    delete toastHeights.value[id]
  }
}

/** 鼠标移入 Toast 容器：展开所有通知并暂停所有计时器。 */
function handleToastContainerEnter(): void {
  isToastHovered.value = true
  pauseAllToastTimers()
}

/** 鼠标移出 Toast 容器：恢复折叠堆叠并重置计时器。 */
function handleToastContainerLeave(): void {
  isToastHovered.value = false
  resumeAllToastTimers()
}

/** 计算各 Toast 卡片的位移、缩放与可见性。 */
function getToastStyle(toast: ToastItem, index: number) {
  if (!isToastHovered.value) {
    // 默认折叠堆叠状态：最多显示 3 层（index 0 为正面卡片，index 1/2 露出底部边缘）
    if (index === 0) {
      return {
        transform: 'translateX(-50%) translateY(0px) scale(1)',
        opacity: '1',
        zIndex: 30,
        pointerEvents: 'auto' as const
      }
    }
    if (index === 1) {
      return {
        transform: 'translateX(-50%) translateY(10px) scale(0.94)',
        opacity: '0.92',
        zIndex: 20,
        pointerEvents: 'none' as const
      }
    }
    if (index === 2) {
      return {
        transform: 'translateX(-50%) translateY(20px) scale(0.88)',
        opacity: '0.8',
        zIndex: 10,
        pointerEvents: 'none' as const
      }
    }
    // 超过 3 层在折叠时隐藏
    return {
      transform: 'translateX(-50%) translateY(24px) scale(0.85)',
      opacity: '0',
      zIndex: 0,
      pointerEvents: 'none' as const
    }
  }

  // 鼠标悬浮展开状态：向下自然展开所有通知
  let offsetY = 0
  for (let i = 0; i < index; i++) {
    const prev = orderedToasts.value[i]
    const h = prev ? (toastHeights.value[prev.id] ?? 54) : 54
    offsetY += h + 8 // 8px 间距
  }

  return {
    transform: `translateX(-50%) translateY(${offsetY}px) scale(1)`,
    opacity: '1',
    zIndex: 30 - index,
    pointerEvents: 'auto' as const
  }
}

/** 计算容器总高度，确保悬浮区域平滑包裹展开卡片。 */
const toastContainerHeight = computed<string>(() => {
  const len = orderedToasts.value.length
  if (len === 0) return '0px'
  if (!isToastHovered.value) {
    if (len === 1) return '56px'
    if (len === 2) return '66px'
    return '76px'
  }
  let total = 0
  for (let i = 0; i < len; i++) {
    const t = orderedToasts.value[i]
    const h = t ? (toastHeights.value[t.id] ?? 54) : 54
    total += h
    if (i > 0) total += 8
  }
  return `${total}px`
})

// ========= 快捷键注册 =========

/** 注册全局播放控制快捷键（支持空格、左右切歌、上下调音量）。 */
usePlayerKeyboardShortcuts({
  showPlayerBar,
  isImmersivePlayerOpen,
  route
})

// ========= 生命周期与监听 =========

/** 正式路由直接访问与浏览器历史变化同步到根层沉浸展示。 */
watch(
  () => route.meta.presentation === 'immersive',
  (open) => void immersivePlayer.syncFromRoute(open),
  { immediate: true }
)
</script>

<template>
  <AppShell
    :inert="isImmersivePlayerOpen"
    :aria-hidden="isImmersivePlayerOpen ? 'true' : undefined"
  />

  <!--
    AudioHost 常驻根层，位于 RouterView 之外（架构约束 A-012）。
    通用 PlayerBar 只按路由元数据显示，隐藏时不销毁音频宿主。
  -->
  <AudioHost />
  <PlayerBar v-if="showPlayerBar" />
  <VoiceInputLayer />

  <!-- 独立于 RouterView 的应用级沉浸播放展示层。 -->
  <Transition
    name="ncx-immersive-page"
    @after-leave="immersivePlayer.completeClose()"
  >
    <!-- 常驻容器负责离场，内部页面在动画结束后才卸载并释放 WebGL。 -->
    <div
      v-show="isImmersivePlayerVisible"
      class="ncx-immersive-page-transition"
    >
      <ImmersiveLyricsPage
        v-if="isImmersivePlayerOpen"
        @close="immersivePlayer.close()"
      />
    </div>
  </Transition>

  <!-- 全局轻提示 Toast 多通知堆叠容器（最多堆叠 3 条，Hover 展开全部） -->
  <Teleport to="body">
    <div
      v-if="orderedToasts.length > 0"
      :class="[
        'ncx-common-toast-container',
        { 'ncx-common-toast-container--expanded': isToastHovered }
      ]"
      :style="{ height: toastContainerHeight }"
      role="region"
      :aria-label="$tSource('系统通知')"
      @mouseenter="handleToastContainerEnter"
      @mouseleave="handleToastContainerLeave"
    >
      <TransitionGroup name="ncx-toast-stack">
        <div
          v-for="(toast, index) in orderedToasts"
          :key="toast.id"
          :ref="(el) => setToastEl(toast.id, el)"
          :class="[
            'ncx-common-toast',
            `ncx-common-toast-${toast.type}`,
            {
              'ncx-common-toast--stacked': !isToastHovered && index > 0,
              'ncx-common-toast--expanded': isToastHovered
            }
          ]"
          :style="getToastStyle(toast, index)"
          role="status"
        >
          <!-- 状态图标 -->
          <div :class="['ncx-common-toast-icon', `ncx-common-toast-icon-${toast.type}`]">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <template v-if="toast.type === 'success'">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </template>
              <template v-else-if="toast.type === 'warning'">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line
                  x1="12"
                  y1="9"
                  x2="12"
                  y2="13"
                />
                <line
                  x1="12"
                  y1="17"
                  x2="12.01"
                  y2="17"
                />
              </template>
              <template v-else-if="toast.type === 'danger'">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                />
                <line
                  x1="15"
                  y1="9"
                  x2="9"
                  y2="15"
                />
                <line
                  x1="9"
                  y1="9"
                  x2="15"
                  y2="15"
                />
              </template>
              <template v-else>
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                />
                <line
                  x1="12"
                  y1="16"
                  x2="12"
                  y2="12"
                />
                <line
                  x1="12"
                  y1="8"
                  x2="12.01"
                  y2="8"
                />
              </template>
            </svg>
          </div>

          <!-- 仅显示 desc 描述正文，不显示标题 -->
          <div class="ncx-common-toast-content">
            <span class="ncx-common-toast-message">{{ toast.message }}</span>
          </div>

          <!-- 关闭按钮 -->
          <button
            type="button"
            class="ncx-common-toast-close"
            :aria-label="$tSource('关闭通知')"
            @click.stop.prevent="dismissToast(toast.id)"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="pointer-events: none;"
            >
              <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
.ncx-immersive-page-transition {
  position: fixed;
  z-index: var(--ncx-layer-presentation);
  inset: 0;
}

.ncx-immersive-page-enter-active {
  transition: transform 440ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.ncx-immersive-page-leave-active {
  pointer-events: none;
  transition: transform 360ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.ncx-immersive-page-enter-from,
.ncx-immersive-page-leave-to {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .ncx-immersive-page-enter-active,
  .ncx-immersive-page-leave-active {
    transition-duration: 1ms;
  }
}
</style>
