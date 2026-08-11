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

    expect(registry.has('control_player')).toBe(true)
    expect(registry.has('unknown_tool')).toBe(false)
    expect(registry.resolve('unknown_tool', {})).toBeUndefined()
    expect(registry.resolve('control_player', { action: 'launch_missile' })).toBeUndefined()
  })

  it('选择后的歌曲引用可直接进入搜播工具且选择工具公开完整选项字段', () => {
    /** 正向 Tool Registry。 */
    const registry = new AgentToolRegistry()
    /** 稳定实体引用直播放行结果。 */
    const directPlay = registry.resolve('smart_search_and_play', {
      action: 'play',
      entityRef: 'song:123'
    })
    /** Provider 可见的选择工具参数。 */
    const selectionParameters = registry.providerDefinitions()
      .find((definition) => definition.name === 'request_user_selection')?.parameters

    expect(directPlay?.operation).toMatchObject({ effect: 'player' })
    expect(registry.resolve('smart_search_and_play', { action: 'play' })).toBeUndefined()
    expect(JSON.stringify(selectionParameters)).toContain('entityRef')
    expect(JSON.stringify(selectionParameters)).toContain('optionKey')
    expect(JSON.stringify(selectionParameters)).toContain('oneOf')
  })
})
