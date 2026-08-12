import { nextTick, readonly, ref, type Ref } from 'vue'

/** 沉浸播放展示控制器公开接口。 */
export interface ImmersivePlayerPresentation {
  /** 沉浸播放展示层是否已打开。 */
  isOpen: Readonly<Ref<boolean>>
  /** 打开沉浸播放展示层。 */
  open: (artworkUrl?: string, trigger?: HTMLElement | null) => Promise<void>
  /** 关闭沉浸播放展示层。 */
  close: () => Promise<void>
  /** 将直接访问或历史导航产生的正式路由状态同步到展示层。 */
  syncFromRoute: (open: boolean) => Promise<void>
}

// ========= 变量 =========

/** 应用级沉浸播放展示状态。 */
const isOpen = ref<boolean>(false)

/** 关闭展示层后需要恢复焦点的 PlayerBar 封面按钮。 */
let returnFocusElement: HTMLElement | null = null

/** 当前正在执行的展示过渡，用于串行处理快速开合命令。 */
let activeTransition: Promise<void> | null = null

/** 当前沉浸展示是否由直接访问沉浸路由创建。 */
let presentationOpenedFromRoute = false

/** 高清封面预热最长等待时间，避免网络慢时阻塞展开交互。 */
const ARTWORK_PRELOAD_BUDGET_MS = 180

/** 根节点上标记沉浸播放共享元素过渡方向的属性名。 */
const IMMERSIVE_TRANSITION_DIRECTION_ATTRIBUTE = 'data-ncx-immersive-transition'

/** 沉浸播放共享元素过渡支持的方向。 */
type ImmersiveTransitionDirection = 'opening' | 'closing'

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

  /** 当前共享元素过渡方向，供伪元素样式稳定匹配开合状态。 */
  const transitionDirection: ImmersiveTransitionDirection = nextOpen
    ? 'opening'
    : 'closing'
  /** 承载过渡方向标记的文档根节点。 */
  const documentRoot = document.documentElement
  documentRoot.setAttribute(
    IMMERSIVE_TRANSITION_DIRECTION_ATTRIBUTE,
    transitionDirection
  )

  try {
    /** 同步根层展示状态产生的原生 View Transition。 */
    const transition = startViewTransition(async () => {
      isOpen.value = nextOpen
      await nextTick()
      if (nextOpen) await waitForImmersiveArtworkDecode()
    })

    await transition.finished.catch(() => undefined)
  } finally {
    if (
      documentRoot.getAttribute(IMMERSIVE_TRANSITION_DIRECTION_ATTRIBUTE)
      === transitionDirection
    ) {
      documentRoot.removeAttribute(IMMERSIVE_TRANSITION_DIRECTION_ATTRIBUTE)
    }
  }
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
  presentationOpenedFromRoute = false
  returnFocusElement = trigger ?? document.activeElement as HTMLElement | null
  void preloadArtwork(artworkUrl)
  await updatePresentation(true)
}

/** 关闭沉浸播放展示层并恢复触发按钮焦点。 */
async function close(): Promise<void> {
  if (!isOpen.value) return
  /** 是否需要在展示关闭后离开直接访问的沉浸路由。 */
  const shouldLeaveImmersiveRoute = presentationOpenedFromRoute &&
    window.location.hash.startsWith('#/player/lyrics')
  presentationOpenedFromRoute = false
  await updatePresentation(false)
  if (shouldLeaveImmersiveRoute) {
    /** 浏览器历史中可返回时优先保持用户来源页，否则进入播放详情页。 */
    if (window.history.length > 1) window.history.back()
    else window.location.hash = '#/player'
  }
  returnFocusElement?.focus()
  returnFocusElement = null
}

/** 同步直接输入 URL、历史前进后退产生的沉浸路由状态。 */
async function syncFromRoute(nextOpen: boolean): Promise<void> {
  if (nextOpen) presentationOpenedFromRoute = true
  else presentationOpenedFromRoute = false
  await updatePresentation(nextOpen)
}

/** 返回应用级沉浸播放展示控制器。 */
export function useImmersivePlayerPresentation(): ImmersivePlayerPresentation {
  return {
    isOpen: readonly(isOpen),
    open,
    close,
    syncFromRoute
  }
}
