<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'

import { CommonIconButton } from '../../../design-system/components'

// -- Inputs and Outputs

const props = defineProps<{
  label: string
  labelledby: string
}>()

// -- State

const viewport = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const canPrevious = ref(false)
const canNext = ref(false)
let resizeObserver: ResizeObserver | undefined

// -- Functions

function updateBounds(): void {
  const element = viewport.value
  if (!element) return
  canPrevious.value = element.scrollLeft > 1
  canNext.value = element.scrollLeft < element.scrollWidth - element.clientWidth - 1
}

function scrollPage(direction: number): void {
  const element = viewport.value
  if (!element) return
  const style = getComputedStyle(element)
  const availableWidth = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  element.scrollBy({
    left: direction * availableWidth,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  })
}

/** 浏览器只认识全宽视口，需要额外避开被侧边栏覆盖的区域。 */
function revealFocusedCard(event: FocusEvent): void {
  const element = viewport.value
  const target = event.target
  if (!element || !(target instanceof HTMLElement)) return
  const card = target.closest('.media-rail-track > *') ?? target
  const viewportRect = element.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  const style = getComputedStyle(element)
  const start = viewportRect.left + parseFloat(style.paddingLeft)
  const end = viewportRect.right - parseFloat(style.paddingRight)
  const offset = cardRect.left < start ? cardRect.left - start : Math.max(0, cardRect.right - end)
  if (offset) element.scrollBy({ left: offset, behavior: 'instant' })
  updateBounds()
}

async function observeLayout(): Promise<void> {
  await nextTick()
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(updateBounds)
  if (viewport.value) resizeObserver.observe(viewport.value)
  if (track.value) resizeObserver.observe(track.value)
  updateBounds()
}

function stopObserving(): void {
  resizeObserver?.disconnect()
}

// -- Lifecycle

onMounted(observeLayout)
onActivated(observeLayout)
onDeactivated(stopObserving)
onBeforeUnmount(stopObserving)
</script>

<template>
  <div class="media-rail">
    <div class="media-rail-heading">
      <slot name="heading" />
      <div class="media-rail-actions">
        <slot name="actions" />
        <div
          v-if="canPrevious || canNext"
          class="media-rail-controls"
          :aria-label="props.label"
        >
          <CommonIconButton
            :label="$tSource('向左滚动')"
            size="compact"
            variant="ghost"
            :disabled="!canPrevious"
            @click="scrollPage(-1)"
          >
            <ChevronLeft :size="18" />
          </CommonIconButton>
          <CommonIconButton
            :label="$tSource('向右滚动')"
            size="compact"
            variant="ghost"
            :disabled="!canNext"
            @click="scrollPage(1)"
          >
            <ChevronRight :size="18" />
          </CommonIconButton>
        </div>
      </div>
    </div>
    <div
      ref="viewport"
      class="media-rail-viewport"
      role="region"
      :aria-labelledby="props.labelledby"
      @scroll.passive="updateBounds"
      @focusin="revealFocusedCard"
    >
      <div
        ref="track"
        class="media-rail-track"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-rail {
  min-width: 0;
}

.media-rail-heading,
.media-rail-actions,
.media-rail-controls {
  display: flex;
  align-items: center;
  gap: var(--ncx-space-2);
}

.media-rail-heading {
  min-height: 30px;
  justify-content: space-between;
  gap: var(--ncx-space-4);
}

.media-rail-viewport {
  width: calc(100% + var(--ncx-content-left) + var(--ncx-content-right));
  margin: 0 0 -20px calc(-1 * var(--ncx-content-left));
  padding: 20px var(--ncx-content-right) 20px var(--ncx-content-left);
  overflow: auto hidden;
  scroll-padding-inline: var(--ncx-content-left) var(--ncx-content-right);
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.media-rail-track {
  display: grid;
  width: max-content;
  min-width: 100%;
  grid-auto-flow: column;
  grid-auto-columns: var(--media-rail-card-width, 180px);
  align-items: start;
  justify-content: start;
  gap: 20px;
}

.media-rail-track :deep(> *) {
  min-width: 0;
}
</style>
