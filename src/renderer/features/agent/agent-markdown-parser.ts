import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { Marked } from 'marked'

import { translateSourceText } from '../../i18n'

// ========= 类型 =========

/** 提取出的思考链与正文内容结构。 */
export interface ExtractedMarkdownContent {
  /** 思考链 Markdown 文本。 */
  readonly thought: string
  /** 正式回复 Markdown 文本。 */
  readonly content: string
  /** 当前是否正处于思考生成中（包含未闭合的 <think> / <thought> 标签）。 */
  readonly isThinking: boolean
}

// ========= 变量 =========

/** 自定义 Marked 渲染实例。 */
const markedInstance = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    code(token) {
      const rawCode = token.text || ''
      const lang = (token.lang || '').trim().toLowerCase()
      const displayLang = lang || 'text'
      const highlighted = highlightSourceCode(rawCode, lang)
      const encodedCode = encodeURIComponent(rawCode)
      /** 代码块复制按钮的当前语言完整标签。 */
      const copyCodeLabel = translateSourceText('复制代码')
      /** 代码块复制按钮的当前语言短标签。 */
      const copyLabel = translateSourceText('复制')

      return `<div class="agent-code-block" data-lang="${displayLang}">
  <div class="agent-code-header">
    <span class="agent-code-lang">${displayLang}</span>
    <button class="agent-code-copy-btn" type="button" aria-label="${copyCodeLabel}" title="${copyCodeLabel}" data-code="${encodedCode}">
      <svg class="agent-code-copy-icon" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>
      <span class="agent-code-copy-text">${copyLabel}</span>
    </button>
  </div>
  <pre><code class="hljs language-${displayLang}">${highlighted}</code></pre>
</div>`
    },
    table(token) {
      let headerHtml = ''
      if (token.header && token.header.length) {
        headerHtml = `<thead><tr>${token.header
          .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
          .join('')}</tr></thead>`
      }
      let bodyHtml = ''
      if (token.rows && token.rows.length) {
        bodyHtml = `<tbody>${token.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`)
          .join('')}</tbody>`
      }
      return `<div class="agent-table-wrapper"><table class="agent-markdown-table">${headerHtml}${bodyHtml}</table></div>`
    },
    link(token) {
      const href = token.href || '#'
      const title = token.title ? ` title="${token.title}"` : ''
      const text = this.parser.parseInline(token.tokens)
      return `<a href="${href}"${title} target="_blank" rel="noopener noreferrer" class="agent-markdown-link">${text}</a>`
    }
  }
})

// ========= 函数 =========

/** 从原始 AI 消息文本中分离出思考链内容与正式回复正文。 */
export function extractThinkingAndContent(raw: string): ExtractedMarkdownContent {
  if (!raw) {
    return { thought: '', content: '', isThinking: false }
  }

  // 1. 匹配所有已闭合或流式未闭合的 <think> / <thought> 标签块
  const thinkTagRegex = /<(?:think|thought)\b[^>]*>([\s\S]*?)(?:<\/(?:think|thought)>|$)/gi
  let match: RegExpExecArray | null
  const thoughts: string[] = []

  // 2. 统计开闭标签数量以判断是否正在思考流中
  const openTagMatch = raw.match(/<(?:think|thought)\b[^>]*>/gi)
  const closeTagMatch = raw.match(/<\/(?:think|thought)>/gi)
  const openCount = openTagMatch ? openTagMatch.length : 0
  const closeCount = closeTagMatch ? closeTagMatch.length : 0
  const isThinking = openCount > closeCount

  while ((match = thinkTagRegex.exec(raw)) !== null) {
    const chunk = match[1] ?? ''
    if (chunk) {
      thoughts.push(chunk)
    }
  }

  // 3. 从正式回复正文中剔除所有思考标签块以及流式未闭合的思考前缀
  const cleanedContent = raw
    .replace(/<(?:think|thought)\b[^>]*>[\s\S]*?<\/(?:think|thought)>/gi, '')
    .replace(/<(?:think|thought)\b[^>]*>[\s\S]*$/gi, '')
    .trimStart()

  // 4. 将提取出的思考片段合并
  const thoughtText = thoughts.join('').trim()

  return {
    thought: thoughtText,
    content: cleanedContent,
    isThinking
  }
}

/** 语法高亮代码块文本。 */
function highlightSourceCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      // 降级使用 highlightAuto
    }
  }
  try {
    return hljs.highlightAuto(code).value
  } catch {
    return escapeHtml(code)
  }
}

/** 转义基础 HTML 实体。 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** 剥离危险标签与恶意事件属性。 */
function stripDangerousTagsAndAttributes(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
}

/** 净化 HTML，防御 XSS 攻击。 */
function sanitizeHtml(dirtyHtml: string): string {
  const stripped = stripDangerousTagsAndAttributes(dirtyHtml)
  if (typeof window !== 'undefined') {
    try {
      const purifier = (typeof DOMPurify?.sanitize === 'function')
        ? DOMPurify
        : (typeof DOMPurify === 'function' ? DOMPurify(window as unknown as Window & typeof globalThis) : undefined)

      if (purifier && typeof purifier.sanitize === 'function') {
        const wrappedInput = `<div class="agent-markdown-body">${stripped}</div>`
        const sanitized = purifier.sanitize(wrappedInput, {
          USE_PROFILES: { html: true, svg: true },
          ADD_ATTR: ['target', 'rel', 'data-lang', 'data-code', 'aria-label', 'aria-hidden'],
          FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
        })
        const unwrapped = sanitized
          .replace(/^<div class="agent-markdown-body">/i, '')
          .replace(/<\/div>$/i, '')
        return stripDangerousTagsAndAttributes(unwrapped)
      }
    } catch {
      // 降级使用基础防御过滤
    }
  }
  return stripped
}

/** 补全流式 Markdown 中尚未闭合的代码块与行内标记，防止流式输出过程中样式破裂或抖动。 */
export function completeStreamingMarkdown(raw: string): string {
  let text = raw
  if (!text) return ''

  // 1. 补全未闭合的代码块 (```)
  const codeBlockFenceMatches = text.match(/^ *```/gm)
  if (codeBlockFenceMatches && codeBlockFenceMatches.length % 2 === 1) {
    text = `${text}\n\`\`\``
  }

  // 2. 如果最新行不在多行代码块内部，检查行内反引号是否未闭合
  const lines = text.split('\n')
  const lastLine = lines[lines.length - 1] ?? ''
  if (!lastLine.trim().startsWith('```')) {
    const inlineBackticks = (lastLine.match(/(?<!\\)`/g) || []).length
    if (inlineBackticks % 2 === 1) {
      lines[lines.length - 1] = `${lastLine}\``
      text = lines.join('\n')
    }

    // 3. 检查未闭合的加粗与删除线
    const currentLastLine = lines[lines.length - 1] ?? ''
    const doubleAsterisks = (currentLastLine.match(/(?<!\\)\*\*/g) || []).length
    if (doubleAsterisks % 2 === 1) {
      lines[lines.length - 1] = `${currentLastLine}**`
      text = lines.join('\n')
    }

    const tildes = (currentLastLine.match(/(?<!\\)~~/g) || []).length
    if (tildes % 2 === 1) {
      lines[lines.length - 1] = `${currentLastLine}~~`
      text = lines.join('\n')
    }
  }

  return text
}

