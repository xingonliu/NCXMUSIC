// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AgentMarkdown from '../../src/renderer/features/agent/components/AgentMarkdown.vue'
import {
  appendStreamingCaret,
  completeStreamingMarkdown,
  renderMarkdownToHtml
} from '../../src/renderer/features/agent/agent-markdown-parser'

// ========= 测试套件 =========

describe('Agent Markdown 解析与流式渲染测试', () => {
  describe('流式 Markdown 未闭合标记自动补全 (completeStreamingMarkdown)', () => {
    it('正确补全流式输出中尚未闭合的代码块', () => {
      /** 流式输入中途的代码块文本。 */
      const incompleteCode = '```typescript\nconst message = "hello";\nconsole.log(message);'
      const completed = completeStreamingMarkdown(incompleteCode)

      expect(completed).toContain('\n```')
      expect(completed.endsWith('\n```')).toBe(true)
    })

    it('已闭合的代码块不重复追加闭合标记', () => {
      /** 完整闭合的代码块。 */
      const completeCode = '```typescript\nconst a = 1;\n```'
      const result = completeStreamingMarkdown(completeCode)

      expect(result).toBe(completeCode)
    })

    it('正确补全最新行中未闭合的行内反引号', () => {
      /** 流式输入中途未闭合反引号。 */
      const text = '请查看函数 `playSong'
      const completed = completeStreamingMarkdown(text)

      expect(completed).toBe('请查看函数 `playSong`')
    })

    it('正确补全最新行中未闭合的加粗与删除线标记', () => {
      /** 未闭合加粗文本。 */
      const boldText = '这是一段**重要提示'
      expect(completeStreamingMarkdown(boldText)).toBe('这是一段**重要提示**')

      /** 未闭合删除线文本。 */
      const strikethroughText = '这是一段~~已废弃'
      expect(completeStreamingMarkdown(strikethroughText)).toBe('这是一段~~已废弃~~')
    })
  })

  describe('流式光标追加 (appendStreamingCaret)', () => {
    it('在普通段落结尾闭合标签前优雅插入闪烁光标', () => {
      /** 标准段落 HTML。 */
      const html = '<p>小云已为你找到以下歌曲：</p>'
      const withCaret = appendStreamingCaret(html)

      expect(withCaret).toContain('class="agent-streaming-caret"')
      expect(withCaret).toBe('<p>小云已为你找到以下歌曲：<span class="agent-streaming-caret" aria-hidden="true"></span></p>')
    })

    it('在空文本时返回独立光标元素', () => {
      const caretOnly = appendStreamingCaret('')
      expect(caretOnly).toBe('<span class="agent-streaming-caret" aria-hidden="true"></span>')
    })
  })

  describe('Markdown 解析与语法高亮 (renderMarkdownToHtml)', () => {
    it('渲染各级标题、段落、粗体与斜体', () => {
      /** 测试 Markdown 输入。 */
      const markdown = '# 歌单推荐\n\n这是**周杰伦**的*热门单曲*。'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('<h1>歌单推荐</h1>')
      expect(html).toContain('<strong>周杰伦</strong>')
      expect(html).toContain('<em>热门单曲</em>')
    })

    it('渲染代码块并包含语言标签、复制按钮与高亮类名', () => {
      /** 代码块输入。 */
      const markdown = '```javascript\nconst song = "七里香";\n```'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('class="agent-code-block"')
      expect(html).toContain('class="agent-code-header"')
      expect(html).toContain('class="agent-code-lang"')
      expect(html).toContain('javascript')
      expect(html).toContain('class="agent-code-copy-btn"')
      expect(html).toContain('hljs language-javascript')
      expect(html).toContain('hljs-keyword')
    })

    it('渲染表格结构并包裹响应式容器', () => {
      /** 表格输入。 */
      const markdown = '| 歌曲 | 歌手 |\n| --- | --- |\n| 晴天 | 周杰伦 |'
      const html = renderMarkdownToHtml(markdown)

      expect(html).toContain('class="agent-table-wrapper"')
      expect(html).toContain('class="agent-markdown-table"')
      expect(html).toContain('<th>歌曲</th>')
      expect(html).toContain('<td>晴天</td>')
    })

    it('安全净化危险标签与属性防御 XSS', () => {
      /** 包含恶意脚本与 onerror 的输入。 */
      const malicious = '点击查看 [链接](javascript:alert(1)) <script>alert("hack")</script><img src="x" onerror="alert(2)" />'
      const html = renderMarkdownToHtml(malicious)

      expect(html).not.toContain('<script>')
      expect(html).not.toContain('onerror')
      expect(html).not.toContain('javascript:alert')
    })
  })

  describe('AgentMarkdown Vue 组件渲染与交互', () => {
    it('组件正确挂载并渲染富文本 HTML', async () => {
      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '### 今日推荐\n- 歌曲 A\n- 歌曲 B',
          streaming: false
        }
      })

      expect(wrapper.classes()).toContain('agent-markdown')
      expect(wrapper.find('h3').text()).toBe('今日推荐')
      expect(wrapper.findAll('li')).toHaveLength(2)
      expect(wrapper.find('.agent-streaming-caret').exists()).toBe(false)
    })

    it('处于流式状态时添加 is-streaming 类名与闪烁光标', async () => {
      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '正在生成歌单中',
          streaming: true
        }
      })

      expect(wrapper.classes()).toContain('is-streaming')
      expect(wrapper.find('.agent-streaming-caret').exists()).toBe(true)
    })

    it('点击代码块复制按钮能提取代码文本并更新复制反馈状态', async () => {
      let copiedText = ''
      Object.defineProperty(window, 'ncx', {
        value: {
          clipboard: {
            writeText: async (text: string) => {
              copiedText = text
            }
          }
        },
        configurable: true,
        writable: true
      })

      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '```javascript\nconst a = 123;\n```',
          streaming: false
        }
      })

      const copyBtn = wrapper.find('.agent-code-copy-btn')
      expect(copyBtn.exists()).toBe(true)

      await copyBtn.trigger('click')

      expect(copiedText).toContain('const a = 123;')
      expect(copyBtn.classes()).toContain('is-copied')
      expect(copyBtn.text()).toContain('已复制')
    })

    it('点击外链能阻止默认应用路由并触发 window.open 安全打开', async () => {
      let openedUrl = ''
      window.open = ((url: string) => {
        openedUrl = url
        return null
      }) as typeof window.open

      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '请访问 [网易云音乐](https://music.163.com) 查看',
          streaming: false
        }
      })

      const link = wrapper.find('a.agent-markdown-link')
      expect(link.exists()).toBe(true)

      await link.trigger('click')
      expect(openedUrl).toBe('https://music.163.com')
    })
  })
})
