import { describe, expect, it } from 'vitest'

import { evaluateMusicPolicy } from '../../src/domains/security/agent-policy'

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

  it('等级不能创建未注册音乐能力', () => {
    expect(evaluateMusicPolicy({ registered: false, level: 'M4' }).decision).toBe('deny')
  })
})
