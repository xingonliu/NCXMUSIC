import { contextBridge, ipcRenderer } from 'electron'

import {
  AGENT_SETTINGS_CHANNELS,
  type AgentSettingsBridge
} from '../shared/contracts/agent-settings-bridge'
import { ACCOUNT_CHANNELS, type AccountBridge } from '../shared/contracts/account-bridge'
import {
  CLIPBOARD_CHANNELS,
  MAX_CLIPBOARD_TEXT_LENGTH,
  type ClipboardBridge
} from '../shared/contracts/clipboard-bridge'
import { CONTROL_CHANNELS, type RuntimeStatus } from '../shared/contracts/control-plane'
import type { DesktopBridge } from '../shared/contracts/desktop-bridge'
import {
  EXTENSION_CHANNELS,
  type ExtensionBridge
} from '../shared/contracts/extension-bridge'
import {
  LIFECYCLE_CHANNELS,
  type LifecycleBridge,
  type LifecycleFlushRequest
} from '../shared/contracts/lifecycle-bridge'
import type { NcxRuntimeBridge } from '../shared/contracts/runtime-bridge'
import {
  VOICE_SHORTCUT_CHANNELS,
  type VoiceShortcutBridge
} from '../shared/contracts/voice-bridge'
import {
  SHELL_SETTINGS_CHANNELS,
  type ShellSettingsBridge
} from '../shared/contracts/shell-settings-bridge'
import {
  PROVIDER_PROFILE_CHANNELS,
  type ProviderProfileBridge
} from '../shared/contracts/provider-profile-bridge'
import {
  ProviderProfileRequestSchema,
  ProviderProfileResultSchema
} from '../shared/schemas/provider-profile'
import {
  WINDOW_CONTROL_CHANNELS,
  type WindowCommand,
  type WindowControlBridge,
  type WindowSnapshot
} from '../shared/contracts/window-controls'
import { AccountSessionSnapshotSchema, type AccountSessionSnapshot } from '../shared/schemas/account'
import {
  AgentSafetySettingsRequestSchema,
  AgentSafetySettingsResultSchema
} from '../shared/schemas/agent-settings'
import {
  ExtensionSettingsRequestSchema,
  ExtensionSettingsResultSchema
} from '../shared/schemas/extensions'
import {
  RuntimeConnectionMetadataSchema,
  RuntimeStatusSchema
} from '../shared/schemas/control-plane'
import {
  VoiceShortcutCommandSchema,
  VoiceShortcutEventSchema,
  VoiceShortcutSnapshotSchema
} from '../shared/schemas/voice'
import {
  ShellSettingsRequestSchema,
  ShellSettingsResultSchema
} from '../shared/schemas/shell'
import { RuntimeGateway } from './runtime-gateway'

