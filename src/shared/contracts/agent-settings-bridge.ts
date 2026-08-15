import type {
  AgentSafetySettingsRequest,
  AgentSafetySettingsResult
} from '../schemas/agent-settings'

// ========= 变量 =========

/** Renderer 与 Main 间唯一 Agent 安全设置通道。 */
export const AGENT_SETTINGS_CHANNELS = {
  request: 'ncx:agent-settings:request'
} as const

// ========= 类型 =========

/** Renderer 可用的 Agent 安全设置桥。 */
export interface AgentSettingsBridge {
  /** 读取或持久化应用级 Agent 安全偏好。 */
  request(input: AgentSafetySettingsRequest): Promise<AgentSafetySettingsResult>
}
