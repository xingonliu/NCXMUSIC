import { computed, defineComponent, h, ref, useId, watch, type PropType } from 'vue'
import { createRefractionMap, type RefractionMap } from './glass-optics'
import { GLASS_PRESETS, type GlassMaterial, type GlassTone } from './glass-presets'
import './glass-material.css'

// -- Inputs and Outputs
export default defineComponent({
  name: 'GlassSurface',
  props: {
    material: { type: String as PropType<GlassMaterial>, default: 'blur' },
    tone: { type: String as PropType<GlassTone>, default: 'neutral' }
  },
  setup(props) {
    // -- State and Variables
    const root = ref<HTMLElement | null>(null)
    const map = ref<RefractionMap | null>(null)
    const filterId = `ncx-glass-${useId().replace(/[^\w-]/g, '')}`
    const reducedTransparency = ref(false)

    // -- Derived Values
    const preset = computed(() => GLASS_PRESETS[props.material])
    const effectiveMaterial = computed(() => reducedTransparency.value ? 'solid' : props.material !== 'blur' && !map.value ? 'blur' : props.material)
    const surfaceStyle = computed(() => ({
      '--ncx-material-blur': `${preset.value.blur}px`,
      '--ncx-material-filter': map.value ? `url(#${filterId})` : 'blur(0px)'
    }))

    // -- Listeners
    watch([root, () => props.material], ([element], _, onCleanup) => {
      map.value = null
      if (!element) return
      const preference = window.matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)')
      const updatePreference = (): void => { reducedTransparency.value = preference.matches; updateMap() }
      const updateMap = (): void => {
        if (props.material === 'blur' || preference.matches) { map.value = null; return }
        const style = getComputedStyle(element)
        try {
          map.value = createRefractionMap({
            width: element.offsetWidth, height: element.offsetHeight,
            radius: Number.parseFloat(style.borderTopLeftRadius) || 0
          }, preset.value)
        } catch {
          // Keep the control usable when the graphics backend cannot create a map.
          map.value = null
        }
      }
      updatePreference()
      preference.addEventListener('change', updatePreference)
      const observer = props.material === 'blur' ? null : new ResizeObserver(updateMap)
      observer?.observe(element)
      onCleanup(() => {
        observer?.disconnect()
        preference.removeEventListener('change', updatePreference)
      })
    }, { flush: 'post' })

    return () => h('span', {
      ref: root, class: 'ncx-glass-surface', 'aria-hidden': 'true',
      'data-material': effectiveMaterial.value, 'data-requested-material': props.material,
      'data-tone': props.tone, style: surfaceStyle.value
    }, [
      h('span', { class: 'ncx-glass-optical-layer' }),
      h('span', { class: 'ncx-glass-light-layer' }),
      map.value ? h('svg', { class: 'ncx-glass-filter-definitions', xmlns: 'http://www.w3.org/2000/svg' }, [
        h('defs', [h('filter', { id: filterId, x: '-50%', y: '-50%', width: '200%', height: '200%', 'color-interpolation-filters': 'sRGB' }, [
          h('feImage', { href: map.value.url, x: '0', y: '0', width: '100%', height: '100%', preserveAspectRatio: 'none', result: 'displacement' }),
          // Correct the 8-bit neutral value so the reading area does not move.
          h('feComponentTransfer', { in: 'displacement', result: 'normalized' }, [
            h('feFuncR', { type: 'linear', intercept: -0.5 / 255 }),
            h('feFuncG', { type: 'linear', intercept: -0.5 / 255 })
          ]),
          h('feDisplacementMap', { in: 'SourceGraphic', in2: 'normalized', scale: map.value.scale, xChannelSelector: 'R', yChannelSelector: 'G' })
        ])])
      ]) : null
    ])
  }
})
