import type { RuntimeConnectionMetadata } from '../shared/contracts/control-plane'
import {
  HelloEnvelopeSchema,
  ExecuteShellRequestEnvelopeSchema,
  PingRequestEnvelopeSchema,
  PROTOCOL_VERSION,
  ResolveTrackUrlRequestEnvelopeSchema,
  RuntimeInboundEnvelopeSchema,
  SnapshotRequestEnvelopeSchema,
  messageBase,
  type CancelEnvelope,
  type ExecuteShellRequestEnvelope,
  type PingRequestEnvelope,
  type ProtocolError,
  type ResolveTrackUrlRequestEnvelope,
  type SnapshotRequestEnvelope
} from '../shared/schemas/runtime'
import type { ShellExecutor } from '../infrastructure/shell/executor'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimePort {
  postMessage(message: unknown): void
  subscribe(listener: (message: unknown) => void): () => void
  start(): void
  close(): void
}

/**
 * music.resolve-url 的执行方。由 Utility 组合根注入，
 * 使 RuntimeServer 不直接依赖凭据租约与网易云 API。
 */
export interface TrackUrlHandler {
  /** 解析播放 URL；失败时抛出携带 code 的 Error */
  resolve(requestId: string, payload: unknown): Promise<unknown>
  /** 取消进行中的解析 */
  cancel(requestId: string): void
}

export interface ShellCommandHandler {
  /** 执行经过策略网关判定的 Shell 命令。 */
  execute(requestId: string, payload: unknown): Promise<unknown>
  /** 取消进行中的 Shell 命令并回收进程树。 */
  cancel(requestId: string): void
}

/** 可被响应的请求信封（用于统一 respond* 签名） */
type AnyRequestEnvelope =
  | PingRequestEnvelope
  | SnapshotRequestEnvelope
  | ResolveTrackUrlRequestEnvelope
  | ExecuteShellRequestEnvelope

/** 待处理请求：ping 用定时器，resolve-url 交由 handler 自行取消 */
type PendingRequest =
  | { name: 'system.ping'; timer: ReturnType<typeof setTimeout> }
  | { name: 'music.resolve-url' }
  | { name: 'shell.execute' }

// ─────────────────────────────────────────────────────────────────────────────
// UtilityRuntimeServer
// ─────────────────────────────────────────────────────────────────────────────

export class UtilityRuntimeServer {
  // ── 变量区 ──
  private readonly startedAt = Date.now()
  private activeConnection: RuntimeConnectionMetadata | undefined
  private activePort: RuntimePort | undefined
  private unsubscribe: (() => void) | undefined
  private readonly pending = new Map<string, PendingRequest>()
  private handledRequests = 0
  private handshakeComplete = false

  /**
   * @param trackUrlHandler music.resolve-url 的执行方；未注入时该能力返回 CAPABILITY_UNAVAILABLE
   * @param shellHandler shell.execute 的执行方；未注入时该能力返回 CAPABILITY_UNAVAILABLE
   */
  constructor(
    private readonly trackUrlHandler?: TrackUrlHandler,
    private readonly shellHandler?: ShellCommandHandler | ShellExecutor
  ) {}

