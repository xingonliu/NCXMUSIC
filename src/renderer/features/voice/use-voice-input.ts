import { readonly, ref, type Ref } from 'vue'

import type { VoiceShortcutEvent } from '../../../shared/schemas/voice'
import { showToast } from '../../design-system/use-toast'
import { usePlayerRuntime } from '../music/use-player'

// ========= 类型 =========

/** 语音输入公开状态。 */
export type VoiceInputState = 'idle' | 'starting' | 'listening' | 'transcribing'

/** 录音入口来源。 */
export type VoiceInputSource = 'global-shortcut' | 'composer-button'

/** Renderer 可见的麦克风权限状态。 */
export type MicrophonePermissionState = PermissionState | 'unknown'

/** 语音输入应用作用域控制器。 */
export interface VoiceInputController {
  /** 当前录音/识别状态。 */
  readonly state: Readonly<Ref<VoiceInputState>>
  /** 首次启用前是否等待隐私披露。 */
  readonly disclosureRequired: Readonly<Ref<boolean>>
  /** 初始化一次全局快捷键事件订阅。 */
  initialize(): Promise<void>
  /** 从全局快捷键或输入区按钮开始按住录音。 */
  press(source: VoiceInputSource): Promise<void>
  /** 松手并进入云端识别。 */
  release(source: VoiceInputSource): void
  /** 取消当前录音或识别。 */
  cancel(reason?: string): void
  /** 接受首次云端音频处理披露。 */
  acceptDisclosure(): void
  /** 拒绝首次披露并保持语音入口未启用。 */
  declineDisclosure(): void
  /** 订阅已经归一化的识别文本。 */
  onTranscript(listener: (text: string) => void): () => void
}

/** 当前录音 Session 的 Renderer 私有状态。 */
interface ActiveVoiceSession {
  /** 稳定 Session ID。 */
  readonly voiceSessionId: string
  /** 入口来源。 */
  readonly source: VoiceInputSource
  /** 原始 MediaStream，只在 Session 内存中持有。 */
  readonly stream: MediaStream
  /** 浏览器录音器。 */
  readonly recorder: MediaRecorder
  /** 仍在内存中的音频块。 */
  readonly chunks: Blob[]
  /** 录音 MIME 类型。 */
  readonly mimeType: string
  /** 关联全局 Hook 的 generation；应用内入口为空。 */
  readonly shortcutGeneration?: number
  /** Runtime 请求 ID，用于取消识别。 */
  requestId?: string
}

// ========= 变量 =========

/** 首次语音隐私披露的本地确认键。 */
const VOICE_DISCLOSURE_KEY = 'ncx.voice-disclosure.v1'

/** 当前应用级语音状态。 */
const state = ref<VoiceInputState>('idle')

/** 是否需要展示首次云端音频处理披露。 */
const disclosureRequired = ref<boolean>(readDisclosureAccepted() === false)

/** 当前唯一 Voice Session。 */
let activeSession: ActiveVoiceSession | undefined

/** 最近一次有效全局快捷键 generation。 */
let shortcutGeneration: number | undefined

/** 当前仍保持按下状态的入口；用于处理权限请求期间的提前松手。 */
const heldSources = new Set<VoiceInputSource>()

/** 每次异步启动递增，迟到的权限/设备结果不得创建录音。 */
let startGeneration = 0

/** 是否已安装全局快捷键订阅。 */
let initialized = false

/** 识别文本订阅者。 */
const transcriptListeners = new Set<(text: string) => void>()

// ========= 函数 =========

/** 初始化全局快捷键订阅；应用内麦克风不依赖初始化结果。 */
async function initialize(): Promise<void> {
  if (initialized) return
  initialized = true
  window.ncx.voiceShortcut.onEvent(handleShortcutEvent)
  await window.ncx.voiceShortcut.snapshot().catch(() => undefined)
}

