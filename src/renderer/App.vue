<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppShell from './design-system/patterns/AppShell.vue'
import './design-system/patterns/app-shell.css'
import { CommonToast } from './design-system/components'
import { activeToast, dismissToast } from './design-system/use-toast'
import ImmersiveLyricsPage from './features/music/ImmersiveLyricsPage.vue'
import AudioHost from './features/music/components/AudioHost.vue'
import PlayerBar from './features/music/components/PlayerBar.vue'
import { useImmersivePlayerPresentation } from './features/music/immersive-player-presentation'

// ========= 变量 =========

/** 当前路由对象，用于读取 PlayerBar 显示策略。 */
const route = useRoute()

/** 应用级沉浸播放展示控制器。 */
const immersivePlayer = useImmersivePlayerPresentation()

/** 沉浸播放展示层是否已打开。 */
const isImmersivePlayerOpen = immersivePlayer.isOpen

/** 当前页面是否展示通用 PlayerBar。 */
const showPlayerBar = computed<boolean>(() => route.meta.playerBar === 'show')
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

  <!-- 独立于 RouterView 的应用级沉浸播放展示层。 -->
  <ImmersiveLyricsPage
    v-if="isImmersivePlayerOpen"
    @close="immersivePlayer.close()"
  />

  <!-- 全局轻提示 Toast -->
  <CommonToast
    :visible="!!activeToast"
    :type="activeToast?.type ?? 'info'"
    :title="activeToast?.title ?? '提示'"
    :message="activeToast?.message ?? ''"
    :duration="0"
    @close="dismissToast"
  />
</template>
