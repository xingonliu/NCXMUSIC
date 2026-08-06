import { describe, expect, it } from 'vitest'

import { INPUT_HOOK_PROTOCOL_VERSION } from '../../src/shared/contracts/input-hook'
import { ShortcutMatcher } from '../../src/input-hook/shortcut-matcher'
import type { InputHookConfig } from '../../src/shared/contracts/input-hook'

// ========= 变量 =========
/** 单元测试固定使用 T-04 默认 Alt+Space 配置。 */
const config: InputHookConfig = {
  protocolVersion: INPUT_HOOK_PROTOCOL_VERSION,
  chord: ['AltLeft', 'Space'],
  sessionGeneration: 7
}

// ========= 测试 =========
describe('ShortcutMatcher', () => {
  it('emits exactly one press for a held chord and ignores repeated keydown', () => {
    const matcher = new ShortcutMatcher(config)

    expect(matcher.handle({ type: 'keydown', key: 'AltLeft' })).toBeUndefined()
    expect(matcher.handle({ type: 'keydown', key: 'Space' })).toMatchObject({
      status: 'pressed',
      sessionGeneration: 7
    })
    expect(matcher.handle({ type: 'keydown', key: 'Space', repeat: true })).toBeUndefined()
  })

  it('releases when any chord key is released', () => {
    const matcher = new ShortcutMatcher(config)

    matcher.handle({ type: 'keydown', key: 'AltLeft' })
    matcher.handle({ type: 'keydown', key: 'Space' })

    expect(matcher.handle({ type: 'keyup', key: 'AltLeft' })).toMatchObject({
      status: 'released',
      sessionGeneration: 7
    })
    expect(matcher.handle({ type: 'keyup', key: 'Space' })).toBeUndefined()
  })

  it('does not emit unrelated keys or raw key streams', () => {
    const matcher = new ShortcutMatcher(config)

    expect(matcher.handle({ type: 'keydown', key: 'AltRight' })).toBeUndefined()
    expect(matcher.snapshot()).toEqual({ pressedKeys: [], listening: false })
  })

  it('converts disconnect into a safe release for active listening', () => {
    const matcher = new ShortcutMatcher(config)

    matcher.handle({ type: 'keydown', key: 'AltLeft' })
    matcher.handle({ type: 'keydown', key: 'Space' })

    expect(matcher.handle({ type: 'disconnect' })).toMatchObject({
      status: 'released',
      reason: 'hook disconnected'
    })
    expect(matcher.snapshot()).toEqual({ pressedKeys: [], listening: false })
  })
})
