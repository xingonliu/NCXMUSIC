import { describe, expect, it, vi } from 'vitest'

import type { MusicDataSource } from '../../src/infrastructure/netease/music-api-adapter'
import type { CredentialLeaseService } from '../../src/utility/credential-lease-service'
import { MusicService } from '../../src/utility/music-service'
import type {
  MusicMutationPayload,
  MusicReadPayload,
  MusicReadResult
} from '../../src/shared/schemas/music'

// ========= 测试夹具区 =========

/** 固定测试时间。 */
const observedAt = '2026-08-08T00:00:00.000Z'

/** 标准音乐读取结果。 */
const songResult: MusicReadResult = {
  kind: 'song',
  entity: {
    kind: 'song',
    id: '33894312',
    name: '光年之外',
    artists: [],
    access: { badges: [], playableKnown: false },
    sources: [{ api: 'ncm.song_detail', observedAt }],
    updatedAt: observedAt
  }
}

/** 构造凭据租约夹具。 */
function credentialLease(active: boolean): CredentialLeaseService {
  return {
    hasActiveLease: vi.fn(() => active),
    executeWithCookie: vi.fn(async (operation: (cookie: string) => Promise<string>) =>
      operation('MUSIC_U=secret')
    )
  } as unknown as CredentialLeaseService
}

// ========= 测试区 =========

describe('MusicService', () => {
  it('uses active credential leases without returning secrets', async () => {
    /** 数据源读取函数。 */
    const read = vi.fn(async (_payload: MusicReadPayload, cookie: string) => {
      expect(cookie).toBe('MUSIC_U=secret')
      return songResult
    })
    /** 标准音乐服务。 */
    const service = new MusicService(credentialLease(true), { read } as MusicDataSource)

    const result = await service.read(crypto.randomUUID(), {
      operation: 'getSong',
      id: '33894312'
    })

    expect(result).toEqual(songResult)
    expect(JSON.stringify(result)).not.toContain('MUSIC_U')
  })

  it('falls back to guest reads when no lease is active', async () => {
    /** 数据源读取函数。 */
    const read = vi.fn(async (_payload: MusicReadPayload, cookie: string) => {
      expect(cookie).toBe('')
      return songResult
    })
    /** 标准音乐服务。 */
    const service = new MusicService(credentialLease(false), { read } as MusicDataSource)

    await expect(
      service.read(crypto.randomUUID(), { operation: 'getSong', id: '33894312' })
    ).resolves.toEqual(songResult)
  })

  it('rejects mutations without an active credential lease', async () => {
    /** 支持写入的数据源方法，游客门禁不应调用。 */
    const mutate = vi.fn()
    /** 游客模式标准音乐服务。 */
    const service = new MusicService(credentialLease(false), {
      read: vi.fn(),
      mutate
    } as unknown as MusicDataSource)

    await expect(service.mutate(crypto.randomUUID(), {
      operation: 'likeTrack',
      trackId: '33894312',
      liked: true
    })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('uses the credential lease for one explicit mutation and returns no secret', async () => {
    /** 标准写入数据源方法。 */
    const mutate = vi.fn(async (_payload: MusicMutationPayload, cookie: string) => {
      expect(cookie).toBe('MUSIC_U=secret')
      return {
        operation: 'likeTrack' as const,
        succeeded: true as const,
        entityId: '33894312',
        updatedAt: observedAt
      }
    })
    /** 登录模式标准音乐服务。 */
    const service = new MusicService(credentialLease(true), {
      read: vi.fn(),
      mutate
    } as unknown as MusicDataSource)

    const result = await service.mutate(crypto.randomUUID(), {
      operation: 'likeTrack',
      trackId: '33894312',
      liked: true
    })

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(result)).not.toContain('MUSIC_U')
  })
})
