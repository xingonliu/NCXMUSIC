import { readonly, ref, type Ref } from 'vue'

import type { VoiceShortcutEvent } from '../../../shared/schemas/voice'
import type { VoiceRecognitionSource, VoiceServiceEvent, VoiceSettingsSnapshot } from '../../../shared/schemas/voice-settings'
import { showToast } from '../../design-system/use-toast'
import { usePlayerRuntime } from '../music/use-player'

// ========= 类型 =========

/** 语音胶囊公开状态。 */
export type VoiceInputState = 'idle' | 'starting' | 'listening' | 'transcribing' | 'reviewing'

/** 录音入口来源。 */
export type VoiceInputSource = 'global-shortcut' | 'composer-button'

/** Renderer 可见的麦克风权限状态。 */
export type MicrophonePermissionState = PermissionState | 'unknown'

/** 语音输入应用作用域控制器。 */
export interface VoiceInputController {
  /** 当前录音、识别或确认状态。 */
  readonly state: Readonly<Ref<VoiceInputState>>
  /** 实时频谱柱归一化高度。 */
  readonly waveform: Readonly<Ref<readonly number[]>>
  /** 流式或最终转写预览。 */
  readonly transcriptPreview: Readonly<Ref<string>>
  /** 首次上传云端音频前是否等待隐私披露。 */
  readonly disclosureRequired: Readonly<Ref<boolean>>
  /** 初始化全局快捷键与语音服务事件订阅。 */
  initialize(): Promise<void>
  /** 从全局快捷键或输入区按钮开始按住录音。 */
  press(source: VoiceInputSource): Promise<void>
  /** 松手并完成本地或云端识别。 */
  release(source: VoiceInputSource): void
  /** 取消当前录音或识别。 */
  cancel(reason?: string): void
  /** 接受首次云端音频处理披露。 */
  acceptDisclosure(): void
  /** 拒绝首次披露。 */
  declineDisclosure(): void
  /** 订阅确认完成、可以提交 Agent 的文本。 */
  onTranscript(listener: (text: string) => void): () => void
}

/** 当前录音 Session 的 Renderer 私有状态。 */
interface ActiveVoiceSession {
  /** 稳定 Session ID。 */
  readonly voiceSessionId: string
  /** 入口来源。 */
  readonly source: VoiceInputSource
  /** 本次固定识别来源。 */
  readonly recognitionSource: VoiceRecognitionSource
  /** 本次固定设置快照。 */
  readonly settings: VoiceSettingsSnapshot
  /** 原始麦克风流。 */
  readonly stream: MediaStream
  /** Web Audio 上下文。 */
  readonly audioContext: AudioContext
  /** 麦克风源节点。 */
  readonly sourceNode: MediaStreamAudioSourceNode
  /** 实时分析节点。 */
  readonly analyser: AnalyserNode
  /** 本地 PCM 节点。 */
  processor?: ScriptProcessorNode
  /** 防止 PCM 节点输出声音的静音增益。 */
  silentGain?: GainNode
  /** 云端录音器。 */
  recorder?: MediaRecorder
  /** 尚在内存的云端音频块。 */
  readonly chunks: Blob[]
  /** 录音 MIME。 */
  mimeType: string
  /** Runtime 请求 ID。 */
  requestId?: string
  /** 频谱动画帧。 */
  animationFrame?: number
  /** 首次开始聆听时间。 */
  listeningStartedAt: number
  /** 是否已经检测到人声。 */
  voiceDetected: boolean
  /** 连续静音起点。 */
  silenceStartedAt?: number
  /** 1.2 秒确认计时器。 */
  reviewTimer?: ReturnType<typeof setTimeout>
}

// ========= 变量 =========

/** 首次云端语音披露确认键。 */
const VOICE_DISCLOSURE_KEY = 'ncx.voice-cloud-disclosure.v2'

/** VAD 判定为人声的频谱能量阈值。 */
const VOICE_ACTIVITY_THRESHOLD = 0.055

