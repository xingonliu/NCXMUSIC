<script setup lang="ts">
import { RouterView } from 'vue-router'

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
  </div>
</template>
