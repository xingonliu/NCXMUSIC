/* eslint vue/multi-word-component-names: off, vue/one-component-per-file: off */
import { Comment, Fragment, computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, Teleport, Transition, watch, type Component, type PropType, type Ref, type VNode } from 'vue'

// ========= 类型 =========

/** 通用组件尺寸。 */
type CommonComponentSize = 'compact' | 'default' | 'prominent'

/** 通用气泡位置。 */
type CommonTooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

/** 通用按钮视觉变体。 */
type CommonButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/** 通用消息视觉类型。 */
type CommonMessageType = 'info' | 'success' | 'warning' | 'danger'

/** 通用标签页视觉变体。 */
export type CommonTabsVariant = 'segmented' | 'underlined' | 'pills'

/** 通用选项数据结构。 */
export interface CommonOption {
  /** 选项展示文案。 */
  label: string
  /** 选项提交值。 */
  value: string
  /** 选项是否禁用。 */
  disabled?: boolean
  /** 选项图标。 */
  icon?: string
  /** 选项徽章。 */
  badge?: string | number
}

/** 通用菜单项类型。 */
export type CommonMenuItemType = 'normal' | 'separator' | 'header'

/** 通用菜单项数据结构。 */
export interface CommonMenuItem {
  /** 菜单项展示文案。 */
  label?: string
  /** 菜单项键值。 */
  value: string
  /** 菜单项类型。 */
  type?: CommonMenuItemType
  /** 菜单项快捷键。 */
  shortcut?: string
  /** 菜单项是否危险操作。 */
  danger?: boolean
  /** 菜单项是否禁用。 */
  disabled?: boolean
  /** 菜单项是否勾选。 */
  checked?: boolean
  /** 菜单项图标。 */
  icon?: string
}

/** 通用手风琴条目数据结构。 */
export interface CommonAccordionItem {
  /** 条目标题。 */
  title: string
  /** 条目正文。 */
  content: string
}

/** 通用虚拟列表条目数据结构。 */
export interface CommonVirtualListItem {
  /** 条目唯一键。 */
  id: string
  /** 条目标题。 */
  title: string
  /** 条目描述。 */
  description: string
}

// ========= 变量 =========

/** 通用尺寸 Prop 定义。 */
const sizeProp = {
  type: String as PropType<CommonComponentSize>,
  default: 'default'
}

/** 通用按钮变体 Prop 定义。 */
const buttonVariantProp = {
  type: String as PropType<CommonButtonVariant>,
  default: 'secondary'
}

/** 通用消息类型 Prop 定义。 */
const messageTypeProp = {
  type: String as PropType<CommonMessageType>,
  default: 'info'
}

// ========= 函数 =========

/** 组合通用组件 CSS 类名。 */
function joinClasses(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** 读取输入控件的字符串值。 */
function readInputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

/** 阻止禁用态点击事件继续执行。 */
function guardDisabledClick(event: MouseEvent, disabled: boolean): boolean {
  if (!disabled) return false
  event.preventDefault()
  event.stopPropagation()
  return true
}

/** 气泡显隐交互状态：统一鼠标悬浮/聚焦显隐逻辑（含延迟），供 Tooltip 与 IconButton 复用。 */
function useTooltipInteraction(disabled: () => boolean, delay = 1_500) {
  /** 气泡是否处于显示状态。 */
  const visible = ref(false)
  /** 延迟显示计时器。 */
  let timer: ReturnType<typeof setTimeout> | null = null

  /** 鼠标移入：延迟后显示气泡。 */
  function handleMouseEnter(): void {
    if (disabled()) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = true
    }, delay)
  }

  /** 鼠标移出：立即隐藏气泡并清除延迟计时器。 */
  function handleMouseLeave(): void {
    if (timer) clearTimeout(timer)
    visible.value = false
  }

  /** 获得焦点：立即显示气泡。 */
  function handleFocusIn(): void {
    if (disabled()) return
    if (timer) clearTimeout(timer)
    visible.value = true
  }

  /** 失去焦点：立即隐藏气泡。 */
  function handleFocusOut(): void {
    if (timer) clearTimeout(timer)
    visible.value = false
  }

  return { visible, handleMouseEnter, handleMouseLeave, handleFocusIn, handleFocusOut }
}

/** 可聚焦控件选择器，用于所有模态表面的焦点陷阱。 */
const MODAL_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

/** 当前打开的模态表面数量，用于嵌套表面关闭时维持背景 inert。 */
let activeModalCount = 0

/** 设置或清除应用背景不可交互状态。 */
function setApplicationBackgroundInert(inert: boolean): void {
  document.querySelectorAll<HTMLElement>('.ncx-app-shell, .ncx-player-bar').forEach((element) => {
    element.inert = inert
    if (inert) element.setAttribute('aria-hidden', 'true')
    else element.removeAttribute('aria-hidden')
  })
}

/** 为 Dialog/Alert/Drawer 安装焦点进入、循环与关闭后恢复。 */
function useModalFocus(visible: () => boolean, panel: Ref<HTMLElement | null>): void {
  /** 打开表面前的活动元素。 */
  let previousFocus: HTMLElement | null = null

  /** 将焦点保持在当前模态面板内。 */
  function trapFocus(event: KeyboardEvent): void {
    if (!visible() || event.key !== 'Tab' || !panel.value) return
    const focusable = Array.from(panel.value.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR))
      .filter((element) => !element.hidden)
    if (focusable.length === 0) {
      event.preventDefault()
      panel.value.focus()
      return
    }
    const first = focusable[0] as HTMLElement
    const last = focusable.at(-1) as HTMLElement
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(visible, async (isVisible) => {
    if (isVisible) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      activeModalCount += 1
      setApplicationBackgroundInert(true)
      await nextTick()
      const first = panel.value?.querySelector<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)
      ;(first ?? panel.value)?.focus()
      return
    }
    if (activeModalCount > 0) activeModalCount -= 1
    if (activeModalCount === 0) setApplicationBackgroundInert(false)
    previousFocus?.focus()
    previousFocus = null
  }, { immediate: true })

  onMounted(() => window.addEventListener('keydown', trapFocus, true))
  onUnmounted(() => {
    window.removeEventListener('keydown', trapFocus, true)
    if (visible() && activeModalCount > 0) activeModalCount -= 1
    if (activeModalCount === 0) setApplicationBackgroundInert(false)
  })
}

// ========= 操作组件 (macOS HIG / WWDC25 规范) =========

/** 通用组件Button：统一 macOS 标准按钮入口。 */
export const CommonButton = defineComponent({
  name: '通用组件Button',
  props: {
    variant: buttonVariantProp,
    size: sizeProp,
    loading: Boolean,
    disabled: Boolean,
    type: {
      type: String as PropType<'button' | 'submit' | 'reset'>,
      default: 'button'
    }
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    /** 当前按钮是否不可操作。 */
    const isDisabled = computed(() => props.disabled || props.loading)

    /** 处理按钮点击。 */
    function handleClick(event: MouseEvent): void {
      if (guardDisabledClick(event, isDisabled.value)) return
      emit('click', event)
    }

    return () =>
      h(
        'button',
        {
          class: joinClasses(
            'ncx-common-button',
            `ncx-common-button-${props.variant}`,
            `ncx-common-button-${props.size}`,
            props.loading && 'ncx-common-button-loading'
          ),
          type: props.type,
          disabled: isDisabled.value,
          'aria-disabled': isDisabled.value ? 'true' : undefined,
          'aria-busy': props.loading ? 'true' : undefined,
          onClick: handleClick
        },
        [
          props.loading ? h(CommonSpinner, { size: props.size === 'compact' ? 'compact' : 'default' }) : null,
          h('span', { class: 'ncx-common-button-text' }, slots.default?.())
        ]
      )
  }
})

/** 通用组件IconButton：统一纯图标按钮入口，悬停/聚焦自动展示样式化气泡，遵循 macOS 无障碍与状态规范。 */
export const CommonIconButton = defineComponent({
  name: '通用组件IconButton',
  props: {
    label: { type: String, required: true },
    size: sizeProp,
    variant: {
      type: String as PropType<'ghost' | 'secondary' | 'primary'>,
      default: 'ghost'
    },
    selected: Boolean,
    disabled: Boolean,
    /** 可选气泡弹出位置；未传入时按按钮所在视口位置自动选择。 */
    tooltipPlacement: {
      type: String as PropType<CommonTooltipPlacement>,
      default: undefined
    }
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    /** 气泡显隐交互状态。 */
    const { visible, handleMouseEnter, handleMouseLeave, handleFocusIn, handleFocusOut } = useTooltipInteraction(
      () => props.disabled
    )

    /** 图标按钮 DOM 引用，用于读取视口位置。 */
    const buttonRef = ref<HTMLButtonElement | null>(null)

    /** 当前实际使用的气泡位置。 */
    const resolvedTooltipPlacement = ref<CommonTooltipPlacement>('top')

    /** 脱离裁剪上下文后的气泡锚点定位样式。 */
    const tooltipAnchorStyle = ref<Record<string, string>>({})

    /** 根据按钮与视口边缘的距离选择默认气泡方向。 */
    function resolveTooltipPlacement(rect: DOMRect): CommonTooltipPlacement {
      if (props.tooltipPlacement) return props.tooltipPlacement
      if (rect.width === 0 && rect.height === 0) return 'top'

      /** 靠近视口边缘时切换方向的安全距离。 */
      const edgeThreshold = 72
      if (rect.top < edgeThreshold) return 'bottom'
      if (rect.bottom > window.innerHeight - edgeThreshold) return 'top'
      if (rect.left < edgeThreshold) return 'right'
      if (rect.right > window.innerWidth - edgeThreshold) return 'left'
      return 'top'
    }

    /** 同步气泡锚点到按钮的视口位置。 */
    function updateTooltipPosition(): void {
      if (!visible.value || !buttonRef.value) return
      const rect = buttonRef.value.getBoundingClientRect()
      resolvedTooltipPlacement.value = resolveTooltipPlacement(rect)
      tooltipAnchorStyle.value = {
        position: 'fixed',
        top: `${Math.round(rect.top)}px`,
        left: `${Math.round(rect.left)}px`,
        width: `${Math.round(rect.width)}px`,
        height: `${Math.round(rect.height)}px`,
        zIndex: 'calc(var(--ncx-layer-popover, 400) + 1)',
        pointerEvents: 'none'
      }
    }

    /** 视口变化时重新计算可见气泡位置。 */
    function handleViewportChange(): void {
      updateTooltipPosition()
    }

    /** 气泡显示后等待 Teleport 挂载，再同步锚点位置。 */
    watch(visible, (isVisible) => {
      if (isVisible) nextTick(updateTooltipPosition)
    })

    /** 显式位置变化时刷新气泡方向。 */
    watch(() => props.tooltipPlacement, () => {
      if (visible.value) updateTooltipPosition()
    })

    onMounted(() => {
      window.addEventListener('resize', handleViewportChange, { passive: true })
      window.addEventListener('scroll', handleViewportChange, { passive: true, capture: true })
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    })

    /** 处理图标按钮点击。 */
    function handleClick(event: MouseEvent): void {
      if (guardDisabledClick(event, props.disabled)) return
      emit('click', event)
    }

    return () =>
      h(
        'button',
        {
          ref: buttonRef,
          class: joinClasses(
            'ncx-common-icon-button',
            `ncx-common-icon-button-${props.variant}`,
            `ncx-common-icon-button-${props.size}`,
            props.selected && 'ncx-common-icon-button-selected'
          ),
          type: 'button',
          disabled: props.disabled,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'aria-label': props.label,
          'aria-pressed': props.selected ? 'true' : undefined,
          onMouseenter: handleMouseEnter,
          onMouseleave: handleMouseLeave,
          onFocusin: handleFocusIn,
          onFocusout: handleFocusOut,
          onClick: handleClick
        },
        [
          slots.default?.(),
          visible.value && !props.disabled
            ? h(
                Teleport,
                { to: 'body' },
                h(
                  'span',
                  { class: 'ncx-common-tooltip-anchor', style: tooltipAnchorStyle.value },
                  h(
                    'span',
                    {
                      class: joinClasses('ncx-common-tooltip-panel', `ncx-common-tooltip-panel--${resolvedTooltipPlacement.value}`),
                      role: 'tooltip'
                    },
                    [h('span', { class: 'ncx-common-tooltip-content' }, props.label), h('span', { class: 'ncx-common-tooltip-arrow' })]
                  )
                )
              )
            : null
        ]
      )
  }
})

