import {
  RUNTIME_PROTOCOL_VERSION,
  RuntimeReadyMessageSchema
} from '../shared/schemas/runtime'

const readyMessage = RuntimeReadyMessageSchema.parse({
  kind: 'runtime.ready',
  protocolVersion: RUNTIME_PROTOCOL_VERSION,
  pid: process.pid
})

process.parentPort.postMessage(readyMessage)
process.parentPort.on('message', () => {
  // The runtime control plane is introduced after the shared protocol registry lands.
})
