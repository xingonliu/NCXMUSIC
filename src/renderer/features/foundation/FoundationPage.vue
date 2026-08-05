<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { RuntimeStatus } from '../../../shared/contracts/control-plane'
import type { PingResult, UtilitySnapshot } from '../../../shared/schemas/runtime'
import { zhCN } from '../../locales/zh-CN'
import { runRuntimeSmoke } from '../../smoke'

const runtimeLabel = computed(
  () => `${window.ncx.platform} · Electron ${window.ncx.versions.electron}`
)
const status = ref<RuntimeStatus>({ state: 'starting', generation: 0, restartAttempt: 0 })
const ping = ref<PingResult>()
const snapshot = ref<UtilitySnapshot>()
const unsubscribeStatus = window.ncx.runtime.onStatus((nextStatus) => {
  status.value = nextStatus
})

onMounted(async () => {
  if (new URLSearchParams(window.location.search).has('smoke')) {
    await runRuntimeSmoke()
    return
  }

  if (!(await window.ncx.runtime.waitUntilReady())) return
  const pingResult = await window.ncx.runtime.ping()
  if (pingResult.ok) ping.value = pingResult.data
  const snapshotResult = await window.ncx.runtime.snapshot()
  if (snapshotResult.ok) snapshot.value = snapshotResult.data
})

onBeforeUnmount(unsubscribeStatus)
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
      <article class="layer-card runtime-card">
        <p class="layer-state">
          {{ status.state.toUpperCase() }}
        </p>
        <h2>
          {{ zhCN.foundation.runtime.name }}
        </h2>
        <dl class="runtime-details">
          <div>
            <dt>{{ zhCN.foundation.runtime.generation }}</dt>
            <dd>{{ status.generation }}</dd>
          </div>
          <div>
            <dt>{{ zhCN.foundation.runtime.ping }}</dt>
            <dd>{{ ping ? `${ping.respondedAt - ping.receivedAt} ms` : '—' }}</dd>
          </div>
          <div>
            <dt>{{ zhCN.foundation.runtime.requests }}</dt>
            <dd>{{ snapshot?.handledRequests ?? '—' }}</dd>
          </div>
        </dl>
      </article>
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
