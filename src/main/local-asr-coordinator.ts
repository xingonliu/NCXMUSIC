import { randomUUID } from 'node:crypto'

import { utilityProcess, type UtilityProcess } from 'electron'

import type { LocalModelInstaller } from '../infrastructure/voice/local-model-installer'
import {
  LOCAL_ASR_PROTOCOL_VERSION,
  LocalAsrReportSchema,
  type LocalAsrCommand,
  type LocalAsrReport
} from '../shared/contracts/local-asr-process'
import type {
  VoiceLocalLoadMode,
  VoiceLocalPcmChunk,
  VoiceLocalSessionEnd,
  VoiceLocalSessionStart,
  VoiceServiceEvent,
  VoiceTranscriptionResult
} from '../shared/schemas/voice-settings'

// ========= 类型 =========

/** 本地 ASR 协调器依赖。 */
export interface LocalAsrCoordinatorOptions {
  /** 构建后的本地 ASR 子进程入口。 */
  readonly entryPath: string
  /** 模型安装管理器。 */
  readonly installer: LocalModelInstaller
  /** 读取当前加载策略。 */
  readonly loadMode: () => VoiceLocalLoadMode
  /** 发布增量转写事件。 */
  readonly publish: (event: VoiceServiceEvent) => void
}

/** Main 内存中的活动本地会话。 */
interface ActiveLocalSession {
  /** 会话 ID。 */
  readonly voiceSessionId: string
  /** 模型 ID。 */
  readonly modelId: VoiceLocalSessionStart['modelId']
  /** 子进程 ready Promise。 */
  readonly ready: Promise<void>
  /** 标记子进程 ready。 */
  readonly resolveReady: () => void
  /** 启动失败。 */
  readonly rejectReady: (error: Error) => void
  /** 最终结果 Promise。 */
  readonly result: Promise<VoiceTranscriptionResult>
  /** 返回最终结果。 */
  readonly resolveResult: (result: VoiceTranscriptionResult) => void
  /** 返回识别错误。 */
  readonly rejectResult: (error: Error) => void
}

// ========= 变量 =========

/** 按需加载会话结束后的短暂复用窗口。 */
const ON_DEMAND_IDLE_TIMEOUT_MS = 15_000

// ========= 类 =========

/** Main 管理本地识别 utilityProcess 的会话、异常和内存生命周期。 */
export class LocalAsrCoordinator {
  /** 当前 ASR 子进程。 */
  private host: UtilityProcess | undefined

  /** 当前子进程已加载的模型。 */
  private hostModelId: VoiceLocalSessionStart['modelId'] | undefined

  /** 当前唯一会话。 */
  private session: ActiveLocalSession | undefined

  /** 按需卸载计时器。 */
  private idleTimer: ReturnType<typeof setTimeout> | undefined

  /** 仅常驻模式使用的后台模型预热任务。 */
  private prewarmPromise: Promise<void> | undefined

  /** 后台预热使用的内部会话 ID。 */
  private prewarmSessionId: string | undefined

  /** 公开运行状态。 */
  private stateValue: {
    state: 'stopped' | 'starting' | 'ready' | 'recognizing' | 'failed'
    modelId?: VoiceLocalSessionStart['modelId'] | undefined
    message?: string | undefined
  } = { state: 'stopped' }

  constructor(private readonly options: LocalAsrCoordinatorOptions) {}

  /** 返回 Renderer 可见运行状态。 */
  snapshot(): typeof this.stateValue {
    return { ...this.stateValue }
  }

