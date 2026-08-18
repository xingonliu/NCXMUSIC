import { join } from 'node:path'

import { OfflineRecognizer, OnlineRecognizer, Vad, type OfflineStream, type OnlineStream } from 'sherpa-onnx-node'

import {
  LOCAL_ASR_PROTOCOL_VERSION,
  LocalAsrCommandSchema,
  type LocalAsrCommand,
  type LocalAsrReport
} from '../shared/contracts/local-asr-process'

// ========= 类型 =========

/** Electron utilityProcess 提供的父进程消息端口。 */
interface ProcessPort {
  /** 订阅父进程消息。 */
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  /** 向父进程发布报告。 */
  postMessage(message: unknown): void
}

/** 当前在线会话。 */
interface OnlineSession {
  /** 会话 ID。 */
  readonly voiceSessionId: string
  /** 在线识别器。 */
  readonly recognizer: OnlineRecognizer
  /** 在线识别流。 */
  readonly stream: OnlineStream
  /** 是否发布增量文本。 */
  readonly streaming: boolean
  /** 最近发布文本。 */
  lastText: string
}

/** 当前 SenseVoice 会话。 */
interface SenseVoiceSession {
  /** 会话 ID。 */
  readonly voiceSessionId: string
  /** 离线识别器。 */
  readonly recognizer: OfflineRecognizer
  /** Silero VAD。 */
  readonly vad: Vad
  /** 是否发布片段文本。 */
  readonly streaming: boolean
  /** 完整录音副本，仅用于 VAD 没有产出时兜底。 */
  readonly allChunks: Float32Array[]
  /** 片段串行解码链。 */
  decodeQueue: Promise<void>
  /** 已识别片段。 */
  texts: string[]
}

/** 当前唯一识别会话。 */
type ActiveSession = OnlineSession | SenseVoiceSession

// ========= 变量 =========

/** Main 父进程端口。 */
const parentPort = process.parentPort as ProcessPort | undefined

/** 当前唯一会话。 */
let activeSession: ActiveSession | undefined

/** 当前进程缓存的模型识别器，常驻模式复用其 Native 权重。 */
let cachedRecognizer: { modelId: 'light'; recognizer: OnlineRecognizer } | { modelId: 'accurate'; recognizer: OfflineRecognizer } | undefined

// ========= 函数 =========

/** 向 Main 发布经协议约束的报告。 */
function post(report: LocalAsrReport): void {
  parentPort?.postMessage(report)
}

/** 判断会话是否为在线 Zipformer。 */
function isOnlineSession(session: ActiveSession): session is OnlineSession {
  return 'stream' in session
}

/** 创建并加载指定模型会话。 */
function start(command: Extract<LocalAsrCommand, { type: 'start' }>): void {
  if (activeSession) throw new Error('本地识别进程已有活动会话。')
  /** 当前会话是否直接复用已加载的 Native 识别器。 */
  const reusedRecognizer = cachedRecognizer?.modelId === command.modelId
  /** Native 识别器与会话创建开始时刻。 */
  const startedAt = Date.now()
  if (command.modelId === 'light') {
    /** 在线识别器。 */
    const recognizer = cachedRecognizer?.modelId === 'light' ? cachedRecognizer.recognizer : new OnlineRecognizer({
      featConfig: { sampleRate: 16_000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: join(command.modelDirectory, 'encoder.int8.onnx'),
          decoder: join(command.modelDirectory, 'decoder.onnx'),
          joiner: join(command.modelDirectory, 'joiner.int8.onnx')
        },
        tokens: join(command.modelDirectory, 'tokens.txt'),
        numThreads: 2,
        provider: 'cpu'
      },
      decodingMethod: 'greedy_search',
      enableEndpoint: 1
    })
    cachedRecognizer = { modelId: 'light', recognizer }
    activeSession = {
      voiceSessionId: command.voiceSessionId,
      recognizer,
      stream: recognizer.createStream(),
      streaming: command.streaming,
      lastText: ''
    }
  } else {
    /** SenseVoice 识别器。 */
    const recognizer = cachedRecognizer?.modelId === 'accurate' ? cachedRecognizer.recognizer : new OfflineRecognizer({
      featConfig: { sampleRate: 16_000, featureDim: 80 },
      modelConfig: {
        senseVoice: {
          model: join(command.modelDirectory, 'model.int8.onnx'),
          language: 'auto',
          useInverseTextNormalization: 1
        },
        tokens: join(command.modelDirectory, 'tokens.txt'),
        numThreads: 2,
        provider: 'cpu'
      }
    })
    cachedRecognizer = { modelId: 'accurate', recognizer }
    /** Silero VAD。 */
    const vad = new Vad({
      sileroVad: {
        model: join(command.modelDirectory, 'silero_vad.onnx'),
        threshold: 0.5,
        minSilenceDuration: 0.8,
        minSpeechDuration: 0.2,
        windowSize: 512,
        maxSpeechDuration: 30
      },
      sampleRate: 16_000,
      numThreads: 1,
      provider: 'cpu'
    }, 60)
    activeSession = {
      voiceSessionId: command.voiceSessionId,
      recognizer,
      vad,
      streaming: command.streaming,
      allChunks: [],
      decodeQueue: Promise.resolve(),
      texts: []
    }
  }
  console.info(`[LocalAsr] 模型会话就绪: model=${command.modelId}, reused=${reusedRecognizer}, durationMs=${Date.now() - startedAt}`)
  post({
    type: 'ready',
    protocolVersion: LOCAL_ASR_PROTOCOL_VERSION,
    voiceSessionId: command.voiceSessionId,
    modelId: command.modelId
  })
}

