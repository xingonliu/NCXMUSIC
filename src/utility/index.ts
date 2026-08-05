import { RuntimeConnectionMetadataSchema } from '../shared/contracts/control-plane'
import {
  CredentialControlCommandSchema,
  CredentialControlEventSchema
} from '../shared/contracts/credential-lease'
import { CredentialLeaseService } from './credential-lease-service'
import { UtilityRuntimeServer, type RuntimePort } from './runtime-server'

const runtime = new UtilityRuntimeServer()
const credentialLease = new CredentialLeaseService((event) => {
  process.parentPort.postMessage(CredentialControlEventSchema.parse(event))
})

process.parentPort.on('message', (event) => {
  const metadata = RuntimeConnectionMetadataSchema.safeParse(event.data)
  const transferredPort = event.ports[0]
  if (!metadata.success || !transferredPort) {
    const command = CredentialControlCommandSchema.safeParse(event.data)
    if (command.success) {
      void credentialLease.handle(command.data)
    }
    return
  }

  const listeners = new Map<(message: unknown) => void, (event: Electron.MessageEvent) => void>()
  const port: RuntimePort = {
    postMessage: (message) => transferredPort.postMessage(message),
    subscribe: (listener) => {
      const wrapped = (messageEvent: Electron.MessageEvent): void => listener(messageEvent.data)
      listeners.set(listener, wrapped)
      transferredPort.on('message', wrapped)
      return () => {
        const registered = listeners.get(listener)
        if (registered) {
          transferredPort.off('message', registered)
          listeners.delete(listener)
        }
      }
    },
    start: () => transferredPort.start(),
    close: () => transferredPort.close()
  }

  runtime.attach(port, metadata.data)
})

process.once('exit', () => {
  credentialLease.shutdown()
  runtime.shutdown()
})
