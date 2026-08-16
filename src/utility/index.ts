import { mkdirSync } from 'node:fs'
import { RuntimeConnectionMetadataSchema } from '../shared/schemas/control-plane'
import { AgentRuntime } from '../domains/agent/agent-runtime'
import { AgentExternalTools } from '../infrastructure/extensions/agent-external-tools'
import { McpManager } from '../infrastructure/extensions/mcp-manager'
import { SkillRuntimeManager } from '../infrastructure/extensions/skill-runtime-manager'
import { requestProviderTextStream } from '../infrastructure/provider/provider-protocol'
import { AgentSafetyRuntimeSyncSchema } from '../shared/schemas/agent-settings'
import { ProviderRuntimeControlSchema } from '../shared/schemas/provider-profile'
import {
  CredentialControlCommandSchema,
  CredentialControlEventSchema
} from '../shared/contracts/credential-lease'
import {
  AccountStoreOpenCommandSchema,
  AccountStoreReadyEventSchema
} from '../shared/contracts/account-store-control'
import { UtilityAccountStore } from '../infrastructure/persistence/account-space'
import { ShellExecutor } from '../infrastructure/shell/executor'
import { ShellPolicyClassifier } from '../infrastructure/shell/policy-classifier'
import { ShellProcessSupervisor } from '../infrastructure/shell/process-supervisor'
import { ShellWorkspaceRegistry } from '../infrastructure/shell/workspace-registry'
import { PROTOCOL_VERSION } from '../shared/schemas/runtime'
import { ShellWorkspaceRuntimeSyncSchema } from '../shared/schemas/shell'
import {
  ExtensionLifecycleRequestSchema,
  ExtensionLifecycleResultSchema,
  ExtensionProbeRequestSchema,
  ExtensionProbeResultSchema,
  ExtensionRuntimeSyncSchema
} from '../shared/schemas/extensions'
import { CredentialLeaseService } from './credential-lease-service'
import { AccountDataService } from './account-data-service'
import { AgentConversationService } from './agent-conversation-service'
import { ConversationMemoryService } from './conversation-memory-service'
import { MusicService } from './music-service'
import { PersonalizationService } from './personalization-service'
import { PlaybackSnapshotService } from './playback-snapshot-service'
import { TrackUrlService } from './track-url-service'
import { VoiceTranscriptionService } from './voice-transcription-service'
import { UtilityRuntimeServer, type RuntimePort } from './runtime-server'

// ========= 变量 =========

/** Main 注入的持久数据根目录，Utility 只在此目录打开账户数据库。 */
const accountDataRoot = process.env['NCXMUSIC_DATA_ROOT']
if (!accountDataRoot) throw new Error('NCXMUSIC_DATA_ROOT is required for Utility persistence')

/** Main 注入的可重建缓存根目录。 */
const accountCacheRoot = process.env['NCXMUSIC_CACHE_ROOT']
if (!accountCacheRoot) throw new Error('NCXMUSIC_CACHE_ROOT is required for Utility cache lifecycle')

/** Utility 独占的账户 SQLite 单写者。 */
const accountStore = new UtilityAccountStore({ dataRoot: accountDataRoot })

/** 当前账户偏好、Action Journal、统计与缓存服务。 */
const accountDataService = new AccountDataService(accountStore, accountCacheRoot)

/** 当前已接收的账户 generation，用于丢弃迟到的换号命令。 */
let accountStoreGeneration = 0

/** 启动时先创建并迁移游客账户数据库。 */
const accountStoreReady = accountStore.open('guest:local')

/** Utility Shell 默认工作区根目录。 */
const defaultShellRoot = ShellWorkspaceRegistry.defaultRoot()
try {
  mkdirSync(defaultShellRoot, { recursive: true })
} catch {
  // 容错处理：忽略初始默认目录创建失败
}

