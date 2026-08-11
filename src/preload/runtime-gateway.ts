import type { RuntimeConnectionMetadata } from '../shared/contracts/control-plane'
import {
  AgentCommandSchema,
  AgentRuntimeEventSchema,
  AgentSnapshotSchema,
  type AgentCommand,
  type AgentRuntimeEvent,
  type AgentSnapshot
} from '../shared/schemas/agent'
import {
  AccountDataRequestSchema,
  AccountDataResultSchema,
  type AccountDataRequest,
  type AccountDataResult
} from '../shared/schemas/account-data'
import {
  MusicMutationPayloadSchema,
  MusicMutationResultSchema,
  MusicReadPayloadSchema,
  MusicReadResultSchema,
  ResolveTrackUrlPayloadSchema,
  ResolvedMediaSourceSchema,
  type MusicReadPayload,
  type MusicReadResult,
  type MusicMutationPayload,
  type MusicMutationResult,
  type ResolveTrackUrlPayload,
  type ResolvedMediaSource
} from '../shared/schemas/music'
import {
  PersistedPlaybackSnapshotSchema,
  PlaybackSnapshotLoadPayloadSchema,
  PlaybackSnapshotLoadResultSchema,
  PlaybackSnapshotSaveResultSchema,
  type PersistedPlaybackSnapshot,
  type PlaybackSnapshotLoadPayload
} from '../shared/schemas/playback-persistence'
import {
  VoiceRuntimeRequestSchema,
  VoiceRuntimeResultSchema,
  type VoiceRuntimeRequest,
  type VoiceRuntimeResult
} from '../shared/schemas/voice'
import {
  HelloEnvelopeSchema,
  AgentEventEnvelopeSchema,
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
  /** Renderer Agent 事件订阅者。 */
  private readonly agentListeners = new Set<(event: AgentRuntimeEvent) => void>()

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
          capabilities: [
            'system.ping',
            'system.snapshot',
            'music.read',
            'music.mutate',
            'music.resolve-url',
            'account.data',
            'playback.snapshot.load',
            'playback.snapshot.save',
            'voice.command',
            'agent.command'
          ]
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

  /** 向 Utility 发送一次不可透明重试的音乐写入请求。 */
  async mutateMusic(
    input: MusicMutationPayload & { requestId?: string }
  ): Promise<RuntimeResult<MusicMutationResult>> {
    const { requestId, ...payloadInput } = input
    const payload = MusicMutationPayloadSchema.safeParse(payloadInput)
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', '音乐写入请求参数不合法。')
    }
    const result = await this.request(
      'music.mutate',
      payload.data,
      requestId ?? crypto.randomUUID(),
      contractRegistry['music.mutate'].defaultTimeoutMs
    )
    if (!result.ok) return result
    const parsed = MusicMutationResultSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '音乐写入响应不符合契约。')
  }

  /** 从 Utility 当前账户 SQLite 读取播放快照。 */
  async loadPlaybackSnapshot(
    input: PlaybackSnapshotLoadPayload
  ): Promise<RuntimeResult<PersistedPlaybackSnapshot | null>> {
    const payload = PlaybackSnapshotLoadPayloadSchema.safeParse(input)
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', '播放快照读取参数不合法。')
    }
    const result = await this.request(
      'playback.snapshot.load',
      payload.data,
      crypto.randomUUID(),
      contractRegistry['playback.snapshot.load'].defaultTimeoutMs
    )
    if (!result.ok) return result
    const parsed = PlaybackSnapshotLoadResultSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data.snapshot }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '播放快照读取响应不符合契约。')
  }

  /** 通过 Utility 单写者保存当前账户播放快照。 */
  async savePlaybackSnapshot(
    snapshot: PersistedPlaybackSnapshot
  ): Promise<RuntimeResult<{ savedAt: number }>> {
    const parsedSnapshot = PersistedPlaybackSnapshotSchema.safeParse(snapshot)
    if (!parsedSnapshot.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', '播放快照保存参数不合法。')
    }
    const result = await this.request(
      'playback.snapshot.save',
      { snapshot: parsedSnapshot.data },
      crypto.randomUUID(),
      contractRegistry['playback.snapshot.save'].defaultTimeoutMs
    )
    if (!result.ok) return result
    const parsed = PlaybackSnapshotSaveResultSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '播放快照保存响应不符合契约。')
  }

  /** 通过 Utility 单写者访问当前账户业务数据。 */
  async accountData(input: AccountDataRequest): Promise<RuntimeResult<AccountDataResult>> {
    const payload = AccountDataRequestSchema.safeParse(input)
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', '账户数据请求参数不合法。')
    }
    const result = await this.request(
      'account.data',
      payload.data,
      crypto.randomUUID(),
      contractRegistry['account.data'].defaultTimeoutMs
    )
    if (!result.ok) return result
    const parsed = AccountDataResultSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '账户数据响应不符合契约。')
  }

  /** 查询 ASR 状态或转写一次内存录音。 */
  async voice(
    input: VoiceRuntimeRequest & { requestId?: string }
  ): Promise<RuntimeResult<VoiceRuntimeResult>> {
    /** 分离只用于协议取消的 requestId。 */
    const { requestId, ...payloadInput } = input
    /** 经共享 Schema 校验的语音请求。 */
    const payload = VoiceRuntimeRequestSchema.safeParse(payloadInput)
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', '语音请求参数不合法。')
    }
    /** Utility 返回的语音请求结果。 */
    const result = await this.request(
      'voice.command',
      payload.data,
      requestId ?? crypto.randomUUID(),
      contractRegistry['voice.command'].defaultTimeoutMs
    )
    if (!result.ok) return result
    /** 经共享 Schema 校验的公开语音结果。 */
    const parsed = VoiceRuntimeResultSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', '语音响应不符合契约。')
  }

  /** 发送 Agent 命令并校验完整快照响应。 */
  async agent(command: AgentCommand): Promise<RuntimeResult<AgentSnapshot>> {
    /** 经共享 Schema 校验的 Agent 命令。 */
    const payload = AgentCommandSchema.safeParse(command)
    if (!payload.success) {
      return protocolFailure('PROTOCOL_INVALID_MESSAGE', 'Agent 命令参数不合法。')
    }
    const result = await this.request(
      'agent.command',
      payload.data,
      crypto.randomUUID(),
      contractRegistry['agent.command'].defaultTimeoutMs
    )
    if (!result.ok) return result
    /** 经共享 Schema 校验的 Agent 快照。 */
    const parsed = AgentSnapshotSchema.safeParse(result.data)
    return parsed.success
      ? { ok: true, data: parsed.data }
      : protocolFailure('PROTOCOL_INVALID_MESSAGE', 'Agent 快照响应不符合契约。')
  }

  /** 订阅经 Preload 校验的 Agent 事件。 */
  onAgentEvent(listener: (event: AgentRuntimeEvent) => void): () => void {
    this.agentListeners.add(listener)
    return () => this.agentListeners.delete(listener)
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

    /** Utility 推送的 Agent 流式事件。 */
    const agentEvent = AgentEventEnvelopeSchema.safeParse(message)
    if (agentEvent.success && agentEvent.data.connectionId === this.metadata?.connectionId) {
      /** 二次校验后的公开事件。 */
      const event = AgentRuntimeEventSchema.parse(agentEvent.data.payload)
      for (const listener of this.agentListeners) listener(event)
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
