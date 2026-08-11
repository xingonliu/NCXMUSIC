<script setup lang="ts">
// ========= 属性 =========

/** 三点式间奏律动属性。 */
defineProps<{
  /** 当前间奏是否正在播放。 */
  active: boolean
}>()
</script>

<template>
  <div
    class="instrumental-dots"
    :class="{ 'instrumental-dots--active': active }"
    role="img"
    aria-label="纯音乐间奏"
  >
    <span />
    <span />
    <span />
  </div>
</template>

<style scoped>
.instrumental-dots {
  --instrumental-pulse-duration: 1.4s;

  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 2px;
}

.instrumental-dots span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentcolor;
  box-shadow: 0 0 16px rgb(255 255 255 / 22%);
  opacity: 0.42;
  transform: scale(0.72);
}

.instrumental-dots--active span {
  animation: instrumental-dot-pulse var(--instrumental-pulse-duration) ease-in-out infinite;
}

.instrumental-dots--active span:nth-child(2) {
  animation-delay: calc(var(--instrumental-pulse-duration) / 6);
}

.instrumental-dots--active span:nth-child(3) {
  animation-delay: calc(var(--instrumental-pulse-duration) / 3);
}

@keyframes instrumental-dot-pulse {
  0%,
  100% {
    opacity: 0.38;
    transform: scale(0.72);
  }

  45% {
    opacity: 1;
    transform: scale(1.24);
  }
}

@media (prefers-reduced-motion: reduce) {
  .instrumental-dots--active span {
    animation: none;
    opacity: 0.82;
    transform: scale(1);
  }
}
</style>
