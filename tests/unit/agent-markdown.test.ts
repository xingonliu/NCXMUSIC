// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import AgentMarkdown from '../../src/renderer/features/agent/components/AgentMarkdown.vue'
import {
  appendStreamingCaret,
  completeStreamingMarkdown,
  extractThinkingAndContent,
  renderMarkdownToHtml
} from '../../src/renderer/features/agent/agent-markdown-parser'

// ========= 测试套件 =========

describe('Agent Markdown 解析与流式渲染测试', () => {
  describe('思考链与正文分离提取 (extractThinkingAndContent)', () => {
    it('正确分离 <think> 标签内的思考内容与正文', () => {
      /** 带有完整 <think> 标签的 Markdown。 */
      const raw = '<think>分析用户偏好：喜欢流行音乐。\n选择推荐歌曲。</think>为您推荐以下歌曲：\n- 晴天'
      const extracted = extractThinkingAndContent(raw)

      expect(extracted.thought).toBe('分析用户偏好：喜欢流行音乐。\n选择推荐歌曲。')
      expect(extracted.content).toBe('为您推荐以下歌曲：\n- 晴天')
      expect(extracted.isThinking).toBe(false)
    })

    it('正确分离 <thought> 标签内的思考内容与正文', () => {
      /** 带有 <thought> 标签的 Markdown。 */
      const raw = '<thought>检索本地曲库中</thought>已找到 3 首本地歌曲'
      const extracted = extractThinkingAndContent(raw)

      expect(extracted.thought).toBe('检索本地曲库中')
      expect(extracted.content).toBe('已找到 3 首本地歌曲')
      expect(extracted.isThinking).toBe(false)
    })

    it('正确捕获流式输出中尚未闭合的思考标签并标记 isThinking 为 true', () => {
      /** 流式未闭合思考文本。 */
      const raw = '<think>正在规划工具调用：查询天气与歌单'
      const extracted = extractThinkingAndContent(raw)

      expect(extracted.thought).toBe('正在规划工具调用：查询天气与歌单')
      expect(extracted.content).toBe('')
      expect(extracted.isThinking).toBe(true)
    })

    it('无思考标签时返回完整原内容且 thought 为空', () => {
      /** 普通 Markdown 文本。 */
      const raw = '### 今日精选\n1. 稻香\n2. 夜曲'
      const extracted = extractThinkingAndContent(raw)

      expect(extracted.thought).toBe('')
      expect(extracted.content).toBe(raw)
      expect(extracted.isThinking).toBe(false)
    })
  })

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

      expect(wrapper.classes()).toContain('agent-markdown-root')
      expect(wrapper.find('h3').text()).toBe('今日推荐')
      expect(wrapper.findAll('li')).toHaveLength(2)
      expect(wrapper.find('.agent-thought-block').exists()).toBe(false)
      expect(wrapper.find('.agent-streaming-caret').exists()).toBe(false)
    })

    it('处于流式状态时添加 is-streaming 类名与闪烁光标', async () => {
      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '正在生成歌单中',
          streaming: true
        }
      })

      expect(wrapper.find('.agent-body-markdown').classes()).toContain('is-streaming')
      expect(wrapper.find('.agent-streaming-caret').exists()).toBe(true)
    })

    it('正确渲染 DeepSeek 风格思考容器并支持折叠/展开交互', async () => {
      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '<think>这是第一步推理\n这是第二步推理</think>正式回答：周杰伦是华语流行歌手。',
          streaming: false
        }
      })

      // 1. 验证思考模块存在且默认处于折叠有限窗口
      const thoughtBlock = wrapper.find('.agent-thought-block')
      expect(thoughtBlock.exists()).toBe(true)
      expect(thoughtBlock.classes()).not.toContain('is-expanded')
      expect(wrapper.find('.agent-thought-content-wrapper').classes()).toContain('is-collapsed')
      expect(wrapper.find('.agent-thought-label').text()).toBe('已深度思考')
      expect(wrapper.find('.agent-thought-toggle-text').text()).toBe('展开')
      expect(thoughtBlock.text()).toContain('这是第一步推理')

      // 2. 验证正式正文在思考模块下方独立渲染
      const bodyMarkdown = wrapper.find('.agent-body-markdown')
      expect(bodyMarkdown.exists()).toBe(true)
      expect(bodyMarkdown.text()).toContain('正式回答：周杰伦是华语流行歌手。')

      // 3. 点击思考头部展开
      await wrapper.find('.agent-thought-header').trigger('click')
      expect(wrapper.find('.agent-thought-block').classes()).toContain('is-expanded')
      expect(wrapper.find('.agent-thought-content-wrapper').classes()).not.toContain('is-collapsed')
      expect(wrapper.find('.agent-thought-toggle-text').text()).toBe('收起')

      // 4. 再次点击思考头部收起
      await wrapper.find('.agent-thought-header').trigger('click')
      expect(wrapper.find('.agent-thought-block').classes()).not.toContain('is-expanded')
      expect(wrapper.find('.agent-thought-content-wrapper').classes()).toContain('is-collapsed')
    })

    it('流式思考中正确展示正在深度思考状态文案与脉冲类名', async () => {
      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '<think>正在分析歌词情感模型...',
          streaming: true
        }
      })

      const thoughtBlock = wrapper.find('.agent-thought-block')
      expect(thoughtBlock.exists()).toBe(true)
      expect(thoughtBlock.classes()).toContain('is-streaming')
      expect(wrapper.find('.agent-thought-label').text()).toBe('正在深度思考...')
      expect(wrapper.find('.agent-thought-body .agent-streaming-caret').exists()).toBe(true)
    })

    it('在折叠有限窗口状态下点击思考内容区域直接展开', async () => {
      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '<think>思考内容</think>正文内容',
          streaming: false
        }
      })

      const contentWrapper = wrapper.find('.agent-thought-content-wrapper')
      expect(wrapper.find('.agent-thought-block').classes()).not.toContain('is-expanded')

      await contentWrapper.trigger('click')
      expect(wrapper.find('.agent-thought-block').classes()).toContain('is-expanded')
    })

    it('思考内容持续输出时自动向下滚动有限高度窗口', async () => {
      const wrapper = mount(AgentMarkdown, {
        props: {
          content: '<think>第1行思考',
          streaming: true
        }
      })

      const scrollEl = wrapper.find('.agent-thought-content-wrapper').element as HTMLElement
      Object.defineProperty(scrollEl, 'scrollHeight', { value: 300, configurable: true, writable: true })
      scrollEl.scrollTop = 0

      // 更新 props 模拟持续流式输入思考
      await wrapper.setProps({
        content: '<think>第1行思考\n第2行思考\n第3行思考\n第4行思考',
        streaming: true
      })
      await nextTick()

      expect(scrollEl.scrollTop).toBe(300)
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
