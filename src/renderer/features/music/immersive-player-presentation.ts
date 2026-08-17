import { nextTick, readonly, ref, type Ref } from 'vue'

/** 沉浸播放展示控制器公开接口。 */
export interface ImmersivePlayerPresentation {
  /** 沉浸播放展示层是否已打开。 */
  isOpen: Readonly<Ref<boolean>>
  /** 打开沉浸播放展示层。 */
  open: (trigger?: HTMLElement | null) => Promise<void>
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

/** 当前沉浸展示是否由直接访问沉浸路由创建。 */
let presentationOpenedFromRoute = false

// ========= 函数 =========

/**
 * 切换沉浸播放展示状态并等待 Vue 完成根层挂载更新。
 *
 * @param nextOpen 下一展示状态
 */
async function updatePresentation(nextOpen: boolean): Promise<void> {
  if (isOpen.value === nextOpen) return
  isOpen.value = nextOpen
  await nextTick()
}

/**
 * 打开沉浸播放展示层。
 *
 * @param trigger 关闭后恢复焦点的触发按钮
 */
async function open(trigger?: HTMLElement | null): Promise<void> {
  if (isOpen.value) return
  presentationOpenedFromRoute = false
  returnFocusElement = trigger ?? document.activeElement as HTMLElement | null
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
