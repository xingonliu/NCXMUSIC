import type {
  ProviderProfileRequest,
  ProviderProfileResult
} from '../schemas/provider-profile'

// ========= 变量 =========

/** Provider Profile 受限 IPC 通道。 */
export const PROVIDER_PROFILE_CHANNELS = {
  request: 'ncx:provider-profile:request'
} as const

// ========= 类型 =========

/** Preload 向 Renderer 暴露的 Provider Profile 白名单桥。 */
export interface ProviderProfileBridge {
  /** 管理 Main 持有的公开配置与加密凭据。 */
  request(input: ProviderProfileRequest): Promise<ProviderProfileResult>
}