/** 通用组件ButtonGroup：统一 macOS 组合按钮容器。 */
export const CommonButtonGroup = defineComponent({
  name: '通用组件ButtonGroup',
  props: {
    vertical: Boolean,
    variant: {
      type: String as PropType<'connected' | 'segmented'>,
      default: 'connected'
    }
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: joinClasses(
            'ncx-common-button-group',
            props.vertical && 'ncx-common-button-group-vertical',
            `ncx-common-button-group-${props.variant}`
          ),
          role: 'group'
        },
        slots.default?.()
      )
  }
})

/** Header 组合按钮项接口定义。 */
export interface HeaderGroupButtonItem {
  key?: string | number
  label: string
  variant?: 'default' | 'close' | 'danger'
  disabled?: boolean
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'
  icon?: Component | string
  onClick?: (event: MouseEvent) => void
}

/** 通用组件HeaderButton：Header 普通按钮（单按钮），内置悬停/聚焦样式化 Tooltip 气泡。 */
export const CommonHeaderButton = defineComponent({
  name: '通用组件HeaderButton',
  props: {
    /** 按钮功能说明与 Tooltip 气泡提示文案。 */
    label: { type: String, required: true },
    /** 是否禁用。 */
    disabled: Boolean,
    /** 气泡弹出位置：top | bottom | left | right，默认 bottom。 */
    tooltipPlacement: {
      type: String as PropType<'top' | 'bottom' | 'left' | 'right'>,
      default: 'bottom'
    },
    /** 原生按钮 type 类型。 */
    type: {
      type: String as PropType<'button' | 'submit' | 'reset'>,
      default: 'button'
    }
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    /** 气泡显隐交互状态。 */
    const { visible, handleMouseEnter, handleMouseLeave, handleFocusIn, handleFocusOut } = useTooltipInteraction(
      () => props.disabled
    )

    /** 处理按钮点击。 */
    function handleClick(event: MouseEvent): void {
      if (guardDisabledClick(event, props.disabled)) return
      emit('click', event)
    }

    return () =>
      h(
        'button',
        {
          class: joinClasses('ncx-common-header-button', 'ncx-glass-button'),
          type: props.type,
          disabled: props.disabled,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'aria-label': props.label,
          onMouseenter: handleMouseEnter,
          onMouseleave: handleMouseLeave,
          onFocusin: handleFocusIn,
          onFocusout: handleFocusOut,
          onClick: handleClick
        },
        [
          slots.default?.(),
          visible.value && !props.disabled
            ? h(
                'span',
                {
                  class: joinClasses('ncx-common-tooltip-panel', `ncx-common-tooltip-panel--${props.tooltipPlacement}`),
                  role: 'tooltip'
                },
                [h('span', { class: 'ncx-common-tooltip-content' }, props.label), h('span', { class: 'ncx-common-tooltip-arrow' })]
              )
            : null
        ]
      )
  }
})

/** 通用组件HeaderGroupItem：Header 成组按钮中的单个按钮项，内置悬停/聚焦样式化 Tooltip 气泡。 */
export const CommonHeaderGroupItem = defineComponent({
  name: '通用组件HeaderGroupItem',
  props: {
    /** 按钮功能说明与 Tooltip 气泡提示文案。 */
    label: { type: String, required: true },
    /** 视觉变体：default（默认）| close / danger（关闭/危险红色悬停）。 */
    variant: {
      type: String as PropType<'default' | 'close' | 'danger'>,
      default: 'default'
    },
    /** 是否禁用。 */
    disabled: Boolean,
    /** 气泡弹出位置：top | bottom | left | right，默认 bottom。 */
    tooltipPlacement: {
      type: String as PropType<'top' | 'bottom' | 'left' | 'right'>,
      default: 'bottom'
    }
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    /** 气泡显隐交互状态。 */
    const { visible, handleMouseEnter, handleMouseLeave, handleFocusIn, handleFocusOut } = useTooltipInteraction(
      () => props.disabled
    )

    /** 处理按钮点击。 */
    function handleClick(event: MouseEvent): void {
      if (guardDisabledClick(event, props.disabled)) return
      emit('click', event)
    }

    return () =>
      h(
        'button',
        {
          class: joinClasses(
            'ncx-common-header-group-item',
            'ncx-window-control',
            (props.variant === 'close' || props.variant === 'danger') && 'ncx-window-control--close'
          ),
          type: 'button',
          disabled: props.disabled,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'aria-label': props.label,
          onMouseenter: handleMouseEnter,
          onMouseleave: handleMouseLeave,
          onFocusin: handleFocusIn,
          onFocusout: handleFocusOut,
          onClick: handleClick
        },
        [
          slots.default?.(),
          visible.value && !props.disabled
            ? h(
                'span',
                {
                  class: joinClasses('ncx-common-tooltip-panel', `ncx-common-tooltip-panel--${props.tooltipPlacement}`),
                  role: 'tooltip'
                },
                [h('span', { class: 'ncx-common-tooltip-content' }, props.label), h('span', { class: 'ncx-common-tooltip-arrow' })]
              )
            : null
        ]
      )
  }
})

/** 展平 Vue Slot VNode 节点树（深度摊平 Fragment 包装与过滤注释节点）。 */
function flattenVNodes(vnodes: VNode[]): VNode[] {
  const result: VNode[] = []
  for (const node of vnodes) {
    if (node.type === Fragment && Array.isArray(node.children)) {
      result.push(...flattenVNodes(node.children as VNode[]))
    } else if (node.type !== Comment) {
      result.push(node)
    }
  }
  return result
}

/** 通用组件HeaderGroupButton：Header 成组按钮容器，内置成组包装、分割线与按钮项自动渲染。 */
export const CommonHeaderGroupButton = defineComponent({
  name: '通用组件HeaderGroupButton',
  props: {
    /** 组合按钮组的可读标识，传给 aria-label。 */
    label: { type: String, default: 'Header 按钮组' },
    /** 配置项列表（可选）。如果传入 items，将自动遍历渲染按钮项与分割线。 */
    items: {
      type: Array as PropType<HeaderGroupButtonItem[]>,
      default: undefined
    }
  },
  setup(props, { slots }) {
    return () => {
      // ========= 变量 =========
      let rawNodes: VNode[] = []

      // ========= 视图渲染逻辑 =========
      if (props.items && props.items.length > 0) {
        rawNodes = props.items.map((item, index) => {
          return h(
            CommonHeaderGroupItem,
            {
              key: item.key ?? item.label ?? index,
              label: item.label,
              ...(item.variant ? { variant: item.variant } : {}),
              ...(item.disabled ? { disabled: item.disabled } : {}),
              ...(item.tooltipPlacement ? { tooltipPlacement: item.tooltipPlacement } : {}),
              ...(item.onClick ? { onClick: item.onClick } : {})
            },
            () =>
              item.icon
                ? typeof item.icon === 'string'
                  ? item.icon
                  : h(item.icon, { size: 16 })
                : null
          )
        })
      } else {
        const slotDefault = slots.default?.()
        if (slotDefault) {
          rawNodes = flattenVNodes(slotDefault)
        }
      }

      // ========= 节点与分割线组装 =========
      const children: VNode[] = []
      rawNodes.forEach((node, index) => {
        if (index > 0) {
          children.push(h('span', { key: `divider-${index}`, class: 'ncx-window-divider' }))
        }
        children.push(node)
      })

      return h(
        'div',
        {
          class: joinClasses('ncx-common-header-group-button', 'ncx-window-controls'),
          role: 'group',
          'aria-label': props.label
        },
        children
      )
    }
  }
})

/** 别名导出 */
export const HeaderButton = CommonHeaderButton
export const HeaderGroupButton = CommonHeaderGroupButton
export const HeaderGroupItem = CommonHeaderGroupItem

/** 通用组件LinkButton：统一 macOS 链接型按钮。 */
export const CommonLinkButton = defineComponent({
  name: '通用组件LinkButton',
  props: {
    href: { type: String, default: '#' },
    disabled: Boolean,
    target: { type: String, default: undefined },
    rel: { type: String, default: undefined }
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    /** 处理链接按钮点击。 */
    function handleClick(event: MouseEvent): void {
      if (guardDisabledClick(event, props.disabled)) return
      emit('click', event)
    }

    return () =>
      h(
        'a',
        {
          class: joinClasses('ncx-common-link-button', props.disabled && 'ncx-common-link-button-disabled'),
          href: props.disabled ? undefined : props.href,
          target: props.target,
          rel: props.rel,
          'aria-disabled': props.disabled ? 'true' : undefined,
          onClick: handleClick
        },
        slots.default?.()
      )
  }
})

// ========= 输入组件 (macOS HIG / WWDC25 规范) =========

