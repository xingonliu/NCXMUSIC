import type { NcxRuntimeBridge } from './runtime-bridge'
import type { WindowControlBridge } from './window-controls'

export interface DesktopBridge {
  readonly platform: string
  readonly versions: {
    readonly chrome: string
    readonly electron: string
    readonly node: string
  }
  readonly runtime: NcxRuntimeBridge
  readonly windowControls: WindowControlBridge
}
