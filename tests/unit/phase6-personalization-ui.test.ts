import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** 小云页面源码。 */
const agentPageSource = readFileSync('src/renderer/features/agent/AgentPage.vue', 'utf8')

/** 小云画像提示源码。 */
const bannerSource = readFileSync(
  'src/renderer/features/agent/components/ProfileAnalysisBanner.vue',
  'utf8'
)

/** 小云画像设置源码。 */
const settingsSource = readFileSync(
  'src/renderer/features/settings/PersonalizationSettingsPanel.vue',
  'utf8'
)

/** 模型设置源码。 */
const modelSettingsSource = readFileSync(
  'src/renderer/features/settings/ModelSettingsPanel.vue',
  'utf8'
)

/** 个人信息页源码。 */
const profilePageSource = readFileSync('src/renderer/features/profile/ProfilePage.vue', 'utf8')

/** 发现页源码。 */
const discoverPageSource = readFileSync('src/renderer/features/music/DiscoverPage.vue', 'utf8')

// ========= 测试 =========

describe('Phase 6 个性化 UI', () => {
  it('在输入区上方显示用户触发式分析提示与云端数据披露', () => {
    expect(agentPageSource).toContain('<ProfileAnalysisBanner')
    expect(agentPageSource.indexOf('<ProfileAnalysisBanner')).toBeLessThan(
      agentPageSource.indexOf('<AgentComposer')
    )
    expect(bannerSource).toContain('开始分析')
    expect(bannerSource).toContain('聚合特征和有限代表样本')
    expect(bannerSource).toContain('不会静默调用模型')
    expect(modelSettingsSource).toContain('上下文选择器选中的必要画像/记忆')
    expect(modelSettingsSource).toContain('可能产生 Token 费用')
  })

  it('设置页提供暂停、重生成、纠正、补充和独立删除画像', () => {
    expect(settingsSource).toContain('暂停更新')
    expect(settingsSource).toContain("runAnalysis('regenerate')")
    expect(settingsSource).toContain('纠正这条结论')
    expect(settingsSource).toContain('添加补充')
    expect(settingsSource).toContain("emit('open-data')")
    expect(settingsSource).toContain('查看账户数据')
    expect(settingsSource).toContain('聊天、长期记忆、基础资料与网易云云端数据不会被删除')
  })

  it('设置页管理画像，并在画像可用时装配发现页推荐 Section', () => {
    expect(settingsSource).toContain('音乐人格画像')
    expect(discoverPageSource).toContain('agent.snapshot.value.personalization.usable')
    expect(discoverPageSource).toContain('title="小云为你推荐"')
  })

  it('画像分析失败提示提供查看详情按钮与原始响应弹窗', () => {
    expect(bannerSource).toContain('查看详情')
    expect(bannerSource).toContain('<CommonDialog')
    expect(bannerSource).toContain('画像分析异常详情')
    expect(bannerSource).toContain('profile-raw-detail-pre')
    expect(bannerSource).toContain('复制内容')
  })
})