/** 通用组件Input：统一单行输入，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonInput = defineComponent({
  name: 'CommonInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' },
    type: { type: String, default: 'text' },
    clearable: { type: Boolean, default: false },
    prefix: { type: String, default: '' },
    suffix: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'change', 'input', 'clear', 'focus', 'blur'],
  setup(props, { emit, slots }) {
    const inputRef = ref<HTMLInputElement | null>(null)

    function handleInput(event: Event): void {
      const val = readInputValue(event)
      emit('update:modelValue', val)
      emit('input', val)
      emit('change', val)
    }

    function handleClear(): void {
      if (props.disabled || props.readonly) return
      emit('update:modelValue', '')
      emit('change', '')
      emit('input', '')
      emit('clear')
      inputRef.value?.focus()
    }

    function handleFocus(event: FocusEvent): void {
      emit('focus', event)
    }

    function handleBlur(event: FocusEvent): void {
      emit('blur', event)
    }

    return () => {
      const sizeClass = `ncx-common-field--${props.size || 'default'}`
      const hasPrefix = Boolean(slots.prefix || props.prefix)
      const hasSuffix = Boolean(slots.suffix || props.suffix || (props.clearable && props.modelValue))

      const inputElement = h('input', {
        ref: inputRef,
        class: joinClasses(
          'ncx-common-field',
          'ncx-common-input',
          sizeClass,
          props.invalid && 'ncx-common-field-invalid',
          props.disabled && 'ncx-common-field-disabled'
        ),
        type: props.type,
        value: props.modelValue,
        placeholder: props.placeholder,
        disabled: props.disabled,
        readonly: props.readonly,
        'aria-invalid': props.invalid ? 'true' : undefined,
        onInput: handleInput,
        onFocus: handleFocus,
        onBlur: handleBlur
      })

      if (!hasPrefix && !hasSuffix) {
        return inputElement
      }

      return h(
        'div',
        {
          class: joinClasses(
            'ncx-common-input-wrapper',
            sizeClass,
            props.invalid && 'ncx-common-field-invalid',
            props.disabled && 'ncx-common-field-disabled'
          )
        },
        [
          hasPrefix
            ? h('span', { class: 'ncx-common-input-prefix' }, slots.prefix ? slots.prefix() : props.prefix)
            : null,
          inputElement,
          props.clearable && props.modelValue && !props.disabled && !props.readonly
            ? h(
                'button',
                {
                  class: 'ncx-common-input-clear',
                  type: 'button',
                  'aria-label': '清空内容',
                  onClick: handleClear
                },
                [
                  h('svg', { viewBox: '0 0 16 16', fill: 'currentColor' }, [
                    h('path', {
                      d: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.707 9.293a1 1 0 0 1-1.414 1.414L8 9.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L6.586 8 5.293 6.707a1 1 0 0 1 1.414-1.414L8 6.586l1.293-1.293a1 1 0 0 1 1.414 1.414L9.414 8l1.293 1.293z'
                    })
                  ])
                ]
              )
            : null,
          slots.suffix || props.suffix
            ? h('span', { class: 'ncx-common-input-suffix' }, slots.suffix ? slots.suffix() : props.suffix)
            : null
        ]
      )
    }
  }
})

/** 通用组件Textarea：统一多行输入，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonTextarea = defineComponent({
  name: 'CommonTextarea',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    rows: { type: [Number, String], default: 4 },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' },
    resize: {
      type: String as PropType<'none' | 'vertical' | 'horizontal' | 'both'>,
      default: 'vertical'
    }
  },
  emits: ['update:modelValue', 'change', 'input', 'focus', 'blur'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      const val = readInputValue(event)
      emit('update:modelValue', val)
      emit('input', val)
      emit('change', val)
    }

    function handleFocus(event: FocusEvent): void {
      emit('focus', event)
    }

    function handleBlur(event: FocusEvent): void {
      emit('blur', event)
    }

    return () => {
      const sizeClass = `ncx-common-textarea--${props.size || 'default'}`

      return h('textarea', {
        class: joinClasses(
          'ncx-common-field',
          'ncx-common-textarea',
          sizeClass,
          props.invalid && 'ncx-common-field-invalid',
          props.disabled && 'ncx-common-field-disabled'
        ),
        style: { resize: props.resize },
        value: props.modelValue,
        placeholder: props.placeholder,
        rows: props.rows,
        disabled: props.disabled,
        readonly: props.readonly,
        'aria-invalid': props.invalid ? 'true' : undefined,
        onInput: handleInput,
        onFocus: handleFocus,
        onBlur: handleBlur
      })
    }
  }
})

/** 通用组件SearchInput：统一搜索输入，带清空交互，完全符合 macOS NSSearchField / WWDC25 规范。 */
export const CommonSearchInput = defineComponent({
  name: 'CommonSearchInput',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '搜索...' },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' },
    autoFocus: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'change', 'clear', 'search', 'focus', 'blur', 'input'],
  setup(props, { emit }) {
    const inputRef = ref<HTMLInputElement | null>(null)

    function handleInput(event: Event): void {
      const val = readInputValue(event)
      emit('update:modelValue', val)
      emit('input', val)
      emit('change', val)
    }

    function handleClear(): void {
      if (props.disabled) return
      emit('update:modelValue', '')
      emit('change', '')
      emit('input', '')
      emit('clear')
      nextTick(() => {
        inputRef.value?.focus()
      })
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        if (props.modelValue) {
          event.preventDefault()
          handleClear()
        }
      } else if (event.key === 'Enter') {
        event.preventDefault()
        emit('search', props.modelValue)
      }
    }

    function handleFocus(event: FocusEvent): void {
      emit('focus', event)
    }

    function handleBlur(event: FocusEvent): void {
      emit('blur', event)
    }

    return () => {
      const sizeClass = `ncx-common-search--${props.size || 'default'}`

      return h(
        'div',
        {
          class: joinClasses(
            'ncx-common-search',
            sizeClass,
            props.disabled && 'ncx-common-search--disabled'
          )
        },
        [
          h('span', { class: 'ncx-common-search-icon', 'aria-hidden': 'true' }, [
            h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor' }, [
              h('path', {
                d: 'M11.5 11.5L14 14M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z',
                'stroke-width': '1.8',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
              })
            ])
          ]),
          h('input', {
            ref: inputRef,
            class: 'ncx-common-search-input',
            value: props.modelValue,
            placeholder: props.placeholder,
            disabled: props.disabled,
            type: 'search',
            autofocus: props.autoFocus,
            onInput: handleInput,
            onKeydown: handleKeyDown,
            onFocus: handleFocus,
            onBlur: handleBlur
          }),
          props.modelValue && !props.disabled
            ? h(
                'button',
                {
                  class: 'ncx-common-search-clear',
                  type: 'button',
                  'aria-label': '清空搜索',
                  onClick: handleClear
                },
                [
                  h('svg', { viewBox: '0 0 16 16', fill: 'currentColor' }, [
                    h('path', {
                      d: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.707 9.293a1 1 0 0 1-1.414 1.414L8 9.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L6.586 8 5.293 6.707a1 1 0 0 1 1.414-1.414L8 6.586l1.293-1.293a1 1 0 0 1 1.414 1.414L9.414 8l1.293 1.293z'
                    })
                  ])
                ]
              )
            : null
        ]
      )
    }
  }
})

/** 通用组件Select：统一下拉选择，完全符合 macOS NSPopUpButton / WWDC25 浮层与勾选规范。 */
export const CommonSelect = defineComponent({
  name: 'CommonSelect',
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' }
  },
  emits: ['update:modelValue', 'change', 'focus', 'blur'],
  setup(props, { emit }) {
    const open = ref(false)
    const containerRef = ref<HTMLElement | null>(null)
    const panelStyle = ref<Record<string, string>>({})

    const currentOption = computed(() => {
      return props.options.find((opt) => String(opt.value) === String(props.modelValue))
    })

    const displayLabel = computed(() => {
      if (currentOption.value) {
        return currentOption.value.label
      }
      return props.placeholder || (props.options[0] ? props.options[0].label : '')
    })

    function updatePosition(): void {
      if (!containerRef.value) return
      const rect = containerRef.value.getBoundingClientRect()
      const optionCount = props.options.length + (props.placeholder ? 1 : 0)
      const menuHeight = Math.min(260, optionCount * 32 + 12)

      let top = rect.bottom + 4
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))

      if (top + menuHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuHeight - 4)
      }

      panelStyle.value = {
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${Math.round(rect.width)}px`,
        minWidth: '140px',
        zIndex: 'var(--ncx-layer-popover, 2000)'
      }
    }

    function toggleOpen(): void {
      if (props.disabled) return
      open.value = !open.value
      if (open.value) {
        nextTick(updatePosition)
      }
    }

    function closeMenu(): void {
      open.value = false
    }

    function selectValue(val: string | number): void {
      if (props.disabled) return
      emit('update:modelValue', val)
      emit('change', val)
      closeMenu()
    }

    function handleNativeChange(event: Event): void {
      const val = readInputValue(event)
      emit('update:modelValue', val)
      emit('change', val)
    }

    function handleGlobalClick(e: MouseEvent | PointerEvent): void {
      if (!open.value) return
      const target = e.target as Node
      if (containerRef.value?.contains(target)) return
      const panelEl = document.querySelector('.ncx-common-select-panel-teleport')
      if (panelEl?.contains(target)) return
      closeMenu()
    }

    onMounted(() => {
      window.addEventListener('pointerdown', handleGlobalClick)
      window.addEventListener('resize', closeMenu)
      window.addEventListener('scroll', closeMenu, true)
    })

    onUnmounted(() => {
      window.removeEventListener('pointerdown', handleGlobalClick)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    })

    return () => {
      const sizeClass = `ncx-common-select-wrapper--${props.size || 'default'}`
      const isPlaceholder = !currentOption.value && Boolean(props.placeholder)

      return h(
        'div',
        {
          ref: containerRef,
          class: joinClasses(
            'ncx-common-select-wrapper',
            sizeClass,
            open.value && 'ncx-common-select-wrapper--open',
            props.invalid && 'ncx-common-field-invalid',
            props.disabled && 'ncx-common-field-disabled'
          )
        },
        [
          h(
            'div',
            {
              class: joinClasses(
                'ncx-common-field',
                'ncx-common-select',
                `ncx-common-select--${props.size || 'default'}`,
                isPlaceholder && 'ncx-common-select--placeholder'
              ),
              tabindex: props.disabled ? -1 : 0,
              onClick: toggleOpen,
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  toggleOpen()
                } else if (e.key === 'Escape') {
                  closeMenu()
                }
              }
            },
            [
              h('span', { class: 'ncx-common-select-label' }, displayLabel.value),
              h('span', { class: 'ncx-common-select-chevron', 'aria-hidden': 'true' }, [
                h('svg', { viewBox: '0 0 16 16', fill: 'currentColor' }, [
                  h('path', {
                    d: 'M4.5 5.5L8 2L11.5 5.5M4.5 10.5L8 14L11.5 10.5',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                    fill: 'none'
                  })
                ])
              ])
            ]
          ),
          h(
            'select',
            {
              class: 'ncx-common-select-native-hidden',
              value: props.modelValue,
              disabled: props.disabled,
              'aria-hidden': 'true',
              tabindex: -1,
              onChange: handleNativeChange
            },
            [
              props.placeholder
                ? h('option', { value: '', disabled: true }, props.placeholder)
                : null,
              ...props.options.map((option) =>
                h('option', { value: option.value, disabled: option.disabled }, option.label)
              )
            ]
          ),
          open.value
            ? h(
                Teleport,
                { to: 'body' },
                h(
                  'div',
                  {
                    class: 'ncx-common-select-panel-teleport',
                    style: panelStyle.value
                  },
                  [
                    props.placeholder
                      ? h(
                          'div',
                          { class: 'ncx-common-select-option ncx-common-select-option--placeholder' },
                          props.placeholder
                        )
                      : null,
                    ...props.options.map((option) => {
                      const isSelected = String(option.value) === String(props.modelValue)
                      return h(
                        'button',
                        {
                          key: String(option.value),
                          type: 'button',
                          class: joinClasses(
                            'ncx-common-select-option',
                            isSelected && 'ncx-common-select-option--selected',
                            option.disabled && 'ncx-common-select-option--disabled'
                          ),
                          disabled: option.disabled,
                          onClick: (e: MouseEvent) => {
                            e.stopPropagation()
                            selectValue(option.value)
                          }
                        },
                        [
                          h('span', { class: 'ncx-common-select-option-text' }, option.label),
                          isSelected
                            ? h(
                                'span',
                                { class: 'ncx-common-select-option-check', 'aria-hidden': 'true' },
                                [
                                  h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor' }, [
                                    h('path', {
                                      d: 'M3.5 8.5L6.5 11.5L12.5 4.5',
                                      'stroke-width': '2.2',
                                      'stroke-linecap': 'round',
                                      'stroke-linejoin': 'round'
                                    })
                                  ])
                                ]
                              )
                            : null
                        ]
                      )
                    })
                  ]
                )
              )
            : null
        ]
      )
    }
  }
})

/** 通用组件Combobox：统一可输入选择，基于 datalist 配合 Teleport 悬浮圆角浮层，完全符合 macOS NSComboBox / WWDC25 规范。 */
export const CommonCombobox = defineComponent({
  name: 'CommonCombobox',
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' },
    clearable: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'change', 'input', 'clear', 'focus', 'blur'],
  setup(props, { emit }) {
    const listId = `ncx-combobox-${Math.random().toString(36).slice(2)}`
    const inputRef = ref<HTMLInputElement | null>(null)
    const containerRef = ref<HTMLElement | null>(null)
    const open = ref(false)
    const panelStyle = ref<Record<string, string>>({})

    const filteredOptions = computed(() => {
      if (!props.modelValue) return props.options
      const query = String(props.modelValue).toLowerCase().trim()
      return props.options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(query) ||
          String(opt.value).toLowerCase().includes(query)
      )
    })

    function updatePosition(): void {
      if (!containerRef.value) return
      const rect = containerRef.value.getBoundingClientRect()
      const optionCount = filteredOptions.value.length
      if (optionCount === 0) {
        open.value = false
        return
      }
      const menuHeight = Math.min(240, optionCount * 32 + 12)

      let top = rect.bottom + 4
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))

      if (top + menuHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuHeight - 4)
      }

      panelStyle.value = {
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${Math.round(rect.width)}px`,
        minWidth: '140px',
        zIndex: 'var(--ncx-layer-popover, 2000)'
      }
    }

    function openMenu(): void {
      if (props.disabled || props.readonly) return
      if (filteredOptions.value.length > 0) {
        open.value = true
        nextTick(updatePosition)
      }
    }

    function closeMenu(): void {
      open.value = false
    }

    function toggleMenu(): void {
      if (props.disabled || props.readonly) return
      if (open.value) {
        closeMenu()
      } else {
        openMenu()
      }
    }

    function handleInput(event: Event): void {
      const val = readInputValue(event)
      emit('update:modelValue', val)
      emit('input', val)
      emit('change', val)
      openMenu()
    }

    function handleSelectOption(option: CommonOption): void {
      if (props.disabled || props.readonly || option.disabled) return
      emit('update:modelValue', option.value)
      emit('change', option.value)
      emit('input', option.value)
      closeMenu()
    }

    function handleClear(): void {
      if (props.disabled || props.readonly) return
      emit('update:modelValue', '')
      emit('change', '')
      emit('input', '')
      emit('clear')
      closeMenu()
      nextTick(() => {
        inputRef.value?.focus()
      })
    }

    function handleFocus(event: FocusEvent): void {
      emit('focus', event)
      openMenu()
    }

    function handleBlur(event: FocusEvent): void {
      emit('blur', event)
    }

    function handleGlobalClick(e: MouseEvent | PointerEvent): void {
      if (!open.value) return
      const target = e.target as Node
      if (containerRef.value?.contains(target)) return
      const panelEl = document.querySelector('.ncx-common-combobox-panel-teleport')
      if (panelEl?.contains(target)) return
      closeMenu()
    }

    onMounted(() => {
      window.addEventListener('pointerdown', handleGlobalClick)
      window.addEventListener('resize', closeMenu)
      window.addEventListener('scroll', closeMenu, true)
    })

    onUnmounted(() => {
      window.removeEventListener('pointerdown', handleGlobalClick)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    })

    return () => {
      const sizeClass = `ncx-common-combobox--${props.size || 'default'}`

      return h(
        'div',
        {
          ref: containerRef,
          class: joinClasses(
            'ncx-common-combobox',
            sizeClass,
            open.value && 'ncx-common-combobox--open',
            props.invalid && 'ncx-common-field-invalid',
            props.disabled && 'ncx-common-field-disabled'
          )
        },
        [
          h('input', {
            ref: inputRef,
            class: joinClasses(
              'ncx-common-field',
              'ncx-common-combobox-input',
              `ncx-common-field--${props.size || 'default'}`
            ),
            value: props.modelValue,
            list: listId,
            placeholder: props.placeholder,
            disabled: props.disabled,
            readonly: props.readonly,
            autocomplete: 'off',
            'aria-invalid': props.invalid ? 'true' : undefined,
            onInput: handleInput,
            onFocus: handleFocus,
            onBlur: handleBlur
          }),
          props.clearable && props.modelValue && !props.disabled && !props.readonly
            ? h(
                'button',
                {
                  class: 'ncx-common-combobox-clear',
                  type: 'button',
                  'aria-label': '清空选择',
                  onClick: handleClear
                },
                [
                  h('svg', { viewBox: '0 0 16 16', fill: 'currentColor' }, [
                    h('path', {
                      d: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.707 9.293a1 1 0 0 1-1.414 1.414L8 9.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L6.586 8 5.293 6.707a1 1 0 0 1 1.414-1.414L8 6.586l1.293-1.293a1 1 0 0 1 1.414 1.414L9.414 8l1.293 1.293z'
                    })
                  ])
                ]
              )
            : null,
          h(
            'button',
            {
              class: 'ncx-common-combobox-trigger',
              type: 'button',
              tabindex: -1,
              disabled: props.disabled,
              'aria-label': '展开列表选项',
              onClick: toggleMenu
            },
            [
              h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor' }, [
                h('path', {
                  d: 'M4 6L8 10L12 6',
                  'stroke-width': '1.8',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round'
                })
              ])
            ]
          ),
          h(
            'datalist',
            { id: listId },
            props.options.map((option) => h('option', { value: option.value }, option.label))
          ),
          open.value && filteredOptions.value.length > 0
            ? h(
                Teleport,
                { to: 'body' },
                h(
                  'div',
                  {
                    class: 'ncx-common-combobox-panel-teleport',
                    style: panelStyle.value
                  },
                  filteredOptions.value.map((option) => {
                    const isSelected = String(option.value) === String(props.modelValue)
                    return h(
                      'button',
                      {
                        key: String(option.value),
                        type: 'button',
                        class: joinClasses(
                          'ncx-common-combobox-option',
                          isSelected && 'ncx-common-combobox-option--selected',
                          option.disabled && 'ncx-common-combobox-option--disabled'
                        ),
                        disabled: option.disabled,
                        onClick: (e: MouseEvent) => {
                          e.stopPropagation()
                          handleSelectOption(option)
                        }
                      },
                      [
                        h('span', { class: 'ncx-common-combobox-option-text' }, option.label),
                        isSelected
                          ? h(
                              'span',
                              { class: 'ncx-common-combobox-option-check', 'aria-hidden': 'true' },
                              [
                                h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor' }, [
                                  h('path', {
                                    d: 'M3.5 8.5L6.5 11.5L12.5 4.5',
                                    'stroke-width': '2.2',
                                    'stroke-linecap': 'round',
                                    'stroke-linejoin': 'round'
                                  })
                                ])
                              ]
                            )
                          : null
                      ]
                    )
                  })
                )
              )
            : null
        ]
      )
    }
  }
})

