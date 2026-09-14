import { LiquidGlassRenderer } from './demo/renderer.js'
import { drawButton, type InteractiveHighlight } from './demo/buttons.js'

// -- Type Definitions
export type GlassMaterial = 'none' | 'frost' | 'clear' | 'tinted' | 'dialog'
export interface GlassRenderInput {
  output: HTMLCanvasElement
  background: HTMLCanvasElement
  width: number
  height: number
  radius: number
  radii: number[]
  material: GlassMaterial
  tint: number[]
  dark: boolean
  highlight: InteractiveHighlight
}

// -- State and Variables
let renderer: LiquidGlassRenderer | undefined

// -- Functions
/** One shared WebGL context; each visible surface keeps only a 2D output bitmap. */
export function renderGlass(input: GlassRenderInput): void {
  renderer ??= new LiquidGlassRenderer(document.createElement('canvas'))
  if (renderer.gl.isContextLost()) throw new Error('Glass context lost')
  const { width, height, background, material, highlight } = input
  renderer.resize(width, height)
  renderer.setWallpaper(background)
  renderer.begin()
  if (material === 'dialog') {
    // The demo Dialog preset. Dark mode changes the surface color, not its optics.
    renderer.glass({
      x: 0, y: 0, w: width, h: height, radius: input.radius, radii: input.radii,
      brightness: input.dark ? -0.08 : 0.2, saturation: 1.5,
      blur: 16, refractionHeight: 24, refractionAmount: 48,
      depthEffect: true, highlight: 'plain', shadow: false,
      surface: input.dark ? [0.04, 0.05, 0.07, 0.72] : [250 / 255, 250 / 255, 250 / 255, 0.6]
    })
  } else {
    // Execute the demo's actual drawButton, including its deformation and optics.
    const target = renderer
    drawButton({ glass: (parameters) => target.glass({ ...parameters,
      // DOM content and the material share the demo deformation on their parent.
      tx: 0, ty: 0, scaleX: 1, scaleY: 1
    }) }, 0, 0, width, height, highlight,
      material === 'tinted' ? { tint: input.tint } : {})
  }
  renderer.end()
  const output = input.output
  output.width = renderer.canvas.width
  output.height = renderer.canvas.height
  const context = output.getContext('2d')
  if (!context) throw new Error('Glass output unavailable')
  context.clearRect(0, 0, output.width, output.height)
  context.drawImage(renderer.canvas, 0, 0)
}
