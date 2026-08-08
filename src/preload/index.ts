import { contextBridge, ipcRenderer } from 'electron'

import { ACCOUNT_CHANNELS, type AccountBridge } from '../shared/contracts/account-bridge'
import { CONTROL_CHANNELS, type RuntimeStatus } from '../shared/contracts/control-plane'
import type { DesktopBridge } from '../shared/contracts/desktop-bridge'
import type { NcxRuntimeBridge } from '../shared/contracts/runtime-bridge'
import {
  WINDOW_CONTROL_CHANNELS,
  type WindowCommand,
  type WindowControlBridge,
  type WindowSnapshot
} from '../shared/contracts/window-controls'
import { AccountSessionSnapshotSchema, type AccountSessionSnapshot } from '../shared/schemas/account'
import {
  RuntimeConnectionMetadataSchema,
  RuntimeStatusSchema
} from '../shared/schemas/control-plane'
import { RuntimeGateway } from './runtime-gateway'

const gateway = new RuntimeGateway()
const statusListeners = new Set<(status: RuntimeStatus) => void>()
const windowSnapshotListeners = new Set<(snapshot: WindowSnapshot) => void>()
const accountSnapshotListeners = new Set<(snapshot: AccountSessionSnapshot) => void>()
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

function publishAccountSnapshot(snapshot: AccountSessionSnapshot): void {
  for (const listener of accountSnapshotListeners) listener(snapshot)
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
  readMusic: (input) => gateway.readMusic(input),
  searchMusic: (input) =>
    gateway.readMusic({
      operation: 'search',
      query: input.query,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getSong: (input) =>
    gateway.readMusic({
      operation: 'getSong',
      id: input.id,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getArtist: (input) =>
    gateway.readMusic({
      operation: 'getArtist',
      id: input.id,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getAlbum: (input) =>
    gateway.readMusic({
      operation: 'getAlbum',
      id: input.id,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getPlaylist: (input) =>
    gateway.readMusic({
      operation: 'getPlaylist',
      id: input.id,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getUser: (input) =>
    gateway.readMusic({
      operation: 'getUser',
      id: input.id,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
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

const accountBridge: AccountBridge = {
  snapshot: async () => {
    const result = await ipcRenderer.invoke(ACCOUNT_CHANNELS.snapshot)
    return AccountSessionSnapshotSchema.parse(result)
  },
  login: async () => {
    const result = await ipcRenderer.invoke(ACCOUNT_CHANNELS.login)
    return AccountSessionSnapshotSchema.parse(result)
  },
  logout: async () => {
    const result = await ipcRenderer.invoke(ACCOUNT_CHANNELS.logout)
    return AccountSessionSnapshotSchema.parse(result)
  },
  switchAccount: async () => {
    const result = await ipcRenderer.invoke(ACCOUNT_CHANNELS.switchAccount)
    return AccountSessionSnapshotSchema.parse(result)
  },
  onSnapshot: (listener) => {
    accountSnapshotListeners.add(listener)
    return () => accountSnapshotListeners.delete(listener)
  }
}

const windowControlBridge: WindowControlBridge = {
  snapshot: async () => ipcRenderer.invoke(WINDOW_CONTROL_CHANNELS.snapshot) as Promise<WindowSnapshot>,
  send: async (command: WindowCommand) =>
    ipcRenderer.invoke(WINDOW_CONTROL_CHANNELS.command, command) as Promise<WindowSnapshot>,
  onSnapshot: (listener) => {
    windowSnapshotListeners.add(listener)
    return () => windowSnapshotListeners.delete(listener)
  }
}

ipcRenderer.on(WINDOW_CONTROL_CHANNELS.status, (_event, snapshot) => {
  publishWindowSnapshot(snapshot as WindowSnapshot)
})

ipcRenderer.on(ACCOUNT_CHANNELS.status, (_event, rawSnapshot) => {
  const snapshot = AccountSessionSnapshotSchema.safeParse(rawSnapshot)
  if (!snapshot.success) return
  publishAccountSnapshot(snapshot.data)
})

const bridge: DesktopBridge = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }),
  account: accountBridge,
  runtime: runtimeBridge,
  windowControls: windowControlBridge
})

contextBridge.exposeInMainWorld('ncx', bridge)
ipcRenderer.send(CONTROL_CHANNELS.connect)