// ========= 选择组件 =========

/** 通用组件Checkbox：统一复选框，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonCheckbox = defineComponent({
  name: 'CommonCheckbox',
  props: {
    modelValue: { type: Boolean, default: false },
    indeterminate: { type: Boolean, default: false },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    function handleChange(event: Event): void {
      if (props.disabled) return
      const target = event.target as HTMLInputElement
      emit('update:modelValue', target.checked)
      emit('change', target.checked)
    }

    return () => {
      const isChecked = props.modelValue
      const isIndeterminate = props.indeterminate && !isChecked
      const stateClass = isChecked
        ? 'ncx-common-check--checked'
        : isIndeterminate
          ? 'ncx-common-check--indeterminate'
          : ''
      const sizeClass = `ncx-common-check--${props.size || 'default'}`
      const disabledClass = props.disabled ? 'ncx-common-check--disabled' : ''

      const labelNode = slots.default ? slots.default() : props.label ? props.label : null

      return h('label', { class: joinClasses('ncx-common-check', stateClass, sizeClass, disabledClass) }, [
        h('input', {
          checked: isChecked,
          disabled: props.disabled,
          type: 'checkbox',
          class: 'ncx-common-check-input',
          onChange: handleChange
        }),
        h('span', { class: 'ncx-common-check-box', 'aria-hidden': 'true' }, [
          isChecked
            ? h('svg', { class: 'ncx-common-check-icon', viewBox: '0 0 16 16', fill: 'none' }, [
                h('path', {
                  d: 'M3.5 8.5L6.5 11.5L12.5 4.5',
                  stroke: 'currentColor',
                  'stroke-width': '2.2',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round'
                })
              ])
            : isIndeterminate
              ? h('svg', { class: 'ncx-common-check-icon', viewBox: '0 0 16 16', fill: 'none' }, [
                  h('path', {
                    d: 'M4 8H12',
                    stroke: 'currentColor',
                    'stroke-width': '2.2',
                    'stroke-linecap': 'round'
                  })
                ])
              : null
        ]),
        labelNode ? h('span', { class: 'ncx-common-check-label' }, labelNode) : null
      ])
    }
  }
})

/** 通用组件RadioGroup：统一单选组，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonRadioGroup = defineComponent({
  name: 'CommonRadioGroup',
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] },
    name: { type: String, default: 'ncx-radio-group' },
    disabled: { type: Boolean, default: false },
    direction: { type: String as PropType<'horizontal' | 'vertical'>, default: 'horizontal' },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    function selectOption(option: CommonOption): void {
      if (props.disabled || option.disabled) return
      emit('update:modelValue', option.value)
      emit('change', option.value)
    }

    return () => {
      const directionClass = `ncx-common-radio-group--${props.direction || 'horizontal'}`
      const sizeClass = `ncx-common-radio-group--${props.size || 'default'}`

      return h(
        'div',
        { class: joinClasses('ncx-common-radio-group', directionClass, sizeClass), role: 'radiogroup' },
        props.options.map((option) => {
          const isSelected = props.modelValue === option.value
          const isDisabled = props.disabled || option.disabled
          const radioClass = joinClasses(
            'ncx-common-radio',
            isSelected && 'ncx-common-radio--selected',
            isDisabled && 'ncx-common-radio--disabled',
            `ncx-common-radio--${props.size || 'default'}`
          )

          return h('label', { class: radioClass, key: String(option.value) }, [
            h('input', {
              checked: isSelected,
              disabled: isDisabled,
              name: props.name,
              type: 'radio',
              value: option.value,
              class: 'ncx-common-radio-input',
              onChange: () => selectOption(option)
            }),
            h('span', { class: 'ncx-common-radio-circle', 'aria-hidden': 'true' }, [
              h('span', { class: 'ncx-common-radio-dot' })
            ]),
            h('span', { class: 'ncx-common-radio-label' }, option.label)
          ])
        })
      )
    }
  }
})

/** 通用组件Switch：统一开关，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonSwitch = defineComponent({
  name: 'CommonSwitch',
  props: {
    modelValue: { type: Boolean, default: false },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    function toggleSwitch(): void {
      if (props.disabled) return
      const newValue = !props.modelValue
      emit('update:modelValue', newValue)
      emit('change', newValue)
    }

    return () => {
      const isOn = props.modelValue
      const switchClass = joinClasses(
        'ncx-common-switch',
        isOn && 'ncx-common-switch--on',
        props.disabled && 'ncx-common-switch--disabled',
        `ncx-common-switch--${props.size || 'default'}`
      )

      const labelNode = slots.default ? slots.default() : props.label ? props.label : null

      return h(
        'button',
        {
          class: switchClass,
          type: 'button',
          role: 'switch',
          disabled: props.disabled,
          'aria-checked': isOn ? 'true' : 'false',
          'aria-label': props.label || undefined,
          onClick: toggleSwitch
        },
        [
          h('span', { class: 'ncx-common-switch-track' }, [
            h('span', { class: 'ncx-common-switch-knob' })
          ]),
          labelNode ? h('strong', { class: 'ncx-common-switch-label' }, labelNode) : null
        ]
      )
    }
  }
})

/** 通用组件Slider：统一滑块，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonSlider = defineComponent({
  name: 'CommonSlider',
  props: {
    modelValue: { type: Number, default: 50 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    step: { type: Number, default: 1 },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    showValue: { type: Boolean, default: true },
    formatValue: { type: Function as PropType<(val: number) => string>, default: null },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      if (props.disabled) return
      const val = Number(readInputValue(event))
      emit('update:modelValue', val)
    }

    function handleChange(event: Event): void {
      if (props.disabled) return
      const val = Number(readInputValue(event))
      emit('change', val)
    }

    return () => {
      const minVal = props.min
      const maxVal = props.max
      const currentVal = Math.min(Math.max(props.modelValue, minVal), maxVal)
      const range = maxVal - minVal || 1
      const percent = Math.min(Math.max(((currentVal - minVal) / range) * 100, 0), 100)

      const sliderClass = joinClasses(
        'ncx-common-slider',
        props.disabled && 'ncx-common-slider--disabled',
        `ncx-common-slider--${props.size || 'default'}`
      )

      const displayVal = props.formatValue ? props.formatValue(currentVal) : `${currentVal}`

      return h('div', { class: sliderClass }, [
        props.label ? h('span', { class: 'ncx-common-slider-label' }, props.label) : null,
        h('div', { class: 'ncx-common-slider-track-container' }, [
          h('div', { class: 'ncx-common-slider-rail' }),
          h('div', { class: 'ncx-common-slider-fill', style: { width: `${percent}%` } }),
          h('div', { class: 'ncx-common-slider-thumb', style: { left: `${percent}%` } }),
          h('input', {
            value: currentVal,
            min: minVal,
            max: maxVal,
            step: props.step,
            disabled: props.disabled,
            type: 'range',
            class: 'ncx-common-slider-input',
            'aria-label': props.label || 'Slider',
            'aria-valuenow': currentVal,
            'aria-valuemin': minVal,
            'aria-valuemax': maxVal,
            onInput: handleInput,
            onChange: handleChange
          })
        ]),
        props.showValue ? h('b', { class: 'ncx-common-slider-value' }, displayVal) : null
      ])
    }
  }
})

/** 通用组件SegmentedControl：统一分段控制器，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonSegmentedControl = defineComponent({
  name: 'CommonSegmentedControl',
  props: {
    modelValue: { type: [String, Number], default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<CommonComponentSize>, default: 'default' }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    function selectOption(option: CommonOption): void {
      if (props.disabled || option.disabled) return
      emit('update:modelValue', option.value)
      emit('change', option.value)
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (props.disabled || !props.options.length) return
      const activeIndex = props.options.findIndex((opt) => opt.value === props.modelValue)
      let nextIndex = activeIndex

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        nextIndex = (activeIndex + 1) % props.options.length
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        nextIndex = (activeIndex - 1 + props.options.length) % props.options.length
      }

      const targetOpt = props.options[nextIndex]
      if (nextIndex !== activeIndex && targetOpt && !targetOpt.disabled) {
        selectOption(targetOpt)
      }
    }

    return () => {
      const activeIndex = props.options.findIndex((opt) => opt.value === props.modelValue)
      const count = props.options.length || 1
      const countStyle = { '--ncx-segmented-count': String(count) }
      const indicatorStyle =
        activeIndex >= 0
          ? {
              left: `calc(100% / ${count} * ${activeIndex})`,
              width: `calc(100% / ${count})`
            }
          : { display: 'none' }

      const containerClass = joinClasses(
        'ncx-common-segmented',
        props.disabled && 'ncx-common-segmented--disabled',
        `ncx-common-segmented--${props.size || 'default'}`
      )

      return h(
        'div',
        {
          class: containerClass,
          role: 'tablist',
          tabindex: props.disabled ? -1 : 0,
          style: countStyle,
          onKeydown: handleKeyDown
        },
        [
          activeIndex >= 0
            ? h('div', { class: 'ncx-common-segmented-indicator', style: indicatorStyle })
            : null,
          ...props.options.map((option, index) => {
            const isActive = props.modelValue === option.value
            const isDisabled = props.disabled || option.disabled
            const showRightDivider =
              index < count - 1 && index !== activeIndex && index + 1 !== activeIndex

            return h(
              'button',
              {
                class: joinClasses(
                  'ncx-common-segmented-item',
                  isActive && 'ncx-common-segmented-item-active',
                  isDisabled && 'ncx-common-segmented-item-disabled'
                ),
                type: 'button',
                role: 'tab',
                tabindex: -1,
                disabled: isDisabled,
                'aria-selected': isActive ? 'true' : 'false',
                key: String(option.value),
                onClick: () => selectOption(option)
              },
              [
                h('span', { class: 'ncx-common-segmented-item-text' }, option.label),
                showRightDivider ? h('span', { class: 'ncx-common-segmented-divider' }) : null
              ]
            )
          })
        ]
      )
    }
  }
})

// ========= 展示组件 =========

/** 通用组件Avatar：统一头像，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonAvatar = defineComponent({
  name: 'CommonAvatar',
  props: {
    /** 名称（用于 title、alt 以及兜底首字提取）。 */
    name: { type: String, required: true },
    /** 头像图片地址。 */
    src: { type: String, default: '' },
    /** 头像尺寸：compact (28px)、default (36px)、prominent (48px) 或自定义数值。 */
    size: { type: [String, Number] as PropType<CommonComponentSize | number>, default: 'default' },
    /** 头像形状：circle (圆形) 或 square (macOS 平滑圆角矩形)。 */
    shape: { type: String as PropType<'circle' | 'square'>, default: 'circle' },
    /** 在线/忙碌状态指示点：online | offline | busy | away | ''。 */
    status: { type: String as PropType<'online' | 'offline' | 'busy' | 'away' | ''>, default: '' }
  },
  setup(props) {
    /** 图片加载异常状态。 */
    const imageError = ref(false)

    /** 提取兜底 1-2 位首字母。 */
    const fallback = computed(() => {
      if (!props.name) return '?'
      const trimmed = props.name.trim()
      const parts = trimmed.split(/\s+/)
      const first = parts[0]
      const second = parts[1]
      if (parts.length >= 2 && first && second && first[0] && second[0]) {
        return (first[0] + second[0]).toUpperCase()
      }
      return trimmed.slice(0, 2).toUpperCase()
    })

    /** 处理图片加载错误。 */
    function handleImageError(): void {
      imageError.value = true
    }

    return () => {
      const showImage = Boolean(props.src) && !imageError.value
      const sizeClass = typeof props.size === 'string' ? `ncx-common-avatar--${props.size}` : ''
      const shapeClass = `ncx-common-avatar--${props.shape}`
      const avatarClass = joinClasses(
        'ncx-common-avatar',
        sizeClass,
        shapeClass,
        props.status && 'ncx-common-avatar--has-status'
      )

      const customStyle =
        typeof props.size === 'number'
          ? { width: `${props.size}px`, height: `${props.size}px`, fontSize: `${Math.max(10, Math.round(props.size * 0.38))}px` }
          : undefined

      return h(
        'span',
        {
          class: avatarClass,
          style: customStyle,
          title: props.name,
          role: 'img',
          'aria-label': props.name
        },
        [
          showImage
            ? h('img', { src: props.src, alt: props.name, onError: handleImageError })
            : h('span', { class: 'ncx-common-avatar-fallback' }, fallback.value),
          props.status
            ? h('span', {
                class: `ncx-common-avatar-status ncx-common-avatar-status--${props.status}`,
                'aria-label': `Status: ${props.status}`
              })
            : null
        ]
      )
    }
  }
})

