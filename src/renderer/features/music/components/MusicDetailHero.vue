<script setup lang="ts">
import { ref, watch } from 'vue'

// -- Inputs and Outputs

const props = withDefaults(defineProps<{
  artworkUrl?: string | undefined
}>(), { artworkUrl: undefined })

// -- State

const artworkFailed = ref(false)

// -- Listeners

watch(() => props.artworkUrl, () => { artworkFailed.value = false })
</script>

<template>
  <header class="music-detail-hero">
    <img
      v-if="props.artworkUrl && !artworkFailed"
      class="music-detail-hero-art"
      :src="props.artworkUrl"
      alt=""
      aria-hidden="true"
      @error="artworkFailed = true"
    >
    <div
      class="music-detail-hero-scrim"
      aria-hidden="true"
    />
    <div class="music-detail-hero-inner">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.music-detail-hero {
  --ncx-color-text-primary: #fff;
  --ncx-color-text-secondary: rgb(255 255 255 / 80%);
  --ncx-color-text-tertiary: rgb(255 255 255 / 66%);
  --ncx-btn-bg-secondary: rgb(255 255 255 / 16%);
  --ncx-btn-bg-hover: rgb(255 255 255 / 24%);
  --ncx-btn-bg-pressed: rgb(255 255 255 / 30%);

  position: relative;
  width: calc(100% + var(--ncx-content-left) + var(--ncx-content-right));
  margin-left: calc(-1 * var(--ncx-content-left));
  color: #fff;
  background: #22232a;
}

.music-detail-hero-art,
.music-detail-hero-scrim {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.music-detail-hero-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 35%;
}

.music-detail-hero-scrim {
  background: linear-gradient(180deg, rgb(0 0 0 / 12%), rgb(0 0 0 / 15%) 30%, rgb(0 0 0 / 70%) 100%);
}

.music-detail-hero-inner {
  position: relative;
  display: flex;
  min-height: clamp(480px, 76vh, 740px);
  flex-direction: column;
  justify-content: flex-end;
  padding: 112px var(--ncx-content-right) 48px var(--ncx-content-left);
}

.music-detail-hero-inner :deep(h1) {
  margin: 0;
  font-size: clamp(34px, 4vw, 60px);
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.music-detail-hero-inner :deep(.music-detail-hero-copy) {
  max-width: 680px;
}

.music-detail-hero-inner :deep(.ncx-common-button-secondary) {
  background: var(--ncx-btn-bg-secondary);
}

.music-detail-hero-inner :deep(.ncx-common-button-secondary:hover:not(:disabled)) {
  background: var(--ncx-btn-bg-hover);
}

.music-detail-hero-inner :deep(.ncx-common-button-secondary:active:not(:disabled)) {
  background: var(--ncx-btn-bg-pressed);
}

@media (width < 1100px) {
  .music-detail-hero-inner {
    padding-bottom: 32px;
  }
}
</style>
