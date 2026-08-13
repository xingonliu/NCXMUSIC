<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  DEFAULT_LYRIC_ACCENT_COLOR,
  extractArtworkAccentColor
} from '../artwork-accent-color'
import { FluidMeshRenderer } from '../fluid-mesh-renderer'
import { usePlayer } from '../use-player'

// ========= 属性 =========

/** Apple Music 网页端同形背景输入。 */
const props = withDefaults(defineProps<{
  /** 当前歌曲专辑封面地址。 */
  artworkUrl?: string | undefined
  /** 当前歌曲是否正在播放。 */
  playing?: boolean
}>(), {
  artworkUrl: undefined,
  playing: false
})

/** 封面完成加载后向沉浸页提供一次歌词前沿色。 */
const emit = defineEmits<{
  /** 当前封面提亮后的代表色。 */
  (event: 'accent-color', color: string): void
}>()

// ========= 变量 =========

/** 提供播放器实时 50～120 Hz 低频能量。 */
const player = usePlayer()

/** Apple Music 网页端同形 WebGL 渲染画布。 */
const canvasElement = ref<HTMLCanvasElement | null>(null)

/** WebGL 管线是否已成功输出当前封面。 */
const webglReady = ref(false)

/** WebGL 或跨域加载失败时显示同一封面的弥散降级层。 */
const fallbackArtworkStyle = computed<Record<string, string>>(() => (
  props.artworkUrl
    ? { backgroundImage: `url(${JSON.stringify(props.artworkUrl)})` }
    : {}
))

/** 当前已完成跨域加载和解码的封面。 */
let activeArtwork: HTMLImageElement | undefined

/** 当前 WebGL 背景实例。 */
let renderer: FluidMeshRenderer | undefined

/** 跟踪沉浸页尺寸变化的观察器。 */
let resizeObserver: ResizeObserver | undefined

/** 系统减少动态效果媒体查询。 */
let reducedMotionQuery: MediaQueryList | undefined

// ========= 函数 =========

/** 创建可取消且允许 WebGL 采样的跨域图片加载任务。 */
function loadArtwork(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    /** 承载当前封面的图片对象。 */
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'

    /** 移除本次图片加载的全部监听器。 */
    function cleanup(): void {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
      signal.removeEventListener('abort', handleAbort)
    }

    /** 图片成功加载后的完成处理。 */
    function handleLoad(): void {
      cleanup()
      resolve(image)
    }

    /** 图片失败时保留 CSS 弥散层。 */
    function handleError(): void {
      cleanup()
      reject(new Error('Album artwork could not be loaded as a WebGL texture.'))
    }

    /** 切歌或组件卸载时取消旧封面请求。 */
    function handleAbort(): void {
      cleanup()
      image.src = ''
      reject(new DOMException('Artwork texture loading was aborted.', 'AbortError'))
    }

    if (signal.aborted) {
      handleAbort()
      return
    }
    image.addEventListener('load', handleLoad, { once: true })
    image.addEventListener('error', handleError, { once: true })
    signal.addEventListener('abort', handleAbort, { once: true })
    image.src = source
  })
}

/** 使用当前容器 CSS 尺寸更新低分辨率 WebGL 目标。 */
function resizeRenderer(): void {
  /** Canvas 在页面上的 CSS 尺寸。 */
  const bounds = canvasElement.value?.getBoundingClientRect()
  /** 初次布局或测试环境使用的安全宽度。 */
  const width = bounds?.width || window.innerWidth || 640
  /** 初次布局或测试环境使用的安全高度。 */
  const height = bounds?.height || window.innerHeight || 420
  renderer?.resize(width, height)
}

/** 建立 WebGL 管线；不支持时静默保留 CSS 封面降级层。 */
function createRenderer(): void {
  /** 当前已挂载的 Canvas。 */
  const canvas = canvasElement.value
  if (!canvas) return
  renderer?.destroy()
  renderer = undefined
  webglReady.value = false
  try {
    /** 新建的 Apple Music 网页端同形渲染器。 */
    const nextRenderer = new FluidMeshRenderer(canvas)
    renderer = nextRenderer
    resizeRenderer()
    nextRenderer.setAudioEnergyProvider(() => player.getAudioEnergy())
    nextRenderer.setReducedMotion(reducedMotionQuery?.matches ?? false)
    nextRenderer.setMotionActive(props.playing, true)
    if (activeArtwork) {
      nextRenderer.setArtwork(activeArtwork)
      webglReady.value = true
    }
    if (!document.hidden) nextRenderer.start()
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

/** WebGL 上下文恢复后重建全部 Program、纹理和帧缓冲。 */
function handleContextRestored(): void {
  createRenderer()
}

/** 系统动态效果偏好变化时立即冻结或恢复封面运动。 */
function handleReducedMotionChange(event: MediaQueryListEvent): void {
  renderer?.setReducedMotion(event.matches)
}

// ========= 生命周期 =========

watch(() => props.artworkUrl, async (artworkUrl, _previous, onCleanup) => {
  /** 取消上一首歌曲尚未完成的封面纹理加载。 */
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  emit('accent-color', DEFAULT_LYRIC_ACCENT_COLOR)
  if (!artworkUrl) {
    activeArtwork = undefined
    webglReady.value = false
    renderer?.clearArtwork()
    return
  }

  try {
    /** 当前歌曲完成跨域校验和解码的封面。 */
    const artwork = await loadArtwork(artworkUrl, controller.signal)
    if (controller.signal.aborted) return
    activeArtwork = artwork
    emit('accent-color', extractArtworkAccentColor(artwork))
    renderer?.setArtwork(artwork)
    webglReady.value = renderer !== undefined
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    activeArtwork = undefined
    webglReady.value = false
    renderer?.clearArtwork()
  }
}, { immediate: true })

watch(() => props.playing, (playing) => {
  renderer?.setMotionActive(playing)
})

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
    <div class="fluid-mesh-background-contrast" />
  </div>
</template>

<style scoped>
.fluid-mesh-background,
.fluid-mesh-background-fallback,
.fluid-mesh-background-canvas,
.fluid-mesh-background-contrast {
  position: absolute;
  inset: 0;
}

.fluid-mesh-background {
  overflow: hidden;
  contain: strict;
  background: #090b0d;
  pointer-events: none;
}

.fluid-mesh-background-fallback {
  inset: -14%;
  width: 128%;
  height: 128%;
  background-color: #0c1013;
  background-position: center;
  background-size: cover;
  filter: blur(110px) saturate(2.2) brightness(0.58);
  opacity: 0.92;
  transform: translateZ(0) scale(1.08);
  transition: opacity 700ms ease;
  will-change: filter, opacity;
}

.fluid-mesh-background-canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: translateZ(0) scale(1.025);
  transition: opacity 700ms ease;
  will-change: opacity;
}

.fluid-mesh-background--ready .fluid-mesh-background-fallback {
  opacity: 0;
}

.fluid-mesh-background--ready .fluid-mesh-background-canvas {
  opacity: 1;
}

.fluid-mesh-background-contrast {
  background:
    linear-gradient(
      180deg,
      rgb(2 4 6 / 32%) 0%,
      rgb(2 4 6 / 10%) 34%,
      rgb(2 4 6 / 16%) 66%,
      rgb(2 4 6 / 38%) 100%
    );
}

@media (prefers-reduced-motion: reduce) {
  .fluid-mesh-background-fallback,
  .fluid-mesh-background-canvas {
    transition-duration: 1ms;
  }
}
</style>
