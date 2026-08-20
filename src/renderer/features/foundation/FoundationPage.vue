<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { RuntimeStatus } from '../../../shared/contracts/control-plane'
import type { PingResult, UtilitySnapshot } from '../../../shared/schemas/runtime'
import { useI18n } from '../../i18n'
import { runRuntimeSmoke } from '../../smoke'

// ========= 变量 =========

/** 基础探针页使用的国际化状态。 */
const i18n = useI18n()

/** 当前语言对应的基础探针页文案。 */
const text = computed(() => i18n.messages.value.foundation)

/** 当前 Runtime 平台与 Electron 版本标签。 */
const runtimeLabel = computed(
  () => `${window.ncx.platform} · Electron ${window.ncx.versions.electron}`
)

/** Runtime 当前公开状态。 */
const status = ref<RuntimeStatus>({ state: 'starting', generation: 0, restartAttempt: 0 })

/** Runtime ping 响应。 */
const ping = ref<PingResult>()

/** Utility Process 当前快照。 */
const snapshot = ref<UtilitySnapshot>()

/** Runtime 状态订阅清理函数。 */
const unsubscribeStatus = window.ncx.runtime.onStatus((nextStatus) => {
  status.value = nextStatus
})

// ========= 生命周期 =========

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
        {{ text.eyebrow }}
      </p>
      <h1 id="foundation-title">
        {{ text.title }}
      </h1>
      <p class="foundation-description">
        {{ text.description }}
      </p>
      <p class="runtime-badge">
        {{ runtimeLabel }}
      </p>
    </div>

    <div
      class="foundation-grid"
      :aria-label="text.layersLabel"
    >
      <article class="layer-card runtime-card">
        <p class="layer-state">
          {{ status.state.toUpperCase() }}
        </p>
        <h2>
          {{ text.runtime.name }}
        </h2>
        <dl class="runtime-details">
          <div>
            <dt>{{ text.runtime.generation }}</dt>
            <dd>{{ status.generation }}</dd>
          </div>
          <div>
            <dt>{{ text.runtime.ping }}</dt>
            <dd>{{ ping ? `${ping.respondedAt - ping.receivedAt} ms` : '—' }}</dd>
          </div>
          <div>
            <dt>{{ text.runtime.requests }}</dt>
            <dd>{{ snapshot?.handledRequests ?? '—' }}</dd>
          </div>
        </dl>
      </article>
      <article
        v-for="layer in text.layers"
        :key="layer.name"
        class="layer-card"
      >
        <p class="layer-state">
          {{ text.ready }}
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
