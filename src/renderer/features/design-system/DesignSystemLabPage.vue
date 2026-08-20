<script setup lang="ts">
import {
  Bell,
  ChevronLeft,
  Heart,
  Maximize2,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  X
} from '@lucide/vue'
import { ref } from 'vue'

import {
  CommonAccordion,
  CommonAlertDialog,
  CommonAvatar,
  CommonBadge,
  CommonButton,
  CommonButtonGroup,
  CommonCard,
  CommonCheckbox,
  CommonCombobox,
  CommonContextMenu,
  CommonDialog,
  CommonDrawer,
  CommonDropdownMenu,
  CommonEmptyState,
  CommonErrorState,
  CommonHeaderButton,
  CommonHeaderGroupButton,
  CommonHeaderGroupItem,
  CommonIconButton,
  CommonInlineMessage,
  CommonInput,
  CommonLinkButton,
  CommonPopover,
  CommonProgress,
  CommonRadioGroup,
  CommonResponsiveGrid,
  CommonScrollArea,
  CommonSearchInput,
  CommonSegmentedControl,
  CommonSelect,
  CommonSeparator,
  CommonSkeleton,
  CommonSlider,
  CommonSpinner,
  CommonSwitch,
  CommonTabs,
  CommonTag,
  CommonTextarea,
  CommonToast,
  CommonTooltip,
  CommonVirtualList,
  type CommonAccordionItem,
  type CommonMenuItem,
  type CommonOption,
  type CommonVirtualListItem
} from '../../design-system/components'
import { useToast } from '../../design-system/use-toast'

import './design-system-lab.css'

// ========= 变量 =========

/** 当前选中的分类 Tab（'all' 或 1 ~ 8）。 */
const activeTab = ref<number | 'all'>('all')

/** 组件搜索关键字。 */
const searchFilter = ref('')

/** 分类 Tab 选项列表。 */
const categoryTabs = [
  { id: 'all' as const, label: '全部 (8)' },
  { id: 1 as const, label: '1. 操作类' },
  { id: 2 as const, label: '2. 输入类' },
  { id: 3 as const, label: '3. 选择类' },
  { id: 4 as const, label: '4. 展示类' },
  { id: 5 as const, label: '5. 导航与菜单' },
  { id: 6 as const, label: '6. 状态与反馈' },
  { id: 7 as const, label: '7. 浮层类' },
  { id: 8 as const, label: '8. 容器与布局' }
]

/** UI Lab 单行输入示例值。 */
const inputValue = ref('Ncxmusic')

/** UI Lab 多行输入示例值。 */
const textareaValue = ref('用通用组件搭建页面，不复制业务样式。')

/** UI Lab 搜索输入示例值。 */
const searchValue = ref('每日推荐')

/** UI Lab 下拉选择示例值。 */
const selectValue = ref('lossless')

/** UI Lab Combobox 示例值。 */
const comboboxValue = ref('Hi-Res')

/** UI Lab 复选框示例值。 */
const checkboxValue = ref(true)

/** UI Lab 单选组示例值。 */
const radioValue = ref('list')

/** UI Lab 开关示例值。 */
const switchValue = ref(true)

/** UI Lab 滑块示例值。 */
const sliderValue = ref(64)

/** UI Lab 分段控件示例值。 */
const segmentedValue = ref('music')

/** UI Lab 标签页示例值。 */
const tabsValue = ref('states')

/** UI Lab Toast 可见状态。 */
const toastVisible = ref(false)

/** UI Lab Dialog 可见状态。 */
const dialogVisible = ref(false)

/** UI Lab AlertDialog 可见状态。 */
const alertVisible = ref(false)

/** UI Lab Drawer 可见状态。 */
const drawerVisible = ref(false)

/** UI Lab 最近交互记录。 */
const latestAction = ref('等待交互')

/** 选择型组件共用选项。 */
const qualityOptions: CommonOption[] = [
  { label: '标准', value: 'standard' },
  { label: '无损', value: 'lossless' },
  { label: 'Hi-Res', value: 'Hi-Res' }
]

/** 页面模式选项。 */
const pageModeOptions: CommonOption[] = [
  { label: '列表', value: 'list' },
  { label: '网格', value: 'grid' },
  { label: '沉浸', value: 'immersive' }
]

