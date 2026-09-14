<script setup lang="ts">
import { computed } from 'vue'

import GlassSurface from '../materials/GlassSurface'
import type { GlassMaterial, GlassTone } from '../materials/liquid-glass-presets'

// -- Type Definitions

export interface LiquidGlassProps {
  material?: GlassMaterial
  tone?: GlassTone
  squircleSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

// -- Constants

const props = withDefaults(defineProps<LiquidGlassProps>(), {
  material: 'blur',
  tone: 'neutral',
  squircleSize: 'lg'
})

// -- Derived Values

const hostStyle = computed<Record<string, string>>(() => ({
  borderRadius: `var(--ncx-squircle-radius-${props.squircleSize})`,
  '-electron-corner-smoothing': 'var(--ncx-squircle-smoothing)'
}))
</script>

<template>
  <div
    class="ncx-liquid-glass ncx-glass-host"
    :data-material="props.material"
    :data-tone="props.tone"
    :style="hostStyle"
  >
    <GlassSurface
      :material="props.material"
      :tone="props.tone"
    />
    <div class="ncx-liquid-glass-content ncx-glass-content">
      <slot />
    </div>
  </div>
</template>
