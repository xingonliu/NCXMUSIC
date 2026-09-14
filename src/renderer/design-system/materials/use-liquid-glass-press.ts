import { watch, type Ref } from 'vue'

import { buttonDeform, type InteractiveHighlight } from './liquid-glass-physics'

// -- Functions

function writeDeform(host: HTMLElement, highlight: InteractiveHighlight): void {
  const width = Math.max(1, host.offsetWidth)
  const height = Math.max(1, host.offsetHeight)
  const deform = buttonDeform(width, height, highlight)
  host.style.setProperty('--ncx-press-tx', `${deform.tx}px`)
  host.style.setProperty('--ncx-press-ty', `${deform.ty}px`)
  host.style.setProperty('--ncx-press-sx', String(deform.sx))
  host.style.setProperty('--ncx-press-sy', String(deform.sy))
  host.style.setProperty('--ncx-press-progress', String(deform.progress))
}

function clearDeform(host: HTMLElement): void {
  host.style.removeProperty('--ncx-press-tx')
  host.style.removeProperty('--ncx-press-ty')
  host.style.removeProperty('--ncx-press-sx')
  host.style.removeProperty('--ncx-press-sy')
  host.style.removeProperty('--ncx-press-progress')
}

/** Demo InteractiveHighlight plus buttonDeform, applied as CSS variables on the host. */
export function useLiquidGlassPress(
  host: Ref<HTMLElement | null>,
  enabled: () => boolean,
  highlight: InteractiveHighlight
): void {
  watch([host, enabled], ([element, isEnabled], _, onCleanup) => {
    if (!element || !isEnabled) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previous = 0

    const paint = (now: number): void => {
      frame = 0
      const dt = Math.min(0.032, (now - previous) / 1000 || 1 / 60)
      previous = now
      highlight.step(dt)
      writeDeform(element, highlight)
      if (highlight.active) frame = requestAnimationFrame(paint)
      else if (highlight.press.value === 0) clearDeform(element)
    }
    const schedule = (): void => {
      if (!frame && !reducedMotion.matches) {
        previous = performance.now()
        frame = requestAnimationFrame(paint)
      }
    }
    const down = (event: PointerEvent): void => {
      if (event.button !== 0 || reducedMotion.matches) return
      const rect = element.getBoundingClientRect()
      highlight.start(event.clientX - rect.left, event.clientY - rect.top)
      schedule()
    }
    const move = (event: PointerEvent): void => {
      if (!highlight.down) return
      const rect = element.getBoundingClientRect()
      highlight.move(event.clientX - rect.left, event.clientY - rect.top)
      schedule()
    }
    const up = (): void => {
      if (!highlight.down) return
      highlight.end()
      schedule()
    }
    const keydown = (event: KeyboardEvent): void => {
      if (event.target !== element || ![' ', 'Enter'].includes(event.key) || event.repeat || reducedMotion.matches) return
      highlight.start(element.offsetWidth / 2, element.offsetHeight / 2)
      schedule()
    }
    const keyup = (event: KeyboardEvent): void => {
      if (event.target === element && [' ', 'Enter'].includes(event.key)) up()
    }
    element.addEventListener('pointerdown', down)
    element.addEventListener('keydown', keydown)
    element.addEventListener('blur', up)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keyup', keyup)
    onCleanup(() => {
      cancelAnimationFrame(frame)
      highlight.end()
      clearDeform(element)
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('keydown', keydown)
      element.removeEventListener('blur', up)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keyup', keyup)
    })
  }, { flush: 'post' })
}
