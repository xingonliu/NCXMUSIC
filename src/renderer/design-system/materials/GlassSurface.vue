<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { InteractiveHighlight, buttonDeform } from './demo/buttons.js'
import { renderGlass, type GlassMaterial } from './glass-renderer'
import { fillGlassBackground } from './glass-background'
import { modalBackdropKey } from './modal-backdrop'

// -- Inputs and Outputs
const props = withDefaults(defineProps<{
  material?: GlassMaterial
  variant?: string
  interactive?: boolean
  disabled?: boolean
}>(), { material: 'frost', variant: 'secondary', interactive: true, disabled: false })

// -- State and Variables
const layer = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
const effective = ref<GlassMaterial>('frost')
const backdrop = inject(modalBackdropKey, undefined)
const highlight = new InteractiveHighlight()
const background = document.createElement('canvas')
let host: HTMLElement | null = null
let image: HTMLImageElement | null = null
let imageElement: HTMLElement | null = null
let frame = 0
let previousTime = 0
let visible = true
let disposed = false
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let themeObserver: MutationObserver | undefined
let reducedMotion: MediaQueryList | undefined
let reducedTransparency: MediaQueryList | undefined
const cleanup: Array<() => void> = []

// -- Functions
function listen(target: EventTarget, type: string, handler: EventListener): void {
  target.addEventListener(type, handler)
  cleanup.push(() => target.removeEventListener(type, handler))
}

function schedule(): void {
  if (!frame && !disposed && visible) frame = requestAnimationFrame(draw)
}

function refreshSurface(): void {
  if (['clear', 'tinted', 'dialog'].includes(effective.value)) schedule()
}

function resolveMaterial(): void {
  if (!host) return
  let material = props.material
  if (material === 'frost' && host.closest('.ncx-common-modal-footer')) {
    material = props.variant === 'primary' ? 'tinted' : props.variant === 'secondary' ? 'clear' : 'frost'
  }
  if (reducedTransparency?.matches) material = 'none'
  effective.value = material
  host.dataset.glassMaterial = material
  host.classList.toggle('ncx-glass-interactive', props.interactive)
  ready.value = false
  schedule()
}

async function loadArtwork(): Promise<void> {
  if (!host || backdrop?.value) return
  const region = host.closest('[data-glass-artwork], .ncx-cover, .music-detail-hero, .discover-radio-card, .profile-header')
  imageElement = region?.querySelector<HTMLElement>('.profile-header-bg, img') ?? null
  if (!imageElement) return
  const source = imageElement instanceof HTMLImageElement
    ? imageElement.currentSrc || imageElement.src
    : getComputedStyle(imageElement).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1]
  if (!source) return
  const loaded = new Image()
  loaded.crossOrigin = 'anonymous'
  loaded.src = source
  try {
    await loaded.decode()
    if (disposed) return
    image = loaded
    schedule()
  } catch {
    image = null
    ready.value = false
  }
}


