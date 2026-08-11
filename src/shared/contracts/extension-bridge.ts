import type {
  ExtensionSettingsRequest,
  ExtensionSettingsResult
} from '../schemas/extensions'

// ========= 变量 =========

/** Main 与 Preload 间唯一扩展设置请求通道。 */
export const EXTENSION_CHANNELS = {
  request: 'ncx:extensions:request'
} as const

// ========= 类型 =========

/** Renderer 可用的扩展设置最小桥。 */
export interface ExtensionBridge {
  /** 管理 Skill/MCP，并只返回无秘密公开快照。 */
  request(input: ExtensionSettingsRequest): Promise<ExtensionSettingsResult>
}
