import { contextBridge } from 'electron'

import type { DesktopBridge } from '../shared/contracts/desktop-bridge'

const bridge: DesktopBridge = Object.freeze({
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  })
})

contextBridge.exposeInMainWorld('ncx', bridge)
