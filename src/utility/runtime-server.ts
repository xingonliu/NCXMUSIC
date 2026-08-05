import type { RuntimeConnectionMetadata } from '../shared/contracts/control-plane'
import {
  HelloEnvelopeSchema,
  PingRequestEnvelopeSchema,
  PROTOCOL_VERSION,
  RuntimeInboundEnvelopeSchema,
  SnapshotRequestEnvelopeSchema,
  messageBase,
  type CancelEnvelope,
  type PingRequestEnvelope,
  type ProtocolError,
  type SnapshotRequestEnvelope
} from '../shared/schemas/runtime'

export interface RuntimePort {
  postMessage(message: unknown): void
  subscribe(listener: (message: unknown) => void): () => void
  start(): void
  close(): void
}

interface PendingRequest {
  name: 'system.ping'
  timer: ReturnType<typeof setTimeout>
}

export class UtilityRuntimeServer {
  private readonly startedAt = Date.now()
  private activeConnection: RuntimeConnectionMetadata | undefined
  private activePort: RuntimePort | undefined
  private unsubscribe: (() => void) | undefined
  private readonly pending = new Map<string, PendingRequest>()
  private handledRequests = 0
  private handshakeComplete = false

  attach(port: RuntimePort, metadata: RuntimeConnectionMetadata): void {
    this.replaceConnection()
    this.activeConnection = metadata
    this.activePort = port
    this.unsubscribe = port.subscribe((message) => this.handleMessage(message))
    port.start()
    this.post(
      HelloEnvelopeSchema.parse({
        ...messageBase(metadata.connectionId),
        kind: 'event',
        name: 'system.hello',
        eventId: crypto.randomUUID(),
        payload: {
          role: 'utility',
          appVersion: metadata.appVersion,
          capabilities: ['system.ping', 'system.snapshot']
        }
      })
    )
  }

  shutdown(): void {
    this.replaceConnection()
  }

  private handleMessage(message: unknown): void {
    const parsed = RuntimeInboundEnvelopeSchema.safeParse(message)
    if (!parsed.success) return

    const envelope = parsed.data
    if (envelope.connectionId !== this.activeConnection?.connectionId) return

    if (envelope.kind === 'event') {
      if (envelope.payload.role === 'preload') this.handshakeComplete = true
      return
    }

    if (!this.handshakeComplete) {
      if (envelope.kind === 'request') {
        this.respondError(envelope, {
          code: 'PROTOCOL_INVALID_MESSAGE',
          message: '连接握手尚未完成。',
          retryable: true
        })
      }
      return
    }

    if (envelope.kind === 'cancel') {
      this.cancel(envelope)
      return
    }

    if (envelope.deadlineAt !== undefined && envelope.deadlineAt <= Date.now()) {
      this.respondError(envelope, {
        code: 'REQUEST_TIMEOUT',
        message: '请求在执行前已经超时。',
        retryable: true
      })
      return
    }

    if (envelope.name === 'system.ping') {
      this.ping(PingRequestEnvelopeSchema.parse(envelope))
      return
    }

    this.snapshot(SnapshotRequestEnvelopeSchema.parse(envelope))
  }

  private ping(request: PingRequestEnvelope): void {
    if (this.pending.has(request.requestId)) {
      this.respondError(request, {
        code: 'PROTOCOL_INVALID_MESSAGE',
        message: 'requestId 已在使用。',
        retryable: false
      })
      return
    }

    const receivedAt = Date.now()
    const timer = setTimeout(() => {
      this.pending.delete(request.requestId)
      this.handledRequests += 1
      this.respondSuccess(request, {
        utilityGeneration: this.requiredConnection().utilityGeneration,
        receivedAt,
        respondedAt: Date.now()
      })
    }, request.payload.delayMs)

    this.pending.set(request.requestId, { name: 'system.ping', timer })
  }

  private snapshot(request: SnapshotRequestEnvelope): void {
    this.handledRequests += 1
    this.respondSuccess(request, {
      protocolVersion: PROTOCOL_VERSION,
      connectionId: this.requiredConnection().connectionId,
      utilityGeneration: this.requiredConnection().utilityGeneration,
      startedAt: this.startedAt,
      handledRequests: this.handledRequests,
      pendingRequestIds: [...this.pending.keys()]
    })
  }

  private cancel(envelope: CancelEnvelope): void {
    const pending = this.pending.get(envelope.requestId)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(envelope.requestId)
    this.respondError(envelope, {
      code: 'REQUEST_CANCELLED',
      message: '请求已取消。',
      retryable: false
    })
  }

  private respondSuccess(
    request: PingRequestEnvelope | SnapshotRequestEnvelope,
    data: unknown
  ): void {
    this.post({
      ...messageBase(request.connectionId),
      kind: 'response',
      name: request.name,
      requestId: request.requestId,
      result: { ok: true, data }
    })
  }

  private respondError(
    request: PingRequestEnvelope | SnapshotRequestEnvelope | CancelEnvelope,
    error: ProtocolError
  ): void {
    this.post({
      ...messageBase(request.connectionId),
      kind: 'response',
      name: request.name,
      requestId: request.requestId,
      result: { ok: false, error }
    })
  }

  private post(message: unknown): void {
    this.activePort?.postMessage(message)
  }

  private requiredConnection(): RuntimeConnectionMetadata {
    if (!this.activeConnection) throw new Error('Runtime connection is not available')
    return this.activeConnection
  }

  private replaceConnection(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    for (const request of this.pending.values()) clearTimeout(request.timer)
    this.pending.clear()
    this.activePort?.close()
    this.activePort = undefined
    this.activeConnection = undefined
    this.handshakeComplete = false
  }
}
