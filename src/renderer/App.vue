<script setup lang="ts">
import { RouterView } from 'vue-router'

import AudioHost from './features/music/components/AudioHost.vue'
import PlayerBar from './features/music/components/PlayerBar.vue'
import { zhCN } from './locales/zh-CN'
</script>

<template>
  <div class="app-shell">
    <header class="window-chrome">
      <div
        class="brand-mark"
        aria-hidden="true"
      >
        N
      </div>
      <div>
        <p class="brand-name">
          {{ zhCN.app.name }}
        </p>
        <p class="brand-caption">
          {{ zhCN.app.caption }}
        </p>
      </div>
    </header>

    <main class="workspace">
      <RouterView />
    </main>

    <!--
      AudioHost 与 PlayerBar 常驻根层，位于 RouterView 之外（架构约束 A-012）。
      路由切换只替换 workspace 内容，不会卸载音频宿主，播放因此不中断。
    -->
    <AudioHost />
    <PlayerBar />
  </div>
</template>
