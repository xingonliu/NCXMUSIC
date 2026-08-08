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
import { computed, ref } from 'vue'

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

import './design-system-lab.css'

// ========= 变量 =========

/** UI Lab 单行输入示例值。 */
const inputValue = ref('NcxMusic')

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

/** 进度条演示值。 */
const progressValue = computed(() => Math.min(100, sliderValue.value))

// ========= 函数 =========

/** 记录 UI Lab 的最近交互。 */
function recordAction(action: string): void {
  latestAction.value = action
}

/** 展示 Toast 并记录交互。 */
function showToast(): void {
  toastVisible.value = true
  recordAction('Toast 已打开')
}

/** 确认危险弹窗演示。 */
function confirmDangerAction(): void {
  alertVisible.value = false
  recordAction('AlertDialog 已确认')
}
</script>

<template>
  <main class="ncx-design-lab">
    <!-- 顶部 Hero 区域 -->
    <section class="ncx-design-lab-hero">
      <div>
        <p class="ncx-design-lab-eyebrow">
          Design System UI Lab
        </p>
        <h1>通用组件交互测试页</h1>
        <p>
          按规范分类分级展示通用组件：大类 → 小类 → 具体组件名 + 交互效果。
        </p>
      </div>
      <CommonCard class="ncx-design-lab-status">
        <CommonBadge type="success">
          READY
        </CommonBadge>
        <strong>{{ latestAction }}</strong>
        <span>滑块进度：{{ progressValue }}%</span>
      </CommonCard>
    </section>

    <!-- 大类 1：操作类 (Actions) -->
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 1
          </CommonBadge>
          <h2>操作类组件 (Actions)</h2>
        </div>
        <CommonTag color="blue">
          WWDC25 对齐
        </CommonTag>
      </header>

      <!-- 小类 1.1：基础按钮与链接 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 1.1：基础按钮与链接 (Buttons & Links)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonButton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonButton</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                基础按钮
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <CommonButton
                    variant="primary"
                    @click="recordAction('Primary Button')"
                  >
                    <Play :size="15" />
                    立即播放
                  </CommonButton>
                  <CommonButton
                    variant="secondary"
                    @click="recordAction('Secondary Button')"
                  >
                    加入队列
                  </CommonButton>
                  <CommonButton
                    variant="ghost"
                    @click="recordAction('Ghost Button')"
                  >
                    稍后再说
                  </CommonButton>
                  <CommonButton
                    variant="danger"
                    @click="alertVisible = true"
                  >
                    <Trash2 :size="15" />
                    删除音轨
                  </CommonButton>
                  <CommonButton
                    variant="primary"
                    loading
                  >
                    同步中...
                  </CommonButton>
                  <CommonButton
                    variant="secondary"
                    disabled
                  >
                    已禁用操作
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                图标按钮
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <CommonIconButton
                  label="喜欢"
                  selected
                  @click="recordAction('IconButton 喜欢')"
                >
                  <Heart :size="17" />
                </CommonIconButton>
                <CommonIconButton
                  label="通知"
                  @click="recordAction('IconButton 通知')"
                >
                  <Bell :size="17" />
                </CommonIconButton>
                <CommonIconButton
                  label="已禁用图标"
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                组合按钮组
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
                    左侧
                  </CommonButton>
                  <CommonButton
                    size="default"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 中间')"
                  >
                    中间
                  </CommonButton>
                  <CommonButton
                    size="default"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 右侧')"
                  >
                    右侧
                  </CommonButton>
                </CommonButtonGroup>

                <CommonButtonGroup variant="connected">
                  <CommonIconButton
                    label="新增"
                    size="compact"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 新增')"
                  >
                    <Plus :size="14" />
                  </CommonIconButton>
                  <CommonIconButton
                    label="刷新"
                    size="compact"
                    variant="secondary"
                    @click="recordAction('ButtonGroup 刷新')"
                  >
                    <RefreshCcw :size="14" />
                  </CommonIconButton>
                  <CommonIconButton
                    label="更多"
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                链接按钮
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 16px;">
                <CommonLinkButton
                  href="#/discover"
                  @click="recordAction('LinkButton 发现页')"
                >
                  查看发现页
                </CommonLinkButton>
                <CommonLinkButton
                  disabled
                  href="#/disabled"
                >
                  不可用链接
                </CommonLinkButton>
              </div>
            </div>
          </CommonCard>
        </div>
      </div>

      <!-- 小类 1.2：顶栏控件 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 1.2：顶栏控件 (Header Controls)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonHeaderButton -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonHeaderButton</code>
              </div>
              <CommonTag color="blue" class="ncx-design-lab-component-tag">
                Header 单按钮
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 8px;">
                <CommonHeaderButton
                  label="返回上一页"
                  @click="recordAction('HeaderButton 返回')"
                >
                  <ChevronLeft :size="18" />
                </CommonHeaderButton>

                <CommonHeaderButton
                  label="搜索内容"
                  @click="recordAction('HeaderButton 搜索')"
                >
                  <Search :size="17" />
                </CommonHeaderButton>

                <CommonHeaderButton
                  label="刷新当前页"
                  @click="recordAction('HeaderButton 刷新')"
                >
                  <RotateCcw :size="17" />
                </CommonHeaderButton>

                <CommonHeaderButton
                  label="已禁用按钮"
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
              <CommonTag color="blue" class="ncx-design-lab-component-tag">
                Header 成组按钮
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonHeaderGroupButton label="窗口控制示例（插槽模式）">
                  <CommonHeaderGroupItem
                    label="最小化"
                    @click="recordAction('HeaderGroupItem 最小化')"
                  >
                    <Minus :size="16" />
                  </CommonHeaderGroupItem>
                  <CommonHeaderGroupItem
                    label="最大化"
                    @click="recordAction('HeaderGroupItem 最大化')"
                  >
                    <Maximize2 :size="15" />
                  </CommonHeaderGroupItem>
                  <CommonHeaderGroupItem
                    label="关闭"
                    variant="close"
                    @click="recordAction('HeaderGroupItem 关闭')"
                  >
                    <X :size="16" />
                  </CommonHeaderGroupItem>
                </CommonHeaderGroupButton>

                <CommonHeaderGroupButton
                  label="成组按钮（Items 配置模式）"
                  :items="[
                    { label: '添加项', icon: Plus, onClick: () => recordAction('HeaderGroup items 添加') },
                    { label: '刷新列表', icon: RefreshCcw, onClick: () => recordAction('HeaderGroup items 刷新') },
                    { label: '删除选定', icon: Trash2, variant: 'danger', onClick: () => recordAction('HeaderGroup items 删除') }
                  ]"
                />
              </div>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 2：输入类 (Inputs) -->
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 2
          </CommonBadge>
          <h2>输入类组件 (Inputs)</h2>
        </div>
        <CommonTag color="gray">
          表单输入
        </CommonTag>
      </header>

      <!-- 小类 2.1：文本输入 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 2.1：文本输入 (Text Inputs)" />
        </div>

        <div class="ncx-design-lab-grid">
          <!-- 具体组件：CommonInput -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonInput</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                单行输入框
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonInput
                v-model="inputValue"
                placeholder="输入项目名称"
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                搜索输入框
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                多行文本域
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
          <CommonSeparator label="小类 2.2：下拉与组合选择 (Select & Combobox)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonSelect -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSelect</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                下拉选择框
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                组合选择框
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonCombobox
                v-model="comboboxValue"
                :options="qualityOptions"
                placeholder="输入或选择音质"
              />
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 3：选择类 (Selections) -->
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 3
          </CommonBadge>
          <h2>选择类组件 (Selections)</h2>
        </div>
        <CommonTag color="gray">
          选项与状态
        </CommonTag>
      </header>

      <!-- 小类 3.1：勾选与开关 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 3.1：勾选与开关 (Checkbox & Switch)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonCheckbox -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonCheckbox</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                复选框
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                开关组件
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
          <CommonSeparator label="小类 3.2：单选与分段 (Radio & Segmented)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonRadioGroup -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonRadioGroup</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                单选组
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                分段控制器
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
          <CommonSeparator label="小类 3.3：数值调节 (Slider)" />
        </div>

        <div class="ncx-design-lab-grid--full">
          <!-- 具体组件：CommonSlider -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSlider</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                滑块控制
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonSlider
                v-model="sliderValue"
                label="音量控制"
              />
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 4：展示类 (Display) -->
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 4
          </CommonBadge>
          <h2>展示类组件 (Display)</h2>
        </div>
        <CommonTag color="gray">
          视觉展示
        </CommonTag>
      </header>

      <!-- 小类 4.1：身份与徽标 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 4.1：身份与徽标 (Avatar & Badge)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonAvatar -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonAvatar</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                头像
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                徽标角标
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
          <CommonSeparator label="小类 4.2：标签与提示 (Tag & Tooltip)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonTag -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonTag</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                标签分类
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <CommonTag
                  selected
                  color="blue"
                >
                  精选单曲
                </CommonTag>
                <CommonTag color="green">
                  Hi-Res 无损
                </CommonTag>
                <CommonTag
                  color="orange"
                  closable
                  @close="recordAction('关闭标签：流行榜')"
                >
                  流行榜单
                </CommonTag>
                <CommonTag
                  color="purple"
                  variant="solid"
                >
                  VIP 专享
                </CommonTag>
                <CommonTag
                  color="red"
                  variant="outline"
                >
                  热门推荐
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                气泡提示
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <CommonTooltip
                  text="顶部气泡提示：快捷键 ⌘K"
                  placement="top"
                >
                  <CommonTag color="gray">
                    Top Tooltip
                  </CommonTag>
                </CommonTooltip>
                <CommonTooltip
                  text="右侧气泡提示：M3 Max 优化"
                  placement="right"
                >
                  <CommonTag color="blue">
                    Right Tooltip
                  </CommonTag>
                </CommonTooltip>
                <CommonTooltip
                  text="底部气泡提示：高清音频流"
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
          <CommonSeparator label="小类 4.3：结构卡片与分割线 (Card & Separator)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonCard -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonCard</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                结构卡片
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div style="display: grid; gap: 12px;">
                <CommonCard
                  variant="default"
                  title="Default Card"
                >
                  默认标准卡片
                </CommonCard>
                <CommonCard
                  variant="glass"
                  title="Glass Card"
                >
                  Liquid Glass 玻璃材质卡片
                </CommonCard>
                <CommonCard
                  variant="elevated"
                  title="Elevated Card"
                >
                  Elevated 阴影抬升卡片
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                分割线
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonSeparator />
                <CommonSeparator label="带 Label 的分割线" />
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
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 5
          </CommonBadge>
          <h2>导航与菜单类组件 (Navigation & Menus)</h2>
        </div>
        <CommonTag color="gray">
          菜单与页签
        </CommonTag>
      </header>

      <!-- 小类 5.1：标签导航 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 5.1：标签导航 (Tabs Navigation)" />
        </div>

        <div class="ncx-design-lab-grid--full">
          <!-- 具体组件：CommonTabs -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonTabs</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                标签页
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
          <CommonSeparator label="小类 5.2：弹出菜单 (Popups & Menus)" />
        </div>

        <div class="ncx-design-lab-grid">
          <!-- 具体组件：CommonDropdownMenu -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonDropdownMenu</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                下拉菜单
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonDropdownMenu
                label="DropdownMenu 示例"
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                右键菜单
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonContextMenu
                :items="menuItems"
                @select="recordAction(`右键菜单：${$event}`)"
              >
                <div class="ncx-design-lab-context-zone">
                  右键点击本区域唤起 ContextMenu
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                气泡弹出框
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonPopover label="Popover 示例">
                Popover 用于由明确锚点触发的少量说明或控制。
              </CommonPopover>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 6：状态与反馈类 (Status & Feedback) -->
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 6
          </CommonBadge>
          <h2>状态与反馈类组件 (Status & Feedback)</h2>
        </div>
        <CommonTag color="gray">
          反馈与加载
        </CommonTag>
      </header>

      <!-- 小类 6.1：加载与进度 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 6.1：加载与进度 (Loading & Progress)" />
        </div>

        <div class="ncx-design-lab-grid">
          <!-- 具体组件：CommonSpinner -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonSpinner</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                加载菊花
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                进度条
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonProgress
                  :value="65"
                  show-value
                  label="确定进度"
                />
                <CommonProgress
                  indeterminate
                  size="compact"
                  label="不定长加载进度"
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                骨架屏
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
          <CommonSeparator label="小类 6.2：状态反馈 (State Feedback)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonEmptyState -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonEmptyState</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                空状态
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonEmptyState
                title="暂无音轨列表"
                description="遵循 macOS ContentUnavailableView 居中布局。"
              >
                <CommonButton
                  size="compact"
                  variant="secondary"
                  @click="recordAction('EmptyState 导入音乐')"
                >
                  导入本地音乐
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                错误状态
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonErrorState
                title="网络连接失败"
                description="无法连接到云端数据库，请检查网络后再试。"
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                内联消息栏
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <div class="ncx-design-lab-stack">
                <CommonInlineMessage
                  type="info"
                  title="系统提示"
                  closable
                  @close="recordAction('关闭 InlineMessage')"
                >
                  符合 macOS HIG 规范的内联提示通告栏。
                </CommonInlineMessage>
                <CommonInlineMessage
                  type="success"
                  title="同步成功"
                >
                  播放列表已实时与 iCloud 云端同步。
                </CommonInlineMessage>
                <CommonInlineMessage type="warning">
                  存储空间即将不足 1GB。
                </CommonInlineMessage>
                <CommonInlineMessage
                  type="danger"
                  title="校验失败"
                >
                  音频文件 Header 损坏，无法解码。
                </CommonInlineMessage>
              </div>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 7：浮层类 (Overlays) -->
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 7
          </CommonBadge>
          <h2>浮层类组件 (Overlays)</h2>
        </div>
        <CommonTag color="gray">
          弹窗与反馈
        </CommonTag>
      </header>

      <!-- 小类 7.1：轻提示与阻断对话框 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 7.1：轻提示与阻断对话框 (Toast & Dialogs)" />
        </div>

        <div class="ncx-design-lab-grid--2col">
          <!-- 具体组件：CommonToast -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonToast</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                轻提示
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton @click="showToast">
                打开 Toast
              </CommonButton>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonDialog -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonDialog</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                标准对话框
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton @click="dialogVisible = true">
                打开 Dialog
              </CommonButton>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonAlertDialog -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonAlertDialog</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                危险确认对话框
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton
                variant="danger"
                @click="alertVisible = true"
              >
                <Trash2 :size="15" />
                打开 AlertDialog
              </CommonButton>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonDrawer -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonDrawer</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                抽屉面板
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonButton @click="drawerVisible = true">
                打开 Drawer
              </CommonButton>
            </div>
          </CommonCard>
        </div>
      </div>
    </section>

    <!-- 大类 8：容器与高级布局类 (Containers & Layout) -->
    <section class="ncx-design-lab-category">
      <header class="ncx-design-lab-category-header">
        <div class="ncx-design-lab-category-title">
          <CommonBadge type="info" variant="solid">
            大类 8
          </CommonBadge>
          <h2>容器与高级布局类组件 (Containers & Layout)</h2>
        </div>
        <CommonTag color="gray">
          高级容器与滚动
        </CommonTag>
      </header>

      <!-- 小类 8.1：折叠与列表容器 -->
      <div class="ncx-design-lab-subcategory">
        <div class="ncx-design-lab-subcategory-header">
          <CommonSeparator label="小类 8.1：折叠与列表容器 (Accordion & Virtual List)" />
        </div>

        <div class="ncx-design-lab-grid--full">
          <!-- 具体组件：CommonAccordion -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonAccordion</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                手风琴
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
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                虚拟列表与滚动
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonScrollArea>
                <CommonVirtualList :items="virtualListItems" />
              </CommonScrollArea>
            </div>
          </CommonCard>

          <!-- 具体组件：CommonResponsiveGrid -->
          <CommonCard class="ncx-design-lab-component-card">
            <header class="ncx-design-lab-component-header">
              <div class="ncx-design-lab-component-title">
                <code class="ncx-design-lab-component-name">CommonResponsiveGrid</code>
              </div>
              <CommonTag color="gray" class="ncx-design-lab-component-tag">
                响应式网格
              </CommonTag>
            </header>
            <div class="ncx-design-lab-component-demo">
              <CommonResponsiveGrid>
                <div style="padding: 12px; border-radius: 6px; background: var(--ncx-color-surface-raised); text-align: center;">
                  网格列 A
                </div>
                <div style="padding: 12px; border-radius: 6px; background: var(--ncx-color-surface-raised); text-align: center;">
                  网格列 B
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
    title="组件反馈已触发"
    message="Toast 可关闭，且不承担审批任务。"
    @close="toastVisible = false"
  />

  <CommonDialog
    :visible="dialogVisible"
    title="Dialog 示例"
    @close="dialogVisible = false"
  >
    <p>Dialog 用于集中完成短任务或表单，不承载大量浏览内容。</p>
    <template #actions>
      <CommonButton
        variant="secondary"
        @click="dialogVisible = false"
      >
        取消
      </CommonButton>
      <CommonButton
        variant="primary"
        @click="dialogVisible = false; recordAction('Dialog 已保存')"
      >
        保存
      </CommonButton>
    </template>
  </CommonDialog>

  <CommonAlertDialog
    :visible="alertVisible"
    title="确认删除缓存？"
    description="这是不可逆演示操作，用于验证危险确认样式。"
    @cancel="alertVisible = false"
    @confirm="confirmDangerAction"
  />

  <CommonDrawer
    :visible="drawerVisible"
    title="Drawer 示例"
    @close="drawerVisible = false"
  >
    <p>Drawer 保留当前页面上下文，适合队列、详情和辅助任务。</p>
    <CommonInlineMessage type="warning">
      窄窗口下宽度不超过内容区。
    </CommonInlineMessage>
  </CommonDrawer>
</template>
