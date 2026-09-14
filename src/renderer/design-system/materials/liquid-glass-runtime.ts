import { LiquidGlassRenderer } from './liquid-glass-renderer.js'
import { buttonDeform, type InteractiveHighlight } from './liquid-glass-physics'
import {
  CLEAR_SURFACE,
  COMPLETE_BUTTON_OPTICS,
  DIALOG_CANCEL_SURFACE,
  FROST_SURFACE,
  GLASS_PAD_PX,
  PANEL_OPTICS,
  PANEL_SURFACE,
  TINTED_ALPHA,
  type GlassMaterial,
  type GlassTone
} from './liquid-glass-presets'

// -- Type Definitions

export interface GlassSurfaceRecord {
  id: string
  host: HTMLElement
  canvas: HTMLCanvasElement | null
  material: GlassMaterial
  tone: GlassTone
  frost: boolean
  highlight: InteractiveHighlight | null
}

// -- Constants

const WEBGL_MATERIALS: GlassMaterial[] = ['clear', 'tinted', 'panel']

// -- State and Variables

const surfaces = new Map<string, GlassSurfaceRecord>()
let renderer: LiquidGlassRenderer | null = null
let runtimeCanvas: HTMLCanvasElement | null = null
let frame = 0
let sceneDirty = true
let capturing = false
let lastCaptureAt = 0

// -- Functions

function prefersReducedTransparency(): boolean {
  return window.matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)').matches
}

function readCssRgb(variableName: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  if (raw.startsWith('#')) {
    const hex = raw.slice(1)
    const value = Number.parseInt(hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex, 16)
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
  }
  const match = raw.match(/rgba?\(([^)]+)\)/)
  if (!match?.[1]) return [0.98, 0.176, 0.282]
  const [red = 250, green = 45, blue = 72] = match[1].split(',').map((part) => Number.parseFloat(part))
  return [red / 255, green / 255, blue / 255]
}

function surfaceFill(record: GlassSurfaceRecord): number[] {
  if (record.material === 'panel') {
    if (document.documentElement.getAttribute('data-theme') === 'dark') return [24 / 255, 26 / 255, 32 / 255, 0.7]
    return [...PANEL_SURFACE]
  }
  if (record.material === 'tinted' || record.tone === 'accent' || record.tone === 'danger') {
    const token = record.tone === 'danger' ? '--ncx-color-danger' : '--ncx-color-accent'
    const [red, green, blue] = readCssRgb(token)
    return [red, green, blue, TINTED_ALPHA]
  }
  if (record.frost) return [...DIALOG_CANCEL_SURFACE]
  if (record.material === 'clear') return [...CLEAR_SURFACE]
  return [...FROST_SURFACE]
}

function cornerRadius(host: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0
}

function ensureRenderer(): LiquidGlassRenderer | null {
  if (renderer) return renderer
  if (typeof document === 'undefined' || prefersReducedTransparency()) return null
  const canvas = document.createElement('canvas')
  canvas.className = 'ncx-glass-runtime-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.append(canvas)
  try {
    renderer = new LiquidGlassRenderer(canvas, { alpha: true, preserveDrawingBuffer: true })
  } catch {
    canvas.remove()
    return null
  }
  runtimeCanvas = canvas
  return renderer
}

function disposeRenderer(): void {
  runtimeCanvas?.remove()
  runtimeCanvas = null
  renderer = null
}

function fillFallbackScene(engine: LiquidGlassRenderer): void {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, engine.canvas.width)
  canvas.height = Math.max(1, engine.canvas.height)
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ncx-color-canvas').trim() || '#f4f4f7'
  context.fillRect(0, 0, canvas.width, canvas.height)
  engine.loadSceneSource(canvas)
}

async function captureScene(engine: LiquidGlassRenderer): Promise<void> {
  if (capturing) return
  capturing = true
  const canvases = [...surfaces.values()].map((record) => record.canvas).filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas))
  for (const canvas of canvases) canvas.style.visibility = 'hidden'
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  try {
    const png = await window.ncx?.windowControls.captureBackdrop?.()
    if (png && png.byteLength > 0) {
      const bytes = new Uint8Array(png.byteLength)
      bytes.set(png)
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      engine.loadSceneSource(bitmap)
      bitmap.close()
    } else {
      fillFallbackScene(engine)
    }
  } catch {
    fillFallbackScene(engine)
  } finally {
    for (const canvas of canvases) canvas.style.visibility = ''
    capturing = false
    lastCaptureAt = performance.now()
    sceneDirty = false
  }
}

