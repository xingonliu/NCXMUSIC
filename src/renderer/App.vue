<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppShell from './design-system/patterns/AppShell.vue'
import './design-system/patterns/app-shell.css'
import { CommonToast } from './design-system/components'
import { activeToast, dismissToast } from './design-system/use-toast'
import AudioHost from './features/music/components/AudioHost.vue'
import PlayerBar from './features/music/components/PlayerBar.vue'

// ========= 变量 =========

/** 当前路由对象，用于读取 PlayerBar 显示策略。 */
const route = useRoute()

/** 当前页面是否展示通用 PlayerBar。 */
const showPlayerBar = computed<boolean>(() => route.meta.playerBar === 'show')
</script>

<template>
  <AppShell />

  <!--
    AudioHost 常驻根层，位于 RouterView 之外（架构约束 A-012）。
    通用 PlayerBar 只按路由元数据显示，隐藏时不销毁音频宿主。
  -->
  <AudioHost />
  <PlayerBar v-if="showPlayerBar" />

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
