import { nextTick, readonly, ref, type Ref } from 'vue'

/** 沉浸播放展示控制器公开接口。 */
export interface ImmersivePlayerPresentation {
  /** 沉浸播放展示层是否仍处于挂载状态。 */
  isOpen: Readonly<Ref<boolean>>
  /** 沉浸播放展示层是否处于可见状态。 */
  isVisible: Readonly<Ref<boolean>>
  /** 打开沉浸播放展示层。 */
  open: (trigger?: HTMLElement | null) => Promise<void>
  /** 开始关闭沉浸播放展示层并等待离场完成。 */
  close: () => Promise<void>
  /** 在根层离场动画完成后卸载沉浸播放展示层。 */
  completeClose: () => Promise<void>
  /** 将直接访问或历史导航产生的正式路由状态同步到展示层。 */
  syncFromRoute: (open: boolean) => Promise<void>
}

// ========= 变量 =========

/** 应用级沉浸播放展示层是否仍处于挂载状态。 */
const isOpen = ref<boolean>(false)

/** 应用级沉浸播放展示层是否处于可见状态。 */
const isVisible = ref<boolean>(false)

/** 关闭展示层后需要恢复焦点的 PlayerBar 封面按钮。 */
let returnFocusElement: HTMLElement | null = null

/** 当前沉浸展示是否由直接访问沉浸路由创建。 */
let presentationOpenedFromRoute = false

/** 离场完成后是否需要离开直接访问的沉浸路由。 */
let shouldLeaveImmersiveRouteAfterClose = false

/** 当前等待离场动画完成的关闭任务。 */
let closeCompletionTask: Promise<void> | undefined

/** 完成当前关闭任务的回调。 */
let resolveCloseCompletion: (() => void) | undefined

// ========= 函数 =========

/** 返回当前关闭任务，并在首次请求关闭时创建它。 */
function ensureCloseCompletionTask(): Promise<void> {
  if (closeCompletionTask) return closeCompletionTask
  closeCompletionTask = new Promise<void>((resolve) => {
    resolveCloseCompletion = resolve
  })
  return closeCompletionTask
}

/** 完成并清理当前等待中的关闭任务。 */
function settleCloseCompletionTask(): void {
  resolveCloseCompletion?.()
  closeCompletionTask = undefined
  resolveCloseCompletion = undefined
}

/** 挂载并显示沉浸播放展示层。 */
async function showPresentation(): Promise<void> {
  if (isOpen.value && isVisible.value) return
  shouldLeaveImmersiveRouteAfterClose = false
  isOpen.value = true
  isVisible.value = true
  settleCloseCompletionTask()
  await nextTick()
}

/**
 * 仅隐藏根层过渡容器，保留内部组件直到离场动画完成。
 *
 * @param shouldLeaveRoute 离场完成后是否离开沉浸路由
 */
async function hidePresentation(shouldLeaveRoute: boolean): Promise<void> {
  if (!isOpen.value) return
  if (!isVisible.value) return closeCompletionTask
  shouldLeaveImmersiveRouteAfterClose = shouldLeaveRoute
  /** 本次等待根层离场动画完成的关闭任务。 */
  const completionTask = ensureCloseCompletionTask()
  isVisible.value = false
  await nextTick()
  await completionTask
}

/**
 * 打开沉浸播放展示层。
 *
 * @param trigger 关闭后恢复焦点的触发按钮
 */
async function open(trigger?: HTMLElement | null): Promise<void> {
  if (isVisible.value) return
  presentationOpenedFromRoute = false
  returnFocusElement = trigger ?? document.activeElement as HTMLElement | null
  await showPresentation()
}

/** 开始关闭沉浸播放展示层并等待根层离场动画完成。 */
async function close(): Promise<void> {
  if (!isOpen.value) return
  /** 是否需要在展示关闭后离开直接访问的沉浸路由。 */
  const shouldLeaveImmersiveRoute = presentationOpenedFromRoute &&
    window.location.hash.startsWith('#/player/lyrics')
  presentationOpenedFromRoute = false
  await hidePresentation(shouldLeaveImmersiveRoute)
}

/** 在根层离场动画完成后卸载内部组件并恢复路由与焦点。 */
async function completeClose(): Promise<void> {
  if (!isOpen.value || isVisible.value) return
  /** 当前离场完成后是否需要离开直接访问的沉浸路由。 */
  const shouldLeaveImmersiveRoute = shouldLeaveImmersiveRouteAfterClose
  shouldLeaveImmersiveRouteAfterClose = false
  isOpen.value = false
  await nextTick()
  if (isVisible.value) return
  if (shouldLeaveImmersiveRoute) {
    /** 浏览器历史中可返回时优先保持用户来源页，否则进入播放详情页。 */
    if (window.history.length > 1) window.history.back()
    else window.location.hash = '#/player'
  }
  returnFocusElement?.focus()
  returnFocusElement = null
  settleCloseCompletionTask()
}

/** 同步直接输入 URL、历史前进后退产生的沉浸路由状态。 */
async function syncFromRoute(nextOpen: boolean): Promise<void> {
  if (nextOpen) {
    presentationOpenedFromRoute = true
    returnFocusElement = null
    await showPresentation()
    return
  }
  presentationOpenedFromRoute = false
  await hidePresentation(false)
}

/** 返回应用级沉浸播放展示控制器。 */
export function useImmersivePlayerPresentation(): ImmersivePlayerPresentation {
  return {
    isOpen: readonly(isOpen),
    isVisible: readonly(isVisible),
    open,
    close,
    completeClose,
    syncFromRoute
  }
}