/** 向生成的 HTML 结尾或最后一个文本容器内部插入流式闪烁光标。 */
export function appendStreamingCaret(html: string): string {
  const caretTag = '<span class="agent-streaming-caret" aria-hidden="true"></span>'
  const trimmed = html.trim()
  if (!trimmed) {
    return caretTag
  }

  // 优先匹配最后一个闭合标签（如 </p>、</li>、</h1>..</h6>、</blockquote>、</td>、</code>），将光标置于文字后
  const lastClosingTagRegex = /(<\/(?:p|li|h[1-6]|blockquote|td|code|span)>)(\s*)$/i
  if (lastClosingTagRegex.test(trimmed)) {
    return trimmed.replace(lastClosingTagRegex, `${caretTag}$1$2`)
  }

  return `${trimmed}${caretTag}`
}

/** 将 Markdown 文本解析并渲染为安全 HTML 字符串，支持流式解析与光标追加。 */
export function renderMarkdownToHtml(markdown: string, isStreaming = false): string {
  const sourceText = isStreaming ? completeStreamingMarkdown(markdown) : markdown
  if (!sourceText.trim()) {
    return isStreaming ? appendStreamingCaret('') : ''
  }

  const rawHtml = markedInstance.parse(sourceText) as string
  const cleanHtml = sanitizeHtml(rawHtml)

  return isStreaming ? appendStreamingCaret(cleanHtml) : cleanHtml
}
