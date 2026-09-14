/** Optical values copied from D:/code/chat/docs/liquid-glass/app.js drawButton / dialog. */

// -- Type Definitions

export type GlassMaterial = 'clear' | 'tinted' | 'blur' | 'panel'
export type GlassTone = 'neutral' | 'accent' | 'danger'

export interface GlassOptics {
  blur: number
  refractionHeight: number
  refractionAmount: number
  depthEffect: boolean
  vibrancy: boolean
  brightness: number
  saturation: number
  highlight: 'none' | 'plain' | 'default'
}

// -- Constants

/** drawButton: blur 2, refractionHeight 12, refractionAmount 24, vibrancy true. */
export const COMPLETE_BUTTON_OPTICS: GlassOptics = {
  blur: 2,
  refractionHeight: 12,
  refractionAmount: 24,
  depthEffect: false,
  vibrancy: true,
  brightness: 0,
  saturation: 1.5,
  highlight: 'default'
}

/** Dialog panel: blur 16, height 24, amount 48, depth, brightness 0.2, saturation 1.5. */
export const PANEL_OPTICS: GlassOptics = {
  blur: 16,
  refractionHeight: 24,
  refractionAmount: 48,
  depthEffect: true,
  vibrancy: false,
  brightness: 0.2,
  saturation: 1.5,
  highlight: 'plain'
}

/** Incomplete buttons keep gaussian blur only. */
export const INCOMPLETE_BUTTON_BLUR_PX = 12

/** Incomplete panels (player bar, settings sidebar) keep gaussian blur only. */
export const INCOMPLETE_PANEL_BLUR_PX = 16

/** Transparent Liquid Button surface. */
export const CLEAR_SURFACE = [0, 0, 0, 0] as const

/** Surface Liquid Button / Dialog Cancel fill. */
export const FROST_SURFACE = [1, 1, 1, 0.3] as const

/** Dialog Cancel uses a slightly stronger frost. */
export const DIALOG_CANCEL_SURFACE = [1, 1, 1, 0.35] as const

/** Dialog panel fill rgba(#FAFAFA, 0.6). */
export const PANEL_SURFACE = [250 / 255, 250 / 255, 250 / 255, 0.6] as const

/** Dialog dim overlay rgba(41, 41, 58, 0.23). */
export const DIALOG_DIM = [41 / 255, 41 / 255, 58 / 255, 0.23] as const

/** Tinted Liquid Button uses the given RGB at 75% alpha. */
export const TINTED_ALPHA = 0.75

export const GLASS_PAD_PX = 32
