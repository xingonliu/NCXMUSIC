<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  createFallbackFluidMeshPalette,
  DEFAULT_FLUID_MESH_PALETTE,
  extractArtworkFluidMeshPalette,
  type FluidMeshPalette
} from '../fluid-mesh-palette'
import { FluidMeshRenderer } from '../fluid-mesh-renderer'
import { usePlayer } from '../use-player'

// ========= 属性 =========

/** 流体网格背景输入。 */
const props = withDefaults(defineProps<{
  /** 当前歌曲专辑封面地址。 */
  artworkUrl?: string | undefined
  /** 当前歌曲是否正在播放。 */
  playing?: boolean
}>(), {
  artworkUrl: undefined,
  playing: false
})

// ========= 变量 =========

/** 共享播放器接口。 */
const player = usePlayer()

/** 低分辨率 WebGL 渲染画布。 */
const canvasElement = ref<HTMLCanvasElement | null>(null)

/** WebGL 管线是否已成功输出画面。 */
const webglReady = ref(false)

/** 跨域失败时仍显示封面弥散层的内联样式。 */
const fallbackArtworkStyle = computed<Record<string, string>>(() => (
  props.artworkUrl ? { backgroundImage: `url("${props.artworkUrl}")` } : {}
))

/** 当前生效或等待渲染器接管的调色板。 */
let activePalette: FluidMeshPalette = DEFAULT_FLUID_MESH_PALETTE

/** 当前 WebGL 流体网格实例。 */
let renderer: FluidMeshRenderer | undefined

/** 跟踪沉浸页尺寸变化的观察器。 */
let resizeObserver: ResizeObserver | undefined

/** 系统减少动态效果媒体查询。 */
let reducedMotionQuery: MediaQueryList | undefined

// ========= 函数 =========

/** 使用当前容器尺寸更新约 400×300 的低分辨率渲染目标。 */
function resizeRenderer(): void {
  /** Canvas 在页面上的 CSS 尺寸。 */
  const bounds = canvasElement.value?.getBoundingClientRect()
  /** 测试或初次布局时使用的安全宽度。 */
  const width = bounds?.width || window.innerWidth || 400
  /** 测试或初次布局时使用的安全高度。 */
  const height = bounds?.height || window.innerHeight || 300
  renderer?.resize(width, height)
}

/** 建立 WebGL 管线；不支持 WebGL 时静默保留 CSS 封面降级层。 */
function createRenderer(): void {
  /** 当前已挂载的 Canvas。 */
  const canvas = canvasElement.value
  if (!canvas) return
  renderer?.destroy()
  renderer = undefined
  webglReady.value = false
  try {
    /** 新建的流体网格渲染器。 */
    const nextRenderer = new FluidMeshRenderer(canvas)
    renderer = nextRenderer
    nextRenderer.setPalette(activePalette)
    nextRenderer.setMotionActive(props.playing)
    nextRenderer.setReducedMotion(reducedMotionQuery?.matches ?? false)
    nextRenderer.setAudioEnergyProvider(() => player.getAudioEnergy())
    resizeRenderer()
    if (!document.hidden) nextRenderer.start()
    webglReady.value = true
  } catch {
    renderer = undefined
  }
}

/** 页面隐藏时暂停 GPU 循环，重新可见时继续。 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    renderer?.stop()
    return
  }
  renderer?.start()
}

/** WebGL 上下文丢失时阻止浏览器永久放弃恢复。 */
function handleContextLost(event: Event): void {
  event.preventDefault()
  renderer?.stop()
  webglReady.value = false
}

/** WebGL 上下文恢复后重建 Program、Buffer 和 uniform。 */
function handleContextRestored(): void {
  createRenderer()
}

/** 系统动态效果偏好变化时立即同步 Shader 流动策略。 */
function handleReducedMotionChange(event: MediaQueryListEvent): void {
  renderer?.setReducedMotion(event.matches)
}

// ========= 生命周期 =========