/** 检测到人声后的自动收音静默时长。 */
const VOICE_END_SILENCE_MS = 1_100

/** 最短录音时长，避免按键瞬间抖动触发自动结束。 */
const MIN_LISTENING_MS = 500

/** 最终转写确认展示时长。 */
const TRANSCRIPT_REVIEW_MS = 1_200

/** 当前应用级语音状态。 */
const state = ref<VoiceInputState>('idle')

/** 当前实时波形。 */
const waveform = ref<readonly number[]>(Array.from({ length: 12 }, () => 0.08))

/** 胶囊中的增量或最终文本。 */
const transcriptPreview = ref<string>('')

/** 是否需要展示首次云端音频处理披露。 */
const disclosureRequired = ref<boolean>(false)

/** 当前唯一 Voice Session。 */
let activeSession: ActiveVoiceSession | undefined

/** 最近一次有效全局快捷键 generation。 */
let shortcutGeneration: number | undefined

/** 当前仍保持按下的入口。 */
const heldSources = new Set<VoiceInputSource>()

/** 每次异步启动递增，迟到结果不得创建录音。 */
let startGeneration = 0

/** 是否已经安装全局订阅。 */
let initialized = false

/** 识别文本订阅者。 */
const transcriptListeners = new Set<(text: string) => void>()

// ========= 函数 =========

/** 初始化全局快捷键与增量转写订阅。 */
async function initialize(): Promise<void> {
  if (initialized) return
  initialized = true
  window.ncx.voiceShortcut.onEvent(handleShortcutEvent)
  window.ncx.voiceSettings.onEvent(handleVoiceServiceEvent)
  await window.ncx.voiceShortcut.snapshot().catch(() => undefined)
}

/** 响应 Main 已过滤的 pressed/released/cancelled 事件。 */
function handleShortcutEvent(event: VoiceShortcutEvent): void {
  console.info('[VoiceInput] 渲染进程收到语音快捷键事件:', JSON.stringify(event))
  if (event.type === 'status') return
  if (event.type === 'pressed') {
    shortcutGeneration = event.generation
    void press('global-shortcut')
    return
  }
  if (shortcutGeneration !== event.generation) return
  if (event.type === 'released') release('global-shortcut')
  else cancel(event.reason ?? '全局快捷键已中断。')
}

/** 将本地或独立云端增量文本同步到胶囊。 */
function handleVoiceServiceEvent(event: VoiceServiceEvent): void {
  if (event.type !== 'transcript' || activeSession?.voiceSessionId !== event.voiceSessionId) return
  transcriptPreview.value = event.text
}

