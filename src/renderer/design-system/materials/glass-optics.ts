import type { GlassPreset } from './glass-presets'

// -- Type Definitions
export interface GlassGeometry { width: number; height: number; radius: number }
export interface RefractionMap { url: string; scale: number }

// -- Constants
const MAX_MAP_EDGE = 512
const MAP_CACHE_LIMIT = 24

// -- State and Variables
const mapCache = new Map<string, RefractionMap>()

// -- Functions
/** The reference shader's circular lens profile: no displacement in the reading area. */
export function lensDisplacement(x: number, y: number, geometry: GlassGeometry, preset: GlassPreset): [number, number] {
  const { width, height } = geometry
  const radius = Math.min(geometry.radius, width / 2, height / 2)
  const cx = x - width / 2
  const cy = y - height / 2
  const qx = Math.abs(cx) - (width / 2 - radius)
  const qy = Math.abs(cy) - (height / 2 - radius)
  const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  const heightLimit = Math.min(preset.refractionHeight, width / 2, height / 2)
  if (heightLimit <= 0 || distance >= 0 || -distance >= heightLimit) return [0, 0]
  const nx = Math.max(qx, 0)
  const ny = Math.max(qy, 0)
  let gx = Math.sign(cx) * (nx || ny ? nx : Number(qx >= qy))
  let gy = Math.sign(cy) * (nx || ny ? ny : Number(qy > qx))
  const length = Math.hypot(gx, gy) || 1
  gx /= length
  gy /= length
  if (preset.depth) {
    const centerLength = Math.hypot(cx, cy) || 1
    gx += cx / centerLength
    gy += cy / centerLength
  }
  const normalLength = Math.hypot(gx, gy) || 1
  const progress = 1 + distance / heightLimit
  const displacement = (1 - Math.sqrt(Math.max(0, 1 - progress * progress))) * preset.refractionAmount
  return [displacement * gx / normalLength, displacement * gy / normalLength]
}

/** Only geometry changes rebuild the map; scrolling is sampled by the compositor. */
export function createRefractionMap(geometry: GlassGeometry, preset: GlassPreset): RefractionMap | null {
  if (geometry.width <= 0 || geometry.height <= 0 || preset.refractionAmount === 0) return null
  const key = [geometry.width, geometry.height, geometry.radius, preset.refractionHeight, preset.refractionAmount, preset.depth].join(':')
  const cached = mapCache.get(key)
  if (cached) {
    mapCache.delete(key)
    mapCache.set(key, cached)
    return cached
  }
  const ratio = Math.min(1, MAX_MAP_EDGE / Math.max(geometry.width, geometry.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(geometry.width * ratio))
  canvas.height = Math.max(1, Math.ceil(geometry.height * ratio))
  const context = canvas.getContext('2d')
  if (!context) return null
  const pixels = context.createImageData(canvas.width, canvas.height)
  const scale = preset.refractionAmount * 2
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const [dx, dy] = lensDisplacement((x + 0.5) * geometry.width / canvas.width, (y + 0.5) * geometry.height / canvas.height, geometry, preset)
      const index = (y * canvas.width + x) * 4
      pixels.data[index] = Math.round(128 + dx / scale * 255)
      pixels.data[index + 1] = Math.round(128 + dy / scale * 255)
      pixels.data[index + 2] = 128
      pixels.data[index + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  const result = { url: canvas.toDataURL(), scale }
  if (mapCache.size >= MAP_CACHE_LIMIT) mapCache.delete(mapCache.keys().next().value as string)
  mapCache.set(key, result)
  return result
}
