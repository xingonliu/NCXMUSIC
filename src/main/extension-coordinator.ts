import { extname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

import type { UtilitySupervisor } from './utility-supervisor'
import { McpConfigStore, type McpRuntimeObservation, type McpSecretProtector } from '../infrastructure/extensions/mcp-config-store'
import { SkillPackageManager } from '../infrastructure/extensions/skill-package-manager'
import {
  ExtensionLifecycleRequestSchema,
  ExtensionLifecycleResultSchema,
  ExtensionProbeResultSchema,
  ExtensionRuntimeStatusEventSchema,
  ExtensionToolScopeChangedEventSchema,
  McpMarketSearchResultSchema,
  McpMarketServerDetailSchema,
  SkillMarketSearchResultSchema,
  ExtensionSettingsRequestSchema,
  ExtensionSettingsResultSchema,
  type ExtensionSettingsRequest,
  type ExtensionSettingsResult,
  type McpMarketSearchResult,
  type McpMarketServerDetail,
  type SkillMarketSearchResult
} from '../shared/schemas/extensions'
import { redactSensitiveText } from '../shared/errors/redact-sensitive-text'

// ========= 类型 =========

/** 本地 Skill 选择器返回值。 */
export interface SelectedSkillSource {
  /** 用户选择的绝对路径。 */
  readonly path: string
  /** 文件夹或 ZIP 来源。 */
  readonly type: 'folder' | 'zip'
}

/** 等待 Utility MCP Probe 的内部项。 */
interface PendingProbe {
  /** 完成测试。 */
  readonly resolve: (result: ReturnType<typeof ExtensionProbeResultSchema.parse>) => void
  /** 有限超时。 */
  readonly timer: ReturnType<typeof setTimeout>
}

/** 已向 Renderer 展示且尚未确认写入的 MCP 导入。 */
interface PendingImport {
  /** 原始文档 SHA-256，防止预览后替换内容。 */
  readonly documentDigest: string
  /** Main 内存中已校验的候选配置与临时 Secret。 */
  readonly candidates: ReturnType<McpConfigStore['previewImport']>
  /** 普通确认最晚有效时间。 */
  readonly expiresAt: number
  /** 到期后主动释放候选配置与临时 Secret。 */
  readonly expiryTimer: ReturnType<typeof setTimeout>
}

/** Smithery MCP 市场搜索请求。 */
type McpMarketSearchRequest = Extract<ExtensionSettingsRequest, { operation: 'mcp.market.search' }>

/** SkillHub 市场搜索请求。 */
type SkillMarketSearchRequest = Extract<ExtensionSettingsRequest, { operation: 'skill.market.search' }>

/** Extension Coordinator 构造参数。 */
export interface ExtensionCoordinatorOptions {
  /** AppData 数据根目录。 */
  readonly dataRoot: string
  /** Main safeStorage 保护器。 */
  readonly protector: McpSecretProtector
  /** Main 已有 Utility 监督器。 */
  readonly supervisor: UtilitySupervisor
  /** 系统文件/目录选择器。 */
  readonly chooseSkillSource: (sourceType: 'folder' | 'zip') => Promise<SelectedSkillSource | undefined>
}

// ========= 变量 =========

/** MCP 连接测试最长等待。 */
const MCP_PROBE_TIMEOUT_MS = 30_000

/** MCP 导入预览令牌有效期。 */
const MCP_IMPORT_PREVIEW_TIMEOUT_MS = 5 * 60 * 1_000

/** 同时驻留 Main 内存的导入预览上限。 */
const MCP_IMPORT_PREVIEW_LIMIT = 8

/** MCP Hub 中国公开 MCP Server 列表接口。 */
const MCP_CN_MARKET_URL = 'https://mcp-cn.com/api/servers'

/** MCP Hub 中国公开 MCP Server 详情接口。 */
const MCP_CN_DETAIL_URL = 'https://mcp-cn.com/api/servers/get_details'

/** MCP 市场单次请求超时。 */
const MCP_MARKET_TIMEOUT_MS = 12_000

/** SkillHub 公开 Skill 列表与搜索接口。 */
const SKILLHUB_MARKET_URL = 'https://api.skillhub.cn/api/skills'

/** Skill 市场单次请求超时。 */
const SKILL_MARKET_TIMEOUT_MS = 12_000

// ========= 类 =========

/** Main 独占扩展配置、Secret 与 Runtime 同步协调器。 */
export class ExtensionCoordinator {
  /** Dynamic Skill 安装仓库。 */
  private readonly skills: SkillPackageManager

  /** MCP 配置与 Secret 仓库。 */
  private readonly mcp: McpConfigStore

  /** Utility 报告的脱敏运行状态。 */
  private readonly observations: Record<string, McpRuntimeObservation> = {}

  /** 等待中的 MCP 测试。 */
  private readonly pendingProbes = new Map<string, PendingProbe>()

  /** 只驻留 Main 内存的 MCP 导入预览。 */
  private readonly pendingImports = new Map<string, PendingImport>()

  /** 每次同步递增的版本。 */
  private revision = 0

  /** Utility 控制面监听取消器。 */
  private readonly unsubscribeControl: () => void

  constructor(private readonly options: ExtensionCoordinatorOptions) {
    this.skills = new SkillPackageManager(options.dataRoot)
    this.mcp = new McpConfigStore(options.dataRoot, options.protector)
    this.mcp.load()
    this.skills.discover()
    this.unsubscribeControl = options.supervisor.onControlMessage((message) => this.handleControlMessage(message))
  }

  /** 处理 Renderer 白名单设置请求并返回不含 Secret 的快照。 */
  async handle(rawRequest: ExtensionSettingsRequest): Promise<ExtensionSettingsResult> {
    /** 经共享 Schema 校验的设置请求。 */
    const request = ExtensionSettingsRequestSchema.parse(rawRequest)
    /** 可选面向用户结果。 */
    let message: string | undefined
    /** 可选无秘密导出文档。 */
    let exportDocument: string | undefined
    /** 可选导入预览。 */
    let importPreview: ExtensionSettingsResult['importPreview']
    /** 可选导入确认令牌。 */
    let importToken: string | undefined
    /** 可选 MCP 市场搜索结果。 */
    let mcpMarket: McpMarketSearchResult | undefined
    /** 可选 MCP 市场条目详情。 */
    let marketDetail: McpMarketServerDetail | undefined
    /** 可选 Skill 市场搜索结果。 */
    let skillMarket: SkillMarketSearchResult | undefined

    if (request.operation === 'skill.discover') {
      this.skills.discover()
      message = '已重新扫描 AppData Skills。'
    } else if (request.operation === 'skill.chooseImport') {
      /** 用户通过系统对话框选择的来源。 */
      const selected = await this.options.chooseSkillSource(request.sourceType)
      if (selected) {
        await this.skills.install({ type: selected.type, path: selected.path })
        message = 'Skill 已导入，默认保持禁用。'
      }
    } else if (request.operation === 'skill.installGit') {
      await this.skills.install({ type: 'git', url: request.url })
      message = 'HTTPS Git Skill 已锁定当前 commit 导入，默认保持禁用。'
    } else if (request.operation === 'skill.installMarket') {
      const downloadUrl = `https://api.skillhub.cn/api/v1/download?slug=${encodeURIComponent(request.slug)}${request.version ? `&version=${encodeURIComponent(request.version)}` : ''}`
      await this.skills.install({
        type: 'market',
        slug: request.slug,
        ...(request.version ? { version: request.version } : {}),
        downloadUrl
      })
      message = `已从 SkillHub 安装 ${request.slug}，默认保持禁用。`
    } else if (request.operation === 'skill.market.search') {
      skillMarket = await this.searchSkillMarket(request)
    } else if (request.operation.startsWith('skill.')) {
      await this.handleSkillMutation(request)
      message = 'Skill 状态已更新。'
    } else if (request.operation === 'mcp.upsert') {
      this.mcp.upsert(request.config, request.environment, request.headers, true)
      message = 'MCP 配置已安全保存；请测试实际工具范围。'
    } else if (request.operation === 'mcp.test') {
      message = await this.probe(request.serverId)
    } else if (request.operation === 'mcp.enable') {
      this.mcp.setEnabled(request.serverId, true)
      message = 'MCP Server 已启用。'
    } else if (request.operation === 'mcp.disable') {
      this.mcp.setEnabled(request.serverId, false)
      message = 'MCP Server 已禁用并关闭会话。'
    } else if (request.operation === 'mcp.rollback') {
      this.mcp.rollback(request.serverId)
      message = 'MCP 配置已回滚到上一版。'
    } else if (request.operation === 'mcp.delete') {
      this.mcp.delete(request.serverId)
      delete this.observations[request.serverId]
      message = '已删除 Ncxmusic 中的 MCP 配置和凭据；未触碰 Server 外部数据。'
    } else if (request.operation === 'mcp.export') {
      exportDocument = this.mcp.exportDocument()
      message = '已生成不含 Secret 的可逆配置文档。'
    } else if (request.operation === 'mcp.import') {
      if (request.confirm) {
        /** 必须与刚才展示的预览令牌及原始文档完全一致。 */
        const token = request.previewToken
        const pending = token ? this.pendingImports.get(token) : undefined
        if (!token || !pending || pending.expiresAt <= Date.now()
          || pending.documentDigest !== documentDigest(request.document)) {
          if (token && pending) {
            clearTimeout(pending.expiryTimer)
            this.pendingImports.delete(token)
          }
          throw new Error('MCP 导入预览已变化或过期，请重新预览后确认。')
        }
        clearTimeout(pending.expiryTimer)
        this.pendingImports.delete(token)
        for (const candidate of pending.candidates) {
          this.mcp.upsert(candidate.config, candidate.environment, candidate.headers, false)
        }
        message = `已导入 ${pending.candidates.length} 个 MCP 配置，全部禁用并等待测试批准。`
      } else {
        /** 解析结果只在 Main 内存停留到用户确认或五分钟过期。 */
        const candidates = this.mcp.previewImport(request.document)
        this.prunePendingImports()
        /** 当前预览的一次性随机令牌。 */
        const previewToken = randomUUID()
        importToken = previewToken
        /** 五分钟后主动释放本次预览及其中的临时 Secret。 */
        const expiryTimer = setTimeout(() => this.pendingImports.delete(previewToken), MCP_IMPORT_PREVIEW_TIMEOUT_MS)
        expiryTimer.unref?.()
        this.pendingImports.set(previewToken, {
          documentDigest: documentDigest(request.document),
          candidates,
          expiresAt: Date.now() + MCP_IMPORT_PREVIEW_TIMEOUT_MS,
          expiryTimer
        })
        importPreview = candidates.map((candidate) => candidate.config)
        message = `预览发现 ${candidates.length} 个配置；确认后才会写入。`
      }
    } else if (request.operation === 'mcp.market.search') {
      mcpMarket = await this.searchMcpMarket(request)
    } else if (request.operation === 'mcp.market.resolve') {
      marketDetail = await this.resolveMcpMarketDetail(request.qualifiedName)
    }

    if (!['snapshot', 'mcp.test', 'mcp.market.search', 'mcp.market.resolve', 'skill.market.search'].includes(request.operation)) this.syncUtility()
    return ExtensionSettingsResultSchema.parse({
      snapshot: this.snapshot(),
      ...(message ? { message } : {}),
      ...(exportDocument ? { exportDocument } : {}),
      ...(importPreview ? { importPreview } : {}),
      ...(importToken ? { importToken } : {}),
      ...(skillMarket ? { skillMarket } : {}),
      ...(mcpMarket ? { mcpMarket } : {}),
      ...(marketDetail ? { marketDetail } : {})
    })
  }

  /** Utility 启动/重启后重新注入当前扩展运行配置。 */
  syncUtility(): boolean {
    this.revision += 1
    try {
      return this.options.supervisor.postControl({
        kind: 'extension.runtime.sync',
        revision: this.revision,
        skills: this.skills.runtimeDescriptors(),
        mcpServers: this.mcp.runtimeConfigs()
      })
    } catch (error) {
      console.warn('[ExtensionCoordinator] 同步 Utility 扩展配置失败:', error)
      return false
    }
  }

  /** 返回最新公开设置快照。 */
  snapshot(): ExtensionSettingsResult['snapshot'] {
    return {
      skills: this.skills.discover(),
      mcpServers: this.mcp.snapshots(this.observations),
      updatedAt: Date.now()
    }
  }

  /** 从 MCP Hub 中国公开接口搜索 MCP Server 市场。 */
  private async searchMcpMarket(request: McpMarketSearchRequest): Promise<McpMarketSearchResult> {
    /** 组装后的查询参数。 */
    const parameters = new URLSearchParams({
      page: String(request.page),
      pageSize: String(request.pageSize)
    })
    if (request.q) parameters.set('keywords', request.q)

    /** 本次请求的取消控制器。 */
    const controller = new AbortController()
    /** 本次请求的超时计时器。 */
    const timeout = setTimeout(() => controller.abort(), MCP_MARKET_TIMEOUT_MS)
    try {
      /** MCP Hub 中国公开目录响应。 */
      const response = await fetch(`${MCP_CN_MARKET_URL}?${parameters.toString()}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`MCP Hub 中国市场请求失败（HTTP ${response.status}）。`)
      /** 未信任的远程 JSON。 */
      const payload = await response.json() as {
        code?: number
        message?: string
        data?: Array<{
          server_id: number
          logo?: string | null
          qualified_name: string
          display_name?: string | null
          description?: string | null
          repository_id?: string | null
          creator?: string | null
          package_url?: string | null
          use_count?: number | null
          is_domestic?: boolean | null
          created_at?: string | null
          connections?: unknown
        }>
        pagination?: {
          total?: number
          page?: number
          pageSize?: number
        }
      }
      if (typeof payload.code === 'number' && payload.code !== 0) {
        throw new Error(payload.message || 'MCP Hub 中国市场返回错误状态。')
      }
      const rawList = Array.isArray(payload.data) ? payload.data : []
      const servers = rawList.map((item) => ({
        id: String(item.server_id),
        qualifiedName: item.qualified_name,
        namespace: item.creator || '',
        displayName: item.display_name || item.qualified_name,
        description: item.description || '',
        ...(item.logo ? { iconUrl: item.logo } : {}),
        verified: true,
        useCount: item.use_count ?? 0,
        remote: false,
        ...(item.package_url || item.repository_id
          ? { homepage: item.package_url || `https://github.com/${item.repository_id}` }
          : {}),
        ...(item.created_at ? { createdAt: item.created_at } : {})
      }))
      const totalCount = payload.pagination?.total ?? servers.length
      const currentPage = payload.pagination?.page ?? request.page
      const pageSize = payload.pagination?.pageSize ?? request.pageSize
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

      return McpMarketSearchResultSchema.parse({
        servers,
        pagination: {
          currentPage,
          pageSize,
          totalPages,
          totalCount
        }
      })
    } catch (error) {
      /** 对 Renderer 公开的脱敏错误。 */
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'MCP Hub 中国市场请求超时。'
        : readableError(error, 'MCP Hub 中国市场请求失败。')
      throw new Error(redactSensitiveText(message).slice(0, 500), { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }

  /** 从 MCP Hub 中国公开接口解析指定 MCP Server 详情与连接配置。 */
  private async resolveMcpMarketDetail(qualifiedName: string): Promise<McpMarketServerDetail> {
    /** 本次请求的取消控制器。 */
    const controller = new AbortController()
    /** 本次请求的超时计时器。 */
    const timeout = setTimeout(() => controller.abort(), MCP_MARKET_TIMEOUT_MS)
    try {
      /** MCP Hub 中国单个 Server 详情响应。 */
      const response = await fetch(`${MCP_CN_DETAIL_URL}?qualifiedName=${encodeURIComponent(qualifiedName)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`MCP Hub 中国详情获取失败（HTTP ${response.status}）。`)
      /** 未信任的远程 JSON。 */
      const payload = await response.json() as {
        code?: number
        message?: string
        data?: {
          server_id: number
          logo?: string | null
          qualified_name: string
          display_name?: string | null
          description?: string | null
          repository_id?: string | null
          package_url?: string | null
          connections?: unknown
        }
      }
      if ((typeof payload.code === 'number' && payload.code !== 0) || !payload.data) {
        throw new Error(payload.message || 'MCP Hub 中国详情返回错误状态。')
      }
      const item = payload.data
      const parsedConnections = parseMcpCnConnections(item.connections)
      const primary = parsedConnections[0]

      return McpMarketServerDetailSchema.parse({
        qualifiedName: item.qualified_name,
        displayName: item.display_name || item.qualified_name,
        description: item.description || '',
        ...(item.logo ? { iconUrl: item.logo } : {}),
        remote: Boolean(primary?.deploymentUrl),
        ...(primary?.command ? { command: primary.command } : {}),
        ...(primary?.args ? { args: primary.args } : {}),
        ...(primary?.env ? { env: primary.env } : {}),
        ...(primary?.deploymentUrl ? { deploymentUrl: primary.deploymentUrl } : {}),
        connections: parsedConnections
      })
    } catch (error) {
      /** 对 Renderer 公开的脱敏错误。 */
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'MCP Hub 中国详情请求超时。'
        : readableError(error, 'MCP Hub 中国详情请求失败。')
      throw new Error(redactSensitiveText(message).slice(0, 500), { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }

  /** 关闭监听与所有待决测试。 */
  shutdown(): void {
    this.unsubscribeControl()
    for (const [requestId, pending] of this.pendingProbes) {
      clearTimeout(pending.timer)
      pending.resolve(ExtensionProbeResultSchema.parse({
        kind: 'extension.probe.result',
        requestId,
        serverId: 'unknown-server',
        ok: false,
        message: '应用正在关闭。'
      }))
    }
    this.pendingProbes.clear()
    for (const pending of this.pendingImports.values()) clearTimeout(pending.expiryTimer)
    this.pendingImports.clear()
  }

  /** 清除过期 MCP 导入及其只驻内存的 Secret。 */
  private prunePendingImports(): void {
    /** 当前时间。 */
    const now = Date.now()
    for (const [token, pending] of this.pendingImports) {
      if (pending.expiresAt > now) continue
      clearTimeout(pending.expiryTimer)
      this.pendingImports.delete(token)
    }
    while (this.pendingImports.size >= MCP_IMPORT_PREVIEW_LIMIT) {
      /** Map 迭代顺序中的最旧预览。 */
      const oldestToken = this.pendingImports.keys().next().value as string | undefined
      if (!oldestToken) break
      /** 将被逐出的最旧候选。 */
      const oldest = this.pendingImports.get(oldestToken)
      if (oldest) clearTimeout(oldest.expiryTimer)
      this.pendingImports.delete(oldestToken)
    }
  }

  /** 执行 Skill 生命周期动作。 */
  private async handleSkillMutation(request: ExtensionSettingsRequest): Promise<void> {
    if (!('name' in request)) return
    if (request.operation === 'skill.enable') this.skills.setEnabled(request.name, true)
    else if (request.operation === 'skill.disable') this.skills.setEnabled(request.name, false)
    else if (request.operation === 'skill.update') await this.skills.update(request.name)
    else if (request.operation === 'skill.rollback') this.skills.rollback(request.name)
    else if (request.operation === 'skill.uninstall') this.skills.uninstall(request.name)
  }

  /** 请求 Utility 使用官方 SDK 测试一次 MCP Server。 */
  private async probe(serverId: string): Promise<string> {
    this.syncUtility()
    /** 测试请求 ID。 */
    const requestId = crypto.randomUUID()
    /** Utility 测试结果。 */
    const result = await new Promise<ReturnType<typeof ExtensionProbeResultSchema.parse>>((resolve) => {
      /** 有限超时。 */
      const timer = setTimeout(() => {
        this.pendingProbes.delete(requestId)
        resolve(ExtensionProbeResultSchema.parse({
          kind: 'extension.probe.result',
          requestId,
          serverId,
          ok: false,
          message: 'MCP 连接测试超时。'
        }))
      }, MCP_PROBE_TIMEOUT_MS)
      this.pendingProbes.set(requestId, { resolve, timer })
      if (!this.options.supervisor.postControl({ kind: 'extension.probe.request', requestId, serverId })) {
        clearTimeout(timer)
        this.pendingProbes.delete(requestId)
        resolve(ExtensionProbeResultSchema.parse({
          kind: 'extension.probe.result',
          requestId,
          serverId,
          ok: false,
          message: 'Utility 当前不可用。'
        }))
      }
    })
    if (result.ok) {
      this.mcp.recordProbe(serverId, result.capabilities, result.tools)
      this.syncUtility()
      return result.message
    }
    throw new Error(result.message)
  }

  /** 消费 Utility 的严格 Probe 或运行状态消息。 */
  private handleControlMessage(rawMessage: unknown): void {
    /** Agent 已经通过 ApprovalCard 的生命周期请求。 */
    const lifecycle = ExtensionLifecycleRequestSchema.safeParse(rawMessage)
    if (lifecycle.success) {
      void this.handleAgentLifecycle(lifecycle.data)
      return
    }
    /** 调用前发现的真实工具范围变化。 */
    const scopeChange = ExtensionToolScopeChangedEventSchema.safeParse(rawMessage)
    if (scopeChange.success) {
      this.mcp.recordProbe(
        scopeChange.data.serverId,
        scopeChange.data.capabilities,
        scopeChange.data.tools
      )
      this.syncUtility()
      return
    }
    /** MCP Probe 终态。 */
    const probe = ExtensionProbeResultSchema.safeParse(rawMessage)
    if (probe.success) {
      /** 对应待决测试。 */
      const pending = this.pendingProbes.get(probe.data.requestId)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pendingProbes.delete(probe.data.requestId)
      pending.resolve(probe.data)
      return
    }
    /** MCP 运行状态。 */
    const status = ExtensionRuntimeStatusEventSchema.safeParse(rawMessage)
    if (!status.success) return
    this.observations[status.data.serverId] = {
      connectionState: status.data.connectionState,
      restartCount: status.data.restartCount,
      ...(status.data.lastError
        ? { lastError: redactSensitiveText(status.data.lastError).slice(0, 500) }
        : {})
    }
  }

  /** 从 SkillHub 公开接口搜索 Skill 市场。 */
  private async searchSkillMarket(request: SkillMarketSearchRequest): Promise<SkillMarketSearchResult> {
    /** 组装后的查询参数。 */
    const parameters = new URLSearchParams({
      page: String(request.page),
      pageSize: String(request.pageSize),
      sortBy: request.sortBy ?? 'downloads'
    })
    if (request.q) parameters.set('keyword', request.q)
    if (request.category) parameters.set('category', request.category)

    /** 本次请求的取消控制器。 */
    const controller = new AbortController()
    /** 本次请求的超时计时器。 */
    const timeout = setTimeout(() => controller.abort(), SKILL_MARKET_TIMEOUT_MS)
    try {
      /** SkillHub 公开目录响应。 */
      const response = await fetch(`${SKILLHUB_MARKET_URL}?${parameters.toString()}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`SkillHub 市场请求失败（HTTP ${response.status}）。`)
      /** 未信任的远程 JSON。 */
      const payload = (await response.json()) as {
        code?: number
        data?: {
          total?: number
          skills?: Array<Record<string, unknown>>
        }
      }
      if (payload?.code !== 0 && payload?.code !== undefined) {
        throw new Error('SkillHub 市场返回异常响应。')
      }
      const totalCount = payload?.data?.total ?? 0
      const rawSkills = payload?.data?.skills ?? []
      const pageSize = request.pageSize
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      const skills = rawSkills.map((item) => ({
        slug: String(item['slug'] || ''),
        name: String(item['name'] || item['slug'] || ''),
        version: String(item['version'] || '1.0.0'),
        description: typeof item['description'] === 'string' ? item['description'] : '',
        descriptionZh: typeof item['description_zh'] === 'string' ? item['description_zh'] : '',
        category: typeof item['category'] === 'string' ? item['category'] : '',
        subCategories: Array.isArray(item['subCategories'])
          ? item['subCategories'].map((sc: Record<string, unknown>) => ({
              key: String(sc['key'] || ''),
              name: String(sc['name'] || '')
            }))
          : [],
        downloads: typeof item['downloads'] === 'number' ? item['downloads'] : 0,
        stars: typeof item['stars'] === 'number' ? item['stars'] : 0,
        installs: typeof item['installs'] === 'number' ? item['installs'] : 0,
        iconUrl: typeof item['iconUrl'] === 'string' && item['iconUrl'] ? item['iconUrl'] : undefined,
        ownerName: typeof item['ownerName'] === 'string' ? item['ownerName'] : '',
        source: typeof item['source'] === 'string' ? item['source'] : '',
        verified: Boolean(item['verified']),
        homepage: typeof item['homepage'] === 'string' ? item['homepage'] : undefined,
        createdAt: typeof item['created_at'] === 'number' ? item['created_at'] : undefined,
        updatedAt: typeof item['updated_at'] === 'number' ? item['updated_at'] : undefined
      })).filter((item) => Boolean(item.slug))

      return SkillMarketSearchResultSchema.parse({
        skills,
        pagination: {
          currentPage: request.page,
          pageSize,
          totalPages,
          totalCount
        }
      })
    } catch (error) {
      /** 对 Renderer 公开的脱敏错误。 */
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'SkillHub 市场请求超时。'
        : readableError(error, 'SkillHub 市场请求失败。')
      throw new Error(redactSensitiveText(message).slice(0, 500), { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }

  /** 在 Main 权威仓库重验并执行 Agent 已批准的生命周期动作。 */
  private async handleAgentLifecycle(
    request: ReturnType<typeof ExtensionLifecycleRequestSchema.parse>
  ): Promise<void> {
    try {
      if (request.resource === 'skill') {
        if (request.action === 'install') {
          if (request.payload['slug']) {
            await this.handle(ExtensionSettingsRequestSchema.parse({
              operation: 'skill.installMarket',
              slug: request.payload['slug'],
              version: request.payload['version']
            }))
          } else {
            await this.handle(ExtensionSettingsRequestSchema.parse({
              operation: 'skill.installGit',
              url: request.payload['url']
            }))
          }
        } else {
          /** Agent Skill 动作到设置请求动作。 */
          const operation = request.action === 'uninstall'
            ? 'skill.uninstall'
            : `skill.${request.action}`
          await this.handle(ExtensionSettingsRequestSchema.parse({
            operation,
            name: request.payload['name']
          }))
        }
      } else if (request.action === 'install' || request.action === 'update') {
        /** Agent 不允许传 Secret，且新/更新配置先保持禁用等待测试。 */
        const rawConfig = request.payload['config']
        if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
          throw new Error('Agent MCP 配置无效。')
        }
        await this.handle(ExtensionSettingsRequestSchema.parse({
          operation: 'mcp.upsert',
          config: { ...rawConfig, enabled: false },
          environment: {},
          headers: {}
        }))
      } else {
        /** Agent MCP 动作到设置请求动作。 */
        const operation = `mcp.${request.action}`
        await this.handle(ExtensionSettingsRequestSchema.parse({
          operation,
          serverId: request.payload['serverId']
        }))
      }
      this.options.supervisor.postControl(ExtensionLifecycleResultSchema.parse({
        kind: 'extension.lifecycle.result',
        requestId: request.requestId,
        ok: true,
        code: 'OK',
        message: '扩展生命周期操作已完成。'
      }))
    } catch (error) {
      this.options.supervisor.postControl(ExtensionLifecycleResultSchema.parse({
        kind: 'extension.lifecycle.result',
        requestId: request.requestId,
        ok: false,
        code: 'EXTENSION_LIFECYCLE_FAILED',
        message: redactSensitiveText(error instanceof Error ? error.message : '扩展生命周期操作失败。').slice(0, 500)
      }))
    }
  }
}

// ========= 函数 =========

/** 计算不回传 Renderer 的 MCP 导入文档摘要。 */
function documentDigest(document: string): string {
  return createHash('sha256').update(document, 'utf8').digest('hex')
}

/** 把未知错误转换为面向设置页的短文案。 */
function readableError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** 依据选择路径后缀构造本地 Skill 来源；供系统选择器复用。 */
export function selectedSkillSource(path: string, isDirectory: boolean): SelectedSkillSource {
  if (isDirectory) return { type: 'folder', path }
  if (extname(path).toLowerCase() !== '.zip') throw new Error('只允许选择 Skill 文件夹或 ZIP。')
  return { type: 'zip', path }
}

/** 解析 mcp-cn 接口返回的 loose connections 字符串或对象数组。 */
export function parseMcpCnConnections(raw: unknown): Array<{
  type: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  deploymentUrl?: string
}> {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      const entry = item as Record<string, unknown>
      const cfg = (entry['config'] as Record<string, unknown> | undefined) ?? {}
      const command = typeof cfg['command'] === 'string' ? cfg['command'] : (typeof entry['command'] === 'string' ? entry['command'] : undefined)
      const args = Array.isArray(cfg['args']) ? (cfg['args'] as string[]) : (Array.isArray(entry['args']) ? (entry['args'] as string[]) : undefined)
      const env = typeof cfg['env'] === 'object' && cfg['env'] !== null ? (cfg['env'] as Record<string, string>) : (typeof entry['env'] === 'object' && entry['env'] !== null ? (entry['env'] as Record<string, string>) : undefined)
      const deploymentUrl = typeof entry['deploymentUrl'] === 'string' ? entry['deploymentUrl'] : undefined
      return {
        type: String(entry['type'] || 'stdio'),
        ...(command ? { command } : {}),
        ...(args ? { args } : {}),
        ...(env && Object.keys(env).length > 0 ? { env } : {}),
        ...(deploymentUrl ? { deploymentUrl } : {})
      }
    })
  }
  if (typeof raw !== 'string') return []
  const str = raw.trim()
  if (!str || str === '[]') return []

  try {
    const parsed = JSON.parse(str) as unknown
    if (Array.isArray(parsed)) return parseMcpCnConnections(parsed)
  } catch (_error) {
    // 忽略非法 JSON，走正则兼容提取
    void _error
  }

  // 容错解析形如 [{type:stdio,config:{command:npx,args:[-y,@foo/bar],env:{A:B}}}]
  const commandMatch = str.match(/command\s*:\s*([^,}\]]+)/u)
  const command = commandMatch?.[1]?.trim()

  const argsMatch = str.match(/args\s*:\s*\[([^\]]*)\]/u)
  let args: string[] | undefined
  if (argsMatch?.[1]) {
    args = argsMatch[1]
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
  }

  const envMatch = str.match(/env\s*:\s*\{([^}]*)\}/u)
  let env: Record<string, string> | undefined
  if (envMatch?.[1]) {
    env = {}
    const entries = envMatch[1].split(',')
    for (const entry of entries) {
      const idx = entry.indexOf(':')
      if (idx > 0) {
        const key = entry.slice(0, idx).trim()
        const val = entry.slice(idx + 1).trim()
        if (key) env[key] = val
      }
    }
  }

  const typeMatch = str.match(/type\s*:\s*([^,}\]]+)/u)
  const type = typeMatch?.[1]?.trim() || 'stdio'

  return [{
    type,
    ...(command ? { command } : {}),
    ...(args ? { args } : {}),
    ...(env && Object.keys(env).length > 0 ? { env } : {})
  }]
}
