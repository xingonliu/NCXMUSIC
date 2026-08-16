import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { Marked } from 'marked'

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

      return `<div class="agent-code-block" data-lang="${displayLang}">
  <div class="agent-code-header">
    <span class="agent-code-lang">${displayLang}</span>
    <button class="agent-code-copy-btn" type="button" aria-label="复制代码" title="复制代码" data-code="${encodedCode}">
      <svg class="agent-code-copy-icon" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>
      <span class="agent-code-copy-text">复制</span>
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
