import type {
  RuntimeConnectionMetadata,
  RuntimeStatus
} from '../schemas/control-plane'

export const CONTROL_CHANNELS = {
  connect: 'ncx:runtime-connect',
  port: 'ncx:runtime-port',
  retry: 'ncx:runtime-retry',
  status: 'ncx:runtime-status'
} as const

export type { RuntimeConnectionMetadata, RuntimeStatus }
