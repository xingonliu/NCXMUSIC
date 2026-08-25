<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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

/** Apple Music 网页端同形 Pixi WebGL 渲染画布。 */
const canvasElement = ref<HTMLCanvasElement | null>(null)

/** 强制 Vue 为失效 GPU 管线换用全新 Canvas 的世代编号。 */
const canvasGeneration = ref(0)

/** WebGL 管线是否已成功输出当前封面。 */
const webglReady = ref(false)

/** WebGL 或跨域加载失败时显示同一封面的弥散降级层。 */
const fallbackArtworkStyle = computed<Record<string, string>>(() => (
  props.artworkUrl
    ? { backgroundImage: `url(${JSON.stringify(props.artworkUrl)})` }
    : {}
))

/** 当前已完成跨域加载和解码的 40×40 背景封面。 */
let activeArtwork: HTMLImageElement | undefined

/** 当前 WebGL 背景实例。 */
let renderer: FluidMeshRenderer | undefined

/** 使异步 Pixi 初始化在重建或卸载后不会回写过期实例。 */
let rendererGeneration = 0

/** 跟踪沉浸页尺寸变化的观察器。 */
let resizeObserver: ResizeObserver | undefined

/** 系统减少动态效果媒体查询。 */
let reducedMotionQuery: MediaQueryList | undefined

/** 是否正在用全新 Canvas 重建失效的 GPU 管线。 */
let rendererRebuildInProgress = false

/** 切歌瞬间封面请求失败后的单次重试等待时间。 */
const ARTWORK_LOAD_RETRY_DELAY_MS = 180

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

/** 在可取消的短等待后允许封面加载重试一次。 */
function waitForArtworkRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    /** 本次短等待使用的计时器。 */
    const timeoutId = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ARTWORK_LOAD_RETRY_DELAY_MS)

    /** 移除短等待注册的取消监听。 */
    function cleanup(): void {
      signal.removeEventListener('abort', handleAbort)
    }

    /** 切到另一首歌或卸载时取消尚未开始的重试。 */
    function handleAbort(): void {
      window.clearTimeout(timeoutId)
      cleanup()
      reject(new DOMException('Artwork texture loading was aborted.', 'AbortError'))
    }

    if (signal.aborted) {
      handleAbort()
      return
    }
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

/** 首次封面请求异常时短暂等待并重试一次，避免重新进入页面才能恢复。 */
async function loadArtworkWithRetry(
  source: string,
  signal: AbortSignal
): Promise<HTMLImageElement> {
  try {
    return await loadArtwork(source, signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    await waitForArtworkRetry(signal)
    return loadArtwork(source, signal)
  }
}

/** 使用当前容器 CSS 尺寸更新 Pixi WebGL 目标。 */
function resizeRenderer(): void {
  /** Canvas 在页面上的 CSS 尺寸。 */
  const bounds = canvasElement.value?.getBoundingClientRect()
  /** 初次布局或测试环境使用的安全宽度。 */
  const width = bounds?.width || window.innerWidth || 640
  /** 初次布局或测试环境使用的安全高度。 */
  const height = bounds?.height || window.innerHeight || 420
  renderer?.resize(width, height)
}

/** 为当前 Canvas 注册上下文恢复和尺寸观察。 */
function attachCanvas(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('webglcontextlost', handleContextLost)
  canvas.addEventListener('webglcontextrestored', handleContextRestored)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resizeRenderer)
    resizeObserver.observe(canvas)
  }
}

/** 从即将废弃的 Canvas 移除上下文恢复和尺寸观察。 */
function detachCanvas(canvas: HTMLCanvasElement | null): void {
  resizeObserver?.disconnect()
  resizeObserver = undefined
  canvas?.removeEventListener('webglcontextlost', handleContextLost)
  canvas?.removeEventListener('webglcontextrestored', handleContextRestored)
}

/** 建立 Pixi WebGL 管线；不支持时静默保留 CSS 封面降级层。 */
async function createRenderer(): Promise<void> {
  /** 当前已挂载的 Canvas。 */
  const canvas = canvasElement.value
  if (!canvas) return
  /** 当前异步初始化任务的世代编号。 */
  const generation = ++rendererGeneration
  /** 本次异步创建出来、尚未确认接管 Canvas 的 Pixi 渲染器。 */
  let nextRenderer: FluidMeshRenderer | undefined
  webglReady.value = false
  try {
    /** 新建的 Apple Music 网页端同形 Pixi 渲染器。 */
    nextRenderer = await FluidMeshRenderer.create(canvas)
    if (generation !== rendererGeneration || canvasElement.value !== canvas) {
      nextRenderer.destroy()
      return
    }
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
    nextRenderer?.destroy()
    if (generation === rendererGeneration) {
      renderer = undefined
      webglReady.value = false
    }
  }
}