/** 通用组件Badge：统一徽标，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonBadge = defineComponent({
  name: 'CommonBadge',
  props: {
    /** 徽标类型：info | success | warning | danger | neutral */
    type: { type: String as PropType<CommonMessageType | 'neutral'>, default: 'info' },
    /** 视觉变体：subtle (macOS HIG 毛玻璃/微调) | solid (鲜艳通知高亮) | dot (状态小圆点) */
    variant: { type: String as PropType<'subtle' | 'solid' | 'dot'>, default: 'subtle' },
    /** 数字/文本数值。 */
    count: { type: [Number, String], default: undefined },
    /** 数字最大上限，超过显示 max+ (如 99+)。 */
    max: { type: Number, default: 99 },
    /** 是否只显示状态小点。 */
    dot: { type: Boolean, default: false },
    /** 尺寸：compact | default */
    size: { type: String as PropType<'compact' | 'default'>, default: 'default' }
  },
  setup(props, { slots }) {
    /** 计算显示的数值字符串。 */
    const displayValue = computed(() => {
      if (props.dot || props.variant === 'dot') return ''
      if (typeof props.count === 'number') {
        return props.count > props.max ? `${props.max}+` : `${props.count}`
      }
      if (props.count !== undefined && props.count !== null) {
        return String(props.count)
      }
      return ''
    })

    return () => {
      const isDot = props.dot || props.variant === 'dot'
      const badgeClass = joinClasses(
        'ncx-common-badge',
        `ncx-common-badge-${props.type}`,
        `ncx-common-badge--${props.variant}`,
        `ncx-common-badge--${props.size}`,
        isDot && 'ncx-common-badge--dot'
      )

      const hasDefaultSlot = Boolean(slots.default)

      // 如果有 default slot，且显式指定了 count/dot/variant=dot，则作为挂载至子元素右上角的浮动徽标
      if (hasDefaultSlot && (props.count !== undefined || props.dot || props.variant === 'dot')) {
        const floatingBadgeClass = joinClasses(badgeClass, 'ncx-common-badge--floating')
        return h('span', { class: 'ncx-common-badge-wrapper' }, [
          slots.default?.(),
          h('span', { class: floatingBadgeClass }, [isDot ? null : displayValue.value])
        ])
      }

      return h('span', { class: badgeClass }, [
        isDot ? null : (displayValue.value || slots.default?.())
      ])
    }
  }
})

/** 通用组件Tag：统一标签，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonTag = defineComponent({
  name: 'CommonTag',
  props: {
    /** 是否为选中状态。 */
    selected: { type: Boolean, default: false },
    /** 是否可关闭。 */
    closable: { type: Boolean, default: false },
    /** 是否禁用。 */
    disabled: { type: Boolean, default: false },
    /** 尺寸：compact | default | prominent */
    size: { type: String as PropType<CommonComponentSize>, default: 'default' },
    /** 视觉样式变体：subtle | solid | outline */
    variant: { type: String as PropType<'subtle' | 'solid' | 'outline'>, default: 'subtle' },
    /** macOS Finder 预设颜色分类：accent | blue | green | orange | purple | red | gray */
    color: {
      type: String as PropType<'accent' | 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'gray' | ''>,
      default: ''
    }
  },
  emits: ['click', 'close', 'update:selected'],
  setup(props, { emit, slots }) {
    /** 点击标签逻辑。 */
    function handleClick(event: MouseEvent): void {
      if (props.disabled) return
      emit('click', event)
      emit('update:selected', !props.selected)
    }

    /** 点击关闭按钮逻辑。 */
    function handleClose(event: MouseEvent): void {
      if (props.disabled) return
      event.stopPropagation()
      emit('close', event)
    }

    return () => {
      const tagClass = joinClasses(
        'ncx-common-tag',
        `ncx-common-tag--${props.size}`,
        `ncx-common-tag--${props.variant}`,
        props.selected && 'ncx-common-tag-selected',
        props.selected && 'ncx-common-tag--selected',
        props.disabled && 'ncx-common-tag--disabled',
        props.color && `ncx-common-tag--${props.color}`
      )

      return h(
        'span',
        {
          class: tagClass,
          tabindex: props.disabled ? undefined : 0,
          role: 'button',
          'aria-pressed': props.selected ? 'true' : 'false',
          'aria-disabled': props.disabled ? 'true' : undefined,
          onClick: handleClick
        },
        [
          h('span', { class: 'ncx-common-tag-text' }, slots.default?.()),
          props.closable
            ? h(
                'button',
                {
                  class: 'ncx-common-tag-close',
                  type: 'button',
                  'aria-label': 'Close tag',
                  onClick: handleClose
                },
                '×'
              )
            : null
        ]
      )
    }
  }
})

/** 通用组件Card：统一卡片容器，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonCard = defineComponent({
  name: 'CommonCard',
  props: {
    /** 是否可交互（具有悬浮提升与点击反馈）。 */
    interactive: { type: Boolean, default: false },
    /** 是否选中态（突出高亮边框）。 */
    selected: { type: Boolean, default: false },
    /** 视觉样式变体：default (标准) | flat (扁平) | elevated (高阴影) | glass (毛玻璃) */
    variant: { type: String as PropType<'default' | 'flat' | 'elevated' | 'glass'>, default: 'default' },
    /** 内边距大小：none | compact | default | prominent */
    padding: { type: String as PropType<'none' | 'compact' | 'default' | 'prominent'>, default: 'default' },
    /** 卡片标题（也可使用 #header 插槽）。 */
    title: { type: String, default: '' }
  },
  setup(props, { slots }) {
    return () => {
      const cardClass = joinClasses(
        'ncx-common-card',
        `ncx-common-card--${props.variant}`,
        `ncx-common-card--padding-${props.padding}`,
        props.interactive && 'ncx-common-card-interactive',
        props.interactive && 'ncx-common-card--interactive',
        props.selected && 'ncx-common-card--selected'
      )

      const hasHeader = Boolean(props.title || slots.header || slots.extra)
      const hasFooter = Boolean(slots.footer)

      return h('section', { class: cardClass, tabindex: props.interactive ? 0 : undefined }, [
        hasHeader
          ? h('div', { class: 'ncx-common-card-header' }, [
              h('div', { class: 'ncx-common-card-title' }, slots.header ? slots.header() : props.title),
              slots.extra ? h('div', { class: 'ncx-common-card-extra' }, slots.extra()) : null
            ])
          : null,
        h('div', { class: 'ncx-common-card-body' }, slots.default?.()),
        hasFooter ? h('div', { class: 'ncx-common-card-footer' }, slots.footer?.()) : null
      ])
    }
  }
})

/** 通用组件Separator：统一分隔线，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonSeparator = defineComponent({
  name: 'CommonSeparator',
  props: {
    /** 是否为垂直分隔线。 */
    vertical: { type: Boolean, default: false },
    /** 缩进风格：false | true | start | both */
    inset: { type: [Boolean, String] as PropType<boolean | 'start' | 'both'>, default: false },
    /** 文本标签（用于水平分段文字分隔）。 */
    label: { type: String, default: '' },
    /** 边距间距：none | compact | default | prominent */
    spacing: { type: String as PropType<'none' | 'compact' | 'default' | 'prominent'>, default: 'default' }
  },
  setup(props, { slots }) {
    return () => {
      const isVertical = props.vertical
      const insetMode = typeof props.inset === 'string' ? props.inset : props.inset ? 'start' : ''
      const hasLabel = !isVertical && Boolean(props.label || slots.default)

      const sepClass = joinClasses(
        'ncx-common-separator',
        isVertical ? 'ncx-common-separator-vertical' : 'ncx-common-separator-horizontal',
        isVertical ? 'ncx-common-separator--vertical' : 'ncx-common-separator--horizontal',
        insetMode && `ncx-common-separator--inset-${insetMode}`,
        `ncx-common-separator--spacing-${props.spacing}`,
        hasLabel && 'ncx-common-separator--has-label'
      )

      if (hasLabel) {
        return h('div', { class: sepClass, role: 'separator', 'aria-orientation': 'horizontal' }, [
          h('span', { class: 'ncx-common-separator-line' }),
          h('span', { class: 'ncx-common-separator-label' }, slots.default ? slots.default() : props.label),
          h('span', { class: 'ncx-common-separator-line' })
        ])
      }

      return h('span', {
        class: sepClass,
        role: 'separator',
        'aria-orientation': isVertical ? 'vertical' : 'horizontal'
      })
    }
  }
})