function draw(time: number): void {
  frame = 0
  if (!host || !canvas.value || !visible) return
  const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60
  previousTime = time
  highlight.step(dt)
  const width = host.offsetWidth
  const height = host.offsetHeight
  if (!width || !height) return
  const deform = buttonDeform(width, height, highlight)
  if (props.interactive && !reducedMotion?.matches) {
    host.style.setProperty('--ncx-glass-press-transform', `translate(${deform.tx}px, ${deform.ty}px) scale(${deform.sx}, ${deform.sy})`)
  } else host.style.removeProperty('--ncx-glass-press-transform')
  if (['clear', 'tinted', 'dialog'].includes(effective.value)) {
    try {
      // Ignore press transforms when mapping the background into the resting control.
      const bounds = host.getBoundingClientRect()
      const rect = new DOMRect(bounds.left - deform.tx + (bounds.width - width) / 2,
        bounds.top - deform.ty + (bounds.height - height) / 2, width, height)
      if (fillGlassBackground({ background, rect, host, image, imageElement,
        material: effective.value, snapshot: backdrop?.value ?? null })) {
        if (effective.value === 'clear') {
          const pixel = background.getContext('2d')!.getImageData(Math.floor(background.width / 2), Math.floor(background.height / 2), 1, 1).data
          const luminance = (pixel[0]! * 0.2126 + pixel[1]! * 0.7152 + pixel[2]! * 0.0722) / 255
          host.style.setProperty('--ncx-glass-ink', luminance > 0.55 ? '#111' : '#fff')
        }
        const css = getComputedStyle(host)
        const probe = document.createElement('canvas').getContext('2d')!
        probe.fillStyle = css.getPropertyValue('--ncx-color-accent').trim() || '#0088ff'
        probe.fillRect(0, 0, 1, 1)
        const rgb = probe.getImageData(0, 0, 1, 1).data
        const dark = document.documentElement.dataset.theme === 'dark' ||
          (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
        renderGlass({ output: canvas.value, background, width, height,
          radius: parseFloat(css.borderTopLeftRadius) || 24,
          radii: [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map((value) => parseFloat(value) || 0),
          material: effective.value, tint: [rgb[0]! / 255, rgb[1]! / 255, rgb[2]! / 255], dark, highlight })
        ready.value = true
        if (effective.value === 'dialog') host.dispatchEvent(new Event('glass-rendered'))
      } else ready.value = false
    } catch {
      ready.value = false
    }
  }
  host.dataset.glassRendered = ready.value ? effective.value : effective.value === 'none' ? 'none' : 'frost'
  const entering = effective.value === 'dialog' && [...host.getAnimations(), ...(host.parentElement?.getAnimations() ?? [])]
    .some((animation) => animation.playState === 'running')
  if (entering || !highlight.press.settled || !highlight.px.settled || !highlight.py.settled) schedule()
  else previousTime = 0
}

function release(): void {
  if (!highlight.down && highlight.press.settled && highlight.px.settled && highlight.py.settled) return
  highlight.end()
  schedule()
}

// -- Listeners
watch(() => [props.material, props.variant, props.disabled], () => {
  if (props.disabled) release()
  resolveMaterial()
})

// -- Lifecycle Hooks
onMounted(() => {
  host = layer.value?.parentElement ?? null
  if (!host) return
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)')
  listen(reducedMotion, 'change', () => { release(); schedule() })
  listen(reducedTransparency, 'change', resolveMaterial)
  resolveMaterial()
  void loadArtwork()
  listen(host, 'pointerdown', ((event: PointerEvent) => {
    if (!props.interactive || props.disabled || event.button !== 0 || !host) return
    const rect = host.getBoundingClientRect()
    highlight.start(event.clientX - rect.left, event.clientY - rect.top)
    schedule()
  }) as EventListener)
  listen(window, 'pointermove', ((event: PointerEvent) => {
    if (!highlight.down || !host) return
    const rect = host.getBoundingClientRect()
    highlight.move(event.clientX - rect.left, event.clientY - rect.top)
    schedule()
  }) as EventListener)
  for (const event of ['pointerup', 'pointercancel', 'blur']) listen(window, event, release)
  listen(host, 'keydown', ((event: KeyboardEvent) => {
    if (props.interactive && !props.disabled && !event.repeat && [' ', 'Enter'].includes(event.key)) {
      highlight.start(0, 0)
      schedule()
    }
  }) as EventListener)
  listen(host, 'keyup', release)
  listen(host, 'focusout', release)
  const parentPanel = host.parentElement?.closest('.ncx-common-modal, .ncx-common-drawer')
  if (parentPanel) listen(parentPanel, 'glass-rendered', schedule)
  if (imageElement) listen(imageElement, 'load', () => { void loadArtwork() })
  listen(window, 'resize', refreshSurface)
  listen(host, 'transitionend', refreshSurface)
  if (imageElement?.parentElement) listen(imageElement.parentElement, 'transitionend', refreshSurface)
  // Scrolling changes where a dialog button samples its parent surface.
  window.addEventListener('scroll', refreshSurface, true)
  cleanup.push(() => window.removeEventListener('scroll', refreshSurface, true))
  resizeObserver = new ResizeObserver(refreshSurface)
  resizeObserver.observe(host)
  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false
    if (visible) schedule()
  })
  intersectionObserver.observe(host)
  themeObserver = new MutationObserver(resolveMaterial)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

onUnmounted(() => {
  disposed = true
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  themeObserver?.disconnect()
  for (const stop of cleanup) stop()
})
</script>

<template>
  <span
    ref="layer"
    class="ncx-glass-layer"
    :class="{ 'is-ready': ready }"
    aria-hidden="true"
  >
    <canvas ref="canvas" />
  </span>
</template>
