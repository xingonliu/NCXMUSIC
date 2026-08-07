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