/** 响应 Main 已过滤的 pressed/released/cancelled 事件。 */
function handleShortcutEvent(event: VoiceShortcutEvent): void {
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

/** 开始一次按住说话。 */
async function press(source: VoiceInputSource): Promise<void> {
  if (activeSession || state.value !== 'idle') return
  if (!readDisclosureAccepted()) {
    disclosureRequired.value = true
    showToast('首次使用前请确认语音隐私说明。', 'warning')
    return
  }
  heldSources.add(source)
  /** 当前异步启动 generation。 */
  const generation = startGeneration + 1
  startGeneration = generation
  state.value = 'starting'
  /** 当前 Provider ASR 能力状态。 */
  const capability = await window.ncx.runtime.voice({ operation: 'status' }).catch(() => undefined)
  if (!isCurrentStart(source, generation)) return
  if (!capability?.ok || capability.data.operation !== 'status' || !capability.data.configured) {
    heldSources.delete(source)
    state.value = 'idle'
    showToast(capability && !capability.ok ? capability.error.message : '请先配置当前大模型。', 'warning')
    return
  }
  if (capability.data.capability === 'unsupported') {
    heldSources.delete(source)
    state.value = 'idle'
    showToast(capability.data.message ?? '当前大模型不支持语音识别（ASR）。', 'warning')
    return
  }

  /** 当前启动流程已经取得且尚未移交 Session 的媒体流。 */
  let acquiredStream: MediaStream | undefined
  try {
    /** 只请求音频轨道的内存媒体流。 */
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
    acquiredStream = stream
    if (!isCurrentStart(source, generation)) {
      for (const track of stream.getTracks()) track.stop()
      return
    }
    /** 当前浏览器可录制的首选 MIME 类型。 */
    const mimeType = preferredMimeType()
    /** 使用首选 MIME 创建的录音器。 */
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    /** 当前录音 Session。 */
    const session: ActiveVoiceSession = {
      voiceSessionId: crypto.randomUUID(),
      source,
      stream,
      recorder,
      chunks: [],
      mimeType: recorder.mimeType || mimeType || 'audio/webm',
      ...(source === 'global-shortcut' && shortcutGeneration !== undefined
        ? { shortcutGeneration }
        : {})
    }
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0 && activeSession === session) session.chunks.push(event.data)
    })
    recorder.addEventListener('stop', () => {
      void finalizeRecording(session)
    }, { once: true })
    recorder.addEventListener('error', () => {
      cancel('麦克风录音失败。')
    }, { once: true })
    activeSession = session
    usePlayerRuntime().engine.setDuckGain(0.2)
    recorder.start(250)
    state.value = 'listening'
  } catch (error) {
    /** 录音器启动异常时同步释放已取得的设备与瞬时降音。 */
    const failedSession = activeSession?.stream === acquiredStream ? activeSession : undefined
    if (failedSession) {
      releaseSessionMedia(failedSession)
      activeSession = undefined
    } else if (acquiredStream) {
      for (const track of acquiredStream.getTracks()) track.stop()
    }
    if (isCurrentStart(source, generation)) {
      heldSources.delete(source)
      state.value = 'idle'
      showToast(readMediaError(error), 'warning')
    }
  }
}

/** 松手后立即关闭聆听视觉，并让 MediaRecorder 完整收束尾部块。 */
function release(source: VoiceInputSource): void {
  heldSources.delete(source)
  /** 当前唯一录音 Session。 */
  const session = activeSession
  if (!session && state.value === 'starting') {
    startGeneration += 1
    state.value = 'idle'
    return
  }
  if (!session || session.source !== source || state.value !== 'listening') return
  state.value = 'transcribing'
  showToast('正在识别语音…', 'info')
  if (session.recorder.state !== 'inactive') {
    session.recorder.requestData()
    session.recorder.stop()
  }
}

/** 取消当前录音或云端识别并释放所有本地音频。 */
function cancel(reason = '语音输入已取消。'): void {
  heldSources.clear()
  startGeneration += 1
  /** 当前唯一 Session。 */
  const session = activeSession
  if (!session) {
    state.value = 'idle'
    return
  }
  if (session.requestId) window.ncx.runtime.cancel(session.requestId)
  if (session.recorder.state !== 'inactive') session.recorder.stop()
  releaseSessionMedia(session)
  if (activeSession === session) activeSession = undefined
  state.value = 'idle'
  showToast(reason, 'warning')
}

