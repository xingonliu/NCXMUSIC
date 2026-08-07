import { contextBridge, ipcRenderer } from 'electron'

import { CONTROL_CHANNELS, type RuntimeStatus } from '../shared/contracts/control-plane'
import type { DesktopBridge } from '../shared/contracts/desktop-bridge'
import type { NcxRuntimeBridge } from '../shared/contracts/runtime-bridge'
import {
  WINDOW_CONTROL_CHANNELS,
  type WindowCommand,
  type WindowControlBridge,
  type WindowDragMessage,
  type WindowSnapshot
} from '../shared/contracts/window-controls'
import {
  RuntimeConnectionMetadataSchema,
  RuntimeStatusSchema
} from '../shared/schemas/control-plane'
import { RuntimeGateway } from './runtime-gateway'

const gateway = new RuntimeGateway()
const statusListeners = new Set<(status: RuntimeStatus) => void>()
const windowSnapshotListeners = new Set<(snapshot: WindowSnapshot) => void>()
let latestStatus: RuntimeStatus = {
  state: 'starting',
  generation: 0,
  restartAttempt: 0
}

function publishStatus(status: RuntimeStatus): void {
  latestStatus = status
  for (const listener of statusListeners) listener(status)
}

function publishWindowSnapshot(snapshot: WindowSnapshot): void {
  for (const listener of windowSnapshotListeners) listener(snapshot)
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

/** 发送自绘拖拽消息，仅通知按下/松开事件本身。 */
function sendWindowDrag(type: WindowDragMessage['type']): void {
  const message = { type } satisfies WindowDragMessage
  ipcRenderer.send(WINDOW_CONTROL_CHANNELS.drag, message)
}

const windowControlBridge: WindowControlBridge = {
  snapshot: async () => ipcRenderer.invoke(WINDOW_CONTROL_CHANNELS.snapshot) as Promise<WindowSnapshot>,
  send: async (command: WindowCommand) =>
    ipcRenderer.invoke(WINDOW_CONTROL_CHANNELS.command, command) as Promise<WindowSnapshot>,
  onSnapshot: (listener) => {
    windowSnapshotListeners.add(listener)
    return () => windowSnapshotListeners.delete(listener)
  },
  dragStart: () => sendWindowDrag('window.dragStart'),
  dragEnd: () => sendWindowDrag('window.dragEnd')
}

ipcRenderer.on(WINDOW_CONTROL_CHANNELS.status, (_event, snapshot) => {
  publishWindowSnapshot(snapshot as WindowSnapshot)
})

const bridge: DesktopBridge = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }),
  runtime: runtimeBridge,
  windowControls: windowControlBridge
})

contextBridge.exposeInMainWorld('ncx', bridge)
ipcRenderer.send(CONTROL_CHANNELS.connect)
