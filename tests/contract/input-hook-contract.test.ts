import { describe, expect, it } from 'vitest'

import {
  INPUT_HOOK_PROTOCOL_VERSION,
  InputHookConfigSchema,
  InputHookReportSchema
} from '../../src/shared/contracts/input-hook'

// ========= 测试 =========
describe('input hook contract', () => {
  it('accepts strict Alt+Space configuration', () => {
    expect(
      InputHookConfigSchema.parse({
        protocolVersion: INPUT_HOOK_PROTOCOL_VERSION,
        chord: ['AltLeft', 'Space'],
        sessionGeneration: 1
      })
    ).toEqual({
      protocolVersion: INPUT_HOOK_PROTOCOL_VERSION,
      chord: ['AltLeft', 'Space'],
      sessionGeneration: 1
    })
  })

  it('rejects raw keyboard fields crossing the host boundary', () => {
    expect(
      InputHookReportSchema.safeParse({
        protocolVersion: INPUT_HOOK_PROTOCOL_VERSION,
        status: 'pressed',
        sessionGeneration: 1,
        keycode: 57
      }).success
    ).toBe(false)
  })
})