watch(() => props.artworkUrl, async (artworkUrl, _previous, onCleanup) => {
  /** 取消上一首歌曲尚未完成的图片加载和像素读取。 */
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  if (!artworkUrl) {
    activePalette = DEFAULT_FLUID_MESH_PALETTE
    renderer?.setPalette(activePalette)
    return
  }

  try {
    activePalette = await extractArtworkFluidMeshPalette(artworkUrl, controller.signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    activePalette = createFallbackFluidMeshPalette(artworkUrl)
  }
  if (!controller.signal.aborted) renderer?.setPalette(activePalette)
}, { immediate: true })

watch(() => props.playing, (playing) => {
  renderer?.setMotionActive(playing)
}, { immediate: true })

onMounted(() => {
  /** 当前挂载完成的 Canvas。 */
  const canvas = canvasElement.value
  if (!canvas) return
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  reducedMotionQuery?.addEventListener('change', handleReducedMotionChange)
  canvas.addEventListener('webglcontextlost', handleContextLost)
  canvas.addEventListener('webglcontextrestored', handleContextRestored)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('resize', resizeRenderer)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resizeRenderer)
    resizeObserver.observe(canvas)
  }
  createRenderer()
})

onBeforeUnmount(() => {
  /** 即将卸载的 Canvas。 */
  const canvas = canvasElement.value
  resizeObserver?.disconnect()
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
  canvas?.removeEventListener('webglcontextlost', handleContextLost)
  canvas?.removeEventListener('webglcontextrestored', handleContextRestored)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('resize', resizeRenderer)
  renderer?.destroy()
  renderer = undefined
})
</script>

<template>
  <div
    class="fluid-mesh-background"
    :class="webglReady ? 'fluid-mesh-background--ready' : ''"
    aria-hidden="true"
  >
    <div
      class="fluid-mesh-background-fallback"
      :style="fallbackArtworkStyle"
    />
    <canvas
      ref="canvasElement"
      class="fluid-mesh-background-canvas"
    />
    <div class="fluid-mesh-background-vignette" />
  </div>
</template>

<style scoped>
.fluid-mesh-background,
.fluid-mesh-background-fallback,
.fluid-mesh-background-canvas,
.fluid-mesh-background-vignette {
  position: absolute;
  inset: 0;
}

.fluid-mesh-background {
  overflow: hidden;
  contain: strict;
  background: #0b1114;
  pointer-events: none;
}

.fluid-mesh-background-fallback,
.fluid-mesh-background-canvas {
  inset: -22%;
  width: 144%;
  height: 144%;
  transform: translateZ(0) scale(1.12);
  will-change: transform, filter, opacity;
}

.fluid-mesh-background-fallback {
  background-color: #10171a;
  background-position: center;
  background-size: cover;
  filter: blur(110px) saturate(1.38) brightness(0.58);
  opacity: 0.9;
  transition: opacity 900ms ease;
}

.fluid-mesh-background-canvas {
  display: block;
  filter: blur(110px) saturate(1.15);
  opacity: 0;
  transition: opacity 700ms ease;
}

.fluid-mesh-background--ready .fluid-mesh-background-fallback {
  opacity: 0.18;
}

.fluid-mesh-background--ready .fluid-mesh-background-canvas {
  opacity: 1;
}

.fluid-mesh-background-vignette {
  background:
    linear-gradient(180deg, rgb(3 7 9 / 26%) 0%, transparent 30%, rgb(2 5 7 / 32%) 100%),
    radial-gradient(
      ellipse 82% 74% at 54% 46%,
      rgb(4 8 10 / 20%) 0%,
      rgb(3 7 9 / 30%) 54%,
      rgb(1 3 5 / 66%) 100%
    );
  box-shadow: inset 0 0 190px rgb(0 0 0 / 24%);
}

@media (prefers-reduced-motion: reduce) {
  .fluid-mesh-background-fallback,
  .fluid-mesh-background-canvas {
    transition-duration: 1ms;
  }
}
</style>
