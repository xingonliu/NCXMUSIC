import { onBeforeUnmount, onMounted, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import { usePlayer } from './use-player'

// ========= 类型定义 =========

/** 播放器全局快捷键配置选项。 */
export interface PlayerKeyboardShortcutsOptions {
  /** 播放控制栏是否在当前页面可见。 */
  showPlayerBar: Ref<boolean> | ComputedRef<boolean>
  /** 沉浸式歌词展示页是否打开。 */
  isImmersivePlayerOpen: Ref<boolean> | ComputedRef<boolean>
  /** 当前路由对象，用于识别搜索页等禁用场景。 */
  route: RouteLocationNormalizedLoaded
}

// ========= 辅助函数 =========

/**
 * 判断当前路由是否属于搜索相关页面。
 *
 * @param route 当前路由快照
 * @returns 是否属于搜索页或搜索结果页
 */
export function isSearchRoute(route: Pick<RouteLocationNormalizedLoaded, 'name' | 'path'>): boolean {
  if (route.name === 'search' || route.name === 'search-results') {
    return true
  }
  return typeof route.path === 'string' && route.path.startsWith('/search')
}

/**
 * 判断当前路由是否属于小云 (AI 助手) 页面。
 *
 * @param route 当前路由快照
 * @returns 是否属于小云页面
 */
export function isAgentRoute(route: Pick<RouteLocationNormalizedLoaded, 'name' | 'path'>): boolean {
  if (route.name === 'agent') {
    return true
  }
  return typeof route.path === 'string' && route.path.startsWith('/agent')
}

/**
 * 判断当前路由是否属于快捷键排除页面（搜索页、小云页等）。
 *
 * @param route 当前路由快照
 * @returns 是否属于排除页面
 */
export function isExcludedRoute(route: Pick<RouteLocationNormalizedLoaded, 'name' | 'path'>): boolean {
  return isSearchRoute(route) || isAgentRoute(route)
}

/**
 * 判断键盘事件目标是否为可编辑输入元素。
 *
 * @param target 键盘事件目标
 * @returns 是否处于可输入状态
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toUpperCase()
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true
  }
  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    return true
  }
  return false
}

/**
 * 判断键盘事件目标是否为滑块控件（如进度条或音量条）。
 * 滑块自身拥有方向键微调逻辑，不应被全局音量/切歌快捷键拦截。
 *
 * @param target 键盘事件目标
 * @returns 是否处于滑块聚焦状态
 */
export function isSliderTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('[role="slider"]') ||
    (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range')
  )
}

/**
 * 计算音量步进调整后的数值（步进 5%，范围 [0, 1]）。
 *
 * @param currentVolume 当前音量 (0~1)
 * @param direction 调整方向，'up' 为增加 5%，'down' 为降低 5%
 * @returns 计算并限定在 [0, 1] 区间内的目标音量
 */
export function calculateVolumeStep(currentVolume: number, direction: 'up' | 'down'): number {
  /** 单步调整百分比。 */
  const step = 0.05
  /** 目标原始数值。 */
  const rawTarget = direction === 'up' ? currentVolume + step : currentVolume - step
  /** 保留两位小数避免浮点精度累积误差。 */
  const rounded = Math.round(rawTarget * 100) / 100
  return Math.max(0, Math.min(1, rounded))
}

// ========= 组合式函数 =========

/**
 * 注册应用级播放器键盘快捷键：
 * 1. 空格键：播放/暂停
 * 2. ← / → 键：上一首/下一首
 * 3. ↑ / ↓ 键：调高/降低音量（每次 5%）
 *
 * 启用约束：
 * - 仅在音乐控制栏显示时或在沉浸歌词页内生效
 * - 搜索页与小云 (Agent) 助手页全面禁用
 * - 焦点在输入框/文本域/可编辑区域时禁用
 * - 包含修饰键 (Cmd/Ctrl/Alt) 时不拦截
 *
 * @param options 快捷键启用条件配置
 */
export function usePlayerKeyboardShortcuts(options: PlayerKeyboardShortcutsOptions): void {
  // ========= 变量 =========

  /** 播放器组合式接口。 */
  const player = usePlayer()

  /** 播放器只读快照引用。 */
  const snapshot = player.snapshot

  // ========= 函数 =========

  /**
   * 判断当前是否满足快捷键启用条件。
   *
   * @returns 是否处于允许触发快捷键的状态
   */
  function isShortcutsActive(): boolean {
    // 沉浸歌词页打开时，始终允许快捷键控制
    if (options.isImmersivePlayerOpen.value) {
      return true
    }

    // 搜索页与小云 (Agent) 页明确禁用快捷键
    if (isExcludedRoute(options.route)) {
      return false
    }

    // 基于音乐控制 bar 显示与否决定
    return options.showPlayerBar.value
  }

  /**
   * 全局键盘按下事件监听器。
   *
   * @param event 原生键盘事件
   */
  function handleKeydown(event: KeyboardEvent): void {
    // 带有系统组合键（Cmd / Ctrl / Alt）时不拦截
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return
    }

    // 输入法正在组合输入时跳过
    if (event.isComposing || event.keyCode === 229) {
      return
    }

    // 当前页面或展示状态未激活快捷键时跳过
    if (!isShortcutsActive()) {
      return
    }

    // 焦点在文本输入区时跳过全部播放控制快捷键
    if (isEditableTarget(event.target)) {
      return
    }

    // 1. 空格键：播放/暂停
    if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      // 若当前无播放曲目且队列为空，则不派发指令
      if (!snapshot.value.playback.track && snapshot.value.queue.items.length === 0) {
        return
      }
      void player.toggle()
      return
    }

    // 方向键如果在滑块上聚焦，让滑块自身处理
    if (isSliderTarget(event.target)) {
      return
    }

    // 带 Shift 键时不触发单键方向控制
    if (event.shiftKey) {
      return
    }

    // 2. ← 和 → 键：上一首 / 下一首
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (snapshot.value.queue.items.length === 0) {
        return
      }
      void player.previous()
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (snapshot.value.queue.items.length === 0) {
        return
      }
      void player.next()
      return
    }

    // 3. ↑ 和 ↓ 键：调高音量 / 降低音量（步进 5%）
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const nextVolume = calculateVolumeStep(snapshot.value.playback.volume, 'up')
      if (snapshot.value.playback.muted) {
        void player.setMuted(false)
      }
      void player.setVolume(nextVolume)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextVolume = calculateVolumeStep(snapshot.value.playback.volume, 'down')
      void player.setVolume(nextVolume)
      return
    }
  }

  // ========= 生命周期 =========

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
