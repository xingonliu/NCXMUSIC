import { RuntimeConnectionMetadataSchema } from '../shared/schemas/control-plane'
import { PROTOCOL_VERSION } from '../shared/schemas/runtime'
import { UtilityRuntimeServer, type RuntimePort } from './runtime-server'

const runtime = new UtilityRuntimeServer()
const shouldCrashBeforeReady = process.argv.includes('--ncx-smoke-crash-before-ready')

process.parentPort.on('message', (event) => {
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
process.once('exit', () => runtime.shutdown())
