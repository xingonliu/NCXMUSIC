import { totalmem } from 'node:os'

import type { VoiceSettingsStore } from '../infrastructure/credentials/voice-settings-store'
import type { LocalModelInstaller } from '../infrastructure/voice/local-model-installer'
import {
  LOCAL_VOICE_MODELS,
  localVoiceInstalledBytes
} from '../infrastructure/voice/local-model-catalog'
import type {
  VoiceCloudTranscriptionInput,
  VoiceLocalPcmChunk,
  VoiceLocalSessionEnd,
  VoiceLocalSessionStart,
  VoiceServiceEvent,
  VoiceSettingsRequest,
  VoiceSettingsResult,
  VoiceSettingsSnapshot,
  VoiceTranscriptionResult
} from '../shared/schemas/voice-settings'
import type { LocalAsrCoordinator } from './local-asr-coordinator'

// ========= 类型 =========

/** 语音设置协调器依赖。 */
export interface VoiceSettingsCoordinatorOptions {
  /** 加密设置仓库。 */
  readonly store: VoiceSettingsStore
  /** 本地模型安装器。 */
  readonly installer: LocalModelInstaller
  /** 本地 ASR 进程协调器。 */
  readonly localAsr: LocalAsrCoordinator
  /** 向所有 Renderer 发布事件。 */
  readonly publish: (event: VoiceServiceEvent) => void
}

// ========= 类 =========

/** 协调三种语音来源、本地模型安装与独立云端转写。 */
export class VoiceSettingsCoordinator {
  /** 在途云端请求。 */
  private readonly cloudRequests = new Map<string, AbortController>()

  /** 模型安装状态订阅清理函数。 */
  private readonly unsubscribeInstaller: () => void

  constructor(private readonly options: VoiceSettingsCoordinatorOptions) {
    this.unsubscribeInstaller = options.installer.onChange(() => {
      this.publishSnapshot()
      this.prewarmConfiguredModel()
    })
    this.prewarmConfiguredModel()
  }

  /** 读取或更新设置。 */
  request(input: VoiceSettingsRequest): VoiceSettingsResult {
    /** 操作结果提示。 */
    let message: string | undefined
    if (input.operation === 'setSource') this.options.store.setSource(input.source)
    else if (input.operation === 'setLocal') {
      this.options.store.setLocal(input.modelId, input.streaming, input.loadMode)
      this.options.localAsr.refreshLoadMode()
      this.prewarmConfiguredModel()
    }
    else if (input.operation === 'saveCloud') this.options.store.saveCloud(input.cloud)
    else if (input.operation === 'installModel') {
      this.options.installer.install(input.modelId)
      message = '模型已开始后台下载。'
    } else if (input.operation === 'cancelModelInstall') {
      this.options.installer.cancel(input.modelId)
      message = '已取消模型下载。'
    } else if (input.operation === 'removeModel') {
      if (!this.options.localAsr.unloadIfIdle(input.modelId)) throw new Error('该模型正在识别中，暂时不能删除。')
      this.options.installer.remove(input.modelId)
      message = '本地模型已删除。'
    }
    /** 最新公开快照。 */
    const snapshot = this.snapshot()
    this.options.publish({ type: 'snapshot', snapshot })
    return { snapshot, ...(message ? { message } : {}) }
  }

  /** 返回完整公开快照。 */
  snapshot(): VoiceSettingsSnapshot {
    /** 持久化设置。 */
    const settings = this.options.store.snapshot()
    /** 物理内存 GiB。 */
    const totalMemoryGiB = totalmem() / (1024 ** 3)
    return {
      source: settings.source,
      totalMemoryGiB: Math.round(totalMemoryGiB * 10) / 10,
      recommendedLocalModelId: totalMemoryGiB < 8 ? 'light' : 'accurate',
      local: {
        modelId: settings.localModelId,
        streaming: settings.localStreaming,
        loadMode: settings.localLoadMode
      },
      cloud: { ...settings.cloud, headerNames: [...settings.cloud.headerNames] },
      conversationStreaming: false,
      models: LOCAL_VOICE_MODELS.map((model) => {
        /** 当前安装状态。 */
        const install = this.options.installer.snapshot(model.id)
        return {
          id: model.id,
          name: model.name,
          description: model.description,
          version: model.version,
          languages: [...model.languages],
          streamMode: model.streamMode,
          downloadBytes: model.archiveBytes,
          installedBytes: localVoiceInstalledBytes(model),
          estimatedMemoryMiB: model.estimatedMemoryMiB,
          licenseName: model.licenseName,
          licenseUrl: model.licenseUrl,
          installState: install.state,
          ...(install.progress !== undefined ? { progress: install.progress } : {}),
          ...(install.downloadedBytes !== undefined ? { downloadedBytes: install.downloadedBytes } : {}),
          ...(install.error ? { error: install.error } : {})
        }
      }),
      localRuntime: this.options.localAsr.snapshot()
    }
  }

  /** 开始本地识别。 */
  startLocal(input: VoiceLocalSessionStart): Promise<void> {
    return this.options.localAsr.start(input)
  }

  /** 发送本地 PCM。 */
  sendLocalChunk(input: VoiceLocalPcmChunk): void {
    this.options.localAsr.sendChunk(input)
  }

  /** 完成本地识别。 */
  finishLocal(input: VoiceLocalSessionEnd): Promise<VoiceTranscriptionResult> {
    return this.options.localAsr.finish(input)
  }

