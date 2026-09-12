import Renderer from './renderer'

export interface LiquidGlassWebglInstance {
  resize(width: number, height: number): void
  begin(): void
  glass(params: Record<string, unknown>): void
  end(): void
}

export function createLiquidGlassWebgl(canvas: HTMLCanvasElement): LiquidGlassWebglInstance | undefined {
  try { return new Renderer(canvas) as LiquidGlassWebglInstance } catch { return undefined }
}
