import type {
  VoiceShortcutCommand,
  VoiceShortcutEvent,
  VoiceShortcutSnapshot
} from '../schemas/voice'

// ========= 变量 =========

/** Main 与 Preload 间唯一允许的语音快捷键通道。 */
export const VOICE_SHORTCUT_CHANNELS = {
  command: 'ncx:voice-shortcut:command',
  event: 'ncx:voice-shortcut:event'
} as const

// ========= 类型 =========

/** Renderer 可用的最小语音快捷键桥。 */
export interface VoiceShortcutBridge {
  /** 读取当前全局快捷键状态。 */
  snapshot(): Promise<VoiceShortcutSnapshot>
  /** 配置、关闭或打开权限设置。 */
  command(command: VoiceShortcutCommand): Promise<VoiceShortcutSnapshot>
  /** 订阅 Main 已归一化的 pressed/released/status 事件。 */
  onEvent(listener: (event: VoiceShortcutEvent) => void): () => void
}