  /** 仅常驻模式后台加载所选模型；按需模式不会创建 ASR Host。 */
  async prewarm(modelId: VoiceLocalSessionStart['modelId']): Promise<void> {
    if (this.options.loadMode() !== 'resident' || !this.options.installer.isInstalled(modelId)) return
    this.clearIdleTimer()
    if (this.prewarmPromise) {
      await this.prewarmPromise
      if (this.hostModelId === modelId && this.stateValue.state === 'ready') return
    }
    if (this.session) return
    if (this.hostModelId === modelId && this.stateValue.state === 'ready') return
    /** 仅用于模型预热、不会接收用户音频的内部会话 ID。 */
    const voiceSessionId = randomUUID()
    /** 预热开始时刻，用于定位 Native 模型实际冷启动耗时。 */
    const startedAt = Date.now()
    this.prewarmSessionId = voiceSessionId
    /** 当前唯一预热任务。 */
    const task = this.start({ voiceSessionId, modelId, streaming: false })
      .then(() => {
        this.cancel({ voiceSessionId })
        console.info(`[LocalAsrCoordinator] 常驻模型预热完成: model=${modelId}, durationMs=${Date.now() - startedAt}`)
      })
      .catch((error: unknown) => {
        this.cancel({ voiceSessionId })
        console.warn('[LocalAsrCoordinator] 常驻模型预热失败:', error instanceof Error ? error.message : error)
      })
      .finally(() => {
        if (this.prewarmSessionId === voiceSessionId) {
          this.prewarmPromise = undefined
          this.prewarmSessionId = undefined
        }
      })
    this.prewarmPromise = task
    await task
  }

  /** 设置变化后同步模型生命周期，按需模式在空闲窗口后释放已有 Host。 */
  refreshLoadMode(): void {
    if (this.session) return
    if (this.options.loadMode() === 'resident') this.clearIdleTimer()
    else if (this.host) this.scheduleUnload()
  }