/** 开始一次按住说话。 */
async function press(source: VoiceInputSource): Promise<void> {
  console.info(`[VoiceInput] 收到按住录音请求 (source=${source}, 当前状态=${state.value})`)
  if (activeSession || state.value !== 'idle') {
    console.warn(`[VoiceInput] 忽略录音请求: 存在活跃会话或状态非 idle (activeSession=${Boolean(activeSession)}, state=${state.value})`)
    return
  }
  heldSources.add(source)
  /** 当前异步启动 generation。 */
  const generation = startGeneration + 1
  startGeneration = generation
  state.value = 'starting'
  transcriptPreview.value = ''
  /** 本次固定语音设置。 */
  const settingsResult = await window.ncx.voiceSettings.request({ operation: 'snapshot' }).catch(() => undefined)
  if (!isCurrentStart(source, generation)) {
    console.warn(`[VoiceInput] 启动已失效 (松手过快或已被新请求取代): generation=${generation}`)
    return
  }
  if (!settingsResult) return failStart(source, '语音设置服务不可用。')
  /** 本次固定设置快照。 */
  const settings = settingsResult.snapshot
  if (settings.source !== 'local' && !readDisclosureAccepted()) {
    heldSources.delete(source)
    state.value = 'idle'
    disclosureRequired.value = true
    showToast('首次上传录音前请确认语音隐私说明。', 'warning')
    return
  }
  if (settings.source === 'local') {
    /** 当前选中本地模型。 */
    const model = settings.models.find((candidate) => candidate.id === settings.local.modelId)
    if (model?.installState !== 'installed') return failStart(source, '请先在语音设置中安装所选本地模型。')
  }
  if (settings.source === 'conversation') {
    /** 当前 Provider ASR 能力。 */
    const capability = await window.ncx.runtime.voice({ operation: 'status' }).catch(() => undefined)
    if (!isCurrentStart(source, generation)) return
    if (!capability?.ok || capability.data.operation !== 'status' || !capability.data.configured) {
      return failStart(source, capability && !capability.ok ? capability.error.message : '请先配置当前对话模型。')
    }
    if (capability.data.capability === 'unsupported') return failStart(source, capability.data.message ?? '当前对话模型不支持语音识别。')
  }

  /** 启动流程取得但尚未移交的媒体流。 */
  let acquiredStream: MediaStream | undefined
  try {
    /** 只请求音频轨道。 */
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    })
    acquiredStream = stream
    if (!isCurrentStart(source, generation)) {
      stopTracks(stream)
      return
    }
    /** Web Audio 上下文。 */
    const audioContext = new AudioContext()
    /** 麦克风源节点。 */
    const sourceNode = audioContext.createMediaStreamSource(stream)
    /** 频谱分析节点。 */
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.72
    sourceNode.connect(analyser)
    /** 当前会话。 */
    const session: ActiveVoiceSession = {
      voiceSessionId: crypto.randomUUID(),
      source,
      recognitionSource: settings.source,
      settings,
      stream,
      audioContext,
      sourceNode,
      analyser,
      chunks: [],
      mimeType: '',
      listeningStartedAt: performance.now(),
      voiceDetected: false
    }
    activeSession = session
    if (settings.source === 'local') await startLocalRecording(session)
    else startCloudRecording(session)
    if (!isCurrentStart(source, generation) || activeSession !== session) {
      if (session.recognitionSource === 'local') {
        window.ncx.voiceSettings.cancelLocalSession({ voiceSessionId: session.voiceSessionId })
      }
      cancelSession(session)
      return
    }
    usePlayerRuntime().engine.setDuckGain(0.2)
    state.value = 'listening'
    updateMeter(session)
  } catch (error) {
    if (activeSession) cancelSession(activeSession)
    else if (acquiredStream) stopTracks(acquiredStream)
    if (isCurrentStart(source, generation)) failStart(source, readMediaError(error))
  }
}

/** 启动本地 16 kHz PCM 管线。 */
async function startLocalRecording(session: ActiveVoiceSession): Promise<void> {
  await window.ncx.voiceSettings.startLocalSession({
    voiceSessionId: session.voiceSessionId,
    modelId: session.settings.local.modelId,
    streaming: session.settings.local.streaming
  })
  /** 旧版但跨 Electron 稳定的 PCM 回调节点。 */
  const processor = session.audioContext.createScriptProcessor(4_096, 1, 1)
  /** 静音输出节点，确保处理回调运行但不回放麦克风。 */
  const silentGain = session.audioContext.createGain()
  silentGain.gain.value = 0
  processor.addEventListener('audioprocess', (event) => {
    if (activeSession !== session || state.value !== 'listening') return
    /** 浏览器采样率 PCM 副本。 */
    const sourceSamples = event.inputBuffer.getChannelData(0)
    /** 重采样到 sherpa-onnx 统一采样率。 */
    const resampled = resamplePcm(sourceSamples, session.audioContext.sampleRate, 16_000)
    /** 使用独立 ArrayBuffer，避免 SharedArrayBuffer 穿过桥接边界。 */
    const samples = new Float32Array(new ArrayBuffer(resampled.byteLength))
    samples.set(resampled)
    if (samples.length > 0) {
      window.ncx.voiceSettings.sendLocalChunk({ voiceSessionId: session.voiceSessionId, sampleRate: 16_000, samples })
    }
  })
  session.sourceNode.connect(processor)
  processor.connect(silentGain)
  silentGain.connect(session.audioContext.destination)
  session.processor = processor
  session.silentGain = silentGain
}

