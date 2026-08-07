<script setup lang="ts">
import {
  Bot,
  ChevronLeft,
  Compass,
  Heart,
  Maximize2,
  Minimize2,
  Minus,
  RotateCcw,
  Search,
  Settings,
  UserRound,
  X
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import type {
  DesktopPlatform,
  WindowCommand,
  WindowSnapshot
} from '../../../shared/contracts/window-controls'
import {
  appAccountNavigationItem,
  appPlaylistNavigationSections,
  appPrimaryNavigationSections,
  appSettingsNavigationItem,
  type AppNavigationItem
} from '../../app/navigation'
import { navigateBack } from '../../app/navigation-history'
import {
  CommonHeaderButton,
  CommonHeaderGroupButton,
  CommonHeaderGroupItem
} from '../components'

// ========= 变量 =========

/** 可自绘拖拽的区域根节点，命中后根据祖先 app-region 声明决定是否开始拖拽。 */
const CUSTOM_DRAG_REGION_SELECTOR = '.ncx-sidebar, .ncx-page-header'

/** 当前路由对象，用于驱动标题、层级和导航高亮。 */
const route = useRoute()

/** Router 实例，提供页面切换与统一返回。 */
const router = useRouter()

/** 外壳根节点引用，用于拖拽期间捕获 Pointer 事件。 */
const shellElement = ref<HTMLElement | null>(null)

/** 最大化/全屏下启用自绘拖拽（补偿原生拖拽不还原尺寸的手势缺陷）。 */
const isCustomDragActive = computed(() => windowSnapshot.value.maximized || windowSnapshot.value.fullscreen)

/** 自绘拖拽进行中绑定的 Pointer 标识，未开始时为 undefined。 */
let customDragPointerId: number | undefined

/** Main 进程推送的真实窗口快照。 */
const windowSnapshot = ref<WindowSnapshot>({
  platform: window.ncx.platform as DesktopPlatform,
  maximized: false,
  fullscreen: false,
  focused: true
})

/** 运行平台是否为 macOS。 */
const isMacOS = computed(() => windowSnapshot.value.platform === 'darwin')

/** 运行平台是否为 Windows。 */
const isWindows = computed(() => windowSnapshot.value.platform === 'win32')

/** 当前页面是否为需要返回按钮的二级页面。 */
const isSecondaryPage = computed(() => route.meta.pageLevel === 2)

/** Header 视觉变体。 */
const headerVariant = computed(() => route.meta.headerVariant ?? 'default')

/** 窗口状态监听清理函数。 */
let unsubscribeWindowSnapshot = (): void => {}

// ========= 函数 =========

/** 根据导航配置返回对应图标组件。 */
function resolveNavIcon(item: AppNavigationItem) {
  const iconMap = {
    agent: Bot,
    discover: Compass,
    liked: Heart,
    profile: UserRound,
    search: Search,
    settings: Settings
  }

  return iconMap[item.icon]
}

/** 判断导航条目是否为当前页或当前页 fallback。 */
function isNavigationActive(item: AppNavigationItem): boolean {
  return route.name === item.routeName || route.meta.fallbackRoute === item.routeName
}

/** 发送窗口控制命令，并等待 Main 回传真实窗口状态。 */
async function runWindowCommand(command: WindowCommand): Promise<void> {
  windowSnapshot.value = await window.ncx.windowControls.send(command)
}

/** 全局复用的页面返回函数。 */
function handleBack(): void {
  navigateBack(router, route)
}

/**
 * 判断按下点是否落在交互子区（应拦截拖拽）。
 * 与 Chromium 原生拖拽命中一致：自目标向上走到拖拽区域根节点，
 * 途中任意显式声明 no-drag 的元素均视为交互区，根节点本身除外。
 */
function isWithinNoDragRegion(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null
  if (!element) return true
  const region = element.closest<HTMLElement>(CUSTOM_DRAG_REGION_SELECTOR)
  if (!region) return true
  let current: Element | null = element
  while (current && current !== region) {
    const regionStyle = window
      .getComputedStyle(current)
      .getPropertyValue('-webkit-app-region')
      .trim()
    if (regionStyle === 'no-drag') return true
    current = current.parentElement
  }
  return false
}

/** 自绘拖拽按下：命中拖拽区域且非交互子区时通知 Main 开始跟随手势。 */
function handleCustomDragPointerDown(event: PointerEvent): void {
  if (!isCustomDragActive.value) return
  if (event.button !== 0 || isWithinNoDragRegion(event.target)) return
  customDragPointerId = event.pointerId
  event.preventDefault()
  shellElement.value?.setPointerCapture(event.pointerId)
  window.ncx.windowControls.dragStart()
}

/** 自绘拖拽松开/取消：通知 Main 结束手势并释放捕获。 */
function handleCustomDragPointerUp(event: PointerEvent): void {
  if (customDragPointerId === undefined || event.pointerId !== customDragPointerId) return
  customDragPointerId = undefined
  window.ncx.windowControls.dragEnd()
}

/** Esc 取消自绘拖拽，复刻原生拖拽的可中断行为。 */
function handleCustomDragKeyDown(event: KeyboardEvent): void {
  if (customDragPointerId === undefined || event.key !== 'Escape') return
  customDragPointerId = undefined
  window.ncx.windowControls.dragEnd()
}

// ========= 生命周期 =========

onMounted(async () => {
  unsubscribeWindowSnapshot = window.ncx.windowControls.onSnapshot((snapshot) => {
    windowSnapshot.value = snapshot
  })
  windowSnapshot.value = await window.ncx.windowControls.snapshot()
  window.addEventListener('keydown', handleCustomDragKeyDown)
})

onBeforeUnmount(() => {
  unsubscribeWindowSnapshot()
  window.removeEventListener('keydown', handleCustomDragKeyDown)
  if (customDragPointerId !== undefined) window.ncx.windowControls.dragEnd()
})
</script>

<template>
  <div
    ref="shellElement"
    class="ncx-app-shell"
    :class="[
      isMacOS ? 'ncx-app-shell--macos' : 'ncx-app-shell--windows',
      windowSnapshot.fullscreen ? 'ncx-app-shell--fullscreen' : '',
      windowSnapshot.maximized ? 'ncx-app-shell--maximized' : '',
      isCustomDragActive ? 'ncx-app-shell--custom-drag' : ''
    ]"
    @pointerdown="handleCustomDragPointerDown"
    @pointerup="handleCustomDragPointerUp"
    @pointercancel="handleCustomDragPointerUp"
  >
    <header
      class="ncx-page-header"
      :class="`ncx-page-header--${headerVariant}`"
    >
      <div class="ncx-header-mask" />
      <div class="ncx-page-leading-actions">
        <CommonHeaderButton
          v-if="isSecondaryPage"
          class="ncx-back-button"
          label="返回上一页"
          @click="handleBack"
        >
          <ChevronLeft :size="18" />
        </CommonHeaderButton>
      </div>

      <div class="ncx-page-actions">
        <CommonHeaderButton label="搜索">
          <Search :size="17" />
        </CommonHeaderButton>

        <CommonHeaderButton label="刷新当前页">
          <RotateCcw :size="17" />
        </CommonHeaderButton>

        <CommonHeaderGroupButton
          v-if="isWindows"
          label="窗口控制"
        >
          <CommonHeaderGroupItem
            label="最小化"
            @click="runWindowCommand({ type: 'window.minimize' })"
          >
            <Minus :size="16" />
          </CommonHeaderGroupItem>

          <CommonHeaderGroupItem
            :label="windowSnapshot.maximized ? '还原窗口' : '最大化窗口'"
            @click="runWindowCommand({ type: 'window.toggleMaximize' })"
          >
            <Minimize2
              v-if="windowSnapshot.maximized"
              :size="15"
            />
            <Maximize2
              v-else
              :size="15"
            />
          </CommonHeaderGroupItem>

          <CommonHeaderGroupItem
            label="关闭窗口"
            variant="close"
            @click="runWindowCommand({ type: 'window.requestClose' })"
          >
            <X :size="16" />
          </CommonHeaderGroupItem>
        </CommonHeaderGroupButton>
      </div>
    </header>

    <aside
      class="ncx-sidebar"
      aria-label="主导航"
    >
      <div
        v-if="isMacOS"
        class="ncx-traffic-safe-area"
        aria-hidden="true"
      />

      <nav class="ncx-nav">
        <section
          v-for="section in appPrimaryNavigationSections"
          :key="section.label || 'primary'"
          class="ncx-nav-section"
        >
          <p
            v-if="section.label"
            class="ncx-nav-section-title"
          >
            {{ section.label }}
          </p>
          <RouterLink
            v-for="item in section.items"
            :key="String(item.routeName)"
            class="ncx-nav-item"
            :class="{ 'ncx-nav-item--active': isNavigationActive(item) }"
            :to="{ name: item.routeName }"
          >
            <component
              :is="resolveNavIcon(item)"
              :size="17"
              :stroke-width="1.9"
            />
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <nav
        class="ncx-playlist-nav"
        aria-label="歌单导航"
      >
        <section
          v-for="section in appPlaylistNavigationSections"
          :key="section.label"
          class="ncx-nav-section"
        >
          <p class="ncx-nav-section-title">
            {{ section.label }}
          </p>
          <RouterLink
            v-for="item in section.items"
            :key="String(item.routeName)"
            class="ncx-nav-item"
            :class="{ 'ncx-nav-item--active': isNavigationActive(item) }"
            :to="{ name: item.routeName }"
          >
            <component
              :is="resolveNavIcon(item)"
              :size="17"
              :stroke-width="1.9"
            />
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <nav
        class="ncx-account-nav"
        aria-label="账户和设置"
      >
        <RouterLink
          class="ncx-nav-item"
          :class="{ 'ncx-nav-item--active': isNavigationActive(appAccountNavigationItem) }"
          :to="{ name: appAccountNavigationItem.routeName }"
        >
          <component
            :is="resolveNavIcon(appAccountNavigationItem)"
            :size="17"
            :stroke-width="1.9"
          />
          <span>{{ appAccountNavigationItem.label }}</span>
        </RouterLink>
        <RouterLink
          class="ncx-nav-item"
          :class="{ 'ncx-nav-item--active': isNavigationActive(appSettingsNavigationItem) }"
          :to="{ name: appSettingsNavigationItem.routeName }"
        >
          <component
            :is="resolveNavIcon(appSettingsNavigationItem)"
            :size="17"
            :stroke-width="1.9"
          />
          <span>{{ appSettingsNavigationItem.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <section class="ncx-main-panel">
      <main class="ncx-content-area">
        <RouterView />
      </main>
    </section>
  </div>
</template>