  // ── 生命周期区 ──

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
          capabilities: this.capabilities()
        }
      })
    )
  }

  shutdown(): void {
    this.replaceConnection()
  }

  // ── 函数区 ──

  /** 当前 Utility 实际提供的能力集合 */
  private capabilities(): Array<'system.ping' | 'system.snapshot' | 'music.resolve-url' | 'shell.execute'> {
    const base: Array<'system.ping' | 'system.snapshot' | 'music.resolve-url' | 'shell.execute'> = [
      'system.ping',
      'system.snapshot'
    ]
    if (this.trackUrlHandler) base.push('music.resolve-url')
    if (this.shellHandler) base.push('shell.execute')
    return base
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

    if (envelope.name === 'music.resolve-url') {
      void this.resolveTrackUrl(ResolveTrackUrlRequestEnvelopeSchema.parse(envelope))
      return
    }

    if (envelope.name === 'shell.execute') {
      void this.executeShell(ExecuteShellRequestEnvelopeSchema.parse(envelope))
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

  /**
   * 处理 music.resolve-url：委托给注入的 handler。
   * 错误一律转换为脱敏的 ProtocolError，绝不把 URL 或上游原文回传。
   */
  private async resolveTrackUrl(request: ResolveTrackUrlRequestEnvelope): Promise<void> {
    const handler = this.trackUrlHandler
    if (!handler) {
      this.respondError(request, {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '当前运行时未启用播放地址解析能力。',
        retryable: false
      })
      return
    }

    if (this.pending.has(request.requestId)) {
      this.respondError(request, {
        code: 'PROTOCOL_INVALID_MESSAGE',
        message: 'requestId 已在使用。',
        retryable: false
      })
      return
    }

    // 记录连接身份，避免解析期间连接被替换后向新连接误发响应
    const connectionId = request.connectionId
    this.pending.set(request.requestId, { name: 'music.resolve-url' })

    try {
      const data = await handler.resolve(request.requestId, request.payload)
      if (!this.isCurrentRequest(request.requestId, connectionId)) return
      this.pending.delete(request.requestId)
      this.handledRequests += 1
      this.respondSuccess(request, data)
    } catch (error) {
      if (!this.isCurrentRequest(request.requestId, connectionId)) return
      this.pending.delete(request.requestId)
      this.handledRequests += 1
      this.respondError(request, this.toProtocolError(error))
    }
  }

  /** 执行 shell.execute：委托给 ShellExecutor 并保证连接替换后不误发响应。 */
  private async executeShell(request: ExecuteShellRequestEnvelope): Promise<void> {
    const handler = this.shellHandler
    if (!handler) {
      this.respondError(request, {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '当前运行时未启用 Shell 执行能力。',
        retryable: false
      })
      return
    }

    if (this.pending.has(request.requestId)) {
      this.respondError(request, {
        code: 'PROTOCOL_INVALID_MESSAGE',
        message: 'requestId 已在使用。',
        retryable: false
      })
      return
    }

    const connectionId = request.connectionId
    this.pending.set(request.requestId, { name: 'shell.execute' })

    try {
      const data = await handler.execute(request.requestId, request.payload)
      if (!this.isCurrentRequest(request.requestId, connectionId)) return
      this.pending.delete(request.requestId)
      this.handledRequests += 1
      this.respondSuccess(request, data)
    } catch (error) {
      if (!this.isCurrentRequest(request.requestId, connectionId)) return
      this.pending.delete(request.requestId)
      this.handledRequests += 1
      this.respondError(request, this.toProtocolError(error))
    }
  }

  /** 请求是否仍属于当前连接且未被取消 */
  private isCurrentRequest(requestId: string, connectionId: string): boolean {
    return (
      this.activeConnection?.connectionId === connectionId && this.pending.has(requestId)
    )
  }

  /** 将内部错误映射为脱敏协议错误 */
  private toProtocolError(error: unknown): ProtocolError {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : ''

    if (code === 'PROTOCOL_INVALID_MESSAGE') {
      return {
        code: 'PROTOCOL_INVALID_MESSAGE',
        message: '播放地址解析参数不合法。',
        retryable: false
      }
    }
    if (code === 'ABORT_ERR' || (error instanceof Error && error.name === 'AbortError')) {
      return { code: 'REQUEST_CANCELLED', message: '播放地址解析已取消。', retryable: false }
    }
    if (code === 'NO_ACTIVE_LEASE') {
      return {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '尚未登录或凭据租约已失效，无法获取播放地址。',
        retryable: false
      }
    }
    if (code === 'track-unavailable') {
      return { code: 'CAPABILITY_UNAVAILABLE', message: '该曲目当前不可播放。', retryable: false }
    }
    if (code === 'account-unavailable') {
      return {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '当前账号没有该曲目的播放权限。',
        retryable: false
      }
    }
    return { code: 'UTILITY_UNAVAILABLE', message: '播放地址解析失败。', retryable: true }
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

    if (pending.name === 'system.ping') {
      clearTimeout(pending.timer)
    } else if (pending.name === 'music.resolve-url') {
      this.trackUrlHandler?.cancel(envelope.requestId)
    } else {
      this.shellHandler?.cancel(envelope.requestId)
    }
    this.pending.delete(envelope.requestId)
    this.respondError(envelope, {
      code: 'REQUEST_CANCELLED',
      message: '请求已取消。',
      retryable: false
    })
  }

  private respondSuccess(request: AnyRequestEnvelope, data: unknown): void {
    this.post({
      ...messageBase(request.connectionId),
      kind: 'response',
      name: request.name,
      requestId: request.requestId,
      result: { ok: true, data }
    })
  }

  private respondError(
    request: AnyRequestEnvelope | CancelEnvelope,
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
    for (const [requestId, request] of this.pending) {
      if (request.name === 'system.ping') {
        clearTimeout(request.timer)
      } else if (request.name === 'music.resolve-url') {
        this.trackUrlHandler?.cancel(requestId)
      } else {
        this.shellHandler?.cancel(requestId)
      }
    }
    this.pending.clear()
    this.activePort?.close()
    this.activePort = undefined
    this.activeConnection = undefined
    this.handshakeComplete = false
  }
}
