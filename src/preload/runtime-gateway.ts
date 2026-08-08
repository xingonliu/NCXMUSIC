import type { RuntimeConnectionMetadata } from '../shared/contracts/control-plane'
import {
  MusicReadPayloadSchema,
  MusicReadResultSchema,
  ResolveTrackUrlPayloadSchema,
  ResolvedMediaSourceSchema,
  type MusicReadPayload,
  type MusicReadResult,
  type ResolveTrackUrlPayload,
  type ResolvedMediaSource
} from '../shared/schemas/music'
import {
  HelloEnvelopeSchema,
  PingPayloadSchema,
  PingResultSchema,
  ResponseEnvelopeSchema,
  UtilitySnapshotSchema,
  contractRegistry,
  messageBase,
  protocolFailure,
  type PingResult,
  type RuntimeResult,
  type UtilitySnapshot
} from '../shared/schemas/runtime'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeClientPort {
  postMessage(message: unknown): void
  start(): void
  close(): void
  setMessageHandler(handler: (message: unknown) => void): void
  setCloseHandler(handler: () => void): void
}

/** 已登记在 Contract Registry 中的请求名称 */
type RequestName = keyof typeof contractRegistry

interface PendingRequest {
  name: RequestName
  resolve: (result: RuntimeResult<unknown>) => void
  timer: ReturnType<typeof setTimeout>
}

interface ReadyWaiter {
  resolve: (ready: boolean) => void
  timer: ReturnType<typeof setTimeout>
}

export class RuntimeGateway {
  private port: RuntimeClientPort | undefined
  private metadata: RuntimeConnectionMetadata | undefined
  private ready = false
  private readonly pending = new Map<string, PendingRequest>()
  private readonly readyWaiters = new Set<ReadyWaiter>()

  attach(port: RuntimeClientPort, metadata: RuntimeConnectionMetadata): void {
    this.replaceConnection(protocolFailure('CONNECTION_REPLACED', '运行时连接已替换。', true))
    this.port = port
    this.metadata = metadata
    port.setMessageHandler((message) => this.handleMessage(message))
    port.setCloseHandler(() => this.disconnect('运行时端口已关闭。'))
    port.start()
    port.postMessage(
      HelloEnvelopeSchema.parse({
        ...messageBase(metadata.connectionId),
        kind: 'event',
        name: 'system.hello',
        eventId: crypto.randomUUID(),
        payload: {
          role: 'preload',
          appVersion: metadata.appVersion,
          capabilities: ['system.ping', 'system.snapshot', 'music.read', 'music.resolve-url']
        }
      })
    )
  }

  disconnect(reason: string): void {
    this.replaceConnection(protocolFailure('UTILITY_UNAVAILABLE', reason, true))
  }

  waitUntilReady(timeoutMs = 5_000): Promise<boolean> {
    if (this.ready) return Promise.resolve(true)

    return new Promise((resolve) => {
      const waiter: ReadyWaiter = {
        resolve,
        timer: setTimeout(() => {
          this.readyWaiters.delete(waiter)
          resolve(false)
        }, timeoutMs)
      }
      this.readyWaiters.add(waiter)
    })
  }

  async ping(input: { delayMs?: number; requestId?: string } = {}): Promise<RuntimeResult<PingResult>> {
    const payload = PingPayloadSchema.safeParse({ delayMs: input.delayMs ?? 0 })
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', 'Ping 参数不合法。')
    }

    const result = await this.request(
      'system.ping',
      payload.data,
      input.requestId ?? crypto.randomUUID(),
      contractRegistry['system.ping'].defaultTimeoutMs
    )
    if (!result.ok) return result

