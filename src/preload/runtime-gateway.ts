import type { RuntimeConnectionMetadata } from '../shared/contracts/control-plane'
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
} from '../shared/contracts/runtime'

interface ClientPort {
  postMessage(message: unknown): void
  start(): void
  close(): void
  setMessageHandler(handler: (message: unknown) => void): void
  setCloseHandler(handler: () => void): void
}

interface PendingRequest {
  name: 'system.ping' | 'system.snapshot'
  resolve: (result: RuntimeResult<unknown>) => void
  timer: ReturnType<typeof setTimeout>
}

interface ReadyWaiter {
  resolve: (ready: boolean) => void
  timer: ReturnType<typeof setTimeout>
}

export class RuntimeGateway {
  private port: ClientPort | undefined
  private metadata: RuntimeConnectionMetadata | undefined
  private ready = false
  private readonly pending = new Map<string, PendingRequest>()
  private readonly readyWaiters = new Set<ReadyWaiter>()

  attach(port: ClientPort, metadata: RuntimeConnectionMetadata): void {
    this.replaceConnection()
    this.port = port
    this.metadata = metadata
    port.setMessageHandler((message) => this.handleMessage(message))
    port.setCloseHandler(() => this.replaceConnection())
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
          capabilities: ['system.ping', 'system.snapshot']
        }
      })
    )
  }

  waitUntilReady(timeoutMs = 5_000): Promise<boolean> {
    if (this.ready) {
      return Promise.resolve(true)
    }

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
    if (!result.ok) {
      return result
    }

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
    if (!result.ok) {
      return result
    }

    const parsed = UtilitySnapshotSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '快照响应不符合契约。')
  }

  cancel(requestId: string): boolean {
    const request = this.pending.get(requestId)
    if (!request || !this.port || !this.metadata) {
      return false
    }

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
    name: 'system.ping' | 'system.snapshot',
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

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        this.port?.postMessage({
          ...messageBase(this.metadata?.connectionId ?? crypto.randomUUID()),
          kind: 'cancel',
          name,
          requestId,
          reason: 'timeout'
        })
        resolve(protocolFailure('REQUEST_TIMEOUT', '请求超时。', true))
      }, timeoutMs)

      this.pending.set(requestId, { name, resolve, timer })
      this.port?.postMessage({
        ...messageBase(this.metadata?.connectionId ?? crypto.randomUUID()),
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
    if (!response.success || response.data.connectionId !== this.metadata?.connectionId) {
      return
    }

    const request = this.pending.get(response.data.requestId)
    if (!request || request.name !== response.data.name) {
      return
    }

    clearTimeout(request.timer)
    this.pending.delete(response.data.requestId)
    request.resolve(response.data.result)
  }

  private replaceConnection(): void {
    const replacement = protocolFailure('CONNECTION_REPLACED', '运行时连接已替换。', true)
    for (const request of this.pending.values()) {
      clearTimeout(request.timer)
      request.resolve(replacement)
    }
    this.pending.clear()
    this.port?.close()
    this.port = undefined
    this.metadata = undefined
    this.ready = false
  }
}
