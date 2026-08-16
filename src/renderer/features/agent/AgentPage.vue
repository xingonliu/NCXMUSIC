<script setup lang="ts">
import {
  AlertCircle,
  Bug,
  ChevronRight,
  Copy,
  Hammer,
  RefreshCw,
  Search,
  Terminal,
  ThumbsDown,
  ThumbsUp
} from '@lucide/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type DeepReadonly } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { CommonButton, CommonIconButton } from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import type { AgentSnapshot } from '../../../shared/schemas/agent'
import { useAccountSessionStore } from '../account/account-session-store'
import AgentComposer from './components/AgentComposer.vue'
import ApprovalCard from './components/ApprovalCard.vue'
import SelectionCard from './components/SelectionCard.vue'
import ToolExecutionCard from './components/ToolExecutionCard.vue'
import ProfileAnalysisBanner from './components/ProfileAnalysisBanner.vue'
import { useAgentStore, type AgentMessageContext } from './agent-store'
import './agent-page.css'

// ========= 变量 =========

/** 当前路由对象。 */
const route = useRoute()

/** 路由导航实例。 */
const router = useRouter()

/** 小云 Agent 运行时 Store。 */
const agent = useAgentStore()

/** 当前账户 Session Store。 */
const account = useAccountSessionStore()

/** 对话流 DOM 容器引用。 */
const conversation = ref<HTMLElement | null>(null)

/** 当前复制成功提示 index。 */
const copiedMessageId = ref<string | null>(null)

/** 当前页面实体上下文。 */
const messageContext = computed<AgentMessageContext | undefined>(() => {
  const entityKind = readEntityKind(route.query['entityKind'])
  const entityId = readQueryText(route.query['entityId'])
  const entityName = readQueryText(route.query['entityName'])
  if (!entityKind || !entityId) return undefined
  return {
    routeName: String(route.name ?? 'agent'),
    entityKind,
    entityId,
    ...(entityName ? { entityName } : {})
  }
})

/** 当前上下文短文案。 */
const contextLabel = computed<string>(() => {
  const ctx = messageContext.value
  return ctx
    ? `${ctx.entityKind === 'song' ? '歌曲' : '上下文'}: ${ctx.entityName ?? ctx.entityId}`
    : ''
})

/** 当前会话是否包含消息或工具记录。 */
const hasConversation = computed<boolean>(() =>
  agent.snapshot.value.messages.length > 0
  || agent.snapshot.value.tools.length > 0
  || agent.snapshot.value.approvals.length > 0
  || agent.snapshot.value.selections.length > 0
)

/** 实时当前时间戳（用于执行中工具的耗时实时计算）。 */
const now = ref<number>(Date.now())

/** 全局实时计时器句柄。 */
let timerId: ReturnType<typeof setInterval> | null = null

/** 检查是否存在处于执行中或排队中的工具。 */
const hasRunningTools = computed<boolean>(() => {
  return agent.snapshot.value.tools.some(
    (tool) => tool.status === 'running' || tool.status === 'queued'
  )
})

// ========= 函数 =========

/** 发送消息给 Agent。 */
async function sendMessage(content: string): Promise<void> {
  await agent.sendMessage(content, messageContext.value)
}

/** 打开模型设置页面。 */
function openModelSettings(): void {
  void router.push({ name: 'settings', query: { tab: 'models' } })
}

async function scrollToLatest(): Promise<void> {
  await nextTick()
  const element = conversation.value
  if (!element) return
  const scrollableParent = element.closest('.ncx-content-area') || element.parentElement
  if (scrollableParent) {
    scrollableParent.scrollTo({ top: scrollableParent.scrollHeight, behavior: 'smooth' })
  }
}

function readQueryText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readEntityKind(value: unknown): AgentMessageContext['entityKind'] | undefined {
  return value === 'song' || value === 'artist' || value === 'album' || value === 'playlist'
    ? value
    : undefined
}

function shouldRenderMessage(message: DeepReadonly<AgentSnapshot['messages'][number]>): boolean {
  return message.content.trim().length > 0 || message.streaming || message.interrupted
}

function toolsForMessage(message: DeepReadonly<AgentSnapshot['messages'][number]>) {
  /** 当前消息关联的 Tool Call ID 集合。 */
  const toolCallIds = new Set(message.toolCallIds)
  return agent.snapshot.value.tools.filter((tool) => toolCallIds.has(tool.toolCallId))
}

/** 返回 Tool Call 对应的实时 Shell 终端。 */
function shellTerminalForTool(toolCallId: string) {
  return agent.snapshot.value.shellTerminals.find((terminal) => terminal.commandId === toolCallId)
}

