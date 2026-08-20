<script setup lang="ts">
import { ChevronDown, FileText, ListMusic, Play, Search, Wrench } from '@lucide/vue'
import { computed, onUnmounted, ref, watch, type Component } from 'vue'

import type {
  AgentShellTerminalSnapshot,
  ToolExecutionCardSnapshot
} from '../../../../shared/schemas/agent'

// ========= 类型 =========

interface ToolExecutionCardProps {
  /** Tool 卡快照数据。 */
  readonly card: ToolExecutionCardSnapshot
  /** execute_shell 对应的实时终端输出。 */
  readonly shellTerminal: AgentShellTerminalSnapshot | undefined
  /** 当前实时时间戳（可选，外部传入用于统一刷新时钟）。 */
  readonly now?: number
}

// ========= 变量 =========

/** 组件 Props 定义。 */
const props = defineProps<ToolExecutionCardProps>()

/** 卡片明细折叠展开状态。 */
const expanded = ref<boolean>(false)

/** 本地 fallback 时间戳（用于没有外部传入 now 时独立计时）。 */
const localNow = ref<number>(Date.now())

/** 定时器句柄。 */
let timerId: ReturnType<typeof setInterval> | null = null

/** 当前有效时间戳。 */
const currentNow = computed<number>(() => props.now ?? localNow.value)

/** 根据工具名称解析对应的渲染图标。 */
const toolIcon = computed<Component>(() => resolveToolIcon(props.card.toolName))

/** 根据工具名称转换对应的展示文本前缀。 */
const toolLabel = computed<string>(() => toolNameText(props.card.toolName))

/** 格式化后的耗时文本。 */
const formattedDuration = computed<string>(() => {
  const { card } = props
  if (card.durationMs !== undefined) {
    return formatDuration(card.durationMs)
  }
  if (card.startedAt !== undefined) {
    const elapsed = Math.max(0, currentNow.value - card.startedAt)
    return formatDuration(elapsed)
  }
  return '即时'
})

// ========= 函数 =========

/** 解析工具图标。 */
function resolveToolIcon(toolName: string): Component {
  if (toolName === 'smart_search_and_play') return Search
  if (toolName === 'control_player') return Play
  if (toolName === 'queue_manager' || toolName === 'playlist_manager') return ListMusic
  if (toolName === 'find_music_api_capabilities' || toolName === 'call_music_api') return Wrench
  return FileText
}

/** 映射工具名称。 */
function toolNameText(toolName: string): string {
  const labels: Readonly<Record<string, string>> = {
    smart_search_and_play: '已搜播',
    control_player: '已操控播放器',
    queue_manager: '已更新队列',
    playlist_manager: '已修改歌单',
    library_manager: '已更新收藏',
    music_explorer: '已检索音乐',
    comments_and_social: '已获取社交评论',
    account_manager: '已检查账户',
    user_profile_memory: '已更新用户画像',
    request_user_selection: '已发起选择',
    find_music_api_capabilities: '已检索 API',
    call_music_api: '已调用 API'
  }
  return labels[toolName] ?? toolName
}

/** 格式化毫秒耗时。 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** 动态更新内部独立计时器状态。 */
function updateTimer(): void {
  const isRunning = props.card.status === 'running' || props.card.status === 'queued'
  if (isRunning && props.now === undefined) {
    if (!timerId) {
      localNow.value = Date.now()
      timerId = setInterval(() => {
        localNow.value = Date.now()
      }, 100)
    }
  } else if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

// ========= 生命周期 =========

watch(
  () => [props.card.status, props.now],
  () => {
    updateTimer()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
})
</script>

<template>
  <article
    class="agent-tool-card"
    :class="{ 'is-expanded': expanded }"
  >
    <div
      class="agent-tool-card-main"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="$tSource('展开或收起工具执行明细')"
      @click="expanded = !expanded"
      @keydown.enter.prevent="expanded = !expanded"
      @keydown.space.prevent="expanded = !expanded"
    >
      <div class="agent-tool-card-left">
        <span class="agent-tool-card-icon-box">
          <component
            :is="toolIcon"
            :size="16"
          />
        </span>
        <div class="agent-tool-card-info">
          <span class="agent-tool-card-title">{{ $tSource(toolLabel) }} {{ card.title }}</span>
          <span class="agent-tool-card-sub">{{ $tSource(card.status === 'succeeded' ? '完成' : card.status === 'running' ? '执行中…' : '失败') }} · {{ $tSource(formattedDuration) }}</span>
        </div>
      </div>
      <div class="agent-tool-card-actions">
        <button
          type="button"
          class="agent-action-btn agent-tool-toggle-btn"
          :aria-label="$tSource(expanded ? '收起明细' : '展开明细')"
          :aria-expanded="expanded"
          tabindex="-1"
          @click.stop="expanded = !expanded"
        >
          <ChevronDown
            :size="16"
            class="agent-tool-chevron"
            :class="{ 'is-expanded': expanded }"
          />
        </button>
      </div>
    </div>
    <div
      class="agent-tool-details-wrapper"
      :class="{ 'is-expanded': expanded }"
    >
      <div class="agent-tool-details-inner">
        <div class="agent-tool-card-details">
          <span>{{ $tSource("参数明细:") }}</span>
          <code>{{ $tSource(card.parameterSummary || '无参数') }}</code>
          <template v-if="card.toolName === 'execute_shell' && shellTerminal">
            <span>stdout:</span>
            <pre>{{ shellTerminal.stdout || '—' }}{{ $tSource(shellTerminal.stdoutTruncated ? '\n…已截断' : '') }}</pre>
            <span>stderr:</span>
            <pre>{{ shellTerminal.stderr || '—' }}{{ $tSource(shellTerminal.stderrTruncated ? '\n…已截断' : '') }}</pre>
          </template>
        </div>
      </div>
    </div>
  </article>
</template>