const gateway = new RuntimeGateway()
const statusListeners = new Set<(status: RuntimeStatus) => void>()
const windowSnapshotListeners = new Set<(snapshot: WindowSnapshot) => void>()
const accountSnapshotListeners = new Set<(snapshot: AccountSessionSnapshot) => void>()
/** Renderer 订阅的全局语音快捷键事件监听器。 */
const voiceShortcutListeners = new Set<Parameters<VoiceShortcutBridge['onEvent']>[0]>()
/** Renderer 注册的退出前异步刷新处理器。 */
const lifecycleFlushHandlers = new Set<() => Promise<void>>()
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
  mutateMusic: (input) => gateway.mutateMusic(input),
  searchMusic: (input) =>
    gateway.readMusic({
      operation: 'search',
      query: input.query,
      category: input.category ?? 'all',
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
  getLyrics: (input) =>
    gateway.readMusic({
      operation: 'getLyrics',
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
  getFeaturedPlaylists: (input = {}) =>
    gateway.readMusic({
      operation: 'getFeaturedPlaylists',
      limit: input.limit ?? 12,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getNewSongs: (input = {}) =>
    gateway.readMusic({
      operation: 'getNewSongs',
      limit: input.limit ?? 12,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getDailySongs: (input = {}) =>
    gateway.readMusic({
      operation: 'getDailySongs',
      limit: input.limit ?? 20,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getUserPlaylists: (input) =>
    gateway.readMusic({
      operation: 'getUserPlaylists',
      userId: input.userId,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getLikedSongs: (input) =>
    gateway.readMusic({
      operation: 'getLikedSongs',
      userId: input.userId,
      limit: input.limit ?? 200,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getArtistAlbums: (input) =>
    gateway.readMusic({
      operation: 'getArtistAlbums',
      artistId: input.artistId,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  getSimilarArtists: (input) =>
    gateway.readMusic({
      operation: 'getSimilarArtists',
      artistId: input.artistId,
      ...(input.requestId ? { requestId: input.requestId } : {})
    }),
  resolveTrackUrl: (input) => gateway.resolveTrackUrl(input),
  loadPlaybackSnapshot: (input) => gateway.loadPlaybackSnapshot(input),
  savePlaybackSnapshot: (snapshot) => gateway.savePlaybackSnapshot(snapshot),
  accountData: (input) => gateway.accountData(input),
  voice: (input) => gateway.voice(input),
  agent: (command) => gateway.agent(command),
  onAgentEvent: (listener) => gateway.onAgentEvent(listener),
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

/** 只允许 Renderer 通过共享 Schema 读写应用级 Agent 安全设置。 */
const agentSettingsBridge: AgentSettingsBridge = {
  request: async (input) => {
    /** 经共享 Schema 校验的 Agent 安全设置请求。 */
    const request = AgentSafetySettingsRequestSchema.parse(input)
    /** Main 返回的持久 Agent 安全设置结果。 */
    const result = await ipcRenderer.invoke(AGENT_SETTINGS_CHANNELS.request, request)
    return AgentSafetySettingsResultSchema.parse(result)
  }
}

/** 仅允许写入受限纯文本的系统剪贴板桥。 */
const clipboardBridge: ClipboardBridge = {
  writeText: async (text) => {
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_CLIPBOARD_TEXT_LENGTH) {
      throw new Error('剪贴板文本不合法。')
    }
    await ipcRenderer.invoke(CLIPBOARD_CHANNELS.writeText, text)
  }
}

/** Renderer 可注册异步刷新任务的应用生命周期桥。 */
const lifecycleBridge: LifecycleBridge = {
  onFlushRequest: (handler) => {
    lifecycleFlushHandlers.add(handler)
    return () => lifecycleFlushHandlers.delete(handler)
  }
}

/** 只向 Main 发送经 Schema 校验的 Profile 管理请求，秘密不进入 Renderer 持久化。 */
const providerProfileBridge: ProviderProfileBridge = {
  request: async (input) => {
    /** 经共享 Schema 校验的请求。 */
    const request = ProviderProfileRequestSchema.parse(input)
    /** Main 返回的公开结果。 */
    const result = await ipcRenderer.invoke(PROVIDER_PROFILE_CHANNELS.request, request)
    return ProviderProfileResultSchema.parse(result)
  }
}

/** 只允许 Renderer 通过共享 Schema 调用扩展设置操作。 */
const extensionBridge: ExtensionBridge = {
  request: async (input) => {
    /** 经共享 Schema 校验的扩展设置请求。 */
    const request = ExtensionSettingsRequestSchema.parse(input)
    /** Main 返回的不含 Secret 的公开结果。 */
    const result = await ipcRenderer.invoke(EXTENSION_CHANNELS.request, request)
    return ExtensionSettingsResultSchema.parse(result)
  }
}

/** 只暴露严格语音快捷键命令与最小状态事件。 */
const voiceShortcutBridge: VoiceShortcutBridge = {
  snapshot: async () => {
    /** Main 返回的当前全局快捷键状态。 */
    const result = await ipcRenderer.invoke(VOICE_SHORTCUT_CHANNELS.command, { operation: 'snapshot' })
    return VoiceShortcutSnapshotSchema.parse(result)
  },
  command: async (rawCommand) => {
    /** 经共享 Schema 校验的语音快捷键命令。 */
    const command = VoiceShortcutCommandSchema.parse(rawCommand)
    /** Main 返回的配置结果。 */
    const result = await ipcRenderer.invoke(VOICE_SHORTCUT_CHANNELS.command, command)
    return VoiceShortcutSnapshotSchema.parse(result)
  },
  onEvent: (listener) => {
    voiceShortcutListeners.add(listener)
    return () => voiceShortcutListeners.delete(listener)
  }
}

/** 只允许管理用户通过系统对话框授权的 Shell 工作区。 */
const shellSettingsBridge: ShellSettingsBridge = {
  request: async (input) => {
    /** 经共享 Schema 校验的 Shell 设置请求。 */
    const request = ShellSettingsRequestSchema.parse(input)
    /** Main 返回的工作区快照。 */
    const result = await ipcRenderer.invoke(SHELL_SETTINGS_CHANNELS.request, request)
    return ShellSettingsResultSchema.parse(result)
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

ipcRenderer.on(VOICE_SHORTCUT_CHANNELS.event, (_event, rawEvent: unknown) => {
  /** Main 发来的已归一化语音事件。 */
  const event = VoiceShortcutEventSchema.safeParse(rawEvent)
  if (!event.success) return
  for (const listener of voiceShortcutListeners) listener(event.data)
})

ipcRenderer.on(LIFECYCLE_CHANNELS.flushRequest, (_event, rawRequest: unknown) => {
  /** Main 发来的退出刷新请求。 */
  const request = rawRequest as Partial<LifecycleFlushRequest> | null
  if (!request || typeof request.requestId !== 'string' || !/^[0-9a-f-]{36}$/iu.test(request.requestId)) {
    return
  }
  /** 当前已注册刷新处理器的稳定快照。 */
  const handlers = [...lifecycleFlushHandlers]
  void Promise.allSettled(handlers.map((handler) => handler())).finally(() => {
    ipcRenderer.send(LIFECYCLE_CHANNELS.flushAck, request.requestId)
  })
})

const bridge: DesktopBridge = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  }),
  agentSettings: agentSettingsBridge,
  account: accountBridge,
  clipboard: clipboardBridge,
  extensions: extensionBridge,
  lifecycle: lifecycleBridge,
  providerProfiles: providerProfileBridge,
  runtime: runtimeBridge,
  shellSettings: shellSettingsBridge,
  voiceShortcut: voiceShortcutBridge,
  windowControls: windowControlBridge
})

contextBridge.exposeInMainWorld('ncx', bridge)
ipcRenderer.send(CONTROL_CHANNELS.connect)
