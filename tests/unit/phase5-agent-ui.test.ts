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
})
