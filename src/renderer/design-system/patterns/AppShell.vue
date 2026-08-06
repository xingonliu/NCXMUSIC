<script setup lang="ts">
import {
  Bot,
  ChevronLeft,
  Compass,
  Heart,
  Maximize2,
  Minimize2,
  Minus,
  Music2,
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
import { resolveRouteTitle } from '../../app/route-title'
import { zhCN } from '../../locales/zh-CN'

// ========= 变量 =========

/** 当前路由对象，用于驱动标题、层级和导航高亮。 */
const route = useRoute()

/** Router 实例，提供页面切换与统一返回。 */
const router = useRouter()

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

/** 当前页面 Header 标题。 */
const pageTitle = computed(() => resolveRouteTitle(route.meta.title))

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

// ========= 生命周期 =========

onMounted(async () => {
  unsubscribeWindowSnapshot = window.ncx.windowControls.onSnapshot((snapshot) => {
    windowSnapshot.value = snapshot
  })
  windowSnapshot.value = await window.ncx.windowControls.snapshot()
})

onBeforeUnmount(() => {
  unsubscribeWindowSnapshot()
})
</script>

<template>
  <div
    class="ncx-app-shell"
    :class="[
      isMacOS ? 'ncx-app-shell--macos' : 'ncx-app-shell--windows',
      windowSnapshot.fullscreen ? 'ncx-app-shell--fullscreen' : '',
      windowSnapshot.maximized ? 'ncx-app-shell--maximized' : ''
    ]"
  >
    <div class="ncx-window-mask" />

    <aside
      class="ncx-sidebar"
      aria-label="主导航"
    >
      <div
        v-if="isMacOS"
        class="ncx-traffic-safe-area"
        aria-hidden="true"
      />

      <RouterLink
        class="ncx-brand"
        :to="{ name: 'discover' }"
      >
        <span
          class="ncx-brand-mark"
          aria-hidden="true"
        >
          <Music2 :size="18" />
        </span>
        <span class="ncx-brand-copy">
          <span class="ncx-brand-name">{{ zhCN.app.name }}</span>
          <span class="ncx-brand-caption">{{ zhCN.app.caption }}</span>
        </span>
      </RouterLink>

      <nav class="ncx-nav">
        <section
          v-for="section in appPrimaryNavigationSections"
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
      <header
        class="ncx-page-header"
        :class="`ncx-page-header--${headerVariant}`"
      >
        <div class="ncx-page-title-group">
          <button
            v-if="isSecondaryPage"
            class="ncx-glass-button ncx-back-button"
            type="button"
            aria-label="返回上一页"
            title="返回上一页"
            @click="handleBack"
          >
            <ChevronLeft :size="18" />
          </button>
          <div>
            <p class="ncx-page-eyebrow">
              {{ isSecondaryPage ? '详情页' : '主页面' }}
            </p>
            <h1 class="ncx-page-title">
              {{ pageTitle }}
            </h1>
          </div>
        </div>

        <div class="ncx-page-actions">
          <button
            class="ncx-glass-button"
            type="button"
            aria-label="搜索"
            title="搜索"
          >
            <Search :size="17" />
          </button>
          <button
            class="ncx-glass-button"
            type="button"
            aria-label="刷新当前页"
            title="刷新当前页"
          >
            <RotateCcw :size="17" />
          </button>

          <div
            v-if="isWindows"
            class="ncx-window-controls"
            role="group"
            aria-label="窗口控制"
          >
            <button
              class="ncx-window-control"
              type="button"
              aria-label="最小化"
              title="最小化"
              @click="runWindowCommand({ type: 'window.minimize' })"
            >
              <Minus :size="16" />
            </button>
            <span class="ncx-window-divider" />
            <button
              class="ncx-window-control"
              type="button"
              :aria-label="windowSnapshot.maximized ? '还原窗口' : '最大化窗口'"
              :title="windowSnapshot.maximized ? '还原窗口' : '最大化窗口'"
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
            </button>
            <span class="ncx-window-divider" />
            <button
              class="ncx-window-control ncx-window-control--close"
              type="button"
              aria-label="关闭窗口"
              title="关闭窗口"
              @click="runWindowCommand({ type: 'window.requestClose' })"
            >
              <X :size="16" />
            </button>
          </div>
        </div>
      </header>

      <main class="ncx-content-area">
        <RouterView />
      </main>
    </section>
  </div>
</template>
