import {
  ASR_UNSUPPORTED_MESSAGE,
  AsrSupportCache,
  transcribeWithProviderProfile,
  type ProviderProfile
} from '../infrastructure/provider/provider-protocol'
import {
  VoiceRuntimeRequestSchema,
  VoiceRuntimeResultSchema,
  type VoiceRuntimeResult
} from '../shared/schemas/voice'

// ========= 类 =========

/** Utility 内复用当前 Provider Profile 的单次云端 ASR 服务。 */
export class VoiceTranscriptionService {
  /** 当前 Provider Profile；秘密仅驻留 Utility 内存。 */
  private profile: ProviderProfile | undefined

  /** 按完整 Profile 指纹隔离的 ASR 能力缓存。 */
  private readonly supportCache = new AsrSupportCache()

  /** 正在上传或识别的请求取消器。 */
  private readonly activeRequests = new Map<string, AbortController>()

  // ========= 函数 =========

  /** Main 私有控制面注入或清除当前 Provider Profile。 */
  configure(profile: ProviderProfile | undefined): void {
    this.profile = profile
  }

  /** 查询能力状态或转写一次内存录音。 */
  async execute(requestId: string, rawPayload: unknown): Promise<VoiceRuntimeResult> {
    /** 经共享 Schema 校验的语音请求。 */
    const payload = VoiceRuntimeRequestSchema.parse(rawPayload)
    /** 当前执行 Profile 快照。 */
    const profile = this.profile
    if (payload.operation === 'status') {
      /** 当前 Profile 对应的能力缓存。 */
      const cached = profile ? this.supportCache.get(profile) : null
      return VoiceRuntimeResultSchema.parse({
        operation: 'status',
        configured: Boolean(profile),
        capability: cached?.status ?? 'unknown',
        ...(!profile ? { message: '请先配置当前大模型。' } : {}),
        ...(cached?.status === 'unsupported' ? { message: ASR_UNSUPPORTED_MESSAGE } : {})
      })
    }

    if (!profile) {
      payload.audio.fill(0)
      throw Object.assign(new Error('请先配置当前大模型。'), { code: 'CAPABILITY_UNAVAILABLE' })
    }
    /** 本次上传与识别的独立取消器。 */
    const controller = new AbortController()
    this.activeRequests.set(requestId, controller)
    try {
      /** Provider 协议层已保证 finally 清零原始音频。 */
      const result = await transcribeWithProviderProfile({
        profile,
        audio: payload.audio,
        mimeType: payload.mimeType,
        cache: this.supportCache,
        signal: controller.signal
      })
      if (result.status === 'unsupported') {
        return VoiceRuntimeResultSchema.parse({
          operation: 'transcribe',
          status: 'unsupported',
          message: result.message
        })
      }
      return VoiceRuntimeResultSchema.parse({
        operation: 'transcribe',
        status: 'transcribed',
        text: result.text
      })
    } finally {
      this.activeRequests.delete(requestId)
      payload.audio.fill(0)
    }
  }

  /** 取消指定 ASR 请求。 */
  cancel(requestId: string): void {
    this.activeRequests.get(requestId)?.abort('voice-request-cancelled')
  }

  /** Utility 退出前取消全部请求并清空能力缓存。 */
  shutdown(): void {
    for (const controller of this.activeRequests.values()) controller.abort('utility-shutdown')
    this.activeRequests.clear()
    this.supportCache.clear()
    this.profile = undefined
  }
}
