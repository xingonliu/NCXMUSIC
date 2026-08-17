import type { AgentSettingsBridge } from './agent-settings-bridge'
import type { AccountBridge } from './account-bridge'
import type { ClipboardBridge } from './clipboard-bridge'
import type { LifecycleBridge } from './lifecycle-bridge'
import type { NcxRuntimeBridge } from './runtime-bridge'
import type { ProviderProfileBridge } from './provider-profile-bridge'
import type { WindowControlBridge } from './window-controls'
import type { VoiceShortcutBridge } from './voice-bridge'
import type { VoiceSettingsBridge } from './voice-settings-bridge'
import type { ShellSettingsBridge } from './shell-settings-bridge'
import type { ExtensionBridge } from './extension-bridge'

export interface DesktopBridge {
  readonly platform: string
  readonly versions: {
    readonly chrome: string
    readonly electron: string
    readonly node: string
  }
  /** 应用级 Agent 安全设置。 */
  readonly agentSettings: AgentSettingsBridge
  readonly account: AccountBridge
  readonly clipboard: ClipboardBridge
  readonly extensions: ExtensionBridge
  readonly lifecycle: LifecycleBridge
  readonly providerProfiles: ProviderProfileBridge
  readonly runtime: NcxRuntimeBridge
  /** 本地模型、独立云端 ASR 与语音来源设置。 */
  readonly voiceSettings: VoiceSettingsBridge
  readonly voiceShortcut: VoiceShortcutBridge
  /** 用户授权 Shell 工作区设置。 */
  readonly shellSettings: ShellSettingsBridge
  readonly windowControls: WindowControlBridge
}
