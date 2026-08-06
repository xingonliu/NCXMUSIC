<script setup lang="ts">
import AppShell from './design-system/patterns/AppShell.vue'
import './design-system/patterns/app-shell.css'
import AudioHost from './features/music/components/AudioHost.vue'
import PlayerBar from './features/music/components/PlayerBar.vue'
</script>

<template>
  <AppShell />

  <!--
    AudioHost 与 PlayerBar 常驻根层，位于 RouterView 之外（架构约束 A-012）。
    路由切换只替换 workspace 内容，不会卸载音频宿主，播放因此不中断。
  -->
  <AudioHost />
  <PlayerBar />
</template>
