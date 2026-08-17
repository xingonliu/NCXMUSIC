import type {
  VoiceCloudTranscriptionInput,
  VoiceAgentNotificationInput,
  VoiceLocalPcmChunk,
  VoiceLocalSessionEnd,
  VoiceLocalSessionStart,
  VoiceServiceEvent,
  VoiceOverlayState,
  VoiceSettingsRequest,
  VoiceSettingsResult,
  VoiceTranscriptionResult
} from '../schemas/voice-settings'

// ========= 变量 =========

/** Main、Preload 与 Renderer 间的语音设置及专用识别通道。 */
export const VOICE_SETTINGS_CHANNELS = {
  request: 'ncx:voice-settings:request',
  localStart: 'ncx:voice-settings:local-start',
  localChunk: 'ncx:voice-settings:local-chunk',
  localFinish: 'ncx:voice-settings:local-finish',
  localCancel: 'ncx:voice-settings:local-cancel',
  cloudTranscribe: 'ncx:voice-settings:cloud-transcribe',
  cloudCancel: 'ncx:voice-settings:cloud-cancel',
  event: 'ncx:voice-settings:event',
  overlayState: 'ncx:voice-settings:overlay-state',
  notifyAgentComplete: 'ncx:voice-settings:notify-agent-complete'
} as const

// ========= 类型 =========

/** Renderer 可用的受限语音设置与识别桥。 */
export interface VoiceSettingsBridge {
  /** 读取或更新语音设置及模型安装状态。 */
  request(input: VoiceSettingsRequest): Promise<VoiceSettingsResult>
  /** 创建一个只接收 16 kHz PCM 的本地识别会话。 */
  startLocalSession(input: VoiceLocalSessionStart): Promise<void>
  /** 发送一个有大小上限的本地 PCM 块。 */
  sendLocalChunk(input: VoiceLocalPcmChunk): void
  /** 结束本地会话并取得最终文本。 */
  finishLocalSession(input: VoiceLocalSessionEnd): Promise<VoiceTranscriptionResult>
  /** 取消本地识别并立即释放会话音频。 */
  cancelLocalSession(input: VoiceLocalSessionEnd): void
  /** 使用独立云端 ASR 配置转写完整内存录音。 */
  transcribeCloud(input: VoiceCloudTranscriptionInput): Promise<VoiceTranscriptionResult>
  /** 取消独立云端识别。 */
  cancelCloud(input: VoiceLocalSessionEnd): void
  /** 将胶囊状态镜像给 Main 管理的外置无焦点窗口。 */
  publishOverlayState(input: VoiceOverlayState): void
  /** 请求 Main 创建可点击的原生 Agent 完成通知。 */
  notifyAgentComplete(input: VoiceAgentNotificationInput): void
  /** 订阅模型进度与增量识别文本。 */
  onEvent(listener: (event: VoiceServiceEvent) => void): () => void
}
