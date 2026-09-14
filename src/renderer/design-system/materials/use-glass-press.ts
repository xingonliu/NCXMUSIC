import { watch, type Ref } from 'vue'

// -- Type Definitions
interface Spring { value: number; velocity: number; target: number }

// -- Constants
const STYLE_KEYS = ['progress', 'x', 'y', 'sx', 'sy', 'light-x', 'light-y']

// -- Functions
function stepSpring(spring: Spring, dt: number): boolean {
  spring.velocity += ((spring.target - spring.value) * 300 - spring.velocity * 22) * dt
  spring.value += spring.velocity * dt
  if (Math.abs(spring.target - spring.value) < 0.001 && Math.abs(spring.velocity) < 0.001) {
    spring.value = spring.target
    spring.velocity = 0
    return false
  }
  return true
}

/** Deform the material and its label, never the native button's hit rectangle. */
export function useGlassPress(element: Ref<HTMLElement | null>, disabled: () => boolean): void {
  watch([element, disabled], ([host, isDisabled], _, onCleanup) => {
    if (!host || isDisabled) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const progress: Spring = { value: 0, velocity: 0, target: 0 }
    const x: Spring = { value: 0, velocity: 0, target: 0 }
    const y: Spring = { value: 0, velocity: 0, target: 0 }
    let frame = 0
    let previousTime = 0
    let pointerId: number | null = null
    let width = 1
    let height = 1

    const clearStyle = (): void => {
      for (const key of STYLE_KEYS) host.style.removeProperty(`--ncx-press-${key}`)
    }
    const paint = (now: number): void => {
      frame = 0
      const elapsed = Math.min((now - previousTime) / 1000 || 1 / 60, 0.5)
      previousTime = now
      // Substeps preserve elapsed time on throttled or temporarily stalled windows.
      const steps = Math.max(1, Math.ceil(elapsed * 120))
      let active = false
      for (let index = 0; index < steps; index++) {
        active = [stepSpring(progress, elapsed / steps), stepSpring(x, elapsed / steps), stepSpring(y, elapsed / steps)].some(Boolean)
      }
      const amount = Math.min(0.075, 4 / height)
      const scale = 1 + amount * progress.value
      const maxOffset = Math.min(width, height)
      host.style.setProperty('--ncx-press-progress', String(Math.max(0, progress.value)))
      host.style.setProperty('--ncx-press-x', `${maxOffset * Math.tanh(0.05 * x.value / maxOffset)}px`)
      host.style.setProperty('--ncx-press-y', `${maxOffset * Math.tanh(0.05 * y.value / maxOffset)}px`)
      host.style.setProperty('--ncx-press-sx', String(scale + amount * Math.min(Math.abs(x.value) / width, 1)))
      host.style.setProperty('--ncx-press-sy', String(scale + amount * Math.min(Math.abs(y.value) / height, 1)))
      host.style.setProperty('--ncx-press-light-x', `${Math.max(0, Math.min(100, 50 + x.value / width * 100))}%`)
      host.style.setProperty('--ncx-press-light-y', `${Math.max(0, Math.min(100, 50 + y.value / height * 100))}%`)
      if (active) frame = requestAnimationFrame(paint)
      else if (progress.value === 0) clearStyle()
    }
    const schedule = (): void => {
      if (!frame && !reducedMotion.matches) { previousTime = performance.now(); frame = requestAnimationFrame(paint) }
    }
    const release = (): void => {
      pointerId = null
      progress.target = 0
      x.target = 0
      y.target = 0
      schedule()
    }
    const down = (event: PointerEvent): void => {
      if (event.button !== 0 || !event.isPrimary || reducedMotion.matches) return
      const rect = host.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      pointerId = event.pointerId
      progress.target = 1
      x.target = event.clientX - rect.left - width / 2
      y.target = event.clientY - rect.top - height / 2
      schedule()
    }
    const move = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return
      const rect = host.getBoundingClientRect()
      x.target = Math.max(-width / 2, Math.min(width / 2, event.clientX - rect.left - width / 2))
      y.target = Math.max(-height / 2, Math.min(height / 2, event.clientY - rect.top - height / 2))
      schedule()
    }
    const up = (event: PointerEvent): void => { if (event.pointerId === pointerId) release() }
    const keydown = (event: KeyboardEvent): void => {
      if (event.target !== host || ![' ', 'Enter'].includes(event.key) || event.repeat || reducedMotion.matches) return
      width = Math.max(1, host.offsetWidth)
      height = Math.max(1, host.offsetHeight)
      progress.target = 1
      schedule()
    }
    const keyup = (event: KeyboardEvent): void => {
      if (event.target === host && [' ', 'Enter'].includes(event.key)) release()
    }
    const reset = (): void => {
      cancelAnimationFrame(frame)
      frame = 0
      pointerId = null
      for (const spring of [progress, x, y]) { spring.value = 0; spring.velocity = 0; spring.target = 0 }
      clearStyle()
    }
    host.addEventListener('pointerdown', down)
    host.addEventListener('keydown', keydown)
    host.addEventListener('blur', release)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', reset)
    reducedMotion.addEventListener('change', reset)
    onCleanup(() => {
      reset()
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('keydown', keydown)
      host.removeEventListener('blur', release)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', reset)
      reducedMotion.removeEventListener('change', reset)
    })
  }, { flush: 'post' })
}