  /** 创建本地识别会话并等待模型就绪。 */
  async start(input: VoiceLocalSessionStart): Promise<void> {
    /** 正在进行的常驻模型预热。 */
    const pendingPrewarm = this.prewarmPromise
    if (pendingPrewarm && input.voiceSessionId !== this.prewarmSessionId) await pendingPrewarm
    if (this.session) throw new Error('已有本地语音识别正在进行。')
    if (!this.options.installer.isInstalled(input.modelId)) throw new Error('请先安装所选本地语音模型。')
    this.clearIdleTimer()
    if (!this.host || this.hostModelId !== input.modelId) {
      this.stopHost()
      this.spawnHost(input.modelId)
    }
    /** ready Promise 的解析函数。 */
    let resolveReady!: () => void
    /** ready Promise 的拒绝函数。 */
    let rejectReady!: (error: Error) => void
    /** 子进程 ready Promise。 */
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    /** result Promise 的解析函数。 */
    let resolveResult!: (result: VoiceTranscriptionResult) => void
    /** result Promise 的拒绝函数。 */
    let rejectResult!: (error: Error) => void
    /** 最终结果 Promise。 */
    const result = new Promise<VoiceTranscriptionResult>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })
    void result.catch(() => undefined)
    this.session = {
      voiceSessionId: input.voiceSessionId,
      modelId: input.modelId,
      ready,
      resolveReady,
      rejectReady,
      result,
      resolveResult,
      rejectResult
    }
    this.stateValue = { state: 'starting', modelId: input.modelId }
    this.post({
      type: 'start',
      protocolVersion: LOCAL_ASR_PROTOCOL_VERSION,
      voiceSessionId: input.voiceSessionId,
      modelId: input.modelId,
      modelDirectory: this.options.installer.modelDirectory(input.modelId),
      streaming: input.streaming
    })
    /** 模型加载最大等待。 */
    const timeout = setTimeout(() => rejectReady(new Error('本地模型加载超时。')), 60_000)
    try {
      await ready
    } catch (error) {
      this.cancel({ voiceSessionId: input.voiceSessionId })
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  /** 向活动会话发送 PCM 块。 */
  sendChunk(input: VoiceLocalPcmChunk): void {
    if (this.session?.voiceSessionId !== input.voiceSessionId) return
    this.post({ type: 'chunk', protocolVersion: LOCAL_ASR_PROTOCOL_VERSION, ...input })
  }

  /** 结束会话并等待最终识别结果。 */
  async finish(input: VoiceLocalSessionEnd): Promise<VoiceTranscriptionResult> {
    /** 当前会话。 */
    const session = this.session
    if (!session || session.voiceSessionId !== input.voiceSessionId) throw new Error('本地语音会话不存在。')
    this.post({ type: 'finish', protocolVersion: LOCAL_ASR_PROTOCOL_VERSION, voiceSessionId: input.voiceSessionId })
    return session.result
  }

  /** 取消本地识别并清理会话。 */
  cancel(input: VoiceLocalSessionEnd): void {
    /** 当前会话。 */
    const session = this.session
    if (!session || session.voiceSessionId !== input.voiceSessionId) return
    this.post({ type: 'cancel', protocolVersion: LOCAL_ASR_PROTOCOL_VERSION, voiceSessionId: input.voiceSessionId })
    /** 统一取消错误。 */
    const error = new Error('本地语音识别已取消。')
    session.rejectReady(error)
    session.rejectResult(error)
    this.session = undefined
    this.stateValue = { state: this.host ? 'ready' : 'stopped', ...(this.hostModelId ? { modelId: this.hostModelId } : {}) }
    this.scheduleUnload()
  }

  /** 在没有活动会话时卸载指定模型，供安全删除模型文件。 */
  unloadIfIdle(modelId: VoiceLocalSessionStart['modelId']): boolean {
    if (this.session?.modelId === modelId) return false
    if (this.hostModelId === modelId) this.stopHost()
    return true
  }

  /** 应用退出时停止子进程。 */
  shutdown(): void {
    this.clearIdleTimer()
    this.stopHost()
  }

  /** 创建并绑定本地 ASR 子进程。 */
  private spawnHost(modelId: VoiceLocalSessionStart['modelId']): void {
    /** 新子进程。 */
    const host = utilityProcess.fork(this.options.entryPath, [], {
      serviceName: 'NcxMusic Local Speech Recognition',
      stdio: 'pipe'
    })
    this.host = host
    this.hostModelId = modelId
    host.on('message', (message: unknown) => this.handleReport(message))
    host.once('exit', () => {
      if (this.host !== host) return
      this.host = undefined
      this.hostModelId = undefined
      /** 在途会话。 */
      const session = this.session
      this.session = undefined
      session?.rejectReady(new Error('本地语音识别进程意外退出。'))
      session?.rejectResult(new Error('本地语音识别进程意外退出。'))
      this.stateValue = { state: 'failed', message: '本地语音识别进程意外退出。' }
    })
  }

  /** 处理子进程的白名单报告。 */
  private handleReport(rawReport: unknown): void {
    /** 已校验报告。 */
    const parsed = LocalAsrReportSchema.safeParse(rawReport)
    if (!parsed.success) return
    /** 报告。 */
    const report: LocalAsrReport = parsed.data
    /** 当前会话。 */
    const session = this.session
    if (!session || session.voiceSessionId !== report.voiceSessionId) return
    if (report.type === 'ready') {
      this.stateValue = { state: 'recognizing', modelId: report.modelId }
      session.resolveReady()
      return
    }
    if (report.type === 'error') {
      /** 子进程公开错误。 */
      const error = new Error(report.message)
      session.rejectReady(error)
      session.rejectResult(error)
      this.session = undefined
      this.stateValue = { state: 'failed', modelId: session.modelId, message: report.message }
      this.scheduleUnload()
      return
    }
    this.options.publish({ type: 'transcript', voiceSessionId: report.voiceSessionId, text: report.text, isFinal: report.isFinal })
    if (!report.isFinal) return
    session.resolveResult({ voiceSessionId: report.voiceSessionId, text: report.text })
    this.session = undefined
    this.stateValue = { state: 'ready', modelId: session.modelId }
    this.scheduleUnload()
  }

  /** 向当前子进程发送命令。 */
  private post(command: LocalAsrCommand): void {
    if (!this.host) throw new Error('本地语音识别进程未启动。')
    this.host.postMessage(command)
  }

  /** 按加载策略安排模型卸载。 */
  private scheduleUnload(): void {
    this.clearIdleTimer()
    if (this.options.loadMode() === 'resident') return
    this.idleTimer = setTimeout(() => this.stopHost(), ON_DEMAND_IDLE_TIMEOUT_MS)
  }

  /** 清除按需卸载计时器。 */
  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = undefined
  }

  /** 结束子进程并更新稳定状态。 */
  private stopHost(): void {
    /** 待结束进程。 */
    const host = this.host
    this.host = undefined
    this.hostModelId = undefined
    host?.kill()
    this.stateValue = { state: 'stopped' }
  }
}