/** 启动独立云端或当前对话模型的内存录音。 */
function startCloudRecording(session: ActiveVoiceSession): void {
  /** 浏览器首选录音 MIME。 */
  const mimeType = preferredMimeType()
  /** 录音器。 */
  const recorder = mimeType ? new MediaRecorder(session.stream, { mimeType }) : new MediaRecorder(session.stream)
  session.recorder = recorder
  session.mimeType = recorder.mimeType || mimeType || 'audio/webm'
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0 && activeSession === session) session.chunks.push(event.data)
  })
  recorder.addEventListener('stop', () => {
    void finalizeCloudRecording(session)
  }, { once: true })
  recorder.addEventListener('error', () => cancel('麦克风录音失败。'), { once: true })
  recorder.start(250)
}

/** 更新实时波形并运行 Renderer 端自动收音 VAD。 */
function updateMeter(session: ActiveVoiceSession): void {
  if (activeSession !== session || state.value !== 'listening') return
  /** 频谱数据。 */
  const bins = new Uint8Array(session.analyser.frequencyBinCount)
  session.analyser.getByteFrequencyData(bins)
  /** 12 个等距频谱柱。 */
  const bars = Array.from({ length: 12 }, (_, index) => Math.max(0.08, bins[Math.floor((index / 12) * bins.length)]! / 255))
  waveform.value = bars
  /** 平均频谱能量。 */
  const energy = bins.reduce((total, value) => total + value, 0) / Math.max(1, bins.length * 255)
  /** 当前高精度时间。 */
  const now = performance.now()
  if (energy >= VOICE_ACTIVITY_THRESHOLD) {
    session.voiceDetected = true
    delete session.silenceStartedAt
  } else if (session.voiceDetected && now - session.listeningStartedAt >= MIN_LISTENING_MS) {
    session.silenceStartedAt ??= now
    if (now - session.silenceStartedAt >= VOICE_END_SILENCE_MS) {
      release(session.source)
      return
    }
  }
  session.animationFrame = requestAnimationFrame(() => updateMeter(session))
}

/** 松手或 VAD 收音完成后进入识别。 */
function release(source: VoiceInputSource): void {
  console.info(`[VoiceInput] release 触发 (source=${source}, 当前状态=${state.value}, activeSession=${Boolean(activeSession)})`)
  heldSources.delete(source)
  /** 当前会话。 */
  const session = activeSession
  if (!session && state.value === 'starting') {
    startGeneration += 1
    state.value = 'idle'
    return
  }
  if (!session || session.source !== source || state.value !== 'listening') return
  state.value = 'transcribing'
  stopMeterAndTracks(session)
  if (session.recognitionSource === 'local') {
    void finalizeLocalRecording(session)
    return
  }
  /** 云端路径录音器。 */
  const recorder = session.recorder
  if (recorder && recorder.state !== 'inactive') {
    recorder.requestData()
    recorder.stop()
  }
}

/** 完成本地识别并展示确认文本。 */
async function finalizeLocalRecording(session: ActiveVoiceSession): Promise<void> {
  try {
    /** Main 返回的最终文本。 */
    const result = await window.ncx.voiceSettings.finishLocalSession({ voiceSessionId: session.voiceSessionId })
    await reviewTranscript(session, result.text)
  } catch (error) {
    finishWithError(session, error)
  }
}

