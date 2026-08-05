import { contextBridge, ipcRenderer } from 'electron'

import {
  CONTROL_CHANNELS,
  RuntimeConnectionMetadataSchema,
  RuntimeStatusSchema,
  type RuntimeStatus
} from '../shared/contracts/control-plane'
import type { NcxRuntimeBridge } from '../shared/contracts/runtime-bridge'
import { RuntimeGateway } from './runtime-gateway'

const gateway = new RuntimeGateway()
const statusListeners = new Set<(status: RuntimeStatus) => void>()

ipcRenderer.on(CONTROL_CHANNELS.port, (event, rawMetadata) => {
  const metadata = RuntimeConnectionMetadataSchema.safeParse(rawMetadata)
  const transferredPort = event.ports[0]
  if (!metadata.success || !transferredPort) {
    return
  }

  gateway.attach(
    {
      postMessage: (message) => transferredPort.postMessage(message),
      start: () => transferredPort.start(),
      close: () => transferredPort.close(),
      setMessageHandler: (handler) => {
        transferredPort.onmessage = (messageEvent): void => handler(messageEvent.data)
      },
      setCloseHandler: (handler) => {
        transferredPort.onmessageerror = handler
      }
    },
    metadata.data
  )
})

ipcRenderer.on(CONTROL_CHANNELS.status, (_event, rawStatus) => {
  const status = RuntimeStatusSchema.safeParse(rawStatus)
  if (!status.success) {
    return
  }

  for (const listener of statusListeners) {
    listener(status.data)
  }

  if (status.data.state === 'ready') {
    ipcRenderer.send(CONTROL_CHANNELS.connect)
  }
})

const bridge: NcxRuntimeBridge = {
  waitUntilReady: (timeoutMs) => gateway.waitUntilReady(timeoutMs),
  ping: (input) => gateway.ping(input),
  cancel: (requestId) => gateway.cancel(requestId),
  snapshot: () => gateway.snapshot(),
  retryUtility: async () => {
    const result = await ipcRenderer.invoke(CONTROL_CHANNELS.retry)
    return RuntimeStatusSchema.parse(result)
  },
  onStatus: (listener) => {
    statusListeners.add(listener)
    return () => statusListeners.delete(listener)
  }
}

contextBridge.exposeInMainWorld('ncx', { runtime: bridge })
ipcRenderer.send(CONTROL_CHANNELS.connect)
