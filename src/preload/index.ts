import { contextBridge, ipcRenderer } from 'electron'

import { CONTROL_CHANNELS, type RuntimeStatus } from '../shared/contracts/control-plane'
import type { DesktopBridge } from '../shared/contracts/desktop-bridge'
import type { NcxRuntimeBridge } from '../shared/contracts/runtime-bridge'
import {
  RuntimeConnectionMetadataSchema,
  RuntimeStatusSchema
} from '../shared/schemas/control-plane'
import { RuntimeGateway } from './runtime-gateway'

const gateway = new RuntimeGateway()
const statusListeners = new Set<(status: RuntimeStatus) => void>()
let latestStatus: RuntimeStatus = {
  state: 'starting',
  generation: 0,
  restartAttempt: 0
}

function publishStatus(status: RuntimeStatus): void {
  latestStatus = status
  for (const listener of statusListeners) listener(status)
}

ipcRenderer.on(CONTROL_CHANNELS.port, (event, rawMetadata) => {
  const metadata = RuntimeConnectionMetadataSchema.safeParse(rawMetadata)
  const transferredPort = event.ports[0]
  if (!metadata.success || !transferredPort) return

  gateway.attach(
    {
      postMessage: (message) => transferredPort.postMessage(message),
      start: () => transferredPort.start(),
      close: () => transferredPort.close(),
      setMessageHandler: (handler) => {
        transferredPort.onmessage = (messageEvent: { data: unknown }): void =>
          handler(messageEvent.data)
      },
      setCloseHandler: (handler) => {
        transferredPort.onmessageerror = handler
      }
    },
    metadata.data
  )
  publishStatus({
    state: 'ready',
    generation: metadata.data.utilityGeneration,
    restartAttempt: latestStatus.restartAttempt
  })
})

ipcRenderer.on(CONTROL_CHANNELS.status, (_event, rawStatus) => {
  const status = RuntimeStatusSchema.safeParse(rawStatus)
  if (!status.success) return

  const shouldConnect =
    status.data.state === 'ready' &&
    (latestStatus.state !== 'ready' || latestStatus.generation !== status.data.generation)
  publishStatus(status.data)

  if (shouldConnect) {
    ipcRenderer.send(CONTROL_CHANNELS.connect)
  } else if (status.data.state !== 'ready') {
    gateway.disconnect(status.data.reason ?? `本地服务状态：${status.data.state}`)
  }
})

const runtimeBridge: NcxRuntimeBridge = {
  waitUntilReady: (timeoutMs) => gateway.waitUntilReady(timeoutMs),
  ping: (input) => gateway.ping(input),
  cancel: (requestId) => gateway.cancel(requestId),
  snapshot: () => gateway.snapshot(),
  resolveTrackUrl: (input) => gateway.resolveTrackUrl(input),
  retryUtility: async () => {
    const result = await ipcRenderer.invoke(CONTROL_CHANNELS.retry)
    return RuntimeStatusSchema.parse(result)
  },
  onStatus: (listener) => {
    statusListeners.add(listener)
    listener(latestStatus)
    return () => statusListeners.delete(listener)
  }
}

const bridge: DesktopBridge = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }),
  runtime: runtimeBridge
})

contextBridge.exposeInMainWorld('ncx', bridge)
ipcRenderer.send(CONTROL_CHANNELS.connect)
