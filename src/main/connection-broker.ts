import { MessageChannelMain, type WebContents } from 'electron'

import {
  CONTROL_CHANNELS,
  RuntimeConnectionMetadataSchema
} from '../shared/contracts/control-plane'
import { PROTOCOL_VERSION } from '../shared/contracts/runtime'
import type { UtilitySupervisor } from './utility-supervisor'

export class ConnectionBroker {
  constructor(
    private readonly supervisor: UtilitySupervisor,
    private readonly appVersion: string
  ) {}

  connect(webContents: WebContents): boolean {
    const utilityGeneration = this.supervisor.currentGeneration()
    if (!utilityGeneration || webContents.isDestroyed()) {
      return false
    }

    const metadata = RuntimeConnectionMetadataSchema.parse({
      connectionId: crypto.randomUUID(),
      protocolVersion: PROTOCOL_VERSION,
      appVersion: this.appVersion,
      utilityGeneration
    })
    const { port1, port2 } = new MessageChannelMain()

    try {
      this.supervisor.attachPort(port2, metadata)
      webContents.postMessage(CONTROL_CHANNELS.port, metadata, [port1])
      return true
    } catch {
      port1.close()
      port2.close()
      return false
    }
  }
}