/** 完成云端或当前对话模型转写。 */
async function finalizeCloudRecording(session: ActiveVoiceSession): Promise<void> {
  if (activeSession !== session) return
  /** 合并后的内存录音。 */
  const blob = new Blob(session.chunks.splice(0), { type: session.mimeType })
  if (blob.size === 0) return finishWithError(session, new Error('没有录到可识别的音频。'))
  /** 一次性字节数组。 */
  const audio = new Uint8Array(await blob.arrayBuffer())
  try {
    if (session.recognitionSource === 'cloud') {
      /** 独立云端 ASR 终态。 */
      const result = await window.ncx.voiceSettings.transcribeCloud({
        voiceSessionId: session.voiceSessionId,
        mimeType: session.mimeType,
        audio
      })
      await reviewTranscript(session, result.text)
      return
    }
    /** 当前对话模型只允许非流式。 */
    const requestId = crypto.randomUUID()
    session.requestId = requestId
    /** Utility 返回转写结果。 */
    const response = await window.ncx.runtime.voice({
      operation: 'transcribe',
      voiceSessionId: session.voiceSessionId,
      mimeType: session.mimeType,
      audio,
      requestId
    })
    if (!response.ok) throw new Error(response.error.message)
    if (response.data.operation !== 'transcribe') throw new Error('语音识别响应类型不匹配。')
    if (response.data.status === 'unsupported') throw new Error(response.data.message ?? '当前对话模型不支持语音识别。')
    await reviewTranscript(session, response.data.text ?? '')
  } catch (error) {
    finishWithError(session, error)
  } finally {
    audio.fill(0)
  }
}

/** 展示最终转写 1.2 秒，再交给 Agent。 */
async function reviewTranscript(session: ActiveVoiceSession, rawText: string): Promise<void> {
  if (activeSession !== session) return
  /** 去除识别器首尾空白。 */
  const text = rawText.trim()
  if (!text) return finishWithError(session, new Error('没有识别到可执行的文字。'))
  transcriptPreview.value = text
  state.value = 'reviewing'
  await new Promise<void>((resolve) => {
    session.reviewTimer = setTimeout(resolve, TRANSCRIPT_REVIEW_MS)
  })
  if (activeSession !== session) return
  cleanupSession(session)
  activeSession = undefined
  state.value = 'idle'
  transcriptPreview.value = ''
  for (const listener of transcriptListeners) listener(text)
}

/** 取消当前录音或识别并释放全部内存媒体。 */
function cancel(reason = '语音输入已取消。'): void {
  console.info(`[VoiceInput] cancel 触发: reason=${reason}, 当前状态=${state.value}`)
  heldSources.clear()
  startGeneration += 1
  /** 当前会话。 */
  const session = activeSession
  if (!session) {
    state.value = 'idle'
    return
  }
  if (session.recognitionSource === 'local') window.ncx.voiceSettings.cancelLocalSession({ voiceSessionId: session.voiceSessionId })
  else if (session.recognitionSource === 'cloud') window.ncx.voiceSettings.cancelCloud({ voiceSessionId: session.voiceSessionId })
  else if (session.requestId) window.ncx.runtime.cancel(session.requestId)
  /** 可能仍在录音的云端录音器。 */
  const recorder = session.recorder
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  cancelSession(session)
  showToast(reason, 'warning')
}

/** 取消并清理指定会话。 */
function cancelSession(session: ActiveVoiceSession): void {
  cleanupSession(session)
  if (activeSession === session) activeSession = undefined
  state.value = 'idle'
  transcriptPreview.value = ''
}

/** 统一清理媒体节点、轨道、音频块和确认计时器。 */
function cleanupSession(session: ActiveVoiceSession): void {
  if (session.reviewTimer) clearTimeout(session.reviewTimer)
  stopMeterAndTracks(session)
  session.processor?.disconnect()
  session.silentGain?.disconnect()
  session.sourceNode.disconnect()
  void session.audioContext.close().catch(() => undefined)
  session.chunks.splice(0)
  usePlayerRuntime().engine.setDuckGain(1)
}

/** 停止频谱循环和麦克风轨道。 */
function stopMeterAndTracks(session: ActiveVoiceSession): void {
  if (session.animationFrame !== undefined) cancelAnimationFrame(session.animationFrame)
  delete session.animationFrame
  stopTracks(session.stream)
  waveform.value = Array.from({ length: 12 }, () => 0.08)
}

