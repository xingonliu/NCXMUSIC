import { RuntimeConnectionMetadataSchema } from '../shared/schemas/control-plane'
import {
  CredentialControlCommandSchema,
  CredentialControlEventSchema
} from '../shared/contracts/credential-lease'
import { ShellExecutor } from '../infrastructure/shell/executor'
import { ShellPolicyClassifier } from '../infrastructure/shell/policy-classifier'
import { ShellProcessSupervisor } from '../infrastructure/shell/process-supervisor'
import { ShellWorkspaceRegistry } from '../infrastructure/shell/workspace-registry'
import { PROTOCOL_VERSION } from '../shared/schemas/runtime'
import { CredentialLeaseService } from './credential-lease-service'
import { TrackUrlService } from './track-url-service'
import { UtilityRuntimeServer, type RuntimePort } from './runtime-server'

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
const runtime = new UtilityRuntimeServer(trackUrl, shellExecutor)
const shouldCrashBeforeReady = process.argv.includes('--ncx-smoke-crash-before-ready')

process.parentPort.on('message', (event) => {
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
  process.parentPort.postMessage({
    kind: 'utility.ready',
    protocolVersion: PROTOCOL_VERSION
  })
}
process.once('exit', () => {
  credentialLease.shutdown()
  trackUrl.shutdown()
  shellExecutor.shutdown()
  runtime.shutdown()
})
