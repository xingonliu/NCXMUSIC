import type { GlassMaterial } from './glass-renderer'
import type { ModalBackdrop } from './modal-backdrop'

// -- Type Definitions
export interface GlassBackgroundInput {
  background: HTMLCanvasElement
  rect: DOMRect
  host: HTMLElement
  image: HTMLImageElement | null
  imageElement: HTMLElement | null
  material: GlassMaterial
  snapshot: ModalBackdrop | null
}

// -- Functions
export function fillGlassBackground(input: GlassBackgroundInput): boolean {
  const { background, rect, host, image, imageElement, material, snapshot } = input
  const context = background.getContext('2d')
  if (!context || !host) return false
  background.width = Math.max(1, Math.round(rect.width * devicePixelRatio))
  background.height = Math.max(1, Math.round(rect.height * devicePixelRatio))
  context.setTransform(background.width / rect.width, 0, 0, background.height / rect.height, 0, 0)

  // Buttons inside a dialog sample its rendered surface, never the raw page again.
  const panel = host.parentElement?.closest<HTMLElement>('.ncx-common-modal, .ncx-common-drawer')
  const panelCanvas = panel?.querySelector<HTMLCanvasElement>(':scope > .ncx-glass-layer.is-ready > canvas')
  if (panel && panelCanvas) {
    const parent = panel.getBoundingClientRect()
    context.drawImage(panelCanvas, 0, 0, panelCanvas.width, panelCanvas.height,
      parent.left - rect.left, parent.top - rect.top, parent.width, parent.height)
    return true
  }
  if (snapshot) {
    if (snapshot.width !== window.innerWidth || snapshot.height !== window.innerHeight) return false
    if (material !== 'dialog' && panel) return false
    context.drawImage(snapshot.image, 0, 0, snapshot.image.naturalWidth, snapshot.image.naturalHeight,
      -rect.left, -rect.top, snapshot.width, snapshot.height)
    context.fillStyle = 'rgba(41,41,58,0.23)'
    context.fillRect(0, 0, rect.width, rect.height)
    return true
  }
  if (material === 'dialog') return false
  if (imageElement) {
    if (!image || !imageElement.isConnected) return false
    const art = imageElement.getBoundingClientRect()
    const style = getComputedStyle(imageElement)
    const scale = style.objectFit === 'contain'
      ? Math.min(art.width / image.naturalWidth, art.height / image.naturalHeight)
      : Math.max(art.width / image.naturalWidth, art.height / image.naturalHeight)
    const [px = '50%', py = '50%'] = (imageElement instanceof HTMLImageElement ? style.objectPosition : style.backgroundPosition).split(' ')
    const offset = (value: string, remaining: number) => value.endsWith('%') ? remaining * parseFloat(value) / 100 : parseFloat(value) || 0
    context.drawImage(image, art.left - rect.left + offset(px, art.width - image.naturalWidth * scale),
      art.top - rect.top + offset(py, art.height - image.naturalHeight * scale),
      image.naturalWidth * scale, image.naturalHeight * scale)
    // Hero controls sit over the existing readability scrim as well as the image.
    if (host.closest('.music-detail-hero')) {
      const gradient = context.createLinearGradient(0, art.top - rect.top, 0, art.bottom - rect.top)
      gradient.addColorStop(0, 'rgba(0,0,0,0.12)')
      gradient.addColorStop(0.3, 'rgba(0,0,0,0.15)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.7)')
      context.fillStyle = gradient
      context.fillRect(0, 0, rect.width, rect.height)
    }
    if (host.closest('.discover-radio-card')) {
      const gradient = context.createLinearGradient(0, art.top - rect.top, 0, art.bottom - rect.top)
      gradient.addColorStop(0.1, 'transparent')
      gradient.addColorStop(1, 'rgba(0,0,0,0.76)')
      context.fillStyle = gradient
      context.fillRect(0, 0, rect.width, rect.height)
    }
    return true
  }
  // A solid settings surface is a legitimate uniform texture, not a substitute wallpaper.
  const ancestors: HTMLElement[] = []
  for (let node = host.parentElement; node; node = node.parentElement) ancestors.unshift(node)
  context.clearRect(0, 0, rect.width, rect.height)
  for (const node of ancestors) {
    context.fillStyle = getComputedStyle(node).backgroundColor
    context.fillRect(0, 0, rect.width, rect.height)
  }
  return true
}
