<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { resolveRouteTitle } from '../../app/route-title'

// ========= 变量 =========

/** 当前路由对象，用于展示空内容区的页面名称。 */
const route = useRoute()

/** 当前占位页面标题。 */
const title = computed(() => resolveRouteTitle(route.meta.title))
</script>

<template>
  <section
    class="ncx-route-placeholder"
    :aria-label="title"
  >
    <h1 class="ncx-route-title">
      {{ title }}
    </h1>
  </section>
</template>
