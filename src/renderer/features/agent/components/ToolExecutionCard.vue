<script setup lang="ts">
import { ChevronDown, FileText, ListMusic, Play, Search, Wrench } from '@lucide/vue'
import { computed, ref, type Component } from 'vue'

import type { ToolExecutionCardSnapshot } from '../../../../shared/schemas/agent'

// ========= 类型 =========

interface ToolExecutionCardProps {
  readonly card: ToolExecutionCardSnapshot
}

// ========= 变量 =========

const props = defineProps<ToolExecutionCardProps>()
const expanded = ref<boolean>(false)

const toolIcon = computed<Component>(() => resolveToolIcon(props.card.toolName))
const toolLabel = computed<string>(() => toolNameText(props.card.toolName))

function resolveToolIcon(toolName: string): Component {
  if (toolName === 'smart_search_and_play') return Search
  if (toolName === 'control_player') return Play
  if (toolName === 'queue_manager' || toolName === 'playlist_manager') return ListMusic
  if (toolName === 'find_music_api_capabilities' || toolName === 'call_music_api') return Wrench
  return FileText
}

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
</script>

<template>
  <article class="agent-tool-card">
    <div class="agent-tool-card-main">
      <div class="agent-tool-card-left">
        <span class="agent-tool-card-icon-box">
          <component
            :is="toolIcon"
            :size="16"
          />
        </span>
        <div class="agent-tool-card-info">
          <span class="agent-tool-card-title">{{ toolLabel }} {{ card.title }}</span>
          <span class="agent-tool-card-sub">{{ card.status === 'succeeded' ? '完成' : card.status === 'running' ? '执行中…' : '失败' }} · {{ card.durationMs ? `${card.durationMs}ms` : '即时' }}</span>
        </div>
      </div>
      <div class="agent-tool-card-actions">
        <button
          type="button"
          class="agent-action-btn"
          @click="expanded = !expanded"
        >
          <ChevronDown
            :size="16"
            :class="{ 'is-expanded': expanded }"
          />
        </button>
      </div>
    </div>
    <div
      v-if="expanded"
      class="agent-tool-card-details"
    >
      <span>参数明细:</span>
      <code>{{ card.parameterSummary || '无参数' }}</code>
    </div>
  </article>
</template>