const shellWorkspaceRegistry = new ShellWorkspaceRegistry({
  defaultWorkspaceRoot: defaultShellRoot,
  workspaces: []
})
const shellProcessSupervisor = new ShellProcessSupervisor({
  platform: process.platform,
  onOutput: (event) => {
    process.parentPort.postMessage(event)
    agentRuntime.publishShellOutput(event)
  }
})
const shellClassifier = new ShellPolicyClassifier({
  platform: process.platform === 'darwin' ? 'darwin' : 'win32',
  safetyLevel: 'S1',
  workspaceRegistry: shellWorkspaceRegistry
})
const shellExecutor = new ShellExecutor({
  platform: process.platform === 'darwin' ? 'darwin' : 'win32',
  classifier: shellClassifier,
  workspaceRegistry: shellWorkspaceRegistry,
  processSupervisor: shellProcessSupervisor,
  tempRoot: ShellWorkspaceRegistry.defaultRoot('ncxmusic-temp')
})
/** Utility 内官方 SDK MCP 管理器。 */
const mcpManager = new McpManager({
  onStatus: (event) => process.parentPort.postMessage(event),
  onToolScopeChanged: (event) => process.parentPort.postMessage(event)
})
/** Utility 内独立进程 Dynamic Skill 管理器。 */
const skillRuntimeManager = new SkillRuntimeManager({
  onError: (skillName, message) => console.warn(`[skill:${skillName}] ${message}`)
})
/** 等待 Main 完成 Agent 扩展生命周期变更。 */
const pendingExtensionLifecycle = new Map<string, {
  /** 完成一次 Agent 工具调用。 */
  readonly resolve: (result: { readonly ok: boolean; readonly code: string; readonly summary: string }) => void
  /** 有限等待计时器。 */
  readonly timer: ReturnType<typeof setTimeout>
}>()
/** 扩展控制消息串行尾链，保证 sync 先于紧随其后的 probe。 */
let extensionControlTail: Promise<void> = Promise.resolve()
/** Agent 外部工具统一网关。 */
const agentExternalTools = new AgentExternalTools({
  shellExecutor,
  shellClassifier,
  skills: skillRuntimeManager,
  mcp: mcpManager,
  lifecycle: {
    request: (resource, action, payload) => {
      /** 生命周期请求 ID。 */
      const requestId = crypto.randomUUID()
      return new Promise((resolve) => {
        /** Main 回执超时。 */
        const timer = setTimeout(() => {
          pendingExtensionLifecycle.delete(requestId)
          resolve({ ok: false, code: 'UTILITY_TIMEOUT', summary: '扩展生命周期操作等待 Main 超时。' })
        }, 30_000)
        pendingExtensionLifecycle.set(requestId, { resolve, timer })
        process.parentPort.postMessage(ExtensionLifecycleRequestSchema.parse({
          kind: 'extension.lifecycle.request',
          requestId,
          resource,
          action,
          payload
        }))
      })
    }
  }
})
const credentialLease = new CredentialLeaseService((event) => {
  process.parentPort.postMessage(CredentialControlEventSchema.parse(event))
})
/** 播放地址解析服务：经凭据租约取用 Cookie，Renderer 只拿到短期 HTTPS URL */
const trackUrl = new TrackUrlService(credentialLease)
/** 标准 Music Service：统一搜索与实体详情读取，不向 Renderer 暴露上游原始响应 */
const musicService = new MusicService(
  credentialLease,
  undefined,
  (eventType, payload) => accountDataService.appendInternal(eventType, payload)
)
/** 播放快照服务：只通过当前账户 SQLite 单写者读写。 */
const playbackSnapshotService = new PlaybackSnapshotService(accountStore)
/** Agent 当前连续会话服务：在时间分块前持续保存完整消息与工具时间线。 */
const agentConversationService = new AgentConversationService(accountStore)
/** Phase 6 会话块、FTS5 与 Working Memory 服务。 */
const conversationMemoryService = new ConversationMemoryService(accountStore)
/** Phase 6 音乐人格画像、变化评分与证据分页服务。 */
const personalizationService = new PersonalizationService(accountStore)
/** 当前 Provider Profile 唯一云端 ASR 服务。 */
const voiceTranscriptionService = new VoiceTranscriptionService()
/** Utility 内单会话 Agent Runtime。 */
const agentRuntime = new AgentRuntime({
  provider: {
    stream: ({ profile, messages, tools, signal }) => requestProviderTextStream(
      {
        profileId: profile.profileId,
        protocol: profile.protocol,
        model: profile.model,
        baseUrl: profile.baseUrl,
        ...(profile.headers ? { headers: profile.headers } : {}),
        ...(profile.credentialFingerprint
          ? { credentialFingerprint: profile.credentialFingerprint }
          : {})
      },
      { messages, tools },
      { signal }
    )
  },
  music: musicService,
  conversationPersistence: agentConversationService,
  memory: conversationMemoryService,
  personalization: personalizationService,
  externalTools: agentExternalTools,
  emit: (event) => runtime.publishAgentEvent(event)
})
/** Renderer MessagePort 协议服务。 */
const runtime = new UtilityRuntimeServer(
  trackUrl,
  shellExecutor,
  musicService,
  playbackSnapshotService,
  accountDataService,
  agentRuntime,
  voiceTranscriptionService
)
const shouldCrashBeforeReady = process.argv.includes('--ncx-smoke-crash-before-ready')