function approvalsForMessage(message: DeepReadonly<AgentSnapshot['messages'][number]>) {
  /** 当前消息关联的 Tool Call ID 集合。 */
  const toolCallIds = new Set(message.toolCallIds)
  return agent.snapshot.value.approvals.filter((approval) => toolCallIds.has(approval.toolCallId))
}

function selectionsForMessage(message: DeepReadonly<AgentSnapshot['messages'][number]>) {
  /** 当前消息关联的 Tool Call ID 集合。 */
  const toolCallIds = new Set(message.toolCallIds)
  return agent.snapshot.value.selections.filter((selection) => toolCallIds.has(selection.toolCallId))
}

/** 动态更新全局耗时计时器状态。 */
function updateTimerState(): void {
  if (hasRunningTools.value) {
    if (!timerId) {
      now.value = Date.now()
      timerId = setInterval(() => {
        now.value = Date.now()
      }, 100)
    }
  } else if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

/** 格式化已处理耗时与工具数。 */
function processingSummary(message: DeepReadonly<AgentSnapshot['messages'][number]>): string {
  const tools = toolsForMessage(message)
  if (tools.length === 0) return '已响应'
  const totalMs = tools.reduce((acc, t) => {
    if (t.durationMs !== undefined) {
      return acc + t.durationMs
    }
    if (t.startedAt !== undefined) {
      return acc + Math.max(0, now.value - t.startedAt)
    }
    return acc
  }, 0)
  const durationStr = totalMs < 1000 ? `${totalMs}ms` : `${(totalMs / 1000).toFixed(1)}s`
  return `已处理 ${tools.length} 项指令 · ${durationStr}`
}

/** 格式化消息创建时间。 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 复制 AI 消息文本到剪贴板。 */
async function copyMessageText(messageId: string, content: string): Promise<void> {
  try {
    if (window.ncx?.clipboard?.writeText) {
      await window.ncx.clipboard.writeText(content)
    } else {
      await navigator.clipboard.writeText(content)
    }
  } catch {
    await navigator.clipboard.writeText(content)
  }
  copiedMessageId.value = messageId
  showToast('已复制到剪贴板', 'success')
  setTimeout(() => {
    if (copiedMessageId.value === messageId) copiedMessageId.value = null
  }, 2000)
}

/** 点击有帮助点赞按钮触发 Toast。 */
function handleLike(): void {
  showToast('我就知道我很棒！', 'success')
}

/** 点击没帮助踩按钮触发 Toast。 */
function handleDislike(): void {
  showToast('差评也没用，0人收到你的反馈', 'info')
}

// ========= 生命周期 =========

onMounted(async () => {
  await Promise.all([agent.initialize(), account.initialize()])
  await scrollToLatest()
})

watch(
  hasRunningTools,
  () => {
    updateTimerState()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
})

watch(
  () => agent.snapshot.value.turnStatus,
  (newStatus, oldStatus) => {
    if (newStatus === 'failed' && oldStatus !== 'failed') {
      const lastSystemMsg = agent.snapshot.value.messages
        .slice()
        .reverse()
        .find((msg) => msg.role === 'system')
      showToast(lastSystemMsg?.content || '小云响应失败，请检查模型配置与网络。', 'warning')
    }
  }
)

watch(
  () => [
    agent.snapshot.value.updatedAt,
    agent.snapshot.value.messages.at(-1)?.content,
    agent.snapshot.value.tools.length,
    agent.snapshot.value.shellTerminals.at(-1)?.updatedAt,
    agent.snapshot.value.approvals.length,
    agent.snapshot.value.selections.length
  ],
  () => { void scrollToLatest() }
)
</script>

<template>
  <section
    class="agent-page"
    aria-label="NCX Agent 小云"
  >
    <div
      ref="conversation"
      class="agent-conversation"
      aria-live="polite"
    >
      <section
        v-if="!agent.snapshot.value.configured"
        class="agent-empty-state"
      >
        <span class="agent-welcome-icon"><Terminal :size="28" /></span>
        <h2>请先配置模型以启用 Agent</h2>
        <p>前往模型设置添加并激活语言模型配置。</p>
        <CommonButton
          variant="primary"
          @click="openModelSettings"
        >
          前往模型设置
        </CommonButton>
      </section>

      <section
        v-else-if="!hasConversation"
        class="agent-welcome-state"
      >
        <span class="agent-welcome-icon"><Terminal :size="28" /></span>
        <h2>我们应该在 <span class="underline-target">NCX Music</span> 中做些什么？</h2>
        <div class="agent-welcome-grid">
          <button
            type="button"
            class="agent-welcome-card"
            @click="sendMessage('播放一首适合现在听的歌')"
          >
            <span class="agent-welcome-card-icon is-blue"><Search :size="20" /></span>
            <p>探索并智能搜播</p>
          </button>
          <button
            type="button"
            class="agent-welcome-card"
            @click="sendMessage('把当前歌曲加入我的歌单')"
          >
            <span class="agent-welcome-card-icon is-purple"><Hammer :size="20" /></span>
            <p>构建与管理歌单</p>
          </button>
          <button
            type="button"
            class="agent-welcome-card"
            @click="sendMessage('帮我找适合专注沉浸的歌')"
          >
            <span class="agent-welcome-card-icon is-green"><RefreshCw :size="20" /></span>
            <p>推荐专注与工作流</p>
          </button>
          <button
            type="button"
            class="agent-welcome-card"
            @click="sendMessage('分析我的听歌风格与画像')"
          >
            <span class="agent-welcome-card-icon is-orange"><Bug :size="20" /></span>
            <p>分析偏好与解决疑问</p>
          </button>
        </div>
      </section>

      <template v-else>
        <template
          v-for="message in agent.snapshot.value.messages"
          :key="message.messageId"
        >
          <!-- User Turn: Right-aligned pill bubble -->
          <div
            v-if="message.role === 'user'"
            class="agent-turn-block is-user"
          >
            <div class="agent-user-bubble">
              {{ message.content }}
            </div>
          </div>

          <!-- System Message: Error / Warning Callout -->
          <div
            v-else-if="message.role === 'system'"
            class="agent-turn-block is-system"
          >
            <div class="agent-system-card">
              <AlertCircle
                :size="16"
                class="agent-system-icon"
              />
              <div class="agent-system-content">
                <p>{{ message.content }}</p>
                <button
                  v-if="!agent.snapshot.value.configured || message.content.includes('模型')"
                  type="button"
                  class="agent-system-action-btn"
                  @click="openModelSettings"
                >
                  前往模型设置
                </button>
              </div>
            </div>
          </div>

          <!-- Assistant Turn: Full-width matching input box, NO BUBBLE! -->
          <div
            v-else-if="message.role === 'assistant' && shouldRenderMessage(message)"
            class="agent-turn-block is-assistant"
          >
            <!-- Processing Status Line -->
            <div
              v-if="toolsForMessage(message).length > 0"
              class="agent-processing-line"
            >
              <span>{{ processingSummary(message) }}</span>
              <ChevronRight :size="13" />
            </div>

            <!-- Tool Cards Stack -->
            <section
              v-if="toolsForMessage(message).length"
              class="agent-tool-stack"
              aria-label="工具执行记录"
            >
              <ToolExecutionCard
                v-for="tool in toolsForMessage(message)"
                :key="tool.toolCallId"
                :card="tool"
                :shell-terminal="shellTerminalForTool(tool.toolCallId)"
                :now="now"
              />
            </section>

            <ApprovalCard
              v-for="approval in approvalsForMessage(message)"
              :key="approval.approvalId"
              :approval="approval"
              @approve="agent.respondApproval($event, 'approve')"
              @reject="agent.respondApproval($event, 'reject')"
            />

            <SelectionCard
              v-for="selection in selectionsForMessage(message)"
              :key="selection.selectionId"
              :selection="selection"
              @submit="agent.respondSelection"
              @cancel="agent.cancelSelection"
            />

            <!-- Raw Response Text (No bubble container!) -->
            <div class="agent-assistant-content">
              <span>{{ message.content }}</span><span
                v-if="message.streaming"
                class="agent-streaming-caret"
              />
            </div>

            <!-- Footer Toolbar (Copy, Like, Dislike, Timestamp) -->
            <div
              v-if="!message.streaming"
              class="agent-assistant-footer"
            >
              <CommonIconButton
                label="复制内容"
                size="compact"
                variant="ghost"
                @click="copyMessageText(message.messageId, message.content)"
              >
                <Copy :size="14" />
              </CommonIconButton>
              <CommonIconButton
                label="有帮助"
                size="compact"
                variant="ghost"
                @click="handleLike"
              >
                <ThumbsUp :size="14" />
              </CommonIconButton>
              <CommonIconButton
                label="没帮助"
                size="compact"
                variant="ghost"
                @click="handleDislike"
              >
                <ThumbsDown :size="14" />
              </CommonIconButton>
              <span>{{ formatTime(message.createdAt) }}</span>
            </div>
          </div>
        </template>
      </template>
    </div>

    <ProfileAnalysisBanner
      :snapshot="agent.snapshot.value"
      @start="agent.startProfileAnalysis"
      @dismiss="agent.dismissProfilePrompt"
    />

    <AgentComposer
      :snapshot="agent.snapshot.value"
      :context-label="contextLabel"
      @send="sendMessage"
      @stop="agent.stop"
      @music-safety="agent.setMusicSafetyLevel"
      @command-safety="agent.setCommandSafetyLevel"
    />
  </section>
</template>