/** 接收 PCM 块并执行在线解码或 VAD 分段。 */
function acceptChunk(command: Extract<LocalAsrCommand, { type: 'chunk' }>): void {
  /** 活动会话。 */
  const session = activeSession
  if (!session || session.voiceSessionId !== command.voiceSessionId) return
  if (isOnlineSession(session)) {
    session.stream.acceptWaveform({ samples: command.samples, sampleRate: command.sampleRate })
    while (session.recognizer.isReady(session.stream)) session.recognizer.decode(session.stream)
    publishOnlineText(session, false)
    return
  }
  if (totalSamples(session.allChunks) < 16_000 * 300) session.allChunks.push(command.samples.slice())
  session.vad.acceptWaveform(command.samples)
  queueVadSegments(session)
}

/** 把当前 VAD 输出按顺序加入 SenseVoice 解码队列。 */
function queueVadSegments(session: SenseVoiceSession): void {
  while (!session.vad.isEmpty()) {
    /** 从 Native 缓冲复制出的独立语音段。 */
    const samples = session.vad.front(false).samples.slice()
    session.vad.pop()
    session.decodeQueue = session.decodeQueue.then(async () => {
      /** 单段识别文本。 */
      const text = await decodeSenseVoice(session.recognizer, samples)
      if (!text) return
      session.texts.push(text)
      if (session.streaming) publishSenseVoiceText(session, false)
    })
  }
}

/** 完成当前会话并发布最终文本。 */
async function finish(command: Extract<LocalAsrCommand, { type: 'finish' }>): Promise<void> {
  /** 活动会话。 */
  const session = activeSession
  if (!session || session.voiceSessionId !== command.voiceSessionId) return
  if (isOnlineSession(session)) {
    session.stream.inputFinished()
    while (session.recognizer.isReady(session.stream)) session.recognizer.decode(session.stream)
    publishOnlineText(session, true)
    activeSession = undefined
    return
  }
  session.vad.flush()
  queueVadSegments(session)
  await session.decodeQueue
  if (session.texts.length === 0) {
    /** VAD 未切出片段时使用受限完整录音兜底。 */
    const fallbackText = await decodeSenseVoice(session.recognizer, concatenateSamples(session.allChunks))
    if (fallbackText) session.texts.push(fallbackText)
  }
  publishSenseVoiceText(session, true)
  activeSession = undefined
}

/** 取消会话并丢弃其内存音频。 */
function cancel(command: Extract<LocalAsrCommand, { type: 'cancel' }>): void {
  if (activeSession?.voiceSessionId === command.voiceSessionId) activeSession = undefined
}

/** 发布在线识别器当前文本。 */
function publishOnlineText(session: OnlineSession, isFinal: boolean): void {
  /** 当前累计文本。 */
  const text = session.recognizer.getResult(session.stream).text?.trim() ?? ''
  if (!isFinal && (!session.streaming || text === session.lastText)) return
  session.lastText = text
  post({ type: 'transcript', protocolVersion: LOCAL_ASR_PROTOCOL_VERSION, voiceSessionId: session.voiceSessionId, text, isFinal })
}

/** 发布 SenseVoice 已完成片段。 */
function publishSenseVoiceText(session: SenseVoiceSession, isFinal: boolean): void {
  /** 拼接后的片段文本。 */
  const text = session.texts.join('').trim()
  post({ type: 'transcript', protocolVersion: LOCAL_ASR_PROTOCOL_VERSION, voiceSessionId: session.voiceSessionId, text, isFinal })
}

/** 解码一个 SenseVoice PCM 片段。 */
async function decodeSenseVoice(recognizer: OfflineRecognizer, samples: Float32Array): Promise<string> {
  if (samples.length === 0) return ''
  /** 离线识别流。 */
  const stream: OfflineStream = recognizer.createStream()
  stream.acceptWaveform({ samples, sampleRate: 16_000 })
  /** 离线解码结果。 */
  const result = await recognizer.decodeAsync(stream)
  return result.text?.replace(/<\|[^|]+\|>/gu, '').trim() ?? ''
}

/** 计算录音块总样本数。 */
function totalSamples(chunks: readonly Float32Array[]): number {
  return chunks.reduce((total, chunk) => total + chunk.length, 0)
}

/** 将分块 PCM 拼为单一数组。 */
function concatenateSamples(chunks: readonly Float32Array[]): Float32Array {
  /** 拼接结果。 */
  const result = new Float32Array(totalSamples(chunks))
  /** 当前写入偏移。 */
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

/** 处理一条经过共享 Schema 校验的父进程命令。 */
async function handleCommand(rawCommand: unknown): Promise<void> {
  /** 已校验命令。 */
  const parsed = LocalAsrCommandSchema.safeParse(rawCommand)
  if (!parsed.success) return
  /** 命令。 */
  const command = parsed.data
  try {
    if (command.type === 'start') start(command)
    else if (command.type === 'chunk') acceptChunk(command)
    else if (command.type === 'finish') await finish(command)
    else cancel(command)
  } catch (error) {
    post({
      type: 'error',
      protocolVersion: LOCAL_ASR_PROTOCOL_VERSION,
      voiceSessionId: command.voiceSessionId,
      message: (error instanceof Error ? error.message : '本地语音识别失败。').slice(0, 300)
    })
    activeSession = undefined
  }
}

// ========= 生命周期 =========

parentPort?.on('message', (event) => {
  void handleCommand(event.data)
})
