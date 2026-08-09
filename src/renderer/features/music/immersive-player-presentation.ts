import { nextTick, readonly, ref, type Ref } from 'vue'

/** 沉浸播放展示控制器公开接口。 */
export interface ImmersivePlayerPresentation {
  /** 沉浸播放展示层是否已打开。 */
  isOpen: Readonly<Ref<boolean>>
  /** 打开沉浸播放展示层。 */
  open: (artworkUrl?: string, trigger?: HTMLElement | null) => Promise<void>
  /** 关闭沉浸播放展示层。 */
  close: () => Promise<void>
}

// ========= 变量 =========

/** 应用级沉浸播放展示状态。 */
const isOpen = ref<boolean>(false)

/** 关闭展示层后需要恢复焦点的 PlayerBar 封面按钮。 */
let returnFocusElement: HTMLElement | null = null

/** 当前正在执行的展示过渡，用于串行处理快速开合命令。 */
let activeTransition: Promise<void> | null = null

/** 高清封面预热最长等待时间，避免网络慢时阻塞展开交互。 */
const ARTWORK_PRELOAD_BUDGET_MS = 180

// ========= 函数 =========

/** 判断用户是否要求减少界面动画。 */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * 在有限时间内预热沉浸页高清封面。
 *
 * @param artworkUrl 沉浸页使用的高清封面地址
 */
async function preloadArtwork(artworkUrl: string | undefined): Promise<void> {
  if (!artworkUrl || typeof Image === 'undefined') return

  /** 用于触发浏览器图片请求与解码的临时图片。 */
  const image = new Image()
  image.src = artworkUrl

  /** 图片完成解码或加载失败后的结束信号。 */
  const imageReady = typeof image.decode === 'function'
    ? image.decode().catch(() => undefined)
    : Promise.resolve()

  /** 限制预热等待时间的结束信号。 */
  const preloadBudget = new Promise<void>((resolve) => {
    window.setTimeout(resolve, ARTWORK_PRELOAD_BUDGET_MS)
  })

  await Promise.race([imageReady, preloadBudget])
}

/** 在捕获展开终点画面前确保沉浸页封面已经完成解码。 */
async function waitForImmersiveArtworkDecode(): Promise<void> {
  /** 新挂载沉浸页中的实际封面图片。 */
  const artworkImage = document.querySelector<HTMLImageElement>('.immersive-artwork img')
  if (!artworkImage || typeof artworkImage.decode !== 'function') return
  await artworkImage.decode().catch(() => undefined)
}

/**
 * 切换沉浸播放展示状态，并在可用时执行共享元素过渡。
 *
 * @param nextOpen 下一展示状态
 */
async function updatePresentation(nextOpen: boolean): Promise<void> {
  if (activeTransition) await activeTransition
  if (isOpen.value === nextOpen) return

  /** 本次展示状态更新的完整过渡任务。 */
  const transitionTask = runPresentationTransition(nextOpen)
  activeTransition = transitionTask

  try {
    await transitionTask
  } finally {
    if (activeTransition === transitionTask) activeTransition = null
  }
}

/**
 * 执行单次沉浸播放展示状态更新。
 *
 * @param nextOpen 下一展示状态
 */
async function runPresentationTransition(nextOpen: boolean): Promise<void> {

  /** 兼容测试环境的可选 View Transition 入口。 */
  const startViewTransition = (
    document as unknown as {
      startViewTransition?: Document['startViewTransition']
    }
  ).startViewTransition?.bind(document)
  /** 是否使用原生共享元素过渡。 */
  const useViewTransition = Boolean(
    startViewTransition && !prefersReducedMotion()
  )

  if (!useViewTransition || !startViewTransition) {
    isOpen.value = nextOpen
    await nextTick()
    return
  }

  /** 同步根层展示状态产生的原生 View Transition。 */
  const transition = startViewTransition(async () => {
    isOpen.value = nextOpen
    await nextTick()
    if (nextOpen) await waitForImmersiveArtworkDecode()
  })

  await transition.finished.catch(() => undefined)
}

/**
 * 打开沉浸播放展示层。
 *
 * @param artworkUrl 需要预热的高清封面地址
 * @param trigger 关闭后恢复焦点的触发按钮
 */
async function open(
  artworkUrl?: string,
  trigger?: HTMLElement | null
): Promise<void> {
  if (isOpen.value) return
  returnFocusElement = trigger ?? document.activeElement as HTMLElement | null
  void preloadArtwork(artworkUrl)
  await updatePresentation(true)
}

/** 关闭沉浸播放展示层并恢复触发按钮焦点。 */
async function close(): Promise<void> {
  if (!isOpen.value) return
  await updatePresentation(false)
  returnFocusElement?.focus()
  returnFocusElement = null
}

/** 返回应用级沉浸播放展示控制器。 */
export function useImmersivePlayerPresentation(): ImmersivePlayerPresentation {
  return {
    isOpen: readonly(isOpen),
    open,
    close
  }
}
