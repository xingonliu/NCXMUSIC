// -- Type Definitions
export type GlassMaterial = 'clear' | 'tinted' | 'blur' | 'dialog'
export type GlassTone = 'neutral' | 'accent' | 'danger'
export interface GlassPreset {
  blur: number
  refractionHeight: number
  refractionAmount: number
  depth: boolean
}

// -- Constants
/** Optical values migrated from the supplied Backdrop button / dialog examples. */
export const GLASS_PRESETS: Readonly<Record<GlassMaterial, GlassPreset>> = {
  clear: { blur: 2, refractionHeight: 12, refractionAmount: 24, depth: false },
  tinted: { blur: 2, refractionHeight: 12, refractionAmount: 24, depth: false },
  blur: { blur: 12, refractionHeight: 0, refractionAmount: 0, depth: false },
  dialog: { blur: 16, refractionHeight: 24, refractionAmount: 48, depth: true }
}
