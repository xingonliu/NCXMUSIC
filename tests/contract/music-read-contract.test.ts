import { describe, expect, it } from 'vitest'

import {
  MusicReadPayloadSchema,
  MusicReadResultSchema
} from '../../src/shared/schemas/music'
import {
  MusicReadRequestEnvelopeSchema,
  RuntimeInboundEnvelopeSchema,
  messageBase
} from '../../src/shared/schemas/runtime'

// ========= 测试区 =========

describe('music.read contract', () => {
  it('accepts a strict registered search request', () => {
    /** 当前连接 ID。 */
    const connectionId = crypto.randomUUID()
    /** 合法 music.read 请求。 */
    const request = {
      ...messageBase(connectionId),
      kind: 'request',
      name: 'music.read',
      requestId: crypto.randomUUID(),
      deadlineAt: Date.now() + 20_000,
      payload: {
        operation: 'search',
        query: '光年之外',
        limit: 10,
        offset: 0
      }
    }

    expect(MusicReadRequestEnvelopeSchema.parse(request)).toEqual(request)
    expect(RuntimeInboundEnvelopeSchema.safeParse(request).success).toBe(true)
  })

  it('accepts a strict registered lyrics request', () => {
    /** 当前连接 ID。 */
    const connectionId = crypto.randomUUID()
    /** 合法歌词读取请求。 */
    const request = {
      ...messageBase(connectionId),
      kind: 'request',
      name: 'music.read',
      requestId: crypto.randomUUID(),
      deadlineAt: Date.now() + 20_000,
      payload: {
        operation: 'getLyrics',
        id: '33894312'
      }
    }

    expect(MusicReadRequestEnvelopeSchema.parse(request)).toEqual(request)
    expect(RuntimeInboundEnvelopeSchema.safeParse(request).success).toBe(true)
  })

  it('accepts a strict registered public comments request', () => {
    /** 当前连接 ID。 */
    const connectionId = crypto.randomUUID()
    /** 合法评论集合读取请求。 */
    const request = {
      ...messageBase(connectionId),
      kind: 'request',
      name: 'music.read',
      requestId: crypto.randomUUID(),
      deadlineAt: Date.now() + 20_000,
      payload: {
        operation: 'getComments',
        resourceType: 'album',
        resourceId: '34740156',
        limit: 20,
        offset: 0
      }
    }

    expect(MusicReadRequestEnvelopeSchema.parse(request)).toEqual(request)
    expect(RuntimeInboundEnvelopeSchema.safeParse(request).success).toBe(true)
  })

  it('rejects secret-shaped fields in music payloads', () => {
    expect(
      MusicReadPayloadSchema.safeParse({
        operation: 'getSong',
        id: '33894312',
        cookie: 'MUSIC_U=secret'
      }).success
    ).toBe(false)
  })

  it('requires standardized source metadata in music results', () => {
    expect(
      MusicReadResultSchema.safeParse({
        kind: 'song',
        entity: {
          kind: 'song',
          id: '33894312',
          name: '光年之外',
          sources: [{ api: 'ncm.song_detail' }],
          updatedAt: new Date().toISOString()
        }
      }).success
    ).toBe(false)
  })
})
