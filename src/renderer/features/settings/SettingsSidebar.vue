<script setup lang="ts">
import {
  ArrowLeft,
  Bot,
  Cpu,
  Database,
  Headphones,
  Mic,
  Palette,
  PlugZap,
  Puzzle,
  Settings2,
  ShieldCheck,
  Sparkles
} from '@lucide/vue'
import { computed, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { navigateBack } from '../../app/navigation-history'
import { CommonButton, CommonSearchInput } from '../../design-system/components'
import { translateSourceText } from '../../i18n'
import {
  getSettingsNavigationItem,
  normalizeSettingsTab,
  SETTINGS_NAVIGATION_GROUPS,
  SETTINGS_SEARCH_ITEMS,
  type SettingsSearchItem,
  type SettingsTab
} from './settings-navigation'

// ========= 类型 =========

/** 供侧栏渲染的设置搜索结果。 */
interface SettingsSearchResult extends SettingsSearchItem {
  /** 所属标签的展示名称。 */
  readonly tabLabel: string
}

// ========= 变量 =========

/** 当前设置路由。 */
const route = useRoute()

/** 设置侧栏使用的路由控制器。 */
const router = useRouter()

/** 设置搜索框当前文本。 */
const searchQuery = ref<string>('')

/** 当前路由对应的合法设置标签。 */
const activeTab = computed<SettingsTab>(() => normalizeSettingsTab(route.query['tab']))

/** 经过标准化的设置搜索结果。 */
const searchResults = computed<SettingsSearchResult[]>(() => {
  /** 去除首尾空白并统一大小写的查询。 */
  const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase('zh-CN')
  if (!normalizedQuery) return []
  return SETTINGS_SEARCH_ITEMS
    .filter((item) => {
      /** 当前设置项参与检索的完整文本。 */
      const haystack = [
        item.title,
        translateSourceText(item.title),
        item.description,
        translateSourceText(item.description),
        getSettingsNavigationItem(item.tab).label,
        translateSourceText(getSettingsNavigationItem(item.tab).label),
        ...item.keywords
      ].join(' ').toLocaleLowerCase('zh-CN')
      return haystack.includes(normalizedQuery)
    })
    .map((item) => ({
      ...item,
      title: translateSourceText(item.title),
      description: translateSourceText(item.description),
      tabLabel: translateSourceText(getSettingsNavigationItem(item.tab).label)
    }))
})

/** 搜索框是否处于有内容状态。 */
const isSearching = computed<boolean>(() => searchQuery.value.trim().length > 0)

/** 设置标签对应的现有图标组件。 */
const settingsIconMap: Record<SettingsTab, Component> = {
  general: Settings2,
  music: Headphones,
  appearance: Palette,
  models: Cpu,
  agent: Sparkles,
  mcp: PlugZap,
  skill: Puzzle,
  voice: Mic,
  security: ShieldCheck,
  data: Database
}

// ========= 函数 =========

/** 返回进入设置前的应用页面。 */
function returnToApplication(): void {
  navigateBack(router, route)
}

/** 切换设置标签并清除上一次设置项定位。 */
function openSettingsTab(tab: SettingsTab): void {
  void router.replace({
    name: 'settings',
    query: { ...route.query, tab, setting: undefined }
  })
}

/** 打开搜索结果所属标签并定位具体设置项。 */
function openSearchResult(result: SettingsSearchResult): void {
  void router.replace({
    name: 'settings',
    query: { ...route.query, tab: result.tab, setting: result.targetId }
  })
}

/** 返回设置标签对应的图标组件。 */
function resolveSettingsIcon(tab: SettingsTab): Component {
  return settingsIconMap[tab] ?? Bot
}
</script>

<template>
  <div class="settings-sidebar">
    <CommonButton
      class="settings-sidebar-back"
      variant="ghost"
      @click="returnToApplication"
    >
      <ArrowLeft :size="16" /> {{ $tSource("返回应用") }}
    </CommonButton>

    <CommonSearchInput
      v-model="searchQuery"
      class="settings-sidebar-search"
      size="compact"
      :placeholder="$tSource('搜索设置…')"
      :aria-label="$tSource('搜索设置')"
    />

    <nav
      v-if="!isSearching"
      class="settings-sidebar-navigation"
      :aria-label="$tSource('设置分类')"
    >
      <section
        v-for="group in SETTINGS_NAVIGATION_GROUPS"
        :key="group.label"
        class="settings-sidebar-group"
      >
        <p class="settings-sidebar-group-title">
          {{ $tSource(group.label) }}
        </p>
        <CommonButton
          v-for="item in group.items"
          :key="item.value"
          class="settings-sidebar-item"
          :class="{ 'is-active': item.value === activeTab }"
          variant="ghost"
          :aria-current="item.value === activeTab ? 'page' : undefined"
          @click="openSettingsTab(item.value)"
        >
          <component
            :is="resolveSettingsIcon(item.value)"
            :size="16"
            :stroke-width="1.8"
          />
          <span>{{ $tSource(item.label) }}</span>
        </CommonButton>
      </section>
    </nav>

    <section
      v-else
      class="settings-search-results"
      :aria-label="$tSource('设置搜索结果')"
      aria-live="polite"
    >
      <p class="settings-sidebar-group-title">
        {{ $tSource("搜索结果") }}
      </p>
      <CommonButton
        v-for="result in searchResults"
        :key="`${result.tab}-${result.targetId}`"
        class="settings-search-result"
        variant="ghost"
        @click="openSearchResult(result)"
      >
        <component
          :is="resolveSettingsIcon(result.tab)"
          :size="16"
          :stroke-width="1.8"
        />
        <span>
          <strong>{{ result.title }}</strong>
          <small>{{ result.tabLabel }}</small>
        </span>
      </CommonButton>
      <p
        v-if="searchResults.length === 0"
        class="settings-search-empty"
      >
        {{ $tSource("没有匹配的设置") }}
      </p>
    </section>
  </div>
</template>
