import type { RuntimeConnectionMetadata } from '../shared/contracts/control-plane'
import {
  AccountDataRequestEnvelopeSchema,
  HelloEnvelopeSchema,
  ExecuteShellRequestEnvelopeSchema,
  MusicMutationRequestEnvelopeSchema,
  MusicReadRequestEnvelopeSchema,
  PlaybackSnapshotLoadRequestEnvelopeSchema,
  PlaybackSnapshotSaveRequestEnvelopeSchema,
  PingRequestEnvelopeSchema,
  PROTOCOL_VERSION,
  ResolveTrackUrlRequestEnvelopeSchema,
  RuntimeInboundEnvelopeSchema,
  SnapshotRequestEnvelopeSchema,
  messageBase,
  type CancelEnvelope,
  type AccountDataRequestEnvelope,
  type ExecuteShellRequestEnvelope,
  type MusicMutationRequestEnvelope,
  type MusicReadRequestEnvelope,
  type PlaybackSnapshotLoadRequestEnvelope,
  type PlaybackSnapshotSaveRequestEnvelope,
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

/** Runtime 能力名称。 */
type RuntimeCapability =
  | 'system.ping'
  | 'system.snapshot'
  | 'music.read'
  | 'music.mutate'
  | 'music.resolve-url'
  | 'account.data'
  | 'playback.snapshot.load'
  | 'playback.snapshot.save'
  | 'shell.execute'

/**
 * music.read 的执行方。由 Utility 组合根注入，
 * 使 RuntimeServer 不直接依赖网易云 API 或实体池。
 */
export interface MusicReadHandler {
  /** 执行账户感知的只读音乐请求。 */
  read(requestId: string, payload: unknown): Promise<unknown>
  /** 执行账户感知且不可透明重试的音乐写入请求。 */
  mutate(requestId: string, payload: unknown): Promise<unknown>
  /** 取消进行中的只读音乐请求。 */
  cancel(requestId: string): void
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

/** 播放快照 SQLite 读写执行方。 */
export interface PlaybackSnapshotHandler {
  /** 读取当前账户播放快照。 */
  load(payload: unknown): Promise<unknown>
  /** 保存当前账户播放快照。 */
  save(payload: unknown): Promise<unknown>
}

/** 当前账户数据、偏好、Journal 与缓存操作执行方。 */
export interface AccountDataHandler {
  /** 执行已通过协议 Schema 校验的账户数据请求。 */
  execute(payload: unknown): Promise<unknown>
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
  | MusicReadRequestEnvelope
  | MusicMutationRequestEnvelope
  | AccountDataRequestEnvelope
  | ResolveTrackUrlRequestEnvelope
  | PlaybackSnapshotLoadRequestEnvelope
  | PlaybackSnapshotSaveRequestEnvelope
  | ExecuteShellRequestEnvelope

/** 待处理请求：ping 用定时器，resolve-url 交由 handler 自行取消 */
type PendingRequest =
  | { name: 'system.ping'; timer: ReturnType<typeof setTimeout> }
  | { name: 'music.read' }
  | { name: 'music.mutate' }
  | { name: 'music.resolve-url' }
  | { name: 'account.data' }
  | { name: 'playback.snapshot.load' }
  | { name: 'playback.snapshot.save' }
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
   * @param musicReadHandler music.read 的执行方；未注入时该能力返回 CAPABILITY_UNAVAILABLE
   * @param playbackSnapshotHandler 播放快照 SQLite 读写执行方
   * @param accountDataHandler 账户数据、偏好、Journal 与缓存执行方
   */
  constructor(
    private readonly trackUrlHandler?: TrackUrlHandler,
    private readonly shellHandler?: ShellCommandHandler | ShellExecutor,
    private readonly musicReadHandler?: MusicReadHandler,
    private readonly playbackSnapshotHandler?: PlaybackSnapshotHandler,
    private readonly accountDataHandler?: AccountDataHandler
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
  private capabilities(): RuntimeCapability[] {
    const base: RuntimeCapability[] = [
      'system.ping',
      'system.snapshot'
    ]
    if (this.musicReadHandler) base.push('music.read', 'music.mutate')
    if (this.trackUrlHandler) base.push('music.resolve-url')
    if (this.accountDataHandler) base.push('account.data')
    if (this.playbackSnapshotHandler) {
      base.push('playback.snapshot.load', 'playback.snapshot.save')
    }
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

    if (envelope.name === 'music.read') {
      void this.readMusic(MusicReadRequestEnvelopeSchema.parse(envelope))
      return
    }

    if (envelope.name === 'music.mutate') {
      void this.mutateMusic(MusicMutationRequestEnvelopeSchema.parse(envelope))
      return
    }

    if (envelope.name === 'music.resolve-url') {
      void this.resolveTrackUrl(ResolveTrackUrlRequestEnvelopeSchema.parse(envelope))
      return
    }

    if (envelope.name === 'playback.snapshot.load') {
      void this.loadPlaybackSnapshot(PlaybackSnapshotLoadRequestEnvelopeSchema.parse(envelope))
      return
    }

    if (envelope.name === 'account.data') {
      void this.handleAccountData(AccountDataRequestEnvelopeSchema.parse(envelope))
      return
    }

    if (envelope.name === 'playback.snapshot.save') {
      void this.savePlaybackSnapshot(PlaybackSnapshotSaveRequestEnvelopeSchema.parse(envelope))
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
   * 处理 music.read：委托给注入的 Music Service。
   * 返回值只允许标准音乐实体 DTO，不包含 Cookie、数据库路径或上游原始响应。
   */
  private async readMusic(request: MusicReadRequestEnvelope): Promise<void> {
    const handler = this.musicReadHandler
    if (!handler) {
      this.respondError(request, {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '当前运行时未启用 Music Service。',
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
    this.pending.set(request.requestId, { name: 'music.read' })

    try {
      const data = await handler.read(request.requestId, request.payload)
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

  /** 处理 music.mutate：显式执行写操作且不在协议层重试。 */
  private async mutateMusic(request: MusicMutationRequestEnvelope): Promise<void> {
    const handler = this.musicReadHandler
    if (!handler) {
      this.respondError(request, {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '当前运行时未启用 Music Service。',
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
    this.pending.set(request.requestId, { name: 'music.mutate' })
    try {
      const data = await handler.mutate(request.requestId, request.payload)
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

  /** 从 Utility 当前账户 SQLite 读取播放快照。 */
  private async loadPlaybackSnapshot(request: PlaybackSnapshotLoadRequestEnvelope): Promise<void> {
    await this.handlePlaybackSnapshotRequest(request, 'playback.snapshot.load', (handler) =>
      handler.load(request.payload)
    )
  }

  /** 通过 Utility 当前账户 SQLite 保存播放快照。 */
  private async savePlaybackSnapshot(request: PlaybackSnapshotSaveRequestEnvelope): Promise<void> {
    await this.handlePlaybackSnapshotRequest(request, 'playback.snapshot.save', (handler) =>
      handler.save(request.payload)
    )
  }

  /** 通过 Utility 单写者执行账户数据操作。 */
  private async handleAccountData(request: AccountDataRequestEnvelope): Promise<void> {
    const handler = this.accountDataHandler
    if (!handler) {
      this.respondError(request, {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '当前运行时未启用账户数据服务。',
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
    this.pending.set(request.requestId, { name: 'account.data' })
    try {
      const data = await handler.execute(request.payload)
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

  /** 统一执行播放快照请求并处理连接替换与脱敏错误。 */
  private async handlePlaybackSnapshotRequest(
    request: PlaybackSnapshotLoadRequestEnvelope | PlaybackSnapshotSaveRequestEnvelope,
    name: 'playback.snapshot.load' | 'playback.snapshot.save',
    operation: (handler: PlaybackSnapshotHandler) => Promise<unknown>
  ): Promise<void> {
    const handler = this.playbackSnapshotHandler
    if (!handler) {
      this.respondError(request, {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '当前运行时未启用播放快照持久化。',
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
    this.pending.set(request.requestId, { name })
    try {
      const data = await operation(handler)
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
    const rawError = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : undefined
    const code = rawError && 'code' in rawError ? String(rawError['code']) : ''
    const errorMessage = rawError && typeof rawError['message'] === 'string' && rawError['message'].trim() ? rawError['message'].trim() : ''

    if (code === 'PROTOCOL_INVALID_MESSAGE') {
      return {
        code: 'PROTOCOL_INVALID_MESSAGE',
        message: '运行时请求参数不合法。',
        retryable: false
      }
    }
    if (code === 'CONNECTION_REPLACED' || code === 'ACCOUNT_STALE') {
      return {
        code: 'CONNECTION_REPLACED',
        message: '账户或运行时连接已切换，请重新读取当前状态。',
        retryable: true
      }
    }
    if (code === 'ABORT_ERR' || (error instanceof Error && error.name === 'AbortError')) {
      return { code: 'REQUEST_CANCELLED', message: '请求已取消。', retryable: false }
    }
    if (code === 'UPSTREAM_ERROR') {
      /** 网易云 HTTP 状态。 */
      const httpStatus = rawError && typeof rawError['httpStatus'] === 'number'
        ? rawError['httpStatus']
        : undefined
      /** 网易云业务 code。 */
      const upstreamCode = rawError && typeof rawError['upstreamCode'] === 'number'
        ? rawError['upstreamCode']
        : undefined
      const retryable =
        rawError && 'retryable' in rawError ? Boolean(rawError['retryable']) : true
      /** 只包含离散数值的安全错误详情。 */
      const details = {
        runtimeCode: code,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(upstreamCode !== undefined ? { upstreamCode } : {})
      }
      if (upstreamCode === 301 || httpStatus === 301) {
        return {
          code: 'AUTH_REQUIRED',
          message: '登录状态已失效，请重新登录。',
          retryable: false,
          details
        }
      }
      if (upstreamCode === -2) {
        return {
          code: 'ALREADY_COMPLETED',
          message: '今日已签到。',
          retryable: false,
          details
        }
      }
      if (httpStatus === 429 || (httpStatus !== undefined && httpStatus >= 500)) {
        return {
          code: 'SERVICE_UNAVAILABLE',
          message: '网易云服务暂不可用，请稍后再试。',
          retryable: true,
          details
        }
      }
      return {
        code: 'UPSTREAM_ERROR',
        message: errorMessage || '网易云服务请求失败，请稍后重试或检查登录状态。',
        retryable,
        details
      }
    }
    if (code === 'NO_ACTIVE_LEASE') {
      return {
        code: 'CAPABILITY_UNAVAILABLE',
        message: '尚未登录或凭据租约已失效，无法获取播放地址。',
        retryable: false
      }
    }
    if (code === 'AUTH_REQUIRED') {
      return {
        code: 'AUTH_REQUIRED',
        message: errorMessage || '此操作需要先登录网易云账户。',
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

    if (rawError && ('status' in rawError || 'body' in rawError)) {
      const body = typeof rawError['body'] === 'object' && rawError['body'] !== null ? (rawError['body'] as Record<string, unknown>) : {}
      const upstreamCode = body['code']
      const msg = typeof body['msg'] === 'string' && body['msg'].trim() ? body['msg'].trim() : typeof body['message'] === 'string' && body['message'].trim() ? body['message'].trim() : ''
      if (upstreamCode === 301 || rawError['status'] === 301) {
        return {
          code: 'AUTH_REQUIRED',
          message: msg || '登录状态已失效，请重新登录。',
          retryable: false,
          details: {
            runtimeCode: code || 'UPSTREAM_RESPONSE',
            ...(typeof rawError['status'] === 'number' ? { httpStatus: rawError['status'] } : {}),
            ...(typeof upstreamCode === 'number' ? { upstreamCode } : {})
          }
        }
      }
      if (upstreamCode === -2) {
        return {
          code: 'ALREADY_COMPLETED',
          message: msg || '今日已签到。',
          retryable: false,
          details: { runtimeCode: code || 'UPSTREAM_RESPONSE', upstreamCode: -2 }
        }
      }
      return {
        code: 'UPSTREAM_ERROR',
        message: msg || '网易云服务请求失败，请稍后重试或检查登录状态。',
        retryable: rawError['status'] === 429 || (typeof rawError['status'] === 'number' && rawError['status'] >= 500),
        details: {
          runtimeCode: code || 'UPSTREAM_RESPONSE',
          ...(typeof rawError['status'] === 'number' ? { httpStatus: rawError['status'] } : {}),
          ...(typeof upstreamCode === 'number' ? { upstreamCode } : {})
        }
      }
    }

    return { code: 'UTILITY_UNAVAILABLE', message: '本地服务请求失败。', retryable: true }
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
    } else if (pending.name === 'music.read' || pending.name === 'music.mutate') {
      this.musicReadHandler?.cancel(envelope.requestId)
    } else if (pending.name === 'music.resolve-url') {
      this.trackUrlHandler?.cancel(envelope.requestId)
    } else if (pending.name === 'shell.execute') {
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
      } else if (request.name === 'music.read' || request.name === 'music.mutate') {
        this.musicReadHandler?.cancel(requestId)
      } else if (request.name === 'music.resolve-url') {
        this.trackUrlHandler?.cancel(requestId)
      } else if (request.name === 'shell.execute') {
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
