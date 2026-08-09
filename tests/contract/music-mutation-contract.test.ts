import { describe, expect, it } from 'vitest'

import {
  MusicMutationPayloadSchema,
  MusicMutationResultSchema
} from '../../src/shared/schemas/music'
import {
  MusicMutationRequestEnvelopeSchema,
  RuntimeInboundEnvelopeSchema,
  messageBase
} from '../../src/shared/schemas/runtime'

// ========= 测试区 =========

describe('music.mutate contract', () => {
  it('accepts registered strict mutation payloads and receipts', () => {
    /** 合法创建歌单载荷。 */
    const payload = MusicMutationPayloadSchema.parse({
      operation: 'createPlaylist',
      name: '通勤',
      privacy: 'private'
    })
    /** 合法标准写入回执。 */
    const result = MusicMutationResultSchema.parse({
      operation: 'createPlaylist',
      succeeded: true,
      entityId: '9001',
      updatedAt: '2026-08-09T08:00:00.000Z'
    })

    expect(payload).toMatchObject({ operation: 'createPlaylist', name: '通勤' })
    expect(result.entityId).toBe('9001')
  })

  it('rejects secret-shaped and unknown mutation fields before crossing IPC', () => {
    /** 携带秘密字段的非法请求信封。 */
    const request = {
      ...messageBase(crypto.randomUUID()),
      kind: 'request',
      name: 'music.mutate',
      requestId: crypto.randomUUID(),
      payload: {
        operation: 'likeTrack',
        trackId: '1',
        liked: true,
        cookie: 'MUSIC_U=secret'
      }
    }

    expect(MusicMutationRequestEnvelopeSchema.safeParse(request).success).toBe(false)
    expect(RuntimeInboundEnvelopeSchema.safeParse(request).success).toBe(false)
  })

  it('rejects empty destructive targets and unknown operations', () => {
    expect(MusicMutationPayloadSchema.safeParse({
      operation: 'updatePlaylistTracks',
      playlistId: '1',
      trackIds: [],
      action: 'remove'
    }).success).toBe(false)
    expect(MusicMutationPayloadSchema.safeParse({ operation: 'purchaseAlbum', albumId: '1' }).success).toBe(false)
  })
})
