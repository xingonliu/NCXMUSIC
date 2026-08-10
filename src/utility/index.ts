import { RuntimeConnectionMetadataSchema } from '../shared/schemas/control-plane'
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
import { CredentialLeaseService } from './credential-lease-service'
import { AccountDataService } from './account-data-service'
import { MusicService } from './music-service'
import { PlaybackSnapshotService } from './playback-snapshot-service'
import { TrackUrlService } from './track-url-service'
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

const shellWorkspaceRegistry = new ShellWorkspaceRegistry({
  defaultWorkspaceRoot: ShellWorkspaceRegistry.defaultRoot(),
  workspaces: []
})
const shellProcessSupervisor = new ShellProcessSupervisor({
  platform: process.platform,
  onOutput: (event) => process.parentPort.postMessage(event)
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
const runtime = new UtilityRuntimeServer(
  trackUrl,
  shellExecutor,
  musicService,
  playbackSnapshotService,
  accountDataService
)
const shouldCrashBeforeReady = process.argv.includes('--ncx-smoke-crash-before-ready')

process.parentPort.on('message', (event) => {
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
    void accountStoreReady
      .then(() => accountStore.switchAccount(
        accountCommand.data.accountId,
        accountCommand.data.accountGeneration
      ))
      .then(() => {
        musicService.resetEntities()
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
    .then(() => {
      process.parentPort.postMessage({
        kind: 'utility.ready',
        protocolVersion: PROTOCOL_VERSION
      })
    })
    .catch(() => process.exit(87))
}
process.once('exit', () => {
  void accountStore.close()
  credentialLease.shutdown()
  musicService.shutdown()
  trackUrl.shutdown()
  shellExecutor.shutdown()
  runtime.shutdown()
})