/** 通用组件Tooltip：统一提示说明，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonTooltip = defineComponent({
  name: 'CommonTooltip',
  props: {
    /** 提示文案（也可使用 #content 插槽）。 */
    text: { type: String, default: '' },
    /** 弹出位置：top | bottom | left | right */
    placement: { type: String as PropType<'top' | 'bottom' | 'left' | 'right'>, default: 'top' },
    /** 延迟显示时间 (毫秒)。 */
    delay: { type: Number, default: 1_500 },
    /** 是否禁用提示。 */
    disabled: { type: Boolean, default: false }
  },
  setup(props, { slots }) {
    /** 气泡显隐交互状态。 */
    const { visible, handleMouseEnter, handleMouseLeave, handleFocusIn, handleFocusOut } = useTooltipInteraction(
      () => props.disabled,
      props.delay
    )

    return () => {
      const textContent = props.text || ''
      const panelClass = joinClasses(
        'ncx-common-tooltip-panel',
        `ncx-common-tooltip-panel--${props.placement}`
      )

      return h(
        'span',
        {
          class: 'ncx-common-tooltip',
          'data-tooltip': textContent,
          tabindex: 0,
          onMouseenter: handleMouseEnter,
          onMouseleave: handleMouseLeave,
          onFocusin: handleFocusIn,
          onFocusout: handleFocusOut
        },
        [
          slots.default?.(),
          visible.value && !props.disabled
            ? h('span', { class: panelClass, role: 'tooltip' }, [
                h('span', { class: 'ncx-common-tooltip-content' }, slots.content ? slots.content() : textContent),
                h('span', { class: 'ncx-common-tooltip-arrow' })
              ])
            : null
        ]
      )
    }
  }
})

// ========= 导航组件 =========

/** 通用组件Tabs：统一标签页，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonTabs = defineComponent({
  name: 'CommonTabs',
  props: {
    /** 当前激活项的值。 */
    modelValue: { type: String, default: '' },
    /** 选项数组。 */
    options: { type: Array as PropType<CommonOption[]>, default: () => [] },
    /** 标签页风格变体：segmented (macOS 标准胶囊分段) | underlined (顶部下划线) | pills (独立胶囊) */
    variant: { type: String as PropType<CommonTabsVariant>, default: 'segmented' },
    /** 尺寸：compact | default | prominent */
    size: sizeProp,
    /** 是否拉伸充满容器宽度。 */
    fullWidth: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    function selectTab(option: CommonOption): void {
      if (option.disabled) return
      emit('update:modelValue', option.value)
      emit('change', option.value)
    }

    return () =>
      h(
        'div',
        {
          class: joinClasses(
            'ncx-common-tabs',
            `ncx-common-tabs-${props.variant}`,
            `ncx-common-tabs-${props.size}`,
            props.fullWidth && 'ncx-common-tabs-full-width'
          )
        },
        [
          h(
            'div',
            { class: 'ncx-common-tabs-list', role: 'tablist' },
            props.options.map((option) => {
              const active = props.modelValue === option.value
              return h(
                'button',
                {
                  key: option.value,
                  class: joinClasses(
                    'ncx-common-tabs-tab',
                    active && 'ncx-common-tabs-tab-active',
                    option.disabled && 'ncx-common-tabs-tab-disabled'
                  ),
                  type: 'button',
                  role: 'tab',
                  disabled: option.disabled,
                  'aria-selected': active ? 'true' : 'false',
                  onClick: () => selectTab(option)
                },
                slots.tab
                  ? slots.tab({ option, active })
                  : [
                      option.icon ? h('span', { class: 'ncx-common-tabs-tab-icon' }, option.icon) : null,
                      h('span', { class: 'ncx-common-tabs-tab-label' }, option.label),
                      option.badge !== undefined
                        ? h('span', { class: 'ncx-common-tabs-tab-badge' }, String(option.badge))
                        : null
                    ]
              )
            })
          ),
          slots.default
            ? h('div', { class: 'ncx-common-tabs-panel', role: 'tabpanel' }, slots.default())
            : null
        ]
      )
  }
})

/** 通用组件DropdownMenu：统一下拉菜单，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonDropdownMenu = defineComponent({
  name: 'CommonDropdownMenu',
  props: {
    /** 默认触发按钮文案。 */
    label: { type: String, default: '打开菜单' },
    /** 菜单项列表。 */
    items: { type: Array as PropType<CommonMenuItem[]>, default: () => [] },
    /** 是否禁用。 */
    disabled: { type: Boolean, default: false },
    /** 弹出方位：bottom-start | bottom-end | top-start | top-end */
    placement: {
      type: String as PropType<'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'>,
      default: 'bottom-start'
    }
  },
  emits: ['select', 'open-change'],
  setup(props, { emit, slots }) {
    const open = ref(false)
    const triggerRef = ref<HTMLElement | null>(null)
    const panelStyle = ref<Record<string, string>>({})

    function updatePosition(): void {
      if (!triggerRef.value) return
      const rect = triggerRef.value.getBoundingClientRect()
      const menuWidth = 200
      const menuHeight = Math.min(340, props.items.length * 32 + 16)

      let top = rect.bottom + 4
      let left = rect.left

      if (props.placement.startsWith('top') || top + menuHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuHeight - 4)
      }

      if (props.placement.endsWith('end')) {
        left = rect.right - menuWidth
      }

      if (left + menuWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - menuWidth - 8)
      }
      if (left < 8) left = 8

      panelStyle.value = {
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        minWidth: `${Math.max(160, Math.round(rect.width))}px`,
        zIndex: 'var(--ncx-layer-popover)'
      }
    }

    function toggleOpen(e?: MouseEvent): void {
      if (e) e.stopPropagation()
      if (props.disabled) return
      open.value = !open.value
      emit('open-change', open.value)
      if (open.value) {
        nextTick(updatePosition)
      }
    }

    function closeMenu(): void {
      if (!open.value) return
      open.value = false
      emit('open-change', false)
    }

    function selectItem(item: CommonMenuItem): void {
      if (item.disabled || item.type === 'separator' || item.type === 'header') return
      emit('select', item.value)
      closeMenu()
    }

    function handleGlobalClick(e: PointerEvent | MouseEvent): void {
      if (!open.value) return
      const target = e.target as Node
      if (triggerRef.value?.contains(target)) return
      const panelEl = document.querySelector('.ncx-common-dropdown-panel-teleport')
      if (panelEl?.contains(target)) return
      closeMenu()
    }

    function handleKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && open.value) {
        closeMenu()
      }
    }

    onMounted(() => {
      window.addEventListener('pointerdown', handleGlobalClick, true)
      window.addEventListener('keydown', handleKeydown, true)
      window.addEventListener('resize', updatePosition, { passive: true })
      window.addEventListener('scroll', updatePosition, { passive: true, capture: true })
    })

    onUnmounted(() => {
      window.removeEventListener('pointerdown', handleGlobalClick, true)
      window.removeEventListener('keydown', handleKeydown, true)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    })

    return () =>
      h('div', { class: 'ncx-common-menu', ref: triggerRef }, [
        slots.trigger
          ? slots.trigger({ open: open.value, toggle: toggleOpen })
          : h(CommonButton, { variant: 'secondary', disabled: props.disabled, onClick: toggleOpen }, () => [
              h('span', props.label),
              h('span', { class: 'ncx-common-menu-chevron' }, '▾')
            ]),
        open.value
          ? h(
              Teleport,
              { to: 'body' },
              h(
                'div',
                {
                  class: 'ncx-common-menu-panel ncx-common-dropdown-panel-teleport',
                  role: 'menu',
                  style: panelStyle.value
                },
                props.items.map((item) => {
                  if (item.type === 'separator') {
                    return h('div', { key: item.value, class: 'ncx-common-menu-separator', role: 'separator' })
                  }
                  if (item.type === 'header') {
                    return h('div', { key: item.value, class: 'ncx-common-menu-header' }, item.label)
                  }
                  return h(
                    'button',
                    {
                      key: item.value,
                      class: joinClasses(
                        'ncx-common-menu-item',
                        item.danger && 'ncx-common-menu-item-danger',
                        item.checked && 'ncx-common-menu-item-checked',
                        item.disabled && 'ncx-common-menu-item-disabled'
                      ),
                      type: 'button',
                      disabled: item.disabled,
                      role: 'menuitem',
                      onClick: () => selectItem(item)
                    },
                    [
                      h('span', { class: 'ncx-common-menu-item-check' }, item.checked ? '✓' : ''),
                      item.icon ? h('span', { class: 'ncx-common-menu-item-icon' }, item.icon) : null,
                      h('span', { class: 'ncx-common-menu-item-label' }, item.label ?? item.value),
                      item.shortcut ? h('kbd', { class: 'ncx-common-menu-item-shortcut' }, item.shortcut) : null
                    ]
                  )
                })
              )
            )
          : null
      ])
  }
})

