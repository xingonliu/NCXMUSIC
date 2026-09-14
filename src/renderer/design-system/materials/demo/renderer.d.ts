export interface GlassParameters {
  x: number
  y: number
  w: number
  h: number
  radius: number
  [key: string]: unknown
}

export class LiquidGlassRenderer {
  constructor(canvas: HTMLCanvasElement)
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  dpr: number
  resize(width: number, height: number): void
  setWallpaper(image: CanvasImageSource): void
  begin(): void
  glass(parameters: GlassParameters): void
  end(): void
}
