/// <reference types="vite/client" />

import type { NcxRuntimeBridge } from '../shared/contracts/runtime-bridge'

declare global {
  interface Window {
    ncx: {
      runtime: NcxRuntimeBridge
    }
  }
}

export {}
