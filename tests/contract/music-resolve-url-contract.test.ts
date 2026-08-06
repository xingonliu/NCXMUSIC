import { describe, expect, it } from 'vitest'

import {
  HelloEnvelopeSchema,
  ResponseEnvelopeSchema,
  messageBase
} from '../../src/shared/schemas/runtime'
import { ResolvedMediaSourceSchema } from '../../src/shared/schemas/music'
import {
  UtilityRuntimeServer,
  type RuntimePort,
  type TrackUrlHandler
} from '../../src/utility/runtime-server'

// ─────────────────────────────────────────────────────────────────────────────
// 测试替身区
// ─────────────────────────────────────────────────────────────────────────────

/** 内存双向端口，模拟 MessageChannel 的两端 */
class MemoryPort implements RuntimePort {
  peer: MemoryPort | undefined
  private readonly listeners = new Set<(message: unknown) => void>()
  private closed = false

  postMessage(message: unknown): void {
    if (this.closed) return
    queueMicrotask(() => {
      for (const listener of this.peer?.listeners ?? []) listener(message)
    })
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {}

  close(): void {
    this.closed = true
    this.listeners.clear()
  }
}

function channel(): [MemoryPort, MemoryPort] {
  const first = new MemoryPort()
  const second = new MemoryPort()
  first.peer = second
  second.peer = first
  return [first, second]
}

function nextMessage(port: MemoryPort): Promise<unknown> {
  return new Promise((resolve) => {
    const unsubscribe = port.subscribe((message) => {
      unsubscribe()
      resolve(message)
    })
  })
}

function sendHello(client: MemoryPort, connectionId: string): void {
  client.postMessage({
    ...messageBase(connectionId),
    kind: 'event',
    name: 'system.hello',
    eventId: crypto.randomUUID(),
    payload: {
      role: 'preload',
      appVersion: '0.1.0',
      capabilities: ['system.ping', 'system.snapshot', 'music.resolve-url']
    }
  })
}

/** 一个可控的 TrackUrlHandler 替身 */
class FakeTrackUrlHandler implements TrackUrlHandler {
  /** 记录收到的载荷，用于断言 Schema 默认值已生效 */
  readonly received: unknown[] = []

  /** 已被取消的 requestId */
  readonly cancelled: string[] = []

  /** 下一次 resolve 的行为 */
  private behavior:
    | { kind: 'succeed'; data: unknown }
    | { kind: 'fail'; error: unknown }
    | { kind: 'hang' } = {
    kind: 'succeed',
    data: {
      url: 'https://m8.music.126.net/example.mp3',
      requestedQuality: 'auto',
      actualQuality: 'exhigh',
      attemptedQualities: ['exhigh'],
      downgraded: false,
      bitrate: 320_000,
      format: 'mp3',
      size: 8_123_456
    }
  }

  /** 挂起模式下暴露的 reject 句柄，供 cancel 场景断言 */
  private hangReject: ((reason: unknown) => void) | undefined

  succeedWith(data: unknown): void {
    this.behavior = { kind: 'succeed', data }
  }

  failWith(error: unknown): void {
    this.behavior = { kind: 'fail', error }
  }

  hang(): void {
    this.behavior = { kind: 'hang' }
  }

  async resolve(requestId: string, payload: unknown): Promise<unknown> {
    this.received.push(payload)

    if (this.behavior.kind === 'succeed') return this.behavior.data
    if (this.behavior.kind === 'fail') throw this.behavior.error

    // hang：永不自行结算，等待 cancel 触发 abort
    return new Promise((_resolve, reject) => {
      this.hangReject = reject
    })
  }

