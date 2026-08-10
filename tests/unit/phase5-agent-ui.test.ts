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

  it('ToolExecutionCard 使用 @lucide/vue 显式图标映射和状态点', () => {
    /** ToolExecutionCard 源代码。 */
    const card = source('src/renderer/features/agent/components/ToolExecutionCard.vue')
    expect(card).toContain("from '@lucide/vue'")
    expect(card).toContain('resolveToolIcon')
    expect(card).toContain('agent-tool-card-state-dot')
    expect(card).toContain('脱敏参数')
  })

  it('审批卡固定批准拒绝且无关闭按钮，选择卡保持独立语义', () => {
    /** ApprovalCard 源代码。 */
    const approval = source('src/renderer/features/agent/components/ApprovalCard.vue')
    /** SelectionCard 源代码。 */
    const selection = source('src/renderer/features/agent/components/SelectionCard.vue')
    expect(approval).toMatch(/>\s*拒绝\s*<\/CommonButton>/u)
    expect(approval).toMatch(/>\s*批准\s*<\/CommonButton>/u)
    expect(approval).not.toContain('关闭')
    expect(selection).toContain('无副作用选择')
    expect(selection).toContain('selection.mode === \'multiple\'')
  })
})
