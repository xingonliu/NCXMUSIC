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
      <h2>操作组件 (CommonButton 按钮族 WWDC25 对齐)</h2>
      <CommonCard>
        <div class="ncx-design-lab-stack">
          <!-- 变体演示 -->
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
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

          <CommonSeparator label="三档尺寸：Compact (24px) / Default (32px) / Prominent (38px)" />

          <!-- 尺寸演示 -->
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
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

          <CommonSeparator label="图标按钮 (CommonIconButton) & 按钮组 (CommonButtonGroup) & 链接按钮 (CommonLinkButton)" />

          <!-- 图标按钮与组合按钮 -->
          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
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

            <!-- 连体 Push Button 组 -->
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

            <!-- 组合图标按钮 -->
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

            <!-- 链接按钮 -->
            <div style="display: flex; align-items: center; gap: 12px;">
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
        </div>
      </CommonCard>
    </section>

    <section class="ncx-design-lab-section">
      <h2>输入与选择</h2>
      <CommonResponsiveGrid>
        <CommonCard>
          <div class="ncx-design-lab-label">
            Input
          </div>
          <CommonInput
            v-model="inputValue"
            placeholder="输入项目名称"
          />
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            SearchInput
          </div>
          <CommonSearchInput
            v-model="searchValue"
            @clear="recordAction('搜索已清空')"
          />
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            Select
          </div>
          <CommonSelect
            v-model="selectValue"
            :options="qualityOptions"
          />
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            Combobox
          </div>
          <CommonCombobox
            v-model="comboboxValue"
            :options="qualityOptions"
            placeholder="输入或选择音质"
          />
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            Textarea
          </div>
          <CommonTextarea v-model="textareaValue" />
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            macOS Checkbox / Radio
          </div>
          <div class="ncx-design-lab-stack">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <CommonCheckbox
                v-model="checkboxValue"
                size="compact"
                label="Compact Checkbox"
              />
              <CommonCheckbox
                v-model="checkboxValue"
                size="default"
                label="Default Checkbox"
              />
              <CommonCheckbox
                v-model="checkboxValue"
                size="prominent"
                label="Prominent Checkbox"
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
            <CommonRadioGroup
              v-model="radioValue"
              :options="pageModeOptions"
              name="lab-mode"
            />
          </div>
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            macOS Switch / Slider
          </div>
          <div class="ncx-design-lab-stack">
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
              <CommonSwitch
                v-model="switchValue"
                size="compact"
                label="Compact Switch"
              />
              <CommonSwitch
                v-model="switchValue"
                size="default"
                label="Default Switch"
              />
              <CommonSwitch
                v-model="switchValue"
                size="prominent"
                label="Prominent Switch"
              />
              <CommonSwitch
                :model-value="true"
                disabled
                label="Disabled Switch"
              />
            </div>
            <CommonSlider
              v-model="sliderValue"
              label="音量"
            />
          </div>
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            macOS SegmentedControl
          </div>
          <div class="ncx-design-lab-stack">
            <CommonSegmentedControl
              v-model="segmentedValue"
              :options="safetyOptions"
              size="default"
            />
          </div>
        </CommonCard>
      </CommonResponsiveGrid>
    </section>

    <section class="ncx-design-lab-section">
      <h2>macOS UI 规范展示组件 (WWDC25 对齐)</h2>
      <CommonResponsiveGrid>
        <CommonCard
          variant="glass"
          title="CommonAvatar & CommonBadge 状态徽标与头像"
        >
          <div class="ncx-design-lab-stack">
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
            </div>
            <CommonSeparator
              inset
              spacing="compact"
            />
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
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
              <CommonBadge
                type="neutral"
                variant="subtle"
                count="Beta"
              />
            </div>
          </div>
        </CommonCard>

        <CommonCard
          variant="elevated"
          title="CommonTag macOS 标签与分类"
        >
          <div class="ncx-design-lab-stack">
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
            <CommonSeparator
              label="交互提示说明 Tooltip"
              spacing="compact"
            />
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <CommonTooltip
                text="顶部气泡提示：快捷键 Command+K"
                placement="top"
              >
                <CommonTag color="gray">
                  Top Tooltip
                </CommonTag>
              </CommonTooltip>
              <CommonTooltip
                text="右侧气泡提示：MacBook M3 Max 优化"
                placement="right"
              >
                <CommonTag color="blue">
                  Right Tooltip
                </CommonTag>
              </CommonTooltip>
              <CommonTooltip
                text="底部气泡提示：高清音频流处理"
                placement="bottom"
              >
                <CommonTag color="green">
                  Bottom Tooltip
                </CommonTag>
              </CommonTooltip>
            </div>
          </div>
        </CommonCard>
      </CommonResponsiveGrid>
    </section>

    <section class="ncx-design-lab-section">
      <h2>展示与导航</h2>
      <CommonResponsiveGrid>
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
      <h2>macOS 状态与反馈组件 (WWDC25 对齐)</h2>
      <CommonResponsiveGrid>
        <CommonCard>
          <div class="ncx-design-lab-label">
            macOS Activity Spinner & Progress
          </div>
          <div class="ncx-design-lab-stack">
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
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            WWDC25 Glassmorphism Skeleton
          </div>
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
        </CommonCard>
        <CommonEmptyState
          title="暂无音轨列表"
          description="遵循 macOS ContentUnavailableView 居中布局与微光层级。"
        >
          <CommonButton
            size="compact"
            variant="secondary"
            @click="recordAction('EmptyState 导入音乐')"
          >
            导入本地音乐
          </CommonButton>
        </CommonEmptyState>
        <CommonErrorState
          title="网络连接失败"
          description="无法连接到 Apple Music 云端数据库，请检查网络后再试。"
          @retry="recordAction('ErrorState 触发重试')"
        />
        <CommonCard>
          <div class="ncx-design-lab-label">
            macOS Callout InlineMessage
          </div>
          <div class="ncx-design-lab-stack">
            <CommonInlineMessage
              type="info"
              title="系统提示"
              closable
              @close="recordAction('关闭 InlineMessage')"
            >
              这是符合 macOS HIG 规范的内联提示通告栏。
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
        </CommonCard>
        <CommonCard>
          <CommonAccordion :items="accordionItems" />
        </CommonCard>
        <CommonCard>
          <div class="ncx-design-lab-label">
            CommonScrollArea & CommonVirtualList
          </div>
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