/** 通用组件ContextMenu：统一右键菜单，完全符合 macOS HIG / WWDC25 规范。 */
export const CommonContextMenu = defineComponent({
  name: 'CommonContextMenu',
  props: {
    /** 菜单项列表。 */
    items: { type: Array as PropType<CommonMenuItem[]>, default: () => [] },
    /** 是否禁用右键触发。 */
    disabled: { type: Boolean, default: false }
  },
  emits: ['select', 'open-change'],
  setup(props, { emit, slots }) {
    const open = ref(false)
    const position = ref({ x: 0, y: 0 })
    /** Teleport 菜单面板。 */
    const panel = ref<HTMLElement | null>(null)
    /** 打开菜单的触发元素，用于关闭后恢复焦点。 */
    let triggerElement: HTMLElement | null = null

    function openMenu(event: MouseEvent): void {
      if (props.disabled) return
      event.preventDefault()
      event.stopPropagation()
      triggerElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null

      const menuWidth = 200
      const menuHeight = Math.min(340, props.items.length * 32 + 16)

      let posX = event.clientX
      let posY = event.clientY

      if (posX + menuWidth > window.innerWidth - 8) {
        posX = Math.max(8, window.innerWidth - menuWidth - 8)
      }
      if (posY + menuHeight > window.innerHeight - 8) {
        posY = Math.max(8, window.innerHeight - menuHeight - 8)
      }

      position.value = { x: Math.round(posX), y: Math.round(posY) }
      open.value = true
      emit('open-change', true)
      void nextTick(() => panel.value?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus())
    }

    function closeMenu(): void {
      if (!open.value) return
      open.value = false
      emit('open-change', false)
      triggerElement?.focus()
      triggerElement = null
    }

    function selectItem(item: CommonMenuItem): void {
      if (item.disabled || item.type === 'separator' || item.type === 'header') return
      emit('select', item.value)
      closeMenu()
    }

    function handleGlobalClick(e: PointerEvent | MouseEvent): void {
      if (!open.value) return
      const panelEl = document.querySelector('.ncx-common-context-panel-teleport')
      if (panelEl?.contains(e.target as Node)) return
      closeMenu()
    }

    function handleKeydown(e: KeyboardEvent): void {
      if (!open.value) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const items = Array.from(panel.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
      if (items.length === 0) return
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      const nextIndex = e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : e.key === 'ArrowDown'
            ? (currentIndex + 1 + items.length) % items.length
            : (currentIndex - 1 + items.length) % items.length
      e.preventDefault()
      items[nextIndex]?.focus()
    }

    onMounted(() => {
      window.addEventListener('pointerdown', handleGlobalClick, true)
      window.addEventListener('keydown', handleKeydown, true)
    })

    onUnmounted(() => {
      window.removeEventListener('pointerdown', handleGlobalClick, true)
      window.removeEventListener('keydown', handleKeydown, true)
    })

    return () =>
      h('div', { class: 'ncx-common-context', onContextmenu: openMenu }, [
        slots.default?.(),
        open.value
          ? h(
              Teleport,
              { to: 'body' },
              h(
                'div',
                {
                  class: 'ncx-common-menu-panel ncx-common-context-panel ncx-common-context-panel-teleport',
                  ref: panel,
                  role: 'menu',
                  style: {
                    position: 'fixed',
                    left: `${position.value.x}px`,
                    top: `${position.value.y}px`,
                    zIndex: 'var(--ncx-layer-popover)'
                  }
                },
                props.items.map((item) => {
                  if (item.type === 'separator') {
                    return h('div', { key: item.value, class: 'ncx-common-menu-separator', role: 'separator' })
                  }
                  if (item.type === 'header') {
                    return h('div', { key: item.value, class: 'ncx-common-menu-header' }, item.label)
                  }
                  return h(
                    'button',
                    {
                      key: item.value,
                      class: joinClasses(
                        'ncx-common-menu-item',
                        item.danger && 'ncx-common-menu-item-danger',
                        item.checked && 'ncx-common-menu-item-checked',
                        item.disabled && 'ncx-common-menu-item-disabled'
                      ),
                      type: 'button',
                      disabled: item.disabled,
                      role: 'menuitem',
                      onClick: () => selectItem(item)
                    },
                    [
                      h('span', { class: 'ncx-common-menu-item-check' }, item.checked ? '✓' : ''),
                      item.icon ? h('span', { class: 'ncx-common-menu-item-icon' }, item.icon) : null,
                      h('span', { class: 'ncx-common-menu-item-label' }, item.label ?? item.value),
                      item.shortcut ? h('kbd', { class: 'ncx-common-menu-item-shortcut' }, item.shortcut) : null
                    ]
                  )
                })
              )
            )
          : null
      ])
  }
})

// ========= 状态组件 =========

/** 通用组件Spinner：统一加载指示。 */
export const CommonSpinner = defineComponent({
  name: '通用组件Spinner',
  props: {
    size: sizeProp,
    label: { type: String, default: '加载中' },
    variant: { type: String as PropType<'spokes' | 'ring'>, default: 'spokes' }
  },
  setup(props) {
    return () => {
      if (props.variant === 'ring') {
        return h('span', {
          class: joinClasses('ncx-common-spinner', 'ncx-common-spinner-ring', `ncx-common-spinner-${props.size}`),
          role: 'status',
          'aria-label': props.label
        })
      }
      return h(
        'span',
        {
          class: joinClasses('ncx-common-spinner', 'ncx-common-spinner-spokes', `ncx-common-spinner-${props.size}`),
          role: 'status',
          'aria-label': props.label
        },
        [
          h(
            'svg',
            { viewBox: '0 0 24 24', class: 'ncx-common-spinner-svg', fill: 'currentColor' },
            Array.from({ length: 12 }, (_, i) =>
              h('rect', {
                key: i,
                x: '11',
                y: '2',
                width: '2',
                height: '6',
                rx: '1',
                transform: `rotate(${i * 30} 12 12)`,
                opacity: (1 - (i / 12) * 0.75).toFixed(2)
              })
            )
          )
        ]
      )
    }
  }
})

/** 通用组件Progress：统一进度条。 */
export const CommonProgress = defineComponent({
  name: '通用组件Progress',
  props: {
    value: { type: Number as PropType<number | null | undefined>, default: undefined },
    indeterminate: Boolean,
    size: sizeProp,
    showValue: Boolean,
    label: { type: String, default: '' }
  },
  setup(props) {
    /** 当前进度条是否处于不定长模式。 */
    const isIndeterminate = computed(() => props.indeterminate || props.value === undefined || props.value === null)

    /** 计算安全数值 (0-100)。 */
    const safeValue = computed(() => {
      if (isIndeterminate.value) return 0
      return Math.min(100, Math.max(0, props.value!))
    })

    return () =>
      h(
        'div',
        {
          class: joinClasses(
            'ncx-common-progress-container',
            `ncx-common-progress-${props.size}`,
            isIndeterminate.value && 'ncx-common-progress-indeterminate'
          ),
          role: 'progressbar',
          'aria-valuenow': isIndeterminate.value ? undefined : safeValue.value,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-label': props.label
        },
        [
          h('div', { class: 'ncx-common-progress-track' }, [
            h('div', {
              class: 'ncx-common-progress-bar',
              style: isIndeterminate.value ? {} : { width: `${safeValue.value}%` }
            })
          ]),
          props.showValue && !isIndeterminate.value
            ? h('span', { class: 'ncx-common-progress-value-text' }, `${Math.round(safeValue.value)}%`)
            : null
        ]
      )
  }
})

/** 通用组件Skeleton：统一骨架屏。 */
export const CommonSkeleton = defineComponent({
  name: '通用组件Skeleton',
  props: {
    lines: { type: Number, default: 3 },
    variant: { type: String as PropType<'text' | 'rectangular' | 'avatar' | 'card'>, default: 'text' },
    animated: { type: Boolean, default: true },
    width: { type: String, default: '' },
    height: { type: String, default: '' }
  },
  setup(props) {
    return () => {
      const skeletonClass = joinClasses(
        'ncx-common-skeleton',
        `ncx-common-skeleton-${props.variant}`,
        props.animated && 'ncx-common-skeleton-animated'
      )

      if (props.variant === 'avatar' || props.variant === 'rectangular' || props.variant === 'card') {
        return h('div', {
          class: skeletonClass,
          style: { width: props.width, height: props.height },
          'aria-hidden': 'true'
        })
      }

      return h(
        'div',
        { class: skeletonClass, 'aria-hidden': 'true' },
        Array.from({ length: props.lines }, (_, index) =>
          h('span', {
            key: index,
            class: 'ncx-common-skeleton-line',
            style: {
              width: index === props.lines - 1 && props.lines > 1 ? '60%' : props.width || '100%',
              height: props.height
            }
          })
        )
      )
    }
  }
})

/** 通用组件EmptyState：统一空状态。 */
export const CommonEmptyState = defineComponent({
  name: '通用组件EmptyState',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: [Object, Function] as PropType<object | (() => unknown)>, default: null }
  },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'ncx-common-empty' }, [
        h('div', { class: 'ncx-common-empty-icon-wrapper' }, [
          slots.icon
            ? slots.icon()
            : props.icon
            ? h(props.icon as never, { class: 'ncx-common-empty-icon' })
            : h('svg', { viewBox: '0 0 24 24', class: 'ncx-common-empty-icon', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
                h('circle', { cx: '12', cy: '12', r: '10' }),
                h('path', { d: 'm15 9-6 6' }),
                h('path', { d: 'm9 9 6 6' })
              ])
        ]),
        h('div', { class: 'ncx-common-empty-content' }, [
          h('h3', { class: 'ncx-common-empty-title' }, props.title),
          props.description ? h('p', { class: 'ncx-common-empty-description' }, props.description) : null
        ]),
        slots.default ? h('div', { class: 'ncx-common-empty-actions' }, slots.default()) : null
      ])
  }
})

/** 通用组件ErrorState：统一错误状态。 */
export const CommonErrorState = defineComponent({
  name: '通用组件ErrorState',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: [Object, Function] as PropType<object | (() => unknown)>, default: null },
    retryText: { type: String, default: '重试' },
    showRetry: { type: Boolean, default: true }
  },
  emits: ['retry'],
  setup(props, { emit, slots }) {
    return () =>
      h('div', { class: 'ncx-common-error' }, [
        h('div', { class: 'ncx-common-error-icon-wrapper' }, [
          slots.icon
            ? slots.icon()
            : props.icon
            ? h(props.icon, { class: 'ncx-common-error-icon' })
            : h('svg', { viewBox: '0 0 24 24', class: 'ncx-common-error-icon', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
                h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
                h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
                h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
              ])
        ]),
        h('div', { class: 'ncx-common-error-content' }, [
          h('h3', { class: 'ncx-common-error-title' }, props.title),
          props.description ? h('p', { class: 'ncx-common-error-description' }, props.description) : null
        ]),
        slots.default
          ? h('div', { class: 'ncx-common-error-actions' }, slots.default())
          : props.showRetry
          ? h('div', { class: 'ncx-common-error-actions' }, [
              h(
                CommonButton,
                { size: 'compact', variant: 'secondary', onClick: () => emit('retry') },
                () => props.retryText
              )
            ])
          : null
      ])
  }
})

/** 通用组件InlineMessage：统一内联消息。 */
export const CommonInlineMessage = defineComponent({
  name: '通用组件InlineMessage',
  props: {
    type: messageTypeProp,
    title: { type: String, default: '' },
    closable: Boolean,
    showIcon: { type: Boolean, default: true }
  },
  emits: ['close'],
  setup(props, { emit, slots }) {
    /** 根据消息类型渲染 SF 风格状态图标。 */
    function renderStatusIcon() {
      if (!props.showIcon) return null
      let pathElements: ReturnType<typeof h>[]
      if (props.type === 'success') {
        pathElements = [
          h('circle', { cx: '12', cy: '12', r: '10' }),
          h('path', { d: 'm9 12 2 2 4-4' })
        ]
      } else if (props.type === 'warning') {
        pathElements = [
          h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
          h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
          h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
        ]
      } else if (props.type === 'danger') {
        pathElements = [
          h('circle', { cx: '12', cy: '12', r: '10' }),
          h('line', { x1: '15', y1: '9', x2: '9', y2: '15' }),
          h('line', { x1: '9', y1: '9', x2: '15', y2: '15' })
        ]
      } else {
        pathElements = [
          h('circle', { cx: '12', cy: '12', r: '10' }),
          h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
          h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
        ]
      }
      return h('svg', {
        viewBox: '0 0 24 24',
        class: 'ncx-common-inline-message-icon',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }, pathElements)
    }

    return () =>
      h(
        'div',
        { class: joinClasses('ncx-common-inline-message', `ncx-common-inline-message-${props.type}`) },
        [
          renderStatusIcon(),
          h('div', { class: 'ncx-common-inline-message-content' }, [
            props.title ? h('strong', { class: 'ncx-common-inline-message-title' }, props.title) : null,
            h('div', { class: 'ncx-common-inline-message-body' }, slots.default?.())
          ]),
          props.closable
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'ncx-common-inline-message-close',
                  'aria-label': '关闭消息',
                  onClick: () => emit('close')
                },
                [
                  h('svg', { viewBox: '0 0 24 24', width: '14', height: '14', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
                    h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                    h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
                  ])
                ]
              )
            : null
        ]
      )
  }
})

// ========= 浮层组件 (macOS / WWDC25 视觉与交互规范) =========