/** 将完整音频块仅在内存中上传给当前 Provider，并把文本交给 Agent。 */
async function finalizeRecording(session: ActiveVoiceSession): Promise<void> {
  if (activeSession !== session) return
  releaseSessionTracks(session)
  usePlayerRuntime().engine.setDuckGain(1)
  /** 合并后的只读音频 Blob。 */
  const blob = new Blob(session.chunks.splice(0), { type: session.mimeType })
  if (blob.size === 0) {
    activeSession = undefined
    state.value = 'idle'
    showToast('没有录到可识别的音频。', 'warning')
    return
  }
  /** 供 MessagePort 结构化克隆的一次性字节数组。 */
  const audio = new Uint8Array(await blob.arrayBuffer())
  /** ASR 请求 ID。 */
  const requestId = crypto.randomUUID()
  session.requestId = requestId
  try {
    /** Utility 返回的转写终态。 */
    const response = await window.ncx.runtime.voice({
      operation: 'transcribe',
      voiceSessionId: session.voiceSessionId,
      mimeType: session.mimeType,
      audio,
      requestId
    })
    if (!response.ok) {
      showToast(response.error.message, 'warning')
      return
    }
    if (response.data.operation !== 'transcribe') {
      showToast('语音识别响应类型不匹配。', 'warning')
      return
    }
    if (response.data.status === 'unsupported') {
      showToast(response.data.message ?? '当前大模型不支持语音识别（ASR）。', 'warning')
      return
    }
    /** 去除 Provider 偶发的首尾空白。 */
    const transcript = response.data.text?.trim() ?? ''
    if (!transcript) {
      showToast('没有识别到可执行的文字。', 'warning')
      return
    }
    showToast(`已识别：${transcript.slice(0, 80)}`, 'success')
    for (const listener of transcriptListeners) listener(transcript)
  } finally {
    audio.fill(0)
    releaseSessionMedia(session)
    if (activeSession === session) {
      activeSession = undefined
      state.value = 'idle'
    }
  }
}

/** 释放 MediaStream 与录音块，并恢复瞬时音乐增益。 */
function releaseSessionMedia(session: ActiveVoiceSession): void {
  releaseSessionTracks(session)
  session.chunks.splice(0)
  if (activeSession === session) usePlayerRuntime().engine.setDuckGain(1)
}

/** 停止当前 Session 的全部麦克风轨道。 */
function releaseSessionTracks(session: ActiveVoiceSession): void {
  for (const track of session.stream.getTracks()) track.stop()
}

/** 判断异步启动是否仍对应当前保持按下的入口。 */
function isCurrentStart(source: VoiceInputSource, generation: number): boolean {
  return startGeneration === generation && heldSources.has(source) && state.value === 'starting'
}

/** 返回浏览器当前最合适的内存录音 MIME。 */
function preferredMimeType(): string {
  /** 按通用程度排序的音频 MIME 候选。 */
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

/** 将浏览器媒体错误转为明确用户提示。 */
function readMediaError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '麦克风权限未授予；全局快捷键不可用时仍可在设置中重新授权。'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') return '没有检测到可用麦克风。'
  return '无法开始语音录音，请检查麦克风与系统权限。'
}

/** 读取首次云端音频处理披露状态。 */
function readDisclosureAccepted(): boolean {
  try {
    return window.localStorage.getItem(VOICE_DISCLOSURE_KEY) === 'accepted'
  } catch {
    return false
  }
}

/** 用户接受音频发送范围披露。 */
function acceptDisclosure(): void {
  try {
    window.localStorage.setItem(VOICE_DISCLOSURE_KEY, 'accepted')
  } catch {
    // 存储不可用时本次会话仍允许继续，重启后会再次披露。
  }
  disclosureRequired.value = false
  showToast('语音输入已启用；请再次按住麦克风开始。', 'success')
}

/** 用户拒绝披露，不启动录音或上传。 */
function declineDisclosure(): void {
  disclosureRequired.value = false
  showToast('未启用语音输入，未录音也未上传。', 'info')
}

/** 订阅识别完成文本。 */
function onTranscript(listener: (text: string) => void): () => void {
  transcriptListeners.add(listener)
  return () => transcriptListeners.delete(listener)
}

/** 查询 Chromium 可见的麦克风权限状态。 */
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