function blitSurface(engine: LiquidGlassRenderer, record: GlassSurfaceRecord): void {
  if (!record.canvas || !runtimeCanvas) return
  const rect = record.host.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return
  const pad = GLASS_PAD_PX
  const dpr = engine.dpr
  const cssWidth = rect.width + pad * 2
  const cssHeight = rect.height + pad * 2
  record.canvas.width = Math.max(1, Math.round(cssWidth * dpr))
  record.canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  const context = record.canvas.getContext('2d')
  if (!context) return
  const sourceX = Math.max(0, (rect.left - pad) * dpr)
  const sourceY = Math.max(0, (rect.top - pad) * dpr)
  const sourceW = Math.min(runtimeCanvas.width - sourceX, cssWidth * dpr)
  const sourceH = Math.min(runtimeCanvas.height - sourceY, cssHeight * dpr)
  context.clearRect(0, 0, record.canvas.width, record.canvas.height)
  if (sourceW > 0 && sourceH > 0) {
    context.drawImage(runtimeCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)
  }
}

function drawSurface(engine: LiquidGlassRenderer, record: GlassSurfaceRecord): void {
  if (!record.canvas) return
  const rect = record.host.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return
  const deform = record.highlight
    ? buttonDeform(rect.width, rect.height, record.highlight)
    : { tx: 0, ty: 0, sx: 1, sy: 1, progress: 0, ox: 0, oy: 0 }
  const optics = record.material === 'panel' ? PANEL_OPTICS : COMPLETE_BUTTON_OPTICS
  engine.clearOutput()
  engine.glass({
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
    radius: cornerRadius(record.host),
    tx: deform.tx,
    ty: deform.ty,
    scaleX: deform.sx,
    scaleY: deform.sy,
    vibrancy: optics.vibrancy,
    blur: optics.blur,
    refractionHeight: optics.refractionHeight,
    refractionAmount: optics.refractionAmount,
    depthEffect: optics.depthEffect,
    brightness: optics.brightness,
    saturation: optics.saturation,
    highlight: optics.highlight,
    surface: surfaceFill(record),
    pressProgress: deform.progress,
    pressPos: [Math.max(0, Math.min(rect.width, deform.ox + rect.width / 2)), Math.max(0, Math.min(rect.height, deform.oy + rect.height / 2))]
  })
  blitSurface(engine, record)
}

function tick(now: number): void {
  frame = 0
  const webglSurfaces = [...surfaces.values()].filter((record) => record.canvas && WEBGL_MATERIALS.includes(record.material))
  if (webglSurfaces.length === 0) {
    if (surfaces.size === 0) disposeRenderer()
    return
  }
  const engine = ensureRenderer()
  if (!engine) return
  engine.resize(window.innerWidth, window.innerHeight)
  const pressActive = webglSurfaces.some((record) => record.highlight?.active)
  const draw = (): void => {
    for (const record of webglSurfaces) drawSurface(engine, record)
    if (pressActive || capturing || sceneDirty) frame = requestAnimationFrame(tick)
  }
  if (sceneDirty && !capturing && now - lastCaptureAt > 80) {
    void captureScene(engine).then(draw)
    return
  }
  draw()
}

function requestTick(): void {
  if (!frame) frame = requestAnimationFrame(tick)
}

export function markGlassSceneDirty(): void {
  sceneDirty = true
  requestTick()
}

export function registerGlassSurface(record: GlassSurfaceRecord): void {
  surfaces.set(record.id, record)
  sceneDirty = true
  if (WEBGL_MATERIALS.includes(record.material)) requestTick()
}

export function updateGlassSurface(id: string, patch: Partial<GlassSurfaceRecord>): void {
  const current = surfaces.get(id)
  if (!current) return
  surfaces.set(id, { ...current, ...patch, id })
  sceneDirty = true
  requestTick()
}

export function unregisterGlassSurface(id: string): void {
  surfaces.delete(id)
  if (surfaces.size === 0) {
    cancelAnimationFrame(frame)
    frame = 0
    disposeRenderer()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', markGlassSceneDirty, { passive: true })
  window.addEventListener('scroll', markGlassSceneDirty, { passive: true, capture: true })
}
