<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { RuntimeStatus } from '../shared/contracts/control-plane'
import type { PingResult, UtilitySnapshot } from '../shared/contracts/runtime'
import { runRuntimeSmoke } from './smoke'

const status = ref<RuntimeStatus>({ state: 'starting', generation: 0, restartAttempt: 0 })
const ping = ref<PingResult>()
const snapshot = ref<UtilitySnapshot>()
const message = ref('正在连接本地运行时…')

window.ncx.runtime.onStatus((nextStatus) => {
  status.value = nextStatus
  message.value = nextStatus.reason ?? `运行时状态：${nextStatus.state}`
})

async function sendPing(): Promise<void> {
  const result = await window.ncx.runtime.ping()
  if (result.ok) {
    ping.value = result.data
    message.value = `Ping 成功，Utility generation ${result.data.utilityGeneration}`
  } else {
    message.value = result.error.message
  }
}

async function loadSnapshot(): Promise<void> {
  const result = await window.ncx.runtime.snapshot()
  if (result.ok) {
    snapshot.value = result.data
    message.value = `快照已恢复，已处理 ${result.data.handledRequests} 个请求`
  } else {
    message.value = result.error.message
  }
}

async function retry(): Promise<void> {
  status.value = await window.ncx.runtime.retryUtility()
}

onMounted(async () => {
  if (new URLSearchParams(window.location.search).has('smoke')) {
    await runRuntimeSmoke()
  }
})
</script>

<template>
  <main>
    <p class="eyebrow">
      NCXMUSIC · PHASE 0
    </p>
    <h1>进程骨架诊断</h1>
    <p>{{ message }}</p>
    <dl>
      <div>
        <dt>Utility 状态</dt>
        <dd>{{ status.state }}</dd>
      </div>
      <div>
        <dt>Generation</dt>
        <dd>{{ status.generation }}</dd>
      </div>
      <div>
        <dt>最近 Ping</dt>
        <dd>{{ ping?.respondedAt ?? '—' }}</dd>
      </div>
      <div>
        <dt>快照请求数</dt>
        <dd>{{ snapshot?.handledRequests ?? '—' }}</dd>
      </div>
    </dl>
    <div class="actions">
      <button
        type="button"
        @click="sendPing"
      >
        Ping
      </button>
      <button
        type="button"
        @click="loadSnapshot"
      >
        恢复快照
      </button>
      <button
        type="button"
        @click="retry"
      >
        重试 Utility
      </button>
    </div>
  </main>
</template>