  /** 取消本地识别。 */
  cancelLocal(input: VoiceLocalSessionEnd): void {
    this.options.localAsr.cancel(input)
  }

  /** 使用 OpenAI Transcriptions 兼容协议转写内存录音。 */
  async transcribeCloud(input: VoiceCloudTranscriptionInput): Promise<VoiceTranscriptionResult> {
    if (this.cloudRequests.has(input.voiceSessionId)) throw new Error('云端语音会话已存在。')
    /** Main 内独占的解密运行配置。 */
    const config = this.options.store.cloudRuntime()
    /** 请求取消器。 */
    const controller = new AbortController()
    this.cloudRequests.set(input.voiceSessionId, controller)
    try {
      /** multipart 表单。 */
      const form = new FormData()
      /** 独立的音频 ArrayBuffer。 */
      const audioBuffer = input.audio.slice().buffer
      form.append('file', new Blob([audioBuffer], { type: input.mimeType }), `speech.${mimeExtension(input.mimeType)}`)
      form.append('model', config.modelId)
      if (config.streaming) form.append('stream', 'true')
      /** OpenAI Transcriptions 兼容端点。 */
      const endpoint = `${config.baseUrl.replace(/\/+$/u, '')}/audio/transcriptions`
      /** 云端响应。 */
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { accept: config.streaming ? 'text/event-stream' : 'application/json', ...config.headers },
        body: form,
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`云端语音识别失败（HTTP ${response.status}）。`)
      /** 响应类型。 */
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      /** 最终文本。 */
      const text = config.streaming && contentType.includes('text/event-stream')
        ? await readTranscriptionStream(response, input.voiceSessionId, this.options.publish)
        : await readTranscriptionJson(response)
      return { voiceSessionId: input.voiceSessionId, text: text.trim() }
    } finally {
      input.audio.fill(0)
      this.cloudRequests.delete(input.voiceSessionId)
    }
  }

  /** 取消独立云端请求。 */
  cancelCloud(input: VoiceLocalSessionEnd): void {
    this.cloudRequests.get(input.voiceSessionId)?.abort()
  }

  /** 释放所有网络和进程资源。 */
  shutdown(): void {
    this.unsubscribeInstaller()
    for (const request of this.cloudRequests.values()) request.abort()
    this.cloudRequests.clear()
    this.options.localAsr.shutdown()
  }

  /** 广播最新设置和安装状态。 */
  private publishSnapshot(): void {
    this.options.publish({ type: 'snapshot', snapshot: this.snapshot() })
  }

  /** 仅常驻模式预热当前模型；按需模式不会启动本地 ASR 进程。 */
  private prewarmConfiguredModel(): void {
    /** 当前本地模型与加载策略。 */
    const settings = this.options.store.snapshot()
    if (settings.localLoadMode !== 'resident') return
    void this.options.localAsr.prewarm(settings.localModelId)
  }
}

// ========= 函数 =========

/** 读取非流式 JSON 转写。 */
async function readTranscriptionJson(response: Response): Promise<string> {
  /** 未信任 JSON。 */
  const body = await response.json() as unknown
  /** text 字段。 */
  const text = typeof body === 'object' && body ? Reflect.get(body, 'text') : undefined
  if (typeof text !== 'string') throw new Error('云端语音识别响应缺少文本。')
  return text
}

/** 解析 OpenAI Transcriptions SSE 增量事件。 */
async function readTranscriptionStream(
  response: Response,
  voiceSessionId: string,
  publish: (event: VoiceServiceEvent) => void
): Promise<string> {
  if (!response.body) throw new Error('云端语音识别没有返回数据流。')
  /** SSE 文本解码器。 */
  const decoder = new TextDecoder()
  /** Web Stream reader。 */
  const reader = response.body.getReader()
  /** 尚未形成完整事件的缓存。 */
  let buffer = ''
  /** 当前累计文本。 */
  let text = ''
  while (true) {
    /** 下一块响应。 */
    const chunk = await reader.read()
    buffer += decoder.decode(chunk.value, { stream: !chunk.done })
    if (chunk.done && buffer) buffer += '\n\n'
    /** 完整 SSE 事件。 */
    const events = buffer.split(/\r?\n\r?\n/u)
    buffer = events.pop() ?? ''
    for (const event of events) {
      /** data 行内容。 */
      const data = event.split(/\r?\n/u).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
      if (!data || data === '[DONE]') continue
      try {
        /** 未信任事件 JSON。 */
        const parsed = JSON.parse(data) as unknown
        /** 事件类型。 */
        const type = typeof parsed === 'object' && parsed ? Reflect.get(parsed, 'type') : undefined
        /** delta 或最终文本。 */
        const delta = typeof parsed === 'object' && parsed ? Reflect.get(parsed, 'delta') : undefined
        /** done 事件的 text。 */
        const finalText = typeof parsed === 'object' && parsed ? Reflect.get(parsed, 'text') : undefined
        if (type === 'transcript.text.delta' && typeof delta === 'string') text += delta
        else if (type === 'transcript.text.done' && typeof finalText === 'string') text = finalText
        else continue
        publish({ type: 'transcript', voiceSessionId, text, isFinal: type === 'transcript.text.done' })
      } catch {
        // 单个无效兼容事件不应泄露响应原文，也不终止后续合法事件。
      }
    }
    if (chunk.done) break
  }
  return text
}

/** 按 MIME 类型生成不含用户输入的文件后缀。 */
function mimeExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}
