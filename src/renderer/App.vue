<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppShell from './design-system/patterns/AppShell.vue'
import './design-system/patterns/app-shell.css'
import {
  dismissToast,
  pauseToastTimer,
  resumeToastTimer,
  toastList
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

/** 沉浸播放展示层是否已打开。 */
const isImmersivePlayerOpen = immersivePlayer.isOpen

/** 当前页面是否展示通用 PlayerBar。 */
const showPlayerBar = computed<boolean>(() => route.meta.playerBar === 'show')

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
  <Transition name="ncx-immersive-page">
    <ImmersiveLyricsPage
      v-if="isImmersivePlayerOpen"
      @close="immersivePlayer.close()"
    />
  </Transition>

  <!-- 全局轻提示 Toast 多通知堆叠容器（按触发顺序向上自然排列并支持单条关闭） -->
  <Teleport to="body">
    <div
      v-if="toastList.length > 0"
      class="ncx-common-toast-container"
      role="region"
      aria-label="系统通知"
    >
      <TransitionGroup name="ncx-toast-stack">
        <div
          v-for="toast in toastList"
          :key="toast.id"
          :class="['ncx-common-toast', `ncx-common-toast-${toast.type}`]"
          role="status"
          @mouseenter="pauseToastTimer(toast.id)"
          @mouseleave="resumeToastTimer(toast.id)"
        >
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
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </template>
              <template v-else-if="toast.type === 'danger'">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </template>
              <template v-else>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </template>
            </svg>
          </div>
          <div class="ncx-common-toast-content">
            <strong class="ncx-common-toast-title">{{ toast.title }}</strong>
            <span v-if="toast.message" class="ncx-common-toast-message">{{ toast.message }}</span>
          </div>
          <button
            type="button"
            class="ncx-common-toast-close"
            aria-label="关闭通知"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
.ncx-immersive-page-enter-active {
  transition:
    opacity 440ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 440ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ncx-immersive-page-leave-active {
  transition:
    opacity 360ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 360ms cubic-bezier(0.4, 0, 0.2, 1);
}

.ncx-immersive-page-enter-from,
.ncx-immersive-page-leave-to {
  opacity: 0.8;
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .ncx-immersive-page-enter-active,
  .ncx-immersive-page-leave-active {
    transition-duration: 1ms;
  }
}
</style>
