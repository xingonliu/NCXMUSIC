import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** 扩展设置面板源码。 */
const extensionSettingsSource = readFileSync(
  'src/renderer/features/settings/ExtensionsSettingsPanel.vue',
  'utf8'
)

/** 外部 Agent 工具定义源码。 */
const agentExternalToolsSource = readFileSync(
  'src/infrastructure/extensions/agent-external-tools.ts',
  'utf8'
)

/** 主进程扩展协调器源码。 */
const extensionCoordinatorSource = readFileSync(
  'src/main/extension-coordinator.ts',
  'utf8'
)

// ========= 测试 =========

describe('Skill 设置页与 Agent 工具 UI/架构规范测试', () => {
  it('新增 Skill 改为通用弹窗并支持 Git、SkillHub Slug 与本地导入三种方式', () => {
    // 弹窗状态与按钮
    expect(extensionSettingsSource).toContain('skillDialogVisible')
    expect(extensionSettingsSource).toContain('openCreateSkillDialog')
    expect(extensionSettingsSource).toContain('closeSkillDialog')
    expect(extensionSettingsSource).toContain('<Plus :size="14" />新增 Skill')

    // 弹窗定义与三种导入模式
    expect(extensionSettingsSource).toContain(':visible="skillDialogVisible"')
    expect(extensionSettingsSource).toContain('title="新增 Skill"')
    expect(extensionSettingsSource).toContain('方式一：SkillHub 技能标识导入')
    expect(extensionSettingsSource).toContain('方式二：HTTPS Git 仓库导入')
    expect(extensionSettingsSource).toContain('方式三：本地代码包导入')
    expect(extensionSettingsSource).toContain('installSlugSkill')
    expect(extensionSettingsSource).toContain('installGitSkill')
    expect(extensionSettingsSource).toContain("chooseSkill('folder')")
    expect(extensionSettingsSource).toContain("chooseSkill('zip')")
  })

  it('区分已安装与市场 Tab 栏，并支持 SkillHub 数据源拉取与一键安装', () => {
    // Tab 栏选项与切换
    expect(extensionSettingsSource).toContain('activeSkillTab')
    expect(extensionSettingsSource).toContain('skillTabOptions')
    expect(extensionSettingsSource).toContain('setSkillTab')

    // 市场搜索与分页
    expect(extensionSettingsSource).toContain('skillMarketSearchDraft')
    expect(extensionSettingsSource).toContain('skillMarketQuery')
    expect(extensionSettingsSource).toContain('skillMarketItems')
    expect(extensionSettingsSource).toContain('loadSkillMarket')
    expect(extensionSettingsSource).toContain('submitSkillMarketSearch')
    expect(extensionSettingsSource).toContain('goToSkillMarketPage')

    // 一键安装与状态判定
    expect(extensionSettingsSource).toContain('isInstalledSkill')
    expect(extensionSettingsSource).toContain('installMarketSkill')
    expect(extensionSettingsSource).toContain("operation: 'skill.installMarket'")
  })

  it('Main 进程 ExtensionCoordinator 支持 SkillHub 市场搜索与直接安装', () => {
    expect(extensionCoordinatorSource).toContain('SKILLHUB_MARKET_URL = \'https://api.skillhub.cn/api/skills\'')
    expect(extensionCoordinatorSource).toContain('searchSkillMarket')
    expect(extensionCoordinatorSource).toContain("operation === 'skill.market.search'")
    expect(extensionCoordinatorSource).toContain("operation === 'skill.installMarket'")
    expect(extensionCoordinatorSource).toContain('https://api.skillhub.cn/api/v1/download?slug=')
  })

  it('manage_skill Agent 工具支持在 SkillHub 市场中搜索 Skill 并免审批', () => {
    // 参数包含 search 与 query
    expect(agentExternalToolsSource).toContain('enum([\'search\', \'install\', \'enable\', \'disable\', \'update\', \'rollback\', \'uninstall\'])')
    expect(agentExternalToolsSource).toContain('query: z.string()')
    expect(agentExternalToolsSource).toContain('searchSkillHub')

    // search 操作解析为只读免批
    expect(agentExternalToolsSource).toContain("parsed.data.action === 'search'")
    expect(agentExternalToolsSource).toContain("effect: 'read'")
  })
})