/** 分段控制器选项。 */
const safetyOptions: CommonOption[] = [
  { label: '音乐', value: 'music' },
  { label: '命令', value: 'command' },
  { label: '审批', value: 'approval' }
]

/** 标签页选项。 */
const tabOptions: CommonOption[] = [
  { label: '状态', value: 'states', badge: 3 },
  { label: '布局', value: 'layout' },
  { label: '无障碍', value: 'a11y', disabled: true }
]

/** 菜单组件示例项。 */
const menuItems: CommonMenuItem[] = [
  { label: '播放操作', value: 'header-1', type: 'header' },
  { label: '播放下一首', value: 'play-next', shortcut: 'Enter', icon: '▶' },
  { label: '加入歌单', value: 'add-playlist', shortcut: '⌘A', checked: true },
  { label: '分割', value: 'sep-1', type: 'separator' },
  { label: '删除缓存', value: 'delete-cache', shortcut: '⌫', danger: true }
]

/** 手风琴组件示例项。 */
const accordionItems: CommonAccordionItem[] = [
  { title: '按钮契约', content: '覆盖 Default、Hover、Pressed、Focus、Disabled 和 Loading。' },
  { title: '菜单契约', content: '右键菜单不是唯一入口，必须恢复焦点并支持键盘。' },
  { title: '浮层契约', content: 'Toast、Dialog、Drawer、Popover 各有边界，避免重复反馈。' }
]

/** 虚拟列表数据项。 */
const virtualListItems: CommonVirtualListItem[] = [
  { id: '1', title: '单曲 A', description: '无损高质采样' },
  { id: '2', title: '单曲 B', description: '杜比全景声音轨' },
  { id: '3', title: '单曲 C', description: '经典原声重现' }
]

// ========= 函数 =========

/** 判断大类在当前分类 Tab 及搜索过滤下是否显示。 */
function isCategoryVisible(categoryId: number): boolean {
  if (activeTab.value !== 'all' && activeTab.value !== categoryId) {
    return false
  }
  return true
}

/** 切换分类 Tab。 */
function selectTab(tabId: number | 'all'): void {
  activeTab.value = tabId
  recordAction(`切换分类: ${tabId === 'all' ? '全部' : `大类 ${tabId}`}`)
}

/** 记录 UI Lab 的最近交互。 */
function recordAction(action: string): void {
  latestAction.value = action
}

/** 全局 Toast 服务。 */
const toast = useToast()

/** UI Lab Toast 计数器。 */
let toastCounter = 0

/** 展示 Toast 并记录交互。 */
function showToast(): void {
  toastCounter += 1
  const types: Array<'success' | 'info' | 'warning' | 'danger'> = [
    'success',
    'info',
    'warning',
    'danger'
  ]
  const type: 'success' | 'info' | 'warning' | 'danger' =
    types[(toastCounter - 1) % types.length] ?? 'info'
  const sampleMessages: Record<string, string> = {
    success: '已收藏当前歌曲到我的歌单',
    info: '播放列表已同步至最新版本',
    warning: '网络连接稍有延迟，正在重试',
    danger: '未能解析当前音源链接，请稍后'
  }
  toast.showToast({
    message: `${sampleMessages[type]} (#${toastCounter})`,
    type,
    duration: 5000
  })
  recordAction(`Toast #${toastCounter} (${type}) 已触发`)
}

/** 确认危险弹窗演示。 */
function confirmDangerAction(): void {
  alertVisible.value = false
  recordAction('AlertDialog 已确认')
}
</script>

