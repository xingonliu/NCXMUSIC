<script setup lang="ts">
import { ChevronDown, Sparkles } from '@lucide/vue'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import { showToast } from '../../../design-system/use-toast'
import {
  extractThinkingAndContent,
  renderMarkdownToHtml,
  type ExtractedMarkdownContent
} from '../agent-markdown-parser'

// ========= 类型 =========

interface AgentMarkdownProps {
  /** 待渲染的 Markdown 源码。 */
  readonly content: string
  /** 当前消息是否处于流式生成中。 */
  readonly streaming?: boolean
}

// ========= 变量 =========

/** 组件属性。 */
const props = withDefaults(defineProps<AgentMarkdownProps>(), {
  streaming: false
})

/** 思考容器展开状态（默认仅展示有限固定高度窗口）。 */
const isExpanded = ref<boolean>(false)

/** 思考流内部滚动容器 DOM 引用。 */
const thoughtScrollRef = ref<HTMLElement | null>(null)

/** 正文根容器 DOM 引用。 */
const containerRef = ref<HTMLElement | null>(null)

/** 暂存各个复制按钮重置定时器 ID。 */
const copyResetTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()

/** 解析分离后的思考链内容与正文内容。 */
const parsedData = computed<ExtractedMarkdownContent>(() => {
  return extractThinkingAndContent(props.content)
})

/** 计算渲染后的思考链 HTML 字符串。 */
const renderedThoughtHtml = computed<string>(() => {
  return renderMarkdownToHtml(parsedData.value.thought, Boolean(props.streaming && parsedData.value.isThinking))
})

/** 计算渲染后的正式回复 HTML 字符串。 */
const renderedContentHtml = computed<string>(() => {
  return renderMarkdownToHtml(parsedData.value.content, Boolean(props.streaming && !parsedData.value.isThinking))
})

// ========= 函数 =========

/** 切换思考容器展开/折叠状态。 */
function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
}

/** 统一复制文本到剪贴板。 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (window.ncx?.clipboard?.writeText) {
      await window.ncx.clipboard.writeText(text)
      return true
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 降级使用传统方法
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)
      return successful
    } catch {
      return false
    }
  }
  return false
}

/** 委托处理 Markdown 容器内的点击交互（代码块复制与外链跳转）。 */
async function handleClick(event: MouseEvent): Promise<void> {
  const target = event.target as HTMLElement | null
  if (!target) return

  // 1. 处理代码块复制按钮点击
  const copyBtn = target.closest<HTMLElement>('.agent-code-copy-btn')
  if (copyBtn) {
    event.preventDefault()
    event.stopPropagation()

    let codeText = ''
    const rawDataCode = copyBtn.getAttribute('data-code')
    if (rawDataCode) {
      try {
        codeText = decodeURIComponent(rawDataCode)
      } catch {
        codeText = rawDataCode
      }
    }

    if (!codeText) {
      const codeBlock = copyBtn.closest('.agent-code-block')
      const codeEl = codeBlock?.querySelector('pre > code')
      codeText = codeEl?.textContent || ''
    }

    if (!codeText) return

    const copied = await copyToClipboard(codeText)
    if (copied) {
      showToast('代码已复制到剪贴板', 'success')

      copyBtn.classList.add('is-copied')
      const textEl = copyBtn.querySelector('.agent-code-copy-text')
      const originalText = textEl?.textContent || '复制'
      if (textEl) textEl.textContent = '已复制'

      const existingTimer = copyResetTimers.get(copyBtn)
      if (existingTimer) clearTimeout(existingTimer)

      const timer = setTimeout(() => {
        copyBtn.classList.remove('is-copied')
        if (textEl) textEl.textContent = originalText
        copyResetTimers.delete(copyBtn)
      }, 2000)

      copyResetTimers.set(copyBtn, timer)
    }
    return
  }

  // 2. 处理普通外链点击
  const link = target.closest<HTMLAnchorElement>('a.agent-markdown-link, .agent-markdown a')
  if (link && link.href) {
    const href = link.getAttribute('href') || ''
    if (/^https?:\/\//i.test(href)) {
      event.preventDefault()
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  }
}

/** 处理思考容器点击：在折叠有限窗口状态下点击任意位置展开；同时支持容器内复制和外链。 */
async function handleThoughtBoxClick(event: MouseEvent): Promise<void> {
  if (!isExpanded.value) {
    // 默认有限窗口下点击直接展开
    isExpanded.value = true
    return
  }
  // 已展开状态下支持代码复制和外链交互
  await handleClick(event)
}

// ========= 侦听与自动滚底 =========

watch(
  () => parsedData.value.thought,
  async () => {
    // 在未展开的有限高度窗口中，思考内容持续输出时自动向下滚动保持可见
    if (!isExpanded.value && thoughtScrollRef.value) {
      await nextTick()
      if (thoughtScrollRef.value) {
        thoughtScrollRef.value.scrollTop = thoughtScrollRef.value.scrollHeight
      }
    }
  }
)

// ========= 生命周期 =========

onUnmounted(() => {
  for (const timer of copyResetTimers.values()) {
    clearTimeout(timer)
  }
  copyResetTimers.clear()
})
</script>

<template>
  <div class="agent-markdown-root">
    <!-- DeepSeek 风格深度思考容器 -->
    <section
      v-if="parsedData.thought.length > 0 || (streaming && parsedData.isThinking)"
      class="agent-thought-block"
      :class="{
        'is-expanded': isExpanded,
        'is-streaming': Boolean(streaming && parsedData.isThinking)
      }"
      aria-label="思考过程"
    >
      <!-- 思考头部状态栏（点击展开/折叠） -->
      <div
        class="agent-thought-header"
        role="button"
        tabindex="0"
        :aria-expanded="isExpanded"
        @click="toggleExpanded"
        @keydown.enter.prevent="toggleExpanded"
        @keydown.space.prevent="toggleExpanded"
      >
        <div class="agent-thought-title">
          <span class="agent-thought-icon">
            <Sparkles :size="13" />
          </span>
          <span class="agent-thought-label">
            {{ (streaming && parsedData.isThinking) ? '正在深度思考...' : '已深度思考' }}
          </span>
        </div>
        <button
          type="button"
          class="agent-thought-toggle-btn"
          :aria-label="isExpanded ? '收起思考内容' : '展开思考内容'"
          tabindex="-1"
        >
          <span class="agent-thought-toggle-text">{{ isExpanded ? '收起' : '展开' }}</span>
          <ChevronDown
            :size="13"
            class="agent-thought-chevron"
          />
        </button>
      </div>

      <!-- 思考内容容器（默认固定有限高度窗口并自动滚底，展开时自适应完整高度） -->
      <div
        ref="thoughtScrollRef"
        class="agent-thought-content-wrapper"
        :class="{ 'is-collapsed': !isExpanded }"
        @click="handleThoughtBoxClick"
      >
        <div
          class="agent-markdown agent-thought-body"
          :class="{ 'is-streaming': streaming && parsedData.isThinking }"
          v-html="renderedThoughtHtml"
        />
      </div>
    </section>

    <!-- 正式 Markdown 正文 -->
    <div
      v-if="renderedContentHtml.length > 0 || (streaming && !parsedData.isThinking)"
      ref="containerRef"
      class="agent-markdown agent-body-markdown"
      :class="{ 'is-streaming': streaming && !parsedData.isThinking }"
      @click="handleClick"
      v-html="renderedContentHtml"
    />
  </div>
</template>

