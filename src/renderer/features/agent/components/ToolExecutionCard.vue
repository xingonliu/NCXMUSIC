<script setup lang="ts">
import {
  ChevronDown,
  CircleUserRound,
  ListChecks,
  ListMusic,
  MessageCircle,
  Music2,
  Play,
  Search,
  Wrench
} from '@lucide/vue'
import { computed, ref, type Component } from 'vue'

import type { ToolExecutionCardSnapshot } from '../../../../shared/schemas/agent'

// ========= 类型 =========

/** ToolExecutionCard 输入。 */
interface ToolExecutionCardProps {
  /** Utility 提供的脱敏工具快照。 */
  readonly card: ToolExecutionCardSnapshot
}

// ========= 变量 =========

/** 卡片输入。 */
const props = defineProps<ToolExecutionCardProps>()

/** 技术详情是否展开。 */
const expanded = ref<boolean>(false)

/** Lucide 工具图标；显式映射保持 tree-shaking。 */
const toolIcon = computed<Component>(() => resolveToolIcon(props.card.toolName))

/** 卡片状态中文。 */
const statusLabel = computed<string>(() => statusText(props.card.status))

/** 工具耗时。 */
const durationLabel = computed<string>(() => {
  if (props.card.durationMs === undefined) return ''
  return props.card.durationMs < 1_000
    ? `${props.card.durationMs} ms`
    : `${(props.card.durationMs / 1_000).toFixed(1)} s`
})

// ========= 函数 =========

/** 按工具语义选择 lucide.dev 图标。 */
function resolveToolIcon(toolName: string): Component {
  if (toolName === 'smart_search_and_play') return Search
  if (toolName === 'control_player') return Play
  if (toolName === 'queue_manager' || toolName === 'playlist_manager') return ListMusic
  if (toolName === 'comments_and_social') return MessageCircle
  if (toolName === 'account_manager' || toolName === 'user_profile_memory') return CircleUserRound
  if (toolName === 'request_user_selection') return ListChecks
  if (toolName === 'find_music_api_capabilities' || toolName === 'call_music_api') return Wrench
  return Music2
}

/** 将稳定工具状态映射为短中文。 */
function statusText(status: ToolExecutionCardSnapshot['status']): string {
  /** 工具状态中文标签。 */
  const labels: Readonly<Record<ToolExecutionCardSnapshot['status'], string>> = {
    queued: '等待中',
    awaiting_approval: '等待批准',
    awaiting_selection: '等待选择',
    running: '执行中',
    succeeded: '已完成',
    failed: '失败',
    cancelled: '已取消',
    rejected: '已拒绝',
    expired: '已过期'
  }
  return labels[status]
}
</script>

<template>
  <article
    class="agent-tool-card"
    :data-status="card.status"
  >
    <button
      class="agent-tool-card-summary"
      type="button"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span
        class="agent-tool-card-icon"
        aria-hidden="true"
      >
        <component
          :is="toolIcon"
          :size="15"
          :stroke-width="1.8"
        />
      </span>
      <span class="agent-tool-card-copy">
        <strong>{{ card.toolName }} · {{ card.title }}</strong>
        <span>{{ statusLabel }}<template v-if="durationLabel"> · {{ durationLabel }}</template></span>
      </span>
      <span
        class="agent-tool-card-state-dot"
        aria-hidden="true"
      />
      <ChevronDown
        class="agent-tool-card-chevron"
        :class="{ 'is-expanded': expanded }"
        :size="14"
        :stroke-width="1.8"
        aria-hidden="true"
      />
    </button>

    <div
      v-if="expanded"
      class="agent-tool-card-details"
    >
      <div>
        <span>脱敏参数</span>
        <p>{{ card.parameterSummary || '无参数' }}</p>
      </div>
    </div>
  </article>
</template>
