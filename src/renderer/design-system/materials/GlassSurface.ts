import { computed, defineComponent, h, onMounted, onUnmounted, ref, useId, watch, type PropType } from 'vue'

import { InteractiveHighlight } from './liquid-glass-physics'
import { GLASS_PAD_PX, type GlassMaterial, type GlassTone } from './liquid-glass-presets'
import {
  registerGlassSurface,
  unregisterGlassSurface,
  updateGlassSurface
} from './liquid-glass-runtime'
import { useLiquidGlassPress } from './use-liquid-glass-press'
import './liquid-glass.css'

// -- Constants

const WEBGL_MATERIALS: GlassMaterial[] = ['clear', 'tinted', 'panel']

export default defineComponent({
  name: 'GlassSurface',
  props: {
    material: { type: String as PropType<GlassMaterial>, required: true },
    tone: { type: String as PropType<GlassTone>, default: 'neutral' },
    frost: Boolean,
    press: Boolean
  },
  setup(props) {
    // -- State and Variables
    const canvasRef = ref<HTMLCanvasElement | null>(null)
    const layerRef = ref<HTMLElement | null>(null)
    const hostRef = ref<HTMLElement | null>(null)
    const highlight = new InteractiveHighlight()
    const surfaceId = `ncx-glass-${useId().replace(/[^\w-]/g, '')}`
    const useWebgl = computed(() => WEBGL_MATERIALS.includes(props.material))

    useLiquidGlassPress(hostRef, () => props.press, highlight)

    function currentCanvas(): HTMLCanvasElement | null {
      return useWebgl.value ? canvasRef.value : null
    }

    function sync(): void {
      const host = hostRef.value
      if (!host) return
      registerGlassSurface({
        id: surfaceId,
        host,
        canvas: currentCanvas(),
        material: props.material,
        tone: props.tone,
        frost: props.frost,
        highlight: props.press ? highlight : null
      })
    }

    watch([() => props.material, () => props.tone, () => props.frost, () => props.press, canvasRef], () => {
      if (!hostRef.value) return
      updateGlassSurface(surfaceId, {
        host: hostRef.value,
        canvas: currentCanvas(),
        material: props.material,
        tone: props.tone,
        frost: props.frost,
        highlight: props.press ? highlight : null
      })
    })

    onMounted(() => {
      hostRef.value = canvasRef.value?.parentElement ?? layerRef.value?.parentElement ?? null
      sync()
    })

    onUnmounted(() => {
      unregisterGlassSurface(surfaceId)
    })

    return () => {
      if (useWebgl.value) {
        return h('canvas', {
          ref: canvasRef,
          class: 'ncx-glass-surface ncx-glass-surface-canvas',
          'aria-hidden': 'true',
          style: { '--ncx-glass-pad': `${GLASS_PAD_PX}px` }
        })
      }
      return h('span', {
        ref: layerRef,
        class: 'ncx-glass-surface ncx-glass-optical-layer',
        'aria-hidden': 'true'
      })
    }
  }
})
