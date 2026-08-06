<script setup lang="ts">
import {
  Bell,
  Heart,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  Trash2
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
  { label: '状态', value: 'states' },
  { label: '布局', value: 'layout' },
  { label: '无障碍', value: 'a11y' }
]

/** 菜单组件示例项。 */
const menuItems: CommonMenuItem[] = [
  { label: '播放下一首', value: 'play-next', shortcut: 'Enter' },
  { label: '加入歌单', value: 'add-playlist', shortcut: 'A' },
  { label: '删除缓存', value: 'delete-cache', shortcut: 'Del', danger: true }
]

/** 手风琴组件示例项。 */
const accordionItems: CommonAccordionItem[] = [
  { title: '按钮契约', content: '覆盖 Default、Hover、Pressed、Focus、Disabled 和 Loading。' },
  { title: '菜单契约', content: '右键菜单不是唯一入口，必须恢复焦点并支持键盘。' },
  { title: '浮层契约', content: 'Toast、Dialog、Drawer、Popover 各有边界，避免重复反馈。' }
]

/** 虚拟列表组件示例项。 */
const virtualListItems: CommonVirtualListItem[] = Array.from({ length: 36 }, (_, index) => ({
  id: `track-${index + 1}`,
  title: `通用列表项 ${index + 1}`,
  description: `用于验证滚动、焦点和长列表密度 #${index + 1}`
}))

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
    <section class="ncx-design-lab-hero">
      <div>
        <p class="ncx-design-lab-eyebrow">
          Design System UI Lab
        </p>
        <h1>通用组件交互测试页</h1>
        <p>
          展示 P0 通用组件的基础状态、键盘焦点、表单输入和浮层反馈，供项目骨架开发期统一验收。
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

    <section class="ncx-design-lab-section">
      <h2>操作</h2>
      <CommonCard>
        <div class="ncx-design-lab-row">
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
            删除
          </CommonButton>
          <CommonButton loading>
            同步中
          </CommonButton>
        </div>
        <CommonSeparator />
        <div class="ncx-design-lab-row">
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
          <CommonButtonGroup>
            <CommonIconButton
              label="新增"
              size="compact"
              @click="recordAction('ButtonGroup 新增')"
            >
              <Plus :size="14" />
            </CommonIconButton>
            <CommonIconButton
              label="刷新"
              size="compact"
              @click="recordAction('ButtonGroup 刷新')"
            >
              <RefreshCcw :size="14" />
            </CommonIconButton>
            <CommonIconButton
              label="更多"
              size="compact"
              @click="recordAction('ButtonGroup 更多')"
            >
              <MoreHorizontal :size="14" />
            </CommonIconButton>
          </CommonButtonGroup>
          <CommonLinkButton
            href="#/discover"
            @click="recordAction('LinkButton')"
          >
            查看发现页
          </CommonLinkButton>
        </div>
      </CommonCard>
    </section>

    <section class="ncx-design-lab-section">
      <h2>输入与选择</h2>
      <CommonResponsiveGrid>
        <CommonCard>
          <label>Input</label>
          <CommonInput
            v-model="inputValue"
            placeholder="输入项目名称"
          />
        </CommonCard>
        <CommonCard>
          <label>SearchInput</label>
          <CommonSearchInput
            v-model="searchValue"
            @clear="recordAction('搜索已清空')"
          />
        </CommonCard>
        <CommonCard>
          <label>Select</label>
          <CommonSelect
            v-model="selectValue"
            :options="qualityOptions"
          />
        </CommonCard>
        <CommonCard>
          <label>Combobox</label>
          <CommonCombobox
            v-model="comboboxValue"
            :options="qualityOptions"
            placeholder="输入或选择音质"
          />
        </CommonCard>
        <CommonCard>
          <label>Textarea</label>
          <CommonTextarea v-model="textareaValue" />
        </CommonCard>
        <CommonCard>
          <label>Checkbox / Radio</label>
          <div class="ncx-design-lab-stack">
            <CommonCheckbox
              v-model="checkboxValue"
              label="启用键盘焦点验证"
            />
            <CommonRadioGroup
              v-model="radioValue"
              :options="pageModeOptions"
              name="lab-mode"
            />
          </div>
        </CommonCard>
        <CommonCard>
          <label>Switch / Slider</label>
          <div class="ncx-design-lab-stack">
            <CommonSwitch
              v-model="switchValue"
              label="自动播放"
            />
            <CommonSlider
              v-model="sliderValue"
              label="音量"
            />
          </div>
        </CommonCard>
        <CommonCard>
          <label>SegmentedControl</label>
          <CommonSegmentedControl
            v-model="segmentedValue"
            :options="safetyOptions"
          />
        </CommonCard>
      </CommonResponsiveGrid>
    </section>

    <section class="ncx-design-lab-section">
      <h2>展示与导航</h2>
      <CommonResponsiveGrid>
        <CommonCard interactive>
          <div class="ncx-design-lab-row">
            <CommonAvatar name="NcxMusic" />
            <CommonBadge type="info">
              INFO
            </CommonBadge>
            <CommonBadge type="warning">
              WARNING
            </CommonBadge>
            <CommonTag selected>
              精选
            </CommonTag>
            <CommonTooltip text="停留或聚焦展示 Tooltip">
              <CommonTag>Tooltip</CommonTag>
            </CommonTooltip>
          </div>
        </CommonCard>
        <CommonCard>
          <CommonTabs
            v-model="tabsValue"
            :options="tabOptions"
          />
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-row">
            <CommonDropdownMenu
              label="DropdownMenu"
              :items="menuItems"
              @select="recordAction(`菜单：${$event}`)"
            />
            <CommonPopover label="Popover">
              Popover 用于由明确锚点触发的少量说明或控制。
            </CommonPopover>
          </div>
        </CommonCard>
        <CommonCard>
          <CommonContextMenu
            :items="menuItems"
            @select="recordAction(`右键菜单：${$event}`)"
          >
            <div class="ncx-design-lab-context-zone">
              右键这里打开 ContextMenu
            </div>
          </CommonContextMenu>
        </CommonCard>
      </CommonResponsiveGrid>
    </section>

    <section class="ncx-design-lab-section">
      <h2>状态与容器</h2>
      <CommonResponsiveGrid>
        <CommonCard>
          <div class="ncx-design-lab-stack">
            <CommonSpinner label="正在加载组件状态" />
            <CommonProgress :value="progressValue" />
            <CommonSkeleton :lines="3" />
          </div>
        </CommonCard>
        <CommonEmptyState
          title="暂无组件变更"
          description="空数据区域保留恢复操作入口。"
        >
          <CommonButton
            size="compact"
            @click="recordAction('EmptyState 操作')"
          >
            创建示例
          </CommonButton>
        </CommonEmptyState>
        <CommonErrorState
          title="组件加载失败"
          description="错误状态必须说明恢复动作。"
        >
          <CommonButton
            size="compact"
            variant="danger"
            @click="recordAction('ErrorState 重试')"
          >
            重试
          </CommonButton>
        </CommonErrorState>
        <CommonCard>
          <CommonInlineMessage type="info">
            InlineMessage 用于当前 Section 内可恢复的问题。
          </CommonInlineMessage>
        </CommonCard>
        <CommonCard>
          <CommonAccordion :items="accordionItems" />
        </CommonCard>
        <CommonCard>
          <CommonScrollArea>
            <CommonVirtualList :items="virtualListItems" />
          </CommonScrollArea>
        </CommonCard>
      </CommonResponsiveGrid>
    </section>

    <section class="ncx-design-lab-section">
      <h2>浮层</h2>
      <CommonCard>
        <div class="ncx-design-lab-row">
          <CommonButton @click="showToast">
            打开 Toast
          </CommonButton>
          <CommonButton @click="dialogVisible = true">
            打开 Dialog
          </CommonButton>
          <CommonButton @click="drawerVisible = true">
            打开 Drawer
          </CommonButton>
          <CommonButton
            variant="danger"
            @click="alertVisible = true"
          >
            <Trash2 :size="15" />
            打开 AlertDialog
          </CommonButton>
        </div>
      </CommonCard>
    </section>
  </main>

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
