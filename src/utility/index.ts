import { RuntimeConnectionMetadataSchema } from '../shared/schemas/control-plane'
import {
  CredentialControlCommandSchema,
  CredentialControlEventSchema
} from '../shared/contracts/credential-lease'
import { PROTOCOL_VERSION } from '../shared/schemas/runtime'
import { CredentialLeaseService } from './credential-lease-service'
import { UtilityRuntimeServer, type RuntimePort } from './runtime-server'

const runtime = new UtilityRuntimeServer()
const credentialLease = new CredentialLeaseService((event) => {
  process.parentPort.postMessage(CredentialControlEventSchema.parse(event))
})
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
  runtime.shutdown()
})