/**
 * 换用全新 Canvas 重建 GPU 管线，隔离旧 Pixi 销毁时强制派发的上下文丢失事件。
 */
async function rebuildRendererWithFreshCanvas(): Promise<void> {
  if (rendererRebuildInProgress) return
  rendererRebuildInProgress = true
  /** 即将从页面移除的失效 Canvas。 */
  const previousCanvas = canvasElement.value
  /** 即将在旧 Canvas 脱离页面后释放的 Pixi 实例。 */
  const previousRenderer = renderer
  rendererGeneration += 1
  renderer = undefined
  webglReady.value = false
  detachCanvas(previousCanvas)
  previousRenderer?.stop()

  try {
    canvasGeneration.value += 1
    await nextTick()
    previousRenderer?.destroy()
    /** Vue 为新世代挂载的全新 Canvas。 */
    const nextCanvas = canvasElement.value
    if (!nextCanvas) return
    attachCanvas(nextCanvas)
    await createRenderer()
  } finally {
    rendererRebuildInProgress = false
  }
}

/**
 * 把已解码封面交给当前 Pixi 实例；旧实例状态异常时以同一封面重建完整管线。
 *
 * @param artwork 当前歌曲已完成跨域校验的封面
 */
async function applyArtworkToRenderer(artwork: HTMLImageElement): Promise<void> {
  /** 当前负责屏幕输出的 Pixi 实例。 */
  const activeRenderer = renderer
  if (!activeRenderer) {
    webglReady.value = false
    return
  }

  try {
    activeRenderer.setArtwork(artwork)
    webglReady.value = true
  } catch {
    // 关闭再打开能恢复说明封面有效、旧 GPU 管线失效；新 Canvas 可隔离旧上下文销毁事件。
    webglReady.value = false
    if (activeArtwork === artwork) await rebuildRendererWithFreshCanvas()
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

/** 在 Pixi 完成原生上下文恢复后重新上传当前封面并恢复可见输出。 */
async function recoverRestoredContext(): Promise<void> {
  /** 浏览器恢复后仍持有当前 Canvas 的 Pixi 实例。 */
  const activeRenderer = renderer
  /** 恢复时需要重新确认的当前封面。 */
  const artwork = activeArtwork
  if (!activeRenderer || !artwork) {
    await rebuildRendererWithFreshCanvas()
    return
  }

  try {
    activeRenderer.setArtwork(artwork)
    resizeRenderer()
    if (!document.hidden) activeRenderer.start()
    webglReady.value = true
  } catch {
    await rebuildRendererWithFreshCanvas()
  }
}

/** WebGL 上下文恢复后等待 Pixi 自身监听器完成资源恢复。 */
function handleContextRestored(): void {
  queueMicrotask(() => {
    void recoverRestoredContext()
  })
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
    const artwork = await loadArtworkWithRetry(artworkUrl, controller.signal)
    if (controller.signal.aborted) return
    activeArtwork = artwork
    emit('accent-color', extractArtworkAccentColor(artwork))
    await applyArtworkToRenderer(artwork)
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
  attachCanvas(canvas)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('resize', resizeRenderer)
  void createRenderer()
})

onBeforeUnmount(() => {
  /** 即将卸载的 Canvas。 */
  const canvas = canvasElement.value
  rendererGeneration += 1
  detachCanvas(canvas)
  reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
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
      :key="canvasGeneration"
      ref="canvasElement"
      class="fluid-mesh-background-canvas"
    />
    <div class="fluid-mesh-background-dim" />
    <div class="fluid-mesh-background-ambient" />
  </div>
</template>

<style scoped>
.fluid-mesh-background,
.fluid-mesh-background-fallback,
.fluid-mesh-background-canvas,
.fluid-mesh-background-dim,
.fluid-mesh-background-ambient {
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
  filter: blur(110px) saturate(2.75) brightness(0.7) contrast(1.9);
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

.fluid-mesh-background-dim {
  background: rgb(0 0 0 / 50%);
}

.fluid-mesh-background-ambient {
  background: rgb(255 255 255 / 5%);
}

@media (prefers-reduced-motion: reduce) {
  .fluid-mesh-background-fallback,
  .fluid-mesh-background-canvas {
    transition-duration: 180ms;
  }
}
</style>
