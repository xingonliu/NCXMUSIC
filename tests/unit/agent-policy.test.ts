import { describe, expect, it } from 'vitest'

import {
  evaluateCommandPolicy,
  evaluateMusicPolicy
} from '../../src/domains/security/agent-policy'

// ========= 测试 =========

describe('agent policy', () => {
  it('按 M1～M4 纯函数矩阵判断已注册音乐动作', () => {
    expect(evaluateMusicPolicy({ registered: true, action: 'music.playback_queue', level: 'M1' }).decision).toBe('ask')
    expect(evaluateMusicPolicy({ registered: true, action: 'music.playback_queue', level: 'M2' }).decision).toBe('allow')
    expect(evaluateMusicPolicy({ registered: true, action: 'music.library_playlist', level: 'M2' }).decision).toBe('ask')
    expect(evaluateMusicPolicy({ registered: true, action: 'music.library_playlist', level: 'M3' }).decision).toBe('allow')
    expect(evaluateMusicPolicy({ registered: true, action: 'music.account_high_impact', level: 'M3' }).decision).toBe('ask')
    expect(evaluateMusicPolicy({ registered: true, action: 'music.account_high_impact', level: 'M4' }).decision).toBe('allow')
  })

  it('等级不能创建未注册音乐或命令能力', () => {
    expect(evaluateMusicPolicy({ registered: false, level: 'M4' }).decision).toBe('deny')
    expect(evaluateCommandPolicy({ shellToolEnabled: true, registered: false, level: 'S4' }).decision).toBe('deny')
    expect(evaluateCommandPolicy({ shellToolEnabled: false, registered: true, action: 'command.read_only', level: 'S4' }).decision).toBe('deny')
  })

  it('按 S1～S4 放行确定性命令类别', () => {
    expect(evaluateCommandPolicy({ shellToolEnabled: true, registered: true, action: 'command.read_only', level: 'S1' }).decision).toBe('ask')
    expect(evaluateCommandPolicy({ shellToolEnabled: true, registered: true, action: 'command.read_only', level: 'S2' }).decision).toBe('allow')
    expect(evaluateCommandPolicy({ shellToolEnabled: true, registered: true, action: 'command.workspace_development', level: 'S3' }).decision).toBe('allow')
    expect(evaluateCommandPolicy({ shellToolEnabled: true, registered: true, action: 'command.workspace_network', level: 'S3' }).decision).toBe('ask')
    expect(evaluateCommandPolicy({ shellToolEnabled: true, registered: true, action: 'command.workspace_network', level: 'S4' }).decision).toBe('allow')
  })
})
