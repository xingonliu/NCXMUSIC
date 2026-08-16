<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

import { showToast } from '../../../design-system/use-toast'
import { renderMarkdownToHtml } from '../agent-markdown-parser'

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

/** 根容器 DOM 引用。 */
const containerRef = ref<HTMLElement | null>(null)

/** 暂存各个复制按钮重置定时器 ID。 */
const copyResetTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()

/** 计算经过 Markdown 解析、语法高亮与安全净化的 HTML 字符串。 */
const renderedHtml = computed<string>(() => {
  return renderMarkdownToHtml(props.content, props.streaming)
})

// ========= 函数 =========

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

// ========= 生命周期 =========

onUnmounted(() => {
  for (const timer of copyResetTimers.values()) {
    clearTimeout(timer)
  }
  copyResetTimers.clear()
})
</script>

<template>
  <div
    ref="containerRef"
    class="agent-markdown"
    :class="{ 'is-streaming': streaming }"
    @click="handleClick"
    v-html="renderedHtml"
  />
</template>
