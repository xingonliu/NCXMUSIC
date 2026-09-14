import { onUnmounted, provide, ref, shallowRef, watch, type InjectionKey, type ShallowRef } from 'vue'

// -- Type Definitions
export interface ModalBackdrop {
  image: HTMLImageElement
  width: number
  height: number
}

// -- Constants
export const modalBackdropKey: InjectionKey<ShallowRef<ModalBackdrop | null>> = Symbol('modal-backdrop')

// -- Functions
/** Capture before presenting the overlay, so the texture never includes the dialog itself. */
export function useModalBackdrop(visible: () => boolean) {
  const presented = ref(false)
  const backdrop = shallowRef<ModalBackdrop | null>(null)
  let generation = 0
  provide(modalBackdropKey, backdrop)

  watch(visible, async (open) => {
    const current = ++generation
    if (!open) {
      presented.value = false
      backdrop.value = null
      return
    }
    try {
      const width = window.innerWidth
      const height = window.innerHeight
      const data = await window.ncx?.windowControls?.captureBackdrop?.()
      if (data) {
        const image = new Image()
        image.src = data
        await image.decode()
        if (current !== generation) return
        backdrop.value = { image, width, height }
      }
    } catch {
      // A failed capture must not prevent a user from opening or closing a dialog.
    }
    if (current === generation) presented.value = true
  }, { immediate: true, flush: 'sync' })

  onUnmounted(() => { generation += 1 })
  return presented
}
