import {
  ProviderProtocolError,
  requestProviderTextStream,
  type ProviderStreamEvent
} from '../infrastructure/provider/provider-protocol'
import type { ProviderProfileStore } from '../infrastructure/credentials/provider-profile-store'
import { fetchOpenRouterModelCatalog } from '../infrastructure/provider/openrouter-model-catalog'
import type { UtilitySupervisor } from './utility-supervisor'
import {
  ProviderProfileRequestSchema,
  ProviderProfileResultSchema,
  type ProviderCapabilitySnapshot,
  type ProviderModelCatalog,
  type ProviderProfileRequest,
  type ProviderProfileResult
} from '../shared/schemas/provider-profile'
import { sanitizeErrorMessage } from '../shared/errors/public-error'

// ========= 变量 =========

/** OpenRouter 目录加载失败时的兜底展示文案。 */
const CATALOG_LOAD_FALLBACK_MESSAGE = 'OpenRouter 模型目录加载失败，请检查网络后重试。'

// ========= 函数 =========

/** 将目录异常转换为 Renderer 可展示、已脱敏且长度受控的错误文案。 */
function createCatalogErrorMessage(error: unknown): string {
  /** 原始异常中可安全展示的消息。 */
  const message = error instanceof Error || typeof error === 'string'
    ? sanitizeErrorMessage(error)
    : ''
  return message || CATALOG_LOAD_FALLBACK_MESSAGE
}

// ========= 类 =========

/** 协调 Renderer Profile 管理、Main 安全存储与 Utility 私有配置注入。 */
export class ProviderProfileCoordinator {
  constructor(
    private readonly store: ProviderProfileStore,
    private readonly supervisor: UtilitySupervisor
  ) {}

  /** 处理白名单化 Profile 请求并返回无秘密快照。 */
  async handle(rawRequest: ProviderProfileRequest): Promise<ProviderProfileResult> {
    /** 经共享 Schema 校验的请求。 */
    const request = ProviderProfileRequestSchema.parse(rawRequest)
    /** 可选验证提示。 */
    let verificationMessage: string | undefined
    /** 按需拉取且不包含凭据的 OpenRouter 模型目录。 */
    let catalog: ProviderModelCatalog | undefined
    /** 目录加载失败时返回给 Renderer 的可展示错误。 */
    let catalogError: string | undefined
    if (request.operation === 'save') this.store.save(request.profile)
    else if (request.operation === 'delete') this.store.delete(request.profileId)
    else if (request.operation === 'setDefault') this.store.setDefault(request.profileId)
    else if (request.operation === 'verify') {
      verificationMessage = await this.verify(request.profileId)
    } else if (request.operation === 'catalog') {
      try {
        catalog = await fetchOpenRouterModelCatalog()
      } catch (error) {
        catalogError = createCatalogErrorMessage(error)
      }
    }
    if (request.operation === 'save' || request.operation === 'delete' || request.operation === 'setDefault') {
      this.syncUtility()
    }
    return ProviderProfileResultSchema.parse({
      profiles: this.store.list(),
      ...(this.store.activeProfileId() ? { activeProfileId: this.store.activeProfileId() } : {}),
      ...(verificationMessage ? { verificationMessage } : {}),
      ...(catalogError ? { catalogError } : {}),
      ...(catalog ? { catalog } : {})
    })
  }

  /** Utility 启动/重启后重新注入唯一默认 Profile。 */
  syncUtility(): boolean {
    /** 当前默认可执行 Profile。 */
    const profile = this.store.runtimeProfile()
    return this.supervisor.postControl(profile
      ? { kind: 'agent.provider.configure', profile }
      : { kind: 'agent.provider.clear' })
  }

  /** 执行最小流式与 Tool Call 验证；失败不会删除 Profile。 */
  private async verify(profileId: string): Promise<string> {
    /** 待验证执行 Profile。 */
    const profile = this.store.runtimeProfile(profileId)
    if (!profile) throw new Error('Provider Profile 不存在或已停用。')
    /** 验证开始时间。 */
    const startedAt = Date.now()
    /** 已观察事件。 */
    const events: ProviderStreamEvent[] = []
    try {
      /** 与协议层精确可选字段兼容的执行 Profile。 */
      const executableProfile = {
        profileId: profile.profileId,
        protocol: profile.protocol,
        model: profile.model,
        baseUrl: profile.baseUrl,
        ...(profile.headers ? { headers: profile.headers } : {}),
        ...(profile.credentialFingerprint
          ? { credentialFingerprint: profile.credentialFingerprint }
          : {})
      }
      for await (const event of requestProviderTextStream(executableProfile, {
        messages: [
          { role: 'system', content: '你正在进行连接测试。请调用 connection_probe 工具一次，不要输出敏感信息。' },
          { role: 'user', content: '执行连接测试。' }
        ],
        tools: [{
          name: 'connection_probe',
          description: '无副作用连接测试',
          parameters: { type: 'object', properties: {}, additionalProperties: false }
        }],
        maxTokens: 64
      })) events.push(event)
      /** 能力测试快照。 */
      const capabilities: ProviderCapabilitySnapshot = {
        text: events.some((event) => event.type === 'text-delta'),
        streaming: events.length > 0,
        toolCalls: events.some((event) => event.type === 'tool-call-delta'),
        modelListing: false,
        latencyMs: Date.now() - startedAt
      }
      this.store.markVerified(profileId, capabilities)
      this.syncUtility()
      return capabilities.toolCalls
        ? '连接、流式与 Tool Call 验证通过。'
        : '连接与流式响应可用，但模型未通过 Tool Call 验证。'
    } catch (error) {
      /** 已归一化且脱敏的 Provider 错误。 */
      const message = error instanceof ProviderProtocolError
        ? error.normalized.message
        : 'Provider 验证失败，请检查地址、凭据和模型 ID。'
      return message
    }
  }
}