<template>
  <main class="ncx-design-lab">
    <!-- 顶部 Sticky 导航 & 筛选栏 -->
    <header class="ncx-design-lab-nav-header">
      <div class="ncx-design-lab-nav-top">
        <div class="ncx-design-lab-nav-title-group">
          <span class="ncx-design-lab-eyebrow">Design System UI Lab</span>
          <h1 class="ncx-design-lab-title">
            {{ $tSource("通用组件交互测试页") }}
          </h1>
        </div>

        <div class="ncx-design-lab-nav-actions">
          <CommonSearchInput
            v-model="searchFilter"
            :placeholder="$tSource('搜索 35+ 通用组件...')"
            class="ncx-design-lab-search"
            @clear="searchFilter = ''"
          />
          <div class="ncx-design-lab-status-pill">
            <CommonBadge type="success">
              READY
            </CommonBadge>
            <span class="ncx-design-lab-status-action">{{ latestAction }}</span>
          </div>
        </div>
      </div>

      <!-- 分类 Tab 切换栏 -->
      <nav class="ncx-design-lab-category-tabs">
        <button
          v-for="tab in categoryTabs"
          :key="tab.id"
          type="button"
          class="ncx-design-lab-tab-item"
          :class="{ 'is-active': activeTab === tab.id }"
          @click="selectTab(tab.id)"
        >
          {{ $tSource(tab.label) }}
        </button>
      </nav>
    </header>

    <!-- 大类 1：操作类 (Actions) -->
    <section
      v-show="isCategoryVisible(1)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 1") }}
          </CommonBadge>
          <h2>{{ $tSource("操作类组件 (Actions)") }}</h2>
        </div>
        <CommonTag color="blue">
          {{ $tSource("WWDC25 对齐") }}
        </CommonTag>
      </header>

      <!-- 小类 1.1：基础按钮与链接 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 1.1：基础按钮与链接 (Buttons & Links)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonButton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonButton</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("基础按钮") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <CommonButton
                    variant="primary"
                    @click="recordAction('Primary Button')"
                  >
                    <Play :size="15" /> {{ $tSource("立即播放") }}
                  </CommonButton>
                  <CommonButton
                    variant="secondary"
                    @click="recordAction('Secondary Button')"
                  >
                    {{ $tSource("加入队列") }}
                  </CommonButton>
                  <CommonButton
                    variant="ghost"
                    @click="recordAction('Ghost Button')"
                  >
                    {{ $tSource("稍后再说") }}
                  </CommonButton>
                  <CommonButton
                    variant="danger"
                    @click="alertVisible = true"
                  >
                    <Trash2 :size="15" /> {{ $tSource("删除音轨") }}
                  </CommonButton>
                  <CommonButton
                    variant="primary"
                    loading
                  >
                    {{ $tSource("同步中...") }}
                  </CommonButton>
                  <CommonButton
                    variant="secondary"
                    disabled
                  >
                    {{ $tSource("已禁用操作") }}
                  </CommonButton>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <CommonButton
                    size="compact"
                    variant="primary"
                    @click="recordAction('Compact Primary')"
                  >
                    Compact 24px
                  </CommonButton>
                  <CommonButton
                    size="default"
                    variant="primary"
                    @click="recordAction('Default Primary')"
                  >
                    Default 32px
                  </CommonButton>
                  <CommonButton
                    size="prominent"
                    variant="primary"
                    @click="recordAction('Prominent Primary')"
                  >
                    Prominent 38px
                  </CommonButton>
                </div>
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonIconButton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonIconButton</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("图标按钮") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <CommonIconButton
                  :label="$tSource('喜欢')"
                  selected
                  @click="recordAction('IconButton 喜欢')"
                >
                  <Heart :size="17" />
                </CommonIconButton>
                <CommonIconButton
                  :label="$tSource('通知')"
                  @click="recordAction('IconButton 通知')"
                >
                  <Bell :size="17" />
                </CommonIconButton>
                <CommonIconButton
                  :label="$tSource('已禁用图标')"
                  disabled
                >
                  <Bell :size="17" />
                </CommonIconButton>
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonButtonGroup -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonButtonGroup</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("组合按钮组") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <CommonButtonGroup variant="connected">
                  <CommonButton
                    size="default"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 左侧')"
                  >
                    {{ $tSource("左侧") }}
                  </CommonButton>
                  <CommonButton
                    size="default"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 中间')"
                  >
                    {{ $tSource("中间") }}
                  </CommonButton>
                  <CommonButton
                    size="default"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 右侧')"
                  >
                    {{ $tSource("右侧") }}
                  </CommonButton>
                </CommonButtonGroup>

                <CommonButtonGroup variant="connected">
                  <CommonIconButton
                    :label="$tSource('新增')"
                    size="compact"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 新增')"
                  >
                    <Plus :size="14" />
                  </CommonIconButton>
                  <CommonIconButton
                    :label="$tSource('刷新')"
                    size="compact"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 刷新')"
                  >
                    <RefreshCcw :size="14" />
                  </CommonIconButton>
                  <CommonIconButton
                    :label="$tSource('更多')"
                    size="compact"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 更多')"
                  >
                    <MoreHorizontal :size="14" />
                  </CommonIconButton>
                </CommonButtonGroup>
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonLinkButton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonLinkButton</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("链接按钮") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 16px;">
                <CommonLinkButton
                  href="#/discover"
                  @click="recordAction('LinkButton 发现页')"
                >
                  {{ $tSource("查看发现页") }}
                </CommonLinkButton>
                <CommonLinkButton
                  disabled
                  href="#/disabled"
                >
                  {{ $tSource("不可用链接") }}
                </CommonLinkButton>
              </div>
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 1.2：顶栏控件 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 1.2：顶栏控件 (Header Controls)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonHeaderButton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonHeaderButton</code>
              </div>
              <CommonTag
                color="blue"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("Header 单按钮") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 8px;">
                <CommonHeaderButton
                  :label="$tSource('返回上一页')"
                  @click="recordAction('HeaderButton 返回')"
                >
                  <ChevronLeft :size="18" />
                </CommonHeaderButton>

                <CommonHeaderButton
                  :label="$tSource('搜索内容')"
                  @click="recordAction('HeaderButton 搜索')"
                >
                  <Search :size="17" />
                </CommonHeaderButton>

                <CommonHeaderButton
                  :label="$tSource('刷新当前页')"
                  @click="recordAction('HeaderButton 刷新')"
                >
                  <RotateCcw :size="17" />
                </CommonHeaderButton>

                <CommonHeaderButton
                  :label="$tSource('已禁用按钮')"
                  disabled
                >
                  <Search :size="17" />
                </CommonHeaderButton>
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonHeaderGroupButton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonHeaderGroupButton</code>
              </div>
              <CommonTag
                color="blue"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("Header 成组按钮") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonHeaderGroupButton :label="$tSource('窗口控制示例（插槽模式）')">
                  <CommonHeaderGroupItem
                    :label="$tSource('最小化')"
                    @click="recordAction('HeaderGroupItem 最小化')"
                  >
                    <Minus :size="16" />
                  </CommonHeaderGroupItem>
                  <CommonHeaderGroupItem
                    :label="$tSource('最大化')"
                    @click="recordAction('HeaderGroupItem 最大化')"
                  >
                    <Maximize2 :size="16" />
                  </CommonHeaderGroupItem>
                  <CommonHeaderGroupItem
                    :label="$tSource('关闭')"
                    variant="close"
                    @click="recordAction('HeaderGroupItem 关闭')"
                  >
                    <X :size="16" />
                  </CommonHeaderGroupItem>
                </CommonHeaderGroupButton>

                <CommonHeaderGroupButton
                  :label="$tSource('成组按钮（Items 配置模式）')"
                  :items="[
                    { label: $tSource('添加项'), icon: Plus, onClick: () => recordAction('HeaderGroup items 添加') },
                    { label: $tSource('刷新列表'), icon: RefreshCcw, onClick: () => recordAction('HeaderGroup items 刷新') },
                    { label: $tSource('删除选定'), icon: Trash2, variant: 'danger', onClick: () => recordAction('HeaderGroup items 删除') }
                  ]"
                />
              </div>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 2：输入类 (Inputs) -->
    <section
      v-show="isCategoryVisible(2)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 2") }}
          </CommonBadge>
          <h2>{{ $tSource("输入类组件 (Inputs)") }}</h2>
        </div>
        <CommonTag color="gray">
          {{ $tSource("表单输入") }}
        </CommonTag>
      </header>

      <!-- 小类 2.1：文本输入 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 2.1：文本输入 (Text Inputs)')" />
        </div>

        <div class="ncx-design-lab-grid">
          <!-- 具体组件：CommonInput -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonInput</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("单行输入框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonInput
                v-model="inputValue"
                :placeholder="$tSource('输入项目名称')"
                clearable
              />
            </div>
          </CommonCard>

          <!-- 具体组件：CommonSearchInput -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSearchInput</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("搜索输入框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonSearchInput
                v-model="searchValue"
                @clear="recordAction('搜索已清空')"
              />
            </div>
          </CommonCard>

          <!-- 具体组件：CommonTextarea -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonTextarea</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("多行文本域") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonTextarea v-model="textareaValue" />
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 2.2：下拉与组合选择 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 2.2：下拉与组合选择 (Select & Combobox)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonSelect -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSelect</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("下拉选择框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonSelect
                v-model="selectValue"
                :options="qualityOptions"
              />
            </div>
          </CommonCard>

          <!-- 具体组件：CommonCombobox -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonCombobox</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("组合选择框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonCombobox
                v-model="comboboxValue"
                :options="qualityOptions"
                :placeholder="$tSource('输入或选择音质')"
              />
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 3：选择类 (Selections) -->
    <section
      v-show="isCategoryVisible(3)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 3") }}
          </CommonBadge>
          <h2>{{ $tSource("选择类组件 (Selections)") }}</h2>
        </div>
        <CommonTag color="gray">
          {{ $tSource("选项与状态") }}
        </CommonTag>
      </header>

      <!-- 小类 3.1：勾选与开关 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 3.1：勾选与开关 (Checkbox & Switch)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonCheckbox -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonCheckbox</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("复选框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <CommonCheckbox
                  v-model="checkboxValue"
                  size="compact"
                  label="Compact"
                />
                <CommonCheckbox
                  v-model="checkboxValue"
                  size="default"
                  label="Default"
                />
                <CommonCheckbox
                  v-model="checkboxValue"
                  size="prominent"
                  label="Prominent"
                />
                <CommonCheckbox
                  :model-value="false"
                  indeterminate
                  label="Indeterminate"
                />
                <CommonCheckbox
                  :model-value="true"
                  disabled
                  label="Disabled"
                />
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonSwitch -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSwitch</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("开关组件") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <CommonSwitch
                  v-model="switchValue"
                  size="compact"
                  label="Compact"
                />
                <CommonSwitch
                  v-model="switchValue"
                  size="default"
                  label="Default"
                />
                <CommonSwitch
                  v-model="switchValue"
                  size="prominent"
                  label="Prominent"
                />
                <CommonSwitch
                  :model-value="true"
                  disabled
                  label="Disabled Switch"
                />
              </div>
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 3.2：单选与分段 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 3.2：单选与分段 (Radio & Segmented)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonRadioGroup -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonRadioGroup</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("单选组") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonRadioGroup
                v-model="radioValue"
                :options="pageModeOptions"
                name="lab-mode"
              />
            </div>
          </CommonCard>

          <!-- 具体组件：CommonSegmentedControl -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSegmentedControl</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("分段控制器") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonSegmentedControl
                v-model="segmentedValue"
                :options="safetyOptions"
                size="default"
              />
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 3.3：数值调节 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 3.3：数值调节 (Slider)')" />
        </div>

        <div class="ncx-design-lab-grid--full">
          <!-- 具体组件：CommonSlider -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSlider</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("滑块控制") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonSlider
                v-model="sliderValue"
                :label="$tSource('音量控制')"
              />
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 4：展示类 (Display) -->
    <section
      v-show="isCategoryVisible(4)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 4") }}
          </CommonBadge>
          <h2>{{ $tSource("展示类组件 (Display)") }}</h2>
        </div>
        <CommonTag color="gray">
          {{ $tSource("视觉展示") }}
        </CommonTag>
      </header>

      <!-- 小类 4.1：身份与徽标 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 4.1：身份与徽标 (Avatar & Badge)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonAvatar -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonAvatar</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("头像") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <CommonAvatar
                  name="Ncx Music"
                  size="compact"
                  status="online"
                />
                <CommonAvatar
                  name="Apple User"
                  size="default"
                  shape="square"
                  status="busy"
                />
                <CommonAvatar
                  name="David Miller"
                  size="prominent"
                  status="away"
                />
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonBadge -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonBadge</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("徽标角标") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <CommonBadge
                  count="5"
                  type="danger"
                  variant="solid"
                >
                  <CommonAvatar
                    name="Inbox Notification"
                    size="default"
                  />
                </CommonBadge>
                <CommonBadge
                  dot
                  type="success"
                >
                  <CommonAvatar
                    name="Online User"
                    size="default"
                  />
                </CommonBadge>
                <CommonBadge
                  type="info"
                  variant="subtle"
                >
                  INFO
                </CommonBadge>
                <CommonBadge
                  type="success"
                  variant="subtle"
                >
                  SUCCESS
                </CommonBadge>
                <CommonBadge
                  type="warning"
                  variant="subtle"
                >
                  WARNING
                </CommonBadge>
                <CommonBadge
                  type="danger"
                  variant="solid"
                  :count="120"
                  :max="99"
                />
              </div>
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 4.2：标签与提示 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 4.2：标签与提示 (Tag & Tooltip)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonTag -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonTag</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("标签分类") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <CommonTag
                  selected
                  color="blue"
                >
                  {{ $tSource("精选单曲") }}
                </CommonTag>
                <CommonTag color="green">
                  {{ $tSource("Hi-Res 无损") }}
                </CommonTag>
                <CommonTag
                  color="orange"
                  closable
                  @close="recordAction('关闭标签：流行榜')"
                >
                  {{ $tSource("流行榜单") }}
                </CommonTag>
                <CommonTag
                  color="purple"
                  variant="solid"
                >
                  {{ $tSource("VIP 专享") }}
                </CommonTag>
                <CommonTag
                  color="red"
                  variant="outline"
                >
                  {{ $tSource("热门推荐") }}
                </CommonTag>
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonTooltip -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonTooltip</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("气泡提示") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <CommonTooltip
                  :text="$tSource('顶部气泡提示：快捷键 ⌘K')"
                  placement="top"
                >
                  <CommonTag color="gray">
                    Top Tooltip
                  </CommonTag>
                </CommonTooltip>
                <CommonTooltip
                  :text="$tSource('右侧气泡提示：M3 Max 优化')"
                  placement="right"
                >
                  <CommonTag color="blue">
                    Right Tooltip
                  </CommonTag>
                </CommonTooltip>
                <CommonTooltip
                  :text="$tSource('底部气泡提示：高清音频流')"
                  placement="bottom"
                >
                  <CommonTag color="green">
                    Bottom Tooltip
                  </CommonTag>
                </CommonTooltip>
              </div>
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 4.3：结构卡片与分割线 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 4.3：结构卡片与分割线 (Card & Separator)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonCard -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonCard</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("结构卡片") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: grid; gap: 12px;">
                <CommonCard
                  variant="default"
                  title="Default Card"
                >
                  {{ $tSource("默认标准卡片") }}
                </CommonCard>
                <CommonCard
                  variant="glass"
                  title="Glass Card"
                >
                  {{ $tSource("Liquid Glass 玻璃材质卡片") }}
                </CommonCard>
                <CommonCard
                  variant="elevated"
                  title="Elevated Card"
                >
                  {{ $tSource("Elevated 阴影抬升卡片") }}
                </CommonCard>
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonSeparator -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSeparator</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("分割线") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonSeparator />
                <CommonSeparator :label="$tSource('带 Label 的分割线')" />
                <CommonSeparator
                  inset
                  spacing="compact"
                />
              </div>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 5：导航与菜单类 (Navigation & Menus) -->
    <section
      v-show="isCategoryVisible(5)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 5") }}
          </CommonBadge>
          <h2>{{ $tSource("导航与菜单类组件 (Navigation & Menus)") }}</h2>
        </div>
        <CommonTag color="gray">
          {{ $tSource("菜单与页签") }}
        </CommonTag>
      </header>

      <!-- 小类 5.1：标签导航 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 5.1：标签导航 (Tabs Navigation)')" />
        </div>

        <div class="ncx-design-lab-grid--full">
          <!-- 具体组件：CommonTabs -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonTabs</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("标签页") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonTabs
                v-model="tabsValue"
                :options="tabOptions"
              />
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 5.2：弹出菜单 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 5.2：弹出菜单 (Popups & Menus)')" />
        </div>

        <div class="ncx-design-lab-grid">
          <!-- 具体组件：CommonDropdownMenu -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonDropdownMenu</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("下拉菜单") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonDropdownMenu
                :label="$tSource('DropdownMenu 示例')"
                :items="menuItems"
                @select="recordAction(`菜单：${$event}`)"
              />
            </div>
          </CommonCard>

          <!-- 具体组件：CommonContextMenu -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonContextMenu</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("右键菜单") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonContextMenu
                :items="menuItems"
                @select="recordAction(`右键菜单：${$event}`)"
              >
                <div class="ncx-design-lab-context-zone">
                  {{ $tSource("右键点击本区域唤起 ContextMenu") }}
                </div>
              </CommonContextMenu>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonPopover -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonPopover</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("气泡弹出框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonPopover :label="$tSource('Popover 示例')">
                {{ $tSource("Popover 用于由明确锚点触发的少量说明或控制。") }}
              </CommonPopover>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 6：状态与反馈类 (Status & Feedback) -->
    <section
      v-show="isCategoryVisible(6)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 6") }}
          </CommonBadge>
          <h2>{{ $tSource("状态与反馈类组件 (Status & Feedback)") }}</h2>
        </div>
        <CommonTag color="gray">
          {{ $tSource("反馈与加载") }}
        </CommonTag>
      </header>

      <!-- 小类 6.1：加载与进度 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 6.1：加载与进度 (Loading & Progress)')" />
        </div>

        <div class="ncx-design-lab-grid">
          <!-- 具体组件：CommonSpinner -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSpinner</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("加载菊花") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <CommonSpinner
                  size="compact"
                  label="Compact Spokes Spinner"
                />
                <CommonSpinner
                  size="default"
                  label="Default Spokes Spinner"
                />
                <CommonSpinner
                  size="prominent"
                  label="Prominent Spokes Spinner"
                />
                <CommonSpinner
                  size="default"
                  variant="ring"
                  label="Ring Spinner"
                />
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonProgress -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonProgress</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("进度条") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonProgress
                  :value="65"
                  show-value
                  :label="$tSource('确定进度')"
                />
                <CommonProgress
                  indeterminate
                  size="compact"
                  :label="$tSource('不定长加载进度')"
                />
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonSkeleton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSkeleton</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("骨架屏") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <CommonSkeleton variant="avatar" />
                  <div style="flex: 1;">
                    <CommonSkeleton :lines="2" />
                  </div>
                </div>
                <CommonSkeleton
                  variant="rectangular"
                  height="40px"
                />
              </div>
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 6.2：状态反馈 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 6.2：状态反馈 (State Feedback)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonEmptyState -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonEmptyState</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("空状态") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonEmptyState
                :title="$tSource('暂无音轨列表')"
                :description="$tSource('遵循 macOS ContentUnavailableView 居中布局。')"
              >
                <CommonButton
                  size="compact"
                  variant="secondary"
                  @click="recordAction('EmptyState 导入音乐')"
                >
                  {{ $tSource("导入本地音乐") }}
                </CommonButton>
              </CommonEmptyState>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonErrorState -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonErrorState</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("错误状态") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonErrorState
                :title="$tSource('网络连接失败')"
                :description="$tSource('无法连接到云端数据库，请检查网络后再试。')"
                @retry="recordAction('ErrorState 触发重试')"
              />
            </div>
          </CommonCard>
        </div>

        <div class="ncx-design-lab-grid--full">
          <!-- 具体组件：CommonInlineMessage -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonInlineMessage</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("内联消息栏") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonInlineMessage
                  type="info"
                  :title="$tSource('系统提示')"
                  closable
                  @close="recordAction('关闭 InlineMessage')"
                >
                  {{ $tSource("符合 macOS HIG 规范的内联提示通告栏。") }}
                </CommonInlineMessage>
                <CommonInlineMessage
                  type="success"
                  :title="$tSource('同步成功')"
                >
                  {{ $tSource("播放列表已实时与 iCloud 云端同步。") }}
                </CommonInlineMessage>
                <CommonInlineMessage type="warning">
                  {{ $tSource("存储空间即将不足 1GB。") }}
                </CommonInlineMessage>
                <CommonInlineMessage
                  type="danger"
                  :title="$tSource('校验失败')"
                >
                  {{ $tSource("音频文件 Header 损坏，无法解码。") }}
                </CommonInlineMessage>
              </div>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 7：浮层类 (Overlays) -->
    <section
      v-show="isCategoryVisible(7)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 7") }}
          </CommonBadge>
          <h2>{{ $tSource("浮层类组件 (Overlays)") }}</h2>
        </div>
        <CommonTag color="gray">
          {{ $tSource("弹窗与反馈") }}
        </CommonTag>
      </header>

      <!-- 小类 7.1：轻提示与阻断对话框 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 7.1：轻提示与阻断对话框 (Toast & Dialogs)')" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonToast -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonToast</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("轻提示") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton @click="showToast">
                {{ $tSource("打开 Toast") }}
              </CommonButton>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonDialog -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonDialog</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("标准对话框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton @click="dialogVisible = true">
                {{ $tSource("打开 Dialog") }}
              </CommonButton>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonAlertDialog -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonAlertDialog</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("危险确认对话框") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton
                variant="danger"
                @click="alertVisible = true"
              >
                <Trash2 :size="15" /> {{ $tSource("打开 AlertDialog") }}
              </CommonButton>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonDrawer -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonDrawer</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("抽屉面板") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton @click="drawerVisible = true">
                {{ $tSource("打开 Drawer") }}
              </CommonButton>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 8：容器与高级布局类 (Containers & Layout) -->
    <section
      v-show="isCategoryVisible(8)"
      class="ncx-design-lab-category"
    >
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge
            type="info"
            variant="solid"
          >
            {{ $tSource("大类 8") }}
          </CommonBadge>
          <h2>{{ $tSource("容器与高级布局类组件 (Containers & Layout)") }}</h2>
        </div>
        <CommonTag color="gray">
          {{ $tSource("高级容器与滚动") }}
        </CommonTag>
      </header>

      <!-- 小类 8.1：折叠与列表容器 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator :label="$tSource('小类 8.1：折叠与列表容器 (Accordion & Virtual List)')" />
        </div>

        <div class="ncx-design-lab-grid--full">
          <!-- 具体组件：CommonAccordion -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonAccordion</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("手风琴") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonAccordion :items="accordionItems" />
            </div>
          </CommonCard>
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonScrollArea & CommonVirtualList -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonScrollArea & CommonVirtualList</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("虚拟列表与滚动") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-scroll-demo">
                <CommonScrollArea>
                  <CommonVirtualList :items="virtualListItems" />
                </CommonScrollArea>
              </div>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonResponsiveGrid -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonResponsiveGrid</code>
              </div>
              <CommonTag
                color="gray"
                class="ncx-design-lab-component-tag"
              >
                {{ $tSource("响应式网格") }}
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonResponsiveGrid>
                <div style="padding: 12px; border-radius: 6px; background: var(--ncx-color-surface-raised); text-align: center;">
                  {{ $tSource("网格列 A") }}
                </div>
                <div style="padding: 12px; border-radius: 6px; background: var(--ncx-color-surface-raised); text-align: center;">
                  {{ $tSource("网格列 B") }}
                </div>
              </CommonResponsiveGrid>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>
  </main>

  <!-- 动态浮层 Modal / Drawer / Toast / Dialog -->
  <CommonToast
    :visible="toastVisible"
    type="success"
    :title="$tSource('组件反馈已触发')"
    :message="$tSource('Toast 可关闭，且不承担审批任务。')"
    @close="toastVisible = false"
  />

  <CommonDialog
    :visible="dialogVisible"
    :title="$tSource('Dialog 示例')"
    @close="dialogVisible = false"
  >
    <p>{{ $tSource("Dialog 用于集中完成短任务或表单，不承载大量浏览内容。") }}</p>
    <template #actions>
      <CommonButton
        variant="secondary"
        @click="dialogVisible = false"
      >
        {{ $tSource("取消") }}
      </CommonButton>
      <CommonButton
        variant="primary"
        @click="dialogVisible = false; recordAction('Dialog 已保存')"
      >
        {{ $tSource("保存") }}
      </CommonButton>
    </template>
  </CommonDialog>

  <CommonAlertDialog
    :visible="alertVisible"
    :title="$tSource('确认删除缓存？')"
    :description="$tSource('这是不可逆演示操作，用于验证危险确认样式。')"
    @cancel="alertVisible = false"
    @confirm="confirmDangerAction"
  />

  <CommonDrawer
    :visible="drawerVisible"
    :title="$tSource('Drawer 示例')"
    @close="drawerVisible = false"
  >
    <p>{{ $tSource("Drawer 保留当前页面上下文，适合队列、详情和辅助任务。") }}</p>
    <CommonInlineMessage type="warning">
      {{ $tSource("窄窗口下宽度不超过内容区。") }}
    </CommonInlineMessage>
  </CommonDrawer>
</template>
