<script setup lang="ts">
import { computed } from 'vue'

import { zhCN } from '../../locales/zh-CN'

const runtimeLabel = computed(
  () => `${window.ncx.platform} · Electron ${window.ncx.versions.electron}`
)
</script>

<template>
  <section
    class="foundation-page"
    aria-labelledby="foundation-title"
  >
    <div class="foundation-copy">
      <p class="eyebrow">
        {{ zhCN.foundation.eyebrow }}
      </p>
      <h1 id="foundation-title">
        {{ zhCN.foundation.title }}
      </h1>
      <p class="foundation-description">
        {{ zhCN.foundation.description }}
      </p>
      <p class="runtime-badge">
        {{ runtimeLabel }}
      </p>
    </div>

    <div
      class="foundation-grid"
      :aria-label="zhCN.foundation.layersLabel"
    >
      <article
        v-for="layer in zhCN.foundation.layers"
        :key="layer.name"
        class="layer-card"
      >
        <p class="layer-state">
          {{ zhCN.foundation.ready }}
        </p>
        <h2>
          {{ layer.name }}
        </h2>
        <p>
          {{ layer.description }}
        </p>
      </article>
    </div>
  </section>
</template>
