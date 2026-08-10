import { describe, expect, it } from 'vitest'

import { AgentToolRegistry } from '../../src/domains/agent/tool-registry'

// ========= 测试 =========

describe('agent tool registry', () => {
  it('只暴露十个核心工具与两个两步兜底工具', () => {
    /** 正向 Tool Registry。 */
    const registry = new AgentToolRegistry()
    /** Provider 可见工具名。 */
    const names = registry.providerDefinitions().map((definition) => definition.name)

    expect(names).toHaveLength(12)
    expect(names).toContain('smart_search_and_play')
    expect(names).toContain('request_user_selection')
    expect(names).toContain('find_music_api_capabilities')
    expect(names).toContain('call_music_api')
  })

  it('Capability 签到不能借只读兜底绕过 M3 写入策略', () => {
    /** 正向 Tool Registry。 */
    const registry = new AgentToolRegistry()
    /** 每日签到兜底操作分类。 */
    const operation = registry.resolve('call_music_api', {
      capabilityId: 'music.daily-signin',
      params: {}
    })?.operation

    expect(operation).toMatchObject({
      effect: 'write',
      riskAction: 'music.library_playlist',
      conflictKeys: ['account:profile']
    })
  })

  it('未知 Tool 和未声明参数在 Policy 前拒绝', () => {
    /** 正向 Tool Registry。 */
    const registry = new AgentToolRegistry()

    expect(registry.resolve('unknown_tool', {})).toBeUndefined()
    expect(registry.resolve('control_player', { action: 'launch_missile' })).toBeUndefined()
  })
})
