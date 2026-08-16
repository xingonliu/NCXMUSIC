import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// ========= 工具函数 =========

/** 读取项目源码文本。 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

// ========= 测试 =========

describe('phase 5 agent UI contract', () => {
  it('小云与首次引导使用正式路由组件', () => {
    /** 路由源代码。 */
    const router = source('src/renderer/app/router.ts')
    expect(router).toContain('component: AgentPage')
    expect(router).toContain('component: OnboardingPage')
    expect(router).toContain("shell: 'standalone'")
  })

  it('ToolExecutionCard 只展示工具名、调用方式与状态，不展示工具结果', () => {
    /** ToolExecutionCard 源代码。 */
    const card = source('src/renderer/features/agent/components/ToolExecutionCard.vue')
    expect(card).toContain('card.toolName')
    expect(card).toContain('card.parameterSummary')
    expect(card).toContain('card.status')
    expect(card).not.toContain("card.resultSummary")
  })

  it('纯 Tool Call 消息不渲染空气泡且工具卡挂回对应消息', () => {
    /** Agent 页面源代码。 */
    const page = source('src/renderer/features/agent/AgentPage.vue')
    expect(page).toContain('shouldRenderMessage(message)')
    expect(page).toContain('message.content.trim().length > 0')
    expect(page).toContain('toolsForMessage(message)')
  })

  it('审批卡固定批准拒绝且无关闭按钮，选择卡保持独立语义', () => {
    /** ApprovalCard 源代码。 */
    const approval = source('src/renderer/features/agent/components/ApprovalCard.vue')
    /** SelectionCard 源代码。 */
    const selection = source('src/renderer/features/agent/components/SelectionCard.vue')
    expect(approval).toContain('拒绝')
    expect(approval).toContain('批准')
    expect(approval).not.toContain('关闭')
    expect(selection).toContain('selection.mode === \'multiple\'')
  })

  it('输入框组件根据输入文本自适应高度且限制最大高度 350px', () => {
    /** AgentComposer 源代码。 */
    const composer = source('src/renderer/features/agent/components/AgentComposer.vue')
    /** Agent 页面 CSS 源代码。 */
    const css = source('src/renderer/features/agent/agent-page.css')

    expect(composer).toContain('adjustTextareaHeight()')
    expect(composer).toContain('Math.min(el.scrollHeight, 350)')
    expect(composer).toContain('textareaRef')
    expect(css).toContain('max-height: min(350px, calc(100vh - 140px));')
  })

  it('进入小云页面后输入框等待 0.5 秒并用 0.7 秒从底部抬出', () => {
    /** Agent 页面 CSS 源代码。 */
    const css = source('src/renderer/features/agent/agent-page.css')

    expect(css).toContain('animation: agent-composer-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) 500ms both;')
    expect(css).toContain('transform: translateY(calc(100% + 24px));')
    expect(css).toContain('@keyframes agent-composer-rise')
    expect(css).toContain('animation-name: agent-composer-fade;')
  })

  it('SelectionCard 带有小封面与右侧歌曲名歌手布局规范', () => {
    /** SelectionCard 源代码。 */
    const selection = source('src/renderer/features/agent/components/SelectionCard.vue')
    /** Agent 页面 CSS 源代码。 */
    const css = source('src/renderer/features/agent/agent-page.css')

    expect(selection).toContain('agent-selection-opt-cover')
    expect(css).toContain('.agent-selection-opt-cover')
    expect(css).toContain('width: 40px;')
    expect(css).toContain('height: 40px;')
    expect(css).toContain('object-fit: cover;')
  })

  it('Agent 消息底部工具栏移除重新生成按钮且点赞点踩复制包含相应交互与提示', () => {
    /** Agent 页面源代码。 */
    const page = source('src/renderer/features/agent/AgentPage.vue')

    expect(page).not.toContain('label="重新生成"')
    expect(page).toContain('handleLike')
    expect(page).toContain('handleDislike')
    expect(page).toContain('我就知道我很棒！')
    expect(page).toContain('差评也没用，0人收到你的反馈')
    expect(page).toContain('copyMessageText')
    expect(page).toContain('已复制到剪贴板')
  })

  it('执行中工具包含动态耗时计算与实时计时器', () => {
    /** Agent 页面源代码。 */
    const page = source('src/renderer/features/agent/AgentPage.vue')
    /** ToolExecutionCard 源代码。 */
    const card = source('src/renderer/features/agent/components/ToolExecutionCard.vue')

    expect(page).toContain('hasRunningTools')
    expect(page).toContain('updateTimerState()')
    expect(page).toContain('startedAt')
    expect(card).toContain('formattedDuration')
    expect(card).toContain('startedAt')
  })

  it('进入小云页面默认瞬间置底且在未触底时显示输入框上方居中的向下箭头按钮', () => {
    /** Agent 页面源代码。 */
    const page = source('src/renderer/features/agent/AgentPage.vue')
    /** AgentComposer 源代码。 */
    const composer = source('src/renderer/features/agent/components/AgentComposer.vue')
    /** CSS 源代码。 */
    const css = source('src/renderer/features/agent/agent-page.css')

    expect(page).toContain("scrollToBottom('auto')")
    expect(page).toContain('isAtBottom')
    expect(page).toContain(':show-scroll-to-bottom="!isAtBottom"')
    expect(page).toContain("@scroll-to-bottom=\"scrollToBottom('smooth')\"")
    expect(composer).toContain('showScrollToBottom')
    expect(composer).toContain('agent-scroll-to-bottom-btn')
    expect(composer).toContain("emit('scroll-to-bottom')")
    expect(css).toContain('.agent-scroll-to-bottom-btn')
    expect(css).toContain('bottom: calc(100% + 12px);')
    expect(css).toContain('transform: translateX(-50%);')
  })

  it('ToolExecutionCard 展开与收起具有顺滑旋转动画与平滑容器高度过渡', () => {
    /** ToolExecutionCard 源代码。 */
    const card = source('src/renderer/features/agent/components/ToolExecutionCard.vue')
    /** CSS 源代码。 */
    const css = source('src/renderer/features/agent/agent-page.css')

    expect(card).toContain('agent-tool-chevron')
    expect(card).toContain(":class=\"{ 'is-expanded': expanded }\"")
    expect(card).toContain('agent-tool-details-wrapper')
    expect(css).toContain('.agent-tool-chevron.is-expanded')
    expect(css).toContain('transform: rotate(180deg);')
    expect(css).toContain('.agent-tool-details-wrapper.is-expanded')
    expect(css).toContain('grid-template-rows: 1fr;')
  })

  it('输入框配置 100% 实体不透明背景且小云页面底部包含平滑渐变遮罩', () => {
    /** Agent 页面源代码。 */
    const page = source('src/renderer/features/agent/AgentPage.vue')
    /** CSS 源代码。 */
    const css = source('src/renderer/features/agent/agent-page.css')

    expect(page).toContain('agent-bottom-mask')
    expect(css).toContain('background: var(--ncx-modal-bg, #fff);')
    expect(css).not.toContain('backdrop-filter: blur(5px);')
    expect(css).toContain('.agent-bottom-mask')
    expect(css).toContain('pointer-events: none;')
    expect(css).toContain('linear-gradient(')
  })

  it('回到底部悬浮按钮去掉边框并配置立体阴影', () => {
    /** CSS 源代码。 */
    const css = source('src/renderer/features/agent/agent-page.css')

    expect(css).toContain('.agent-scroll-to-bottom-btn {')
    expect(css).toContain('border: none;')
    expect(css).toContain('box-shadow: 0 4px 18px rgb(0 0 0 / 18%), 0 2px 6px rgb(0 0 0 / 8%);')
  })
})