/** 通用组件Toast：统一 Toast。完全按照 macOS Notification / HUD 浮窗规范重构。 */
export const CommonToast = defineComponent({
  name: '通用组件Toast',
  props: {
    visible: Boolean,
    type: messageTypeProp,
    title: { type: String, required: true },
    message: { type: String, default: '' },
    duration: { type: Number, default: 4000 },
    closable: { type: Boolean, default: true }
  },
  emits: ['close'],
  setup(props, { emit }) {
    let timer: ReturnType<typeof setTimeout> | null = null

    const clearToastTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    const startToastTimer = () => {
      clearToastTimer()
      if (props.visible && props.duration > 0) {
        timer = setTimeout(() => {
          emit('close')
        }, props.duration)
      }
    }

    watch(() => props.visible, (val) => {
      if (val) {
        startToastTimer()
      } else {
        clearToastTimer()
      }
    }, { immediate: true })

    onUnmounted(() => {
      clearToastTimer()
    })

    const renderToastIcon = () => {
      let iconContent
      if (props.type === 'success') {
        iconContent = [
          h('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
          h('polyline', { points: '22 4 12 14.01 9 11.01' })
        ]
      } else if (props.type === 'warning') {
        iconContent = [
          h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
          h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
          h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
        ]
      } else if (props.type === 'danger') {
        iconContent = [
          h('circle', { cx: '12', cy: '12', r: '10' }),
          h('line', { x1: '15', y1: '9', x2: '9', y2: '15' }),
          h('line', { x1: '9', y1: '9', x2: '15', y2: '15' })
        ]
      } else {
        iconContent = [
          h('circle', { cx: '12', cy: '12', r: '10' }),
          h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
          h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
        ]
      }

      return h('div', { class: joinClasses('ncx-common-toast-icon', `ncx-common-toast-icon-${props.type}`) }, [
        h('svg', {
          viewBox: '0 0 24 24',
          width: '18',
          height: '18',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '2.2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }, iconContent)
      ])
    }

    return () => h(Teleport, { to: 'body' }, [
      h(Transition, { name: 'ncx-toast-fade' }, () =>
        props.visible
          ? h('aside', {
              class: joinClasses('ncx-common-toast', `ncx-common-toast-${props.type}`),
              role: 'status',
              onMouseenter: clearToastTimer,
              onMouseleave: startToastTimer
            }, [
              renderToastIcon(),
              h('div', { class: 'ncx-common-toast-content' }, [
                h('strong', { class: 'ncx-common-toast-title' }, props.title),
                props.message ? h('span', { class: 'ncx-common-toast-message' }, props.message) : null
              ]),
              props.closable
                ? h('button', {
                    type: 'button',
                    class: 'ncx-common-toast-close',
                    'aria-label': '关闭通知',
                    onClick: () => emit('close')
                  }, [
                    h('svg', { viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
                      h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                      h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
                    ])
                  ])
                : null
            ])
          : null
      )
    ])
  }
})

/** 通用组件Dialog：统一对话框。完全按照 macOS Sheet 弹窗规范重构。 */
export const CommonDialog = defineComponent({
  name: '通用组件Dialog',
  props: {
    visible: Boolean,
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    width: { type: String, default: '520px' },
    closeOnOverlayClick: { type: Boolean, default: true },
    closeOnEsc: { type: Boolean, default: true }
  },
  emits: ['close'],
  setup(props, { emit, slots }) {
    /** 当前 Dialog 面板节点。 */
    const panel = ref<HTMLElement | null>(null)
    useModalFocus(() => props.visible, panel)
    const handleKeydown = (e: KeyboardEvent) => {
      if (props.visible && props.closeOnEsc && e.key === 'Escape') {
        emit('close')
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })

    const handleOverlayClick = (e: MouseEvent) => {
      if (props.closeOnOverlayClick && e.target === e.currentTarget) {
        emit('close')
      }
    }

    return () => h(Teleport, { to: 'body' }, [
      h(Transition, { name: 'ncx-modal-pop' }, () =>
        props.visible
          ? h('div', { class: 'ncx-common-overlay', role: 'presentation', onClick: handleOverlayClick }, [
              h('section', {
                ref: panel,
                class: 'ncx-common-modal',
                tabindex: -1,
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': props.title,
                style: { width: props.width }
              }, [
                h('header', { class: 'ncx-common-modal-header' }, [
                  h('div', { class: 'ncx-common-modal-title-group' }, [
                    h('h2', { class: 'ncx-common-modal-title' }, props.title),
                    props.subtitle ? h('p', { class: 'ncx-common-modal-subtitle' }, props.subtitle) : null
                  ]),
                  h('button', {
                    type: 'button',
                    class: 'ncx-common-modal-close',
                    'aria-label': '关闭对话框',
                    onClick: () => emit('close')
                  }, [
                    h('svg', { viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
                      h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                      h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
                    ])
                  ])
                ]),
                h('div', { class: 'ncx-common-modal-body' }, slots.default?.()),
                slots.actions ? h('footer', { class: 'ncx-common-modal-footer' }, slots.actions()) : null
              ])
            ])
          : null
      )
    ])
  }
})

/** 通用组件AlertDialog：统一危险确认对话框。完全按照 macOS NSAlert 原生确认框规范重构。 */
export const CommonAlertDialog = defineComponent({
  name: '通用组件AlertDialog',
  props: {
    visible: Boolean,
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String as PropType<'danger' | 'warning' | 'info'>, default: 'danger' },
    confirmText: { type: String, default: '确认' },
    cancelText: { type: String, default: '取消' }
  },
  emits: ['cancel', 'confirm'],
  setup(props, { emit }) {
    /** 当前 AlertDialog 面板节点。 */
    const panel = ref<HTMLElement | null>(null)
    useModalFocus(() => props.visible, panel)
    const handleKeydown = (e: KeyboardEvent) => {
      if (props.visible && e.key === 'Escape') {
        emit('cancel')
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })

    const renderAlertIcon = () => {
      const pathElements =
        props.type === 'danger'
          ? [
              h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
              h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
              h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
            ]
          : [
              h('circle', { cx: '12', cy: '12', r: '10' }),
              h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
              h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
            ]
      return h('div', { class: joinClasses('ncx-common-alert-icon-badge', `ncx-common-alert-icon-${props.type}`) }, [
        h('svg', { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, pathElements)
      ])
    }

    return () => h(Teleport, { to: 'body' }, [
      h(Transition, { name: 'ncx-alert-pop' }, () =>
        props.visible
          ? h('div', { class: 'ncx-common-overlay ncx-common-overlay-alert', role: 'presentation' }, [
              h('section', {
                ref: panel,
                class: joinClasses('ncx-common-modal', 'ncx-common-modal-alert', `ncx-common-modal-alert-${props.type}`),
                tabindex: -1,
                role: 'alertdialog',
                'aria-modal': 'true',
                'aria-label': props.title
              }, [
                h('div', { class: 'ncx-common-alert-header' }, [
                  renderAlertIcon(),
                  h('h2', { class: 'ncx-common-alert-title' }, props.title)
                ]),
                props.description ? h('p', { class: 'ncx-common-alert-description' }, props.description) : null,
                h('footer', { class: 'ncx-common-alert-footer' }, [
                  h(CommonButton, { variant: 'secondary', onClick: () => emit('cancel') }, () => props.cancelText),
                  h(CommonButton, { variant: props.type === 'danger' ? 'danger' : 'primary', onClick: () => emit('confirm') }, () => props.confirmText)
                ])
              ])
            ])
          : null
      )
    ])
  }
})

/** 通用组件Drawer：统一抽屉。完全按照 macOS Inspector 侧栏抽屉规范重构。 */
export const CommonDrawer = defineComponent({
  name: '通用组件Drawer',
  props: {
    visible: Boolean,
    title: { type: String, required: true },
    width: { type: String, default: '440px' },
    placement: { type: String as PropType<'left' | 'right'>, default: 'right' },
    closeOnOverlayClick: { type: Boolean, default: true },
    closeOnEsc: { type: Boolean, default: true }
  },
  emits: ['close'],
  setup(props, { emit, slots }) {
    /** 当前 Drawer 面板节点。 */
    const panel = ref<HTMLElement | null>(null)
    useModalFocus(() => props.visible, panel)
    // ========= 函数 =========

    /** 处理键盘 ESC 按键关闭抽屉。 */
    const handleKeydown = (e: KeyboardEvent): void => {
      if (props.visible && props.closeOnEsc && e.key === 'Escape') {
        emit('close')
      }
    }

    /** 处理 Overlay 遮罩区域点击关闭抽屉。 */
    const handleOverlayClick = (e: MouseEvent): void => {
      if (props.closeOnOverlayClick && e.target === e.currentTarget) {
        emit('close')
      }
    }

    // ========= 生命周期 =========

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })

    return () => h(Teleport, { to: 'body' }, [
      h(Transition, { name: 'ncx-drawer-slide' }, () =>
        props.visible
          ? h('div', {
              class: joinClasses('ncx-common-overlay', 'ncx-common-overlay-drawer', `ncx-common-overlay-drawer-${props.placement}`),
              role: 'presentation',
              onClick: handleOverlayClick
            }, [
              h('aside', {
                ref: panel,
                class: joinClasses('ncx-common-drawer', `ncx-common-drawer-${props.placement}`),
                tabindex: -1,
                role: 'dialog',
                'aria-modal': 'true',
                style: { width: props.width },
                'aria-label': props.title
              }, [
                h('header', { class: 'ncx-common-drawer-header' }, [
                  h('h2', { class: 'ncx-common-drawer-title' }, props.title),
                  h('div', { class: 'ncx-common-drawer-header-actions' }, [
                    slots.headerActions?.(),
                    h('button', {
                      type: 'button',
                      class: 'ncx-common-drawer-close',
                      'aria-label': '关闭抽屉',
                      onClick: () => emit('close')
                    }, [
                      h('svg', { viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
                        h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                        h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
                      ])
                    ])
                  ])
                ]),
                h('div', { class: 'ncx-common-drawer-body' }, slots.default?.())
              ])
            ])
          : null
      )
    ])
  }
})

/** 通用组件Popover：统一弹出层。完全按照 macOS Popover / 浮窗规范重构。 */
export const CommonPopover = defineComponent({
  name: '通用组件Popover',
  props: {
    label: { type: String, default: '打开浮层' },
    placement: { type: String as PropType<'top' | 'bottom' | 'left' | 'right'>, default: 'bottom' }
  },
  emits: ['update:open', 'open-change'],
  setup(props, { slots, emit }) {
    const popoverRef = ref<HTMLElement | null>(null)
    const open = ref(false)

    const toggleOpen = () => {
      open.value = !open.value
      emit('update:open', open.value)
      emit('open-change', open.value)
    }

    const close = () => {
      if (open.value) {
        open.value = false
        emit('update:open', false)
        emit('open-change', false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
        close()
      }
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (open.value && e.key === 'Escape') {
        close()
      }
    }

    onMounted(() => {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeydown)
    })

    return () =>
      h('div', { ref: popoverRef, class: 'ncx-common-popover' }, [
        slots.trigger
          ? slots.trigger({ open: open.value, toggle: toggleOpen })
          : h(CommonButton, { onClick: toggleOpen }, () => props.label),
        h(Transition, { name: 'ncx-popover-fade' }, () =>
          open.value
            ? h('div', { class: joinClasses('ncx-common-popover-panel', `ncx-common-popover-panel-${props.placement}`) }, [
                h('div', { class: 'ncx-common-popover-arrow' }),
                h('div', { class: 'ncx-common-popover-content' }, slots.default?.())
              ])
            : null
        )
      ])
  }
})

// ========= 容器组件 =========

/** 通用组件ScrollArea：统一滚动区域。 */
export const CommonScrollArea = defineComponent({
  name: '通用组件ScrollArea',
  setup(_, { slots }) {
    return () => h('div', { class: 'ncx-common-scroll-area' }, slots.default?.())
  }
})

/** 通用组件Accordion：统一折叠面板。 */
export const CommonAccordion = defineComponent({
  name: '通用组件Accordion',
  props: { items: { type: Array as PropType<CommonAccordionItem[]>, default: () => [] } },
  setup(props) {
    /** 当前展开条目索引。 */
    const activeIndex = ref(0)

    return () => h('div', { class: 'ncx-common-accordion' }, props.items.map((item, index) => h('section', { class: 'ncx-common-accordion-item' }, [h('button', { type: 'button', onClick: () => (activeIndex.value = activeIndex.value === index ? -1 : index) }, item.title), activeIndex.value === index ? h('p', item.content) : null])))
  }
})

/** 通用组件VirtualList：统一长列表容器。 */
export const CommonVirtualList = defineComponent({
  name: '通用组件VirtualList',
  props: { items: { type: Array as PropType<CommonVirtualListItem[]>, default: () => [] } },
  setup(props) {
    /** 当前展示的轻量列表切片。 */
    const visibleItems = computed(() => props.items.slice(0, 24))

    return () => h('div', { class: 'ncx-common-virtual-list', role: 'list' }, visibleItems.value.map((item) => h('article', { class: 'ncx-common-virtual-list-item', role: 'listitem', key: item.id }, [h('strong', item.title), h('span', item.description)])))
  }
})

/** 通用组件ResponsiveGrid：统一响应式网格。 */
export const CommonResponsiveGrid = defineComponent({
  name: '通用组件ResponsiveGrid',
  setup(_, { slots }) {
    return () => h('div', { class: 'ncx-common-responsive-grid' }, slots.default?.())
  }
})
