import type { LiquidGlassRenderer } from './renderer.js'

export class InteractiveHighlight {
  down: boolean
  offsetX: number
  offsetY: number
  press: { value: number; settled: boolean }
  px: { settled: boolean }
  py: { settled: boolean }
  start(x: number, y: number): void
  move(x: number, y: number): void
  end(): void
  step(seconds: number): void
}

export function buttonDeform(width: number, height: number, highlight: InteractiveHighlight): {
  tx: number; ty: number; sx: number; sy: number; progress: number; ox: number; oy: number
}

export function drawButton(renderer: Pick<LiquidGlassRenderer, 'glass'>, x: number, y: number, width: number,
  height: number, highlight: InteractiveHighlight,
  options?: { tint?: number[]; surface?: number[] }): void