  cancel(requestId: string): void {
    this.cancelled.push(requestId)
    this.hangReject?.(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    this.hangReject = undefined
  }
}

/** 建立一个已完成握手的连接 */
async function connect(
  handler?: TrackUrlHandler
): Promise<{
  client: MemoryPort
  server: UtilityRuntimeServer
  connectionId: string
  capabilities: readonly string[]
}> {
  const connectionId = crypto.randomUUID()
  const [client, utility] = channel()
  const server = new UtilityRuntimeServer(handler)
  const helloFromUtility = nextMessage(client)

  server.attach(utility, {
    connectionId,
    protocolVersion: 1,
    appVersion: '0.1.0',
    utilityGeneration: 3
  })

  const hello = HelloEnvelopeSchema.parse(await helloFromUtility)
  sendHello(client, connectionId)
  await Promise.resolve()

  return { client, server, connectionId, capabilities: hello.payload.capabilities }
}

/** 发起一次 music.resolve-url 请求并等待响应 */
async function requestResolve(
  client: MemoryPort,
  connectionId: string,
  payload: unknown,
  requestId = crypto.randomUUID()
): Promise<{ response: unknown; requestId: string }> {
  const pending = nextMessage(client)
  client.postMessage({
    ...messageBase(connectionId),
    kind: 'request',
    name: 'music.resolve-url',
    requestId,
    payload
  })
  return { response: await pending, requestId }
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试区
// ─────────────────────────────────────────────────────────────────────────────

describe('music.resolve-url 契约', () => {
  describe('能力声明', () => {
    it('注入 handler 时在 hello 中声明 music.resolve-url', async () => {
      const { capabilities, server } = await connect(new FakeTrackUrlHandler())
      expect(capabilities).toContain('music.resolve-url')
      server.shutdown()
    })

    it('未注入 handler 时不声明该能力', async () => {
      const { capabilities, server } = await connect()
      expect(capabilities).not.toContain('music.resolve-url')
      server.shutdown()
    })

    it('未注入 handler 时请求返回 CAPABILITY_UNAVAILABLE', async () => {
      const { client, connectionId, server } = await connect()
      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'auto'
      })

      expect(ResponseEnvelopeSchema.parse(response).result).toMatchObject({
        ok: false,
        error: { code: 'CAPABILITY_UNAVAILABLE', retryable: false }
      })
      server.shutdown()
    })
  })

  describe('成功路径', () => {
    it('返回符合 ResolvedMediaSource 契约的结果', async () => {
      const handler = new FakeTrackUrlHandler()
      const { client, connectionId, server } = await connect(handler)

      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'exhigh'
      })

      const parsed = ResponseEnvelopeSchema.parse(response)
      expect(parsed.name).toBe('music.resolve-url')
      expect(parsed.result.ok).toBe(true)
      if (!parsed.result.ok) throw new Error('expected success')

      // 结果必须能通过 ResolvedMediaSource 严格校验
      const source = ResolvedMediaSourceSchema.parse(parsed.result.data)
      expect(source.url).toMatch(/^https:\/\//u)
      expect(source.actualQuality).toBe('exhigh')
      server.shutdown()
    })

    it('quality 省略时由 Schema 填入 auto 默认值', async () => {
      const handler = new FakeTrackUrlHandler()
      const { client, connectionId, server } = await connect(handler)

      await requestResolve(client, connectionId, { trackId: '1901371647' })

      expect(handler.received[0]).toMatchObject({
        trackId: '1901371647',
        quality: 'auto'
      })
      server.shutdown()
    })

    it('降级结果原样透传 downgraded 与 downgradeReason', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.succeedWith({
        url: 'https://m8.music.126.net/downgraded.mp3',
        requestedQuality: 'hires',
        actualQuality: 'standard',
        attemptedQualities: ['hires', 'lossless', 'exhigh', 'standard'],
        downgraded: true,
        downgradeReason: 'account-unavailable',
        format: 'mp3'
      })
      const { client, connectionId, server } = await connect(handler)

      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'hires'
      })

      const parsed = ResponseEnvelopeSchema.parse(response)
      if (!parsed.result.ok) throw new Error('expected success')
      const source = ResolvedMediaSourceSchema.parse(parsed.result.data)
      expect(source.downgraded).toBe(true)
      expect(source.downgradeReason).toBe('account-unavailable')
      expect(source.actualQuality).toBe('standard')
      server.shutdown()
    })
  })

  describe('载荷校验', () => {
    it('非数字 trackId 被协议层拒绝，不进入 handler', async () => {
      const handler = new FakeTrackUrlHandler()
      const { client, connectionId, server } = await connect(handler)

      // 该消息无法通过 RuntimeInboundEnvelopeSchema，服务端应静默丢弃
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId: crypto.randomUUID(),
        payload: { trackId: 'not-a-number', quality: 'auto' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler.received).toHaveLength(0)
      server.shutdown()
    })

    it('未知音质值被拒绝，不进入 handler', async () => {
      const handler = new FakeTrackUrlHandler()
      const { client, connectionId, server } = await connect(handler)

      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId: crypto.randomUUID(),
        payload: { trackId: '1901371647', quality: 'ultra-hd' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler.received).toHaveLength(0)
      server.shutdown()
    })

    it('载荷中的未知字段被 strictObject 拒绝', async () => {
      const handler = new FakeTrackUrlHandler()
      const { client, connectionId, server } = await connect(handler)

      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId: crypto.randomUUID(),
        payload: { trackId: '1901371647', quality: 'auto', cookie: 'MUSIC_U=leak' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler.received).toHaveLength(0)
      server.shutdown()
    })

    it('握手完成前的请求被拒绝', async () => {
      const connectionId = crypto.randomUUID()
      const [client, utility] = channel()
      const handler = new FakeTrackUrlHandler()
      const server = new UtilityRuntimeServer(handler)
      const helloFromUtility = nextMessage(client)

      server.attach(utility, {
        connectionId,
        protocolVersion: 1,
        appVersion: '0.1.0',
        utilityGeneration: 3
      })
      await helloFromUtility

      // 故意不发送 preload hello
      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'auto'
      })

      expect(ResponseEnvelopeSchema.parse(response).result).toMatchObject({
        ok: false,
        error: { code: 'PROTOCOL_INVALID_MESSAGE' }
      })
      expect(handler.received).toHaveLength(0)
      server.shutdown()
    })
  })

  describe('错误映射与脱敏', () => {
    it('无凭据租约映射为 CAPABILITY_UNAVAILABLE', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.failWith(Object.assign(new Error('no lease'), { code: 'NO_ACTIVE_LEASE' }))
      const { client, connectionId, server } = await connect(handler)

      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'auto'
      })

      expect(ResponseEnvelopeSchema.parse(response).result).toMatchObject({
        ok: false,
        error: { code: 'CAPABILITY_UNAVAILABLE', retryable: false }
      })
      server.shutdown()
    })

    it('曲目不可用映射为 CAPABILITY_UNAVAILABLE', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.failWith(
        Object.assign(new Error('unavailable'), { code: 'track-unavailable' })
      )
      const { client, connectionId, server } = await connect(handler)

      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'auto'
      })

      expect(ResponseEnvelopeSchema.parse(response).result).toMatchObject({
        ok: false,
        error: { code: 'CAPABILITY_UNAVAILABLE' }
      })
      server.shutdown()
    })

    it('未知异常映射为可重试的 UTILITY_UNAVAILABLE', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.failWith(new Error('socket hang up'))
      const { client, connectionId, server } = await connect(handler)

      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'auto'
      })

      expect(ResponseEnvelopeSchema.parse(response).result).toMatchObject({
        ok: false,
        error: { code: 'UTILITY_UNAVAILABLE', retryable: true }
      })
      server.shutdown()
    })

    it('错误消息不泄漏上游原文、Cookie 或播放 URL', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.failWith(
        new Error(
          'upstream 502 cookie=MUSIC_U=deadbeef url=https://m8.music.126.net/secret.mp3'
        )
      )
      const { client, connectionId, server } = await connect(handler)

      const { response } = await requestResolve(client, connectionId, {
        trackId: '1901371647',
        quality: 'auto'
      })

      const parsed = ResponseEnvelopeSchema.parse(response)
      if (parsed.result.ok) throw new Error('expected failure')
      const message = parsed.result.error.message
      expect(message).not.toMatch(/MUSIC_U/u)
      expect(message).not.toMatch(/music\.126\.net/u)
      expect(message).not.toMatch(/502/u)
      server.shutdown()
    })
  })

  describe('取消与生命周期', () => {
    it('cancel 转发到 handler 并返回 REQUEST_CANCELLED', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.hang()
      const { client, connectionId, server } = await connect(handler)

      const requestId = crypto.randomUUID()
      const cancelResponse = nextMessage(client)
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId,
        payload: { trackId: '1901371647', quality: 'auto' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      client.postMessage({
        ...messageBase(connectionId),
        kind: 'cancel',
        name: 'music.resolve-url',
        requestId,
        reason: 'user'
      })

      expect(ResponseEnvelopeSchema.parse(await cancelResponse).result).toMatchObject({
        ok: false,
        error: { code: 'REQUEST_CANCELLED' }
      })
      expect(handler.cancelled).toContain(requestId)
      server.shutdown()
    })

    it('取消后迟到的解析结果不再产生第二个终态响应', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.hang()
      const { client, connectionId, server } = await connect(handler)

      const responses: unknown[] = []
      client.subscribe((message) => responses.push(message))

      const requestId = crypto.randomUUID()
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId,
        payload: { trackId: '1901371647', quality: 'auto' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      client.postMessage({
        ...messageBase(connectionId),
        kind: 'cancel',
        name: 'music.resolve-url',
        requestId,
        reason: 'user'
      })
      await new Promise((resolve) => setTimeout(resolve, 20))

      // 每个请求只允许一个终态响应
      const terminal = responses.filter(
        (message) =>
          typeof message === 'object' &&
          message !== null &&
          (message as { kind?: string }).kind === 'response' &&
          (message as { requestId?: string }).requestId === requestId
      )
      expect(terminal).toHaveLength(1)
      server.shutdown()
    })

    it('重复 requestId 被拒绝，不重复执行解析', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.hang()
      const { client, connectionId, server } = await connect(handler)

      const requestId = crypto.randomUUID()
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId,
        payload: { trackId: '1901371647', quality: 'auto' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      const duplicate = nextMessage(client)
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId,
        payload: { trackId: '1901371647', quality: 'auto' }
      })

      expect(ResponseEnvelopeSchema.parse(await duplicate).result).toMatchObject({
        ok: false,
        error: { code: 'PROTOCOL_INVALID_MESSAGE' }
      })
      // handler 只被调用一次
      expect(handler.received).toHaveLength(1)
      server.shutdown()
    })

    it('连接被替换后旧请求的迟到结果不发往新连接', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.hang()
      const { client, connectionId, server } = await connect(handler)

      const requestId = crypto.randomUUID()
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId,
        payload: { trackId: '1901371647', quality: 'auto' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 替换连接：应取消在途解析
      const reconnectedId = crypto.randomUUID()
      const [newClient, newUtility] = channel()
      const newHello = nextMessage(newClient)
      server.attach(newUtility, {
        connectionId: reconnectedId,
        protocolVersion: 1,
        appVersion: '0.1.0',
        utilityGeneration: 3
      })
      await newHello
      sendHello(newClient, reconnectedId)

      const leaked: unknown[] = []
      newClient.subscribe((message) => leaked.push(message))
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(handler.cancelled).toContain(requestId)
      const leakedResponses = leaked.filter(
        (message) =>
          typeof message === 'object' &&
          message !== null &&
          (message as { requestId?: string }).requestId === requestId
      )
      expect(leakedResponses).toHaveLength(0)
      server.shutdown()
    })

    it('shutdown 取消全部在途解析', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.hang()
      const { client, connectionId, server } = await connect(handler)

      const requestId = crypto.randomUUID()
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId,
        payload: { trackId: '1901371647', quality: 'auto' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      server.shutdown()
      expect(handler.cancelled).toContain(requestId)
    })
  })

  describe('快照统计', () => {
    it('在途解析出现在 snapshot 的 pendingRequestIds 中', async () => {
      const handler = new FakeTrackUrlHandler()
      handler.hang()
      const { client, connectionId, server } = await connect(handler)

      const requestId = crypto.randomUUID()
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'music.resolve-url',
        requestId,
        payload: { trackId: '1901371647', quality: 'auto' }
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      const snapshotResponse = nextMessage(client)
      client.postMessage({
        ...messageBase(connectionId),
        kind: 'request',
        name: 'system.snapshot',
        requestId: crypto.randomUUID(),
        payload: {}
      })

      const parsed = ResponseEnvelopeSchema.parse(await snapshotResponse)
      if (!parsed.result.ok) throw new Error('expected success')
      expect(
        (parsed.result.data as { pendingRequestIds: string[] }).pendingRequestIds
      ).toContain(requestId)
      server.shutdown()
    })
  })
})
