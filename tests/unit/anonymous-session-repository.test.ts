import type { Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { AnonymousSessionRepository } from '../../src/main/auth/anonymous-session-repository'

// ========= 测试 =========

describe('AnonymousSessionRepository', () => {
  it('注册并持久化独立 MUSIC_A 游客凭据', async () => {
    /** 写入独立 Electron Session 的 Cookie 方法。 */
    const set = vi.fn(async () => {})
    /** 测试用独立游客 Session。 */
    const electronSession = {
      cookies: {
        get: vi.fn(async () => []),
        set,
        flushStore: vi.fn(async () => {})
      }
    } as unknown as Session
    /** 固定游客 Token。 */
    const token = 'a'.repeat(64)
    /** 注入匿名注册 API 的游客 Session 仓库。 */
    const repository = new AnonymousSessionRepository(electronSession, async () => ({
      register_anonimous: vi.fn(async () => ({ cookie: [`MUSIC_A=${token}; Path=/`] }))
    }))

    await expect(repository.establish()).resolves.toBe(`MUSIC_A=${token}`)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      name: 'MUSIC_A',
      value: token,
      httpOnly: true,
      secure: true
    }))
  })
})
