import type { ShellSettingsRequest, ShellSettingsResult } from '../schemas/shell'

// ========= 变量 =========

/** Renderer 与 Main 间唯一 Shell 设置通道。 */
export const SHELL_SETTINGS_CHANNELS = {
  request: 'ncx:shell-settings:request'
} as const

// ========= 类型 =========

/** Renderer 可用的 Shell 工作区设置桥。 */
export interface ShellSettingsBridge {
  /** 读取或管理用户明确授权的工作区。 */
  request(input: ShellSettingsRequest): Promise<ShellSettingsResult>
}
