<script setup lang="ts">
import { computed } from 'vue'
import GlassSurface from '../materials/GlassSurface'
import type { GlassMaterial, GlassTone } from '../materials/glass-presets'

// -- Type Definitions
export type LiquidGlassSquircleSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

// -- Inputs and Outputs
const props = withDefaults(defineProps<{ material?: GlassMaterial; tone?: GlassTone; squircleSize?: LiquidGlassSquircleSize }>(), {
  material: 'blur', tone: 'neutral', squircleSize: 'lg'
})

// -- Derived Values
const surfaceStyle = computed(() => ({
  borderRadius: `var(--ncx-squircle-radius-${props.squircleSize})`,
  '-electron-corner-smoothing': 'var(--ncx-squircle-smoothing)'
}))
</script>

<template>
  <div
    class="ncx-liquid-glass ncx-glass-host"
    :style="surfaceStyle"
  >
    <GlassSurface
      :material="material"
      :tone="tone"
    />
    <div class="ncx-liquid-glass-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ncx-liquid-glass-content { position: relative; z-index: 1; width: 100%; height: 100%; border-radius: inherit; }
</style>