process.parentPort.on('message', (event) => {
  /** Main 同步的应用级 Agent 安全设置。 */
  const agentSafetySync = AgentSafetyRuntimeSyncSchema.safeParse(event.data)
  if (agentSafetySync.success) {
    agentRuntime.configureSafety(agentSafetySync.data.preferences)
    return
  }

  /** Main 同步的用户授权 Shell 工作区。 */
  const shellWorkspaceSync = ShellWorkspaceRuntimeSyncSchema.safeParse(event.data)
  if (shellWorkspaceSync.success) {
    shellWorkspaceRegistry.replace(shellWorkspaceSync.data.workspaces.map((workspace) => ({
      id: workspace.id,
      rootPath: workspace.rootPath
    })))
    return
  }

  /** Main 同步的扩展运行配置。 */
  const extensionSync = ExtensionRuntimeSyncSchema.safeParse(event.data)
  if (extensionSync.success) {
    extensionControlTail = extensionControlTail.then(async () => {
      await skillRuntimeManager.sync(extensionSync.data.skills)
      await mcpManager.sync(extensionSync.data.mcpServers)
    }).catch((error: unknown) => {
      console.warn(`扩展运行配置同步失败：${error instanceof Error ? error.message : 'unknown'}`)
    })
    return
  }

  /** Main 发起的一次 MCP initialize/tools 测试。 */
  const extensionProbe = ExtensionProbeRequestSchema.safeParse(event.data)
  if (extensionProbe.success) {
    extensionControlTail = extensionControlTail.then(async () => {
      /** 官方 SDK 测试结果。 */
      const result = await mcpManager.probe(extensionProbe.data.serverId)
      process.parentPort.postMessage(ExtensionProbeResultSchema.parse({
        kind: 'extension.probe.result',
        requestId: extensionProbe.data.requestId,
        serverId: extensionProbe.data.serverId,
        ...result
      }))
    }).catch((error: unknown) => {
      process.parentPort.postMessage(ExtensionProbeResultSchema.parse({
        kind: 'extension.probe.result',
        requestId: extensionProbe.data.requestId,
        serverId: extensionProbe.data.serverId,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 500) : 'MCP 测试失败。'
      }))
    })
    return
  }

  /** Main 完成 Agent 扩展生命周期请求的回执。 */
  const lifecycleResult = ExtensionLifecycleResultSchema.safeParse(event.data)
  if (lifecycleResult.success) {
    /** 对应待决调用。 */
    const pending = pendingExtensionLifecycle.get(lifecycleResult.data.requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingExtensionLifecycle.delete(lifecycleResult.data.requestId)
    pending.resolve({
      ok: lifecycleResult.data.ok,
      code: lifecycleResult.data.code,
      summary: lifecycleResult.data.message
    })
    return
  }

  const providerControl = ProviderRuntimeControlSchema.safeParse(event.data)
  if (providerControl.success) {
    if (providerControl.data.kind === 'agent.provider.clear') {
      agentRuntime.configureProvider(undefined)
      voiceTranscriptionService.configure(undefined)
    } else {
      const profile = providerControl.data.profile
      agentRuntime.configureProvider({
        profileId: profile.profileId,
        protocol: profile.protocol,
        model: profile.model,
        baseUrl: profile.baseUrl,
        ...(profile.headers ? { headers: profile.headers } : {}),
        ...(profile.credentialFingerprint
          ? { credentialFingerprint: profile.credentialFingerprint }
          : {})
      })
      voiceTranscriptionService.configure({
        profileId: profile.profileId,
        protocol: profile.protocol,
        model: profile.model,
        baseUrl: profile.baseUrl,
        ...(profile.headers ? { headers: profile.headers } : {}),
        ...(profile.credentialFingerprint
          ? { credentialFingerprint: profile.credentialFingerprint }
          : {})
      })
    }
    return
  }

  const accountCommand = AccountStoreOpenCommandSchema.safeParse(event.data)
  if (accountCommand.success) {
    if (accountCommand.data.accountGeneration < accountStoreGeneration) {
      process.parentPort.postMessage(AccountStoreReadyEventSchema.parse({
        kind: 'account-store.ready',
        requestId: accountCommand.data.requestId,
        accountId: accountCommand.data.accountId,
        accountGeneration: accountCommand.data.accountGeneration,
        accepted: false
      }))
      return
    }
    accountStoreGeneration = accountCommand.data.accountGeneration
    agentRuntime.terminate('account_switch')
    void agentRuntime.flushConversation()
      .then(() => accountStoreReady)
      .then(() => accountStore.switchAccount(
        accountCommand.data.accountId,
        accountCommand.data.accountGeneration
      ))
      .then(async () => {
        musicService.resetEntities()
        await agentRuntime.restoreConversation()
        process.parentPort.postMessage(AccountStoreReadyEventSchema.parse({
          kind: 'account-store.ready',
          requestId: accountCommand.data.requestId,
          accountId: accountCommand.data.accountId,
          accountGeneration: accountCommand.data.accountGeneration,
          accepted: true
        }))
      })
      .catch(() => {
        process.parentPort.postMessage(AccountStoreReadyEventSchema.parse({
          kind: 'account-store.ready',
          requestId: accountCommand.data.requestId,
          accountId: accountCommand.data.accountId,
          accountGeneration: accountCommand.data.accountGeneration,
          accepted: false
        }))
      })
    return
  }

  const command = CredentialControlCommandSchema.safeParse(event.data)
  if (command.success) {
    void credentialLease.handle(command.data).catch(() => {
      process.parentPort.postMessage({
        kind: 'auth.control-failure',
        requestId: command.data.requestId,
        code: 'UTILITY_UNAVAILABLE'
      })
    })
    return
  }

  const metadata = RuntimeConnectionMetadataSchema.safeParse(event.data)
  const transferredPort = event.ports[0]
  if (!metadata.success || !transferredPort) return

  const listeners = new Map<(message: unknown) => void, (event: Electron.MessageEvent) => void>()
  const port: RuntimePort = {
    postMessage: (message) => transferredPort.postMessage(message),
    subscribe: (listener) => {
      const wrapped = (messageEvent: Electron.MessageEvent): void => listener(messageEvent.data)
      listeners.set(listener, wrapped)
      transferredPort.on('message', wrapped)
      return () => {
        const registered = listeners.get(listener)
        if (!registered) return
        transferredPort.off('message', registered)
        listeners.delete(listener)
      }
    },
    start: () => transferredPort.start(),
    close: () => transferredPort.close()
  }

  runtime.attach(port, metadata.data)
})

if (shouldCrashBeforeReady) {
  setTimeout(() => process.exit(86), 25)
} else {
  void accountStoreReady
    .then(() => agentRuntime.restoreConversation())
    .then(() => {
      process.parentPort.postMessage({
        kind: 'utility.ready',
        protocolVersion: PROTOCOL_VERSION
      })
    })
    .catch(() => process.exit(87))
}
process.once('exit', () => {
  agentRuntime.terminate('app_exit')
  void accountStore.close()
  credentialLease.shutdown()
  musicService.shutdown()
  trackUrl.shutdown()
  shellExecutor.shutdown()
  skillRuntimeManager.shutdown()
  void mcpManager.shutdown()
  for (const pending of pendingExtensionLifecycle.values()) {
    clearTimeout(pending.timer)
    pending.resolve({ ok: false, code: 'CANCELLED', summary: 'Utility 已关闭。' })
  }
  pendingExtensionLifecycle.clear()
  voiceTranscriptionService.shutdown()
  runtime.shutdown()
})