/** 停止媒体流中的全部轨道。 */
function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

/** 将识别异常转为用户提示并回到空闲态。 */
function finishWithError(session: ActiveVoiceSession, error: unknown): void {
  if (activeSession !== session) return
  /** 安全错误文案。 */
  const message = error instanceof Error ? error.message : '语音识别失败。'
  console.warn(`[VoiceInput] 语音识别报错:`, message, error)
  cancelSession(session)
  showToast(message, 'warning')
}

/** 在启动阶段失败并复位。 */
function failStart(source: VoiceInputSource, message: string): void {
  console.warn(`[VoiceInput] 语音输入启动阶段失败 (source=${source}):`, message)
  heldSources.delete(source)
  state.value = 'idle'
  showToast(message, 'warning')
}

/** 判断异步启动是否仍对应当前保持按下的入口。 */
function isCurrentStart(source: VoiceInputSource, generation: number): boolean {
  return startGeneration === generation && heldSources.has(source) && state.value === 'starting'
}

/** 将单声道 PCM 线性重采样到目标采样率。 */
function resamplePcm(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return input.slice()
  /** 输出样本数。 */
  const outputLength = Math.max(1, Math.round(input.length * targetRate / sourceRate))
  /** 重采样结果。 */
  const output = new Float32Array(outputLength)
  /** 输入与输出步进比。 */
  const ratio = sourceRate / targetRate
  for (let index = 0; index < outputLength; index += 1) {
    /** 输入浮点位置。 */
    const position = index * ratio
    /** 左样本索引。 */
    const left = Math.floor(position)
    /** 右样本索引。 */
    const right = Math.min(input.length - 1, left + 1)
    /** 线性插值比例。 */
    const mix = position - left
    output[index] = (input[left] ?? 0) * (1 - mix) + (input[right] ?? 0) * mix
  }
  return output
}

/** 返回浏览器首选内存录音 MIME。 */
function preferredMimeType(): string {
  /** 按兼容度排序的音频 MIME。 */
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

/** 将浏览器媒体或模型错误转为用户提示。 */
function readMediaError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return '麦克风权限未授予，请在系统设置中授权。'
  if (error instanceof DOMException && error.name === 'NotFoundError') return '没有检测到可用麦克风。'
  return error instanceof Error ? error.message : '无法开始语音录音，请检查麦克风与系统权限。'
}

/** 读取首次云端音频披露状态。 */
function readDisclosureAccepted(): boolean {
  try {
    return window.localStorage.getItem(VOICE_DISCLOSURE_KEY) === 'accepted'
  } catch {
    return false
  }
}

/** 用户接受音频上传范围披露。 */
function acceptDisclosure(): void {
  try {
    window.localStorage.setItem(VOICE_DISCLOSURE_KEY, 'accepted')
  } catch {
    // 存储不可用时本次会话仍允许，重启后再次披露。
  }
  disclosureRequired.value = false
  showToast('云端语音输入已启用；请再次按住快捷键开始。', 'success')
}

/** 用户拒绝披露。 */
function declineDisclosure(): void {
  disclosureRequired.value = false
  showToast('未启用云端语音输入，未录音也未上传。', 'info')
}

/** 订阅确认完成的文本。 */
function onTranscript(listener: (text: string) => void): () => void {
  transcriptListeners.add(listener)
  return () => transcriptListeners.delete(listener)
}

/** 查询 Chromium 可见的麦克风权限。 */
export async function readMicrophonePermission(): Promise<MicrophonePermissionState> {
  try {
    /** 浏览器权限查询结果。 */
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

/** 返回应用作用域唯一语音输入控制器。 */
export function useVoiceInput(): VoiceInputController {
  return {
    state: readonly(state),
    waveform: readonly(waveform),
    transcriptPreview: readonly(transcriptPreview),
    disclosureRequired: readonly(disclosureRequired),
    initialize,
    press,
    release,
    cancel,
    acceptDisclosure,
    declineDisclosure,
    onTranscript
  }
}
