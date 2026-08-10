<script setup lang="ts">
import { Bot, LogIn, Settings2, Sparkles } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { CommonButton } from '../../design-system/components'
import { useAccountSessionStore } from '../account/account-session-store'
import AgentComposer from './components/AgentComposer.vue'
import ApprovalCard from './components/ApprovalCard.vue'
import SelectionCard from './components/SelectionCard.vue'
import ToolExecutionCard from './components/ToolExecutionCard.vue'
import { useAgentStore, type AgentMessageContext } from './agent-store'
import './agent-page.css'

// ========= 变量 =========

/** 当前路由，用于接收音乐页面交给小云的标准上下文。 */
const route = useRoute()

/** 路由控制器。 */
const router = useRouter()

/** 应用作用域小云 Store。 */
const agent = useAgentStore()

/** 当前网易云账户公开状态。 */
const account = useAccountSessionStore()

/** 会话滚动容器。 */
const conversation = ref<HTMLElement | null>(null)

/** 当前页面实体上下文。 */
const messageContext = computed<AgentMessageContext | undefined>(() => {
  /** 当前路由传入的实体类型。 */
  const entityKind = readEntityKind(route.query['entityKind'])
  /** 当前路由传入的实体 ID。 */
  const entityId = readQueryText(route.query['entityId'])
  /** 当前路由传入的实体名称。 */
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
const contextLabel = computed<string>(() => messageContext.value
  ? `已带入${messageContext.value.entityKind === 'song' ? '歌曲' : '音乐'}：${messageContext.value.entityName ?? messageContext.value.entityId}`
  : '')

/** 是否为游客会话。 */
const isGuest = computed<boolean>(() => account.snapshot.value?.activeAccount.kind !== 'netease')

/** 是否有可展示会话内容。 */
const hasConversation = computed<boolean>(() =>
  agent.snapshot.value.messages.length > 0
  || agent.snapshot.value.tools.length > 0
  || agent.snapshot.value.approvals.length > 0
  || agent.snapshot.value.selections.length > 0
)

/** 仍有效或刚结束的审批卡。 */
const visibleApprovals = computed(() => agent.snapshot.value.approvals)

/** 仍有效或刚结束的选择卡。 */
const visibleSelections = computed(() => agent.snapshot.value.selections)

// ========= 函数 =========

/** 发送消息并携带当前标准实体上下文。 */
async function sendMessage(content: string): Promise<void> {
  await agent.sendMessage(content, messageContext.value)
}

/** 打开模型设置标签。 */
function openModelSettings(): void {
  void router.push({ name: 'settings', query: { tab: 'models' } })
}

/** 打开官方网易云登录。 */
async function login(): Promise<void> {
  await window.ncx.account.login()
  await account.refresh()
}

/** 滚动到会话最新内容。 */
async function scrollToLatest(): Promise<void> {
  await nextTick()
  /** 当前对话滚动容器。 */
  const element = conversation.value
  if (!element) return
  element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
}

/** 从 Vue Router query 安全读取单个文本。 */
function readQueryText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** 从 query 白名单读取实体类型。 */
function readEntityKind(value: unknown): AgentMessageContext['entityKind'] | undefined {
  return value === 'song' || value === 'artist' || value === 'album' || value === 'playlist'
    ? value
    : undefined
}

// ========= 生命周期 =========

onMounted(async () => {
  await Promise.all([agent.initialize(), account.initialize()])
  await scrollToLatest()
})

/** 流式消息、工具与交互卡改变后跟随到底部。 */
watch(
  () => [
    agent.snapshot.value.updatedAt,
    agent.snapshot.value.messages.at(-1)?.content,
    agent.snapshot.value.tools.length,
    agent.snapshot.value.approvals.length,
    agent.snapshot.value.selections.length
  ],
  () => { void scrollToLatest() }
)
</script>

<template>
  <section
    class="agent-page"
    aria-labelledby="agent-title"
  >
    <header class="agent-page-header">
      <div class="agent-page-identity">
        <span class="agent-avatar"><Bot
          :size="21"
          :stroke-width="1.9"
        /></span>
        <div>
          <h1 id="agent-title">
            小云
          </h1>
          <p>{{ agent.snapshot.value.turnStatus === 'streaming_model' ? '正在回复' : '你的音乐助手' }}</p>
        </div>
      </div>
      <div class="agent-page-header-actions">
        <span
          v-if="contextLabel"
          class="agent-context-chip"
        >{{ contextLabel }}</span>
        <CommonButton
          v-if="isGuest"
          variant="ghost"
          size="compact"
          @click="login"
        >
          <LogIn :size="14" />登录网易云
        </CommonButton>
        <CommonButton
          variant="ghost"
          size="compact"
          @click="openModelSettings"
        >
          <Settings2 :size="14" />模型设置
        </CommonButton>
      </div>
    </header>

    <div
      ref="conversation"
      class="agent-conversation"
      aria-live="polite"
    >
      <section
        v-if="!agent.snapshot.value.configured"
        class="agent-empty-state"
      >
        <span><Sparkles
          :size="25"
          :stroke-width="1.7"
        /></span>
        <h2>让小云开始工作</h2>
        <p>配置你自己的模型服务后，小云可以搜索并播放音乐、管理歌单，并在需要时向你确认。</p>
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
        <span><Sparkles
          :size="20"
          :stroke-width="1.8"
        /></span>
        <h2>今天想听点什么？</h2>
        <p>可以试试“播放一首陈奕迅的歌”，或者“把当前歌曲加入我的通勤歌单”。</p>
        <div>
          <button
            type="button"
            @click="sendMessage('随便放点适合现在听的歌')"
          >
            随便放点适合现在听的歌
          </button>
          <button
            type="button"
            @click="sendMessage('帮我找一首适合专注时听的歌')"
          >
            找一首适合专注的歌
          </button>
        </div>
      </section>

      <template v-else>
        <article
          v-for="message in agent.snapshot.value.messages"
          :key="message.messageId"
          class="agent-message"
          :class="`is-${message.role}`"
        >
          <div
            v-if="message.role === 'assistant'"
            class="agent-message-avatar"
          >
            <Bot :size="15" />
          </div>
          <div class="agent-message-bubble">
            <p>
              {{ message.content }}<span
                v-if="message.streaming"
                class="agent-streaming-caret"
              />
            </p>
            <small v-if="message.interrupted">已中止</small>
          </div>
        </article>

        <section
          v-if="agent.snapshot.value.tools.length"
          class="agent-tool-stack"
          aria-label="工具执行记录"
        >
          <ToolExecutionCard
            v-for="tool in agent.snapshot.value.tools"
            :key="tool.toolCallId"
            :card="tool"
          />
        </section>

        <ApprovalCard
          v-for="approval in visibleApprovals"
          :key="approval.approvalId"
          :approval="approval"
          @approve="agent.respondApproval($event, 'approve')"
          @reject="agent.respondApproval($event, 'reject')"
        />

        <SelectionCard
          v-for="selection in visibleSelections"
          :key="selection.selectionId"
          :selection="selection"
          @submit="agent.respondSelection"
          @cancel="agent.cancelSelection"
        />
      </template>
    </div>

    <AgentComposer
      :snapshot="agent.snapshot.value"
      @send="sendMessage"
      @stop="agent.stop"
      @music-safety="agent.setMusicSafetyLevel"
      @command-safety="agent.setCommandSafetyLevel"
    />
  </section>
</template>