    const parsed = PingResultSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', 'Ping 响应不符合契约。')
  }

  async snapshot(): Promise<RuntimeResult<UtilitySnapshot>> {
    const result = await this.request(
      'system.snapshot',
      {},
      crypto.randomUUID(),
      contractRegistry['system.snapshot'].defaultTimeoutMs
    )
    if (!result.ok) return result

    const parsed = UtilitySnapshotSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '快照响应不符合契约。')
  }

  /**
   * 向 Utility 请求解析曲目播放地址。
   * 返回的 URL 是短期签名地址，调用方不得持久化或写日志。
   *
   * @param input trackId 与音质偏好；requestId 可由调用方指定以便取消
   */
  async resolveTrackUrl(
    input: ResolveTrackUrlPayload & { requestId?: string }
  ): Promise<RuntimeResult<ResolvedMediaSource>> {
    const payload = ResolveTrackUrlPayloadSchema.safeParse({
      trackId: input.trackId,
      quality: input.quality ?? 'auto'
    })
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', '播放地址解析参数不合法。')
    }

    const result = await this.request(
      'music.resolve-url',
      payload.data,
      input.requestId ?? crypto.randomUUID(),
      contractRegistry['music.resolve-url'].defaultTimeoutMs
    )
    if (!result.ok) return result

    const parsed = ResolvedMediaSourceSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '播放地址响应不符合契约。')
  }

  /**
   * 向 Utility 请求标准音乐实体或搜索结果。
   *
   * @param input Music Service 只读请求；requestId 可由调用方指定以便取消
   */
  async readMusic(
    input: MusicReadPayload & { requestId?: string }
  ): Promise<RuntimeResult<MusicReadResult>> {
    const { requestId, ...payloadInput } = input
    const payload = MusicReadPayloadSchema.safeParse(payloadInput)
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', '音乐数据请求参数不合法。')
    }

    const result = await this.request(
      'music.read',
      payload.data,
      requestId ?? crypto.randomUUID(),
      contractRegistry['music.read'].defaultTimeoutMs
    )
    if (!result.ok) return result

    const parsed = MusicReadResultSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '音乐数据响应不符合契约。')
  }

  cancel(requestId: string): boolean {
    const request = this.pending.get(requestId)
    if (!request || !this.port || !this.metadata) return false

    this.port.postMessage({
      ...messageBase(this.metadata.connectionId),
      kind: 'cancel',
      name: request.name,
      requestId,
      reason: 'user'
    })
    return true
  }

  private request(
    name: RequestName,
    payload: unknown,
    requestId: string,
    timeoutMs: number
  ): Promise<RuntimeResult<unknown>> {
    if (!this.ready || !this.port || !this.metadata) {
      return Promise.resolve(protocolFailure('UTILITY_UNAVAILABLE', '本地服务尚未就绪。', true))
    }
    if (this.pending.has(requestId)) {
      return Promise.resolve(protocolFailure('PROTOCOL_INVALID_MESSAGE', 'requestId 已在使用。'))
    }

    const port = this.port
    const metadata = this.metadata
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        port.postMessage({
          ...messageBase(metadata.connectionId),
          kind: 'cancel',
          name,
          requestId,
          reason: 'timeout'
        })
        resolve(protocolFailure('REQUEST_TIMEOUT', '请求超时。', true))
      }, timeoutMs)

      this.pending.set(requestId, { name, resolve, timer })
      port.postMessage({
        ...messageBase(metadata.connectionId),
        kind: 'request',
        name,
        requestId,
        deadlineAt: Date.now() + timeoutMs,
        payload
      })
    })
  }

  private handleMessage(message: unknown): void {
    const hello = HelloEnvelopeSchema.safeParse(message)
    if (hello.success) {
      if (
        hello.data.connectionId === this.metadata?.connectionId &&
        hello.data.payload.role === 'utility'
      ) {
        this.ready = true
        for (const waiter of this.readyWaiters) {
          clearTimeout(waiter.timer)
          waiter.resolve(true)
        }
        this.readyWaiters.clear()
      }
      return
    }

    const response = ResponseEnvelopeSchema.safeParse(message)
    if (!response.success || response.data.connectionId !== this.metadata?.connectionId) return

    const request = this.pending.get(response.data.requestId)
    if (!request || request.name !== response.data.name) return

    clearTimeout(request.timer)
    this.pending.delete(response.data.requestId)
    request.resolve(response.data.result)
  }

  private replaceConnection(failure: RuntimeResult<never>): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer)
      request.resolve(failure)
    }
    this.pending.clear()
    this.port?.close()
    this.port = undefined
    this.metadata = undefined
    this.ready = false
  }
}
