export interface LiquidGlassDrawParams {
  x: number
  y: number
  w: number
  h: number
  radius?: number
  radii?: number[]
  tx?: number
  ty?: number
  scaleX?: number
  scaleY?: number
  rotation?: number
  vibrancy?: boolean
  blur?: number
  refractionHeight?: number
  refractionAmount?: number
  depthEffect?: boolean
  chromaticAberration?: number
  brightness?: number
  contrast?: number
  saturation?: number
  surface?: number[]
  highlight?: 'none' | 'plain' | 'default' | 'ambient'
  highlightWidth?: number
  highlightBlur?: number
  highlightAngle?: number
  highlightFalloff?: number
  highlightAlpha?: number
  highlightColor?: number[]
  shadow?: boolean | number
  shadowRadius?: number
  shadowOffsetY?: number
  shadowColor?: number[]
  shadowAlpha?: number
  innerShadowRadius?: number
  innerShadowOffsetY?: number
  innerShadowAlpha?: number
  innerShadowColor?: number[]
  pressProgress?: number
  pressPos?: number[]
  combined?: unknown
}

export declare class LiquidGlassRenderer {
  canvas: HTMLCanvasElement
  dpr: number
  cssW: number
  cssH: number
  constructor(canvas: HTMLCanvasElement, options?: { alpha?: boolean; preserveDrawingBuffer?: boolean })
  resize(cssW: number, cssH: number): void
  setWallpaper(img: CanvasImageSource): void
  loadSceneSource(source: TexImageSource): void
  clearOutput(): void
  begin(): void
  glass(params: LiquidGlassDrawParams): void
  end(): void
}
