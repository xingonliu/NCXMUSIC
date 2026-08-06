/* eslint vue/multi-word-component-names: off, vue/one-component-per-file: off */
import { computed, defineComponent, h, ref, type PropType } from 'vue'

// ========= 类型 =========

/** 通用组件尺寸。 */
type CommonComponentSize = 'compact' | 'default' | 'prominent'

/** 通用按钮视觉变体。 */
type CommonButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/** 通用消息视觉类型。 */
type CommonMessageType = 'info' | 'success' | 'warning' | 'danger'

/** 通用选项数据结构。 */
export interface CommonOption {
  /** 选项展示文案。 */
  label: string
  /** 选项提交值。 */
  value: string
  /** 选项是否禁用。 */
  disabled?: boolean
}

/** 通用菜单项数据结构。 */
export interface CommonMenuItem {
  /** 菜单项展示文案。 */
  label: string
  /** 菜单项键值。 */
  value: string
  /** 菜单项快捷键。 */
  shortcut?: string
  /** 菜单项是否危险操作。 */
  danger?: boolean
  /** 菜单项是否禁用。 */
  disabled?: boolean
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

// ========= 操作组件 =========

/** 通用组件Button：统一按钮入口。 */
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
          class: joinClasses('ncx-common-button', `ncx-common-button-${props.variant}`, `ncx-common-button-${props.size}`, props.loading && 'ncx-common-button-loading'),
          type: props.type,
          disabled: isDisabled.value,
          'aria-busy': props.loading ? 'true' : undefined,
          onClick: handleClick
        },
        [props.loading ? h(CommonSpinner, { size: 'compact' }) : null, h('span', slots.default?.())]
      )
  }
})

/** 通用组件IconButton：统一纯图标按钮入口。 */
export const CommonIconButton = defineComponent({
  name: '通用组件IconButton',
  props: {
    label: { type: String, required: true },
    size: sizeProp,
    selected: Boolean,
    disabled: Boolean
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    /** 处理图标按钮点击。 */
    function handleClick(event: MouseEvent): void {
      if (guardDisabledClick(event, props.disabled)) return
      emit('click', event)
    }

    return () =>
      h(
        'button',
        {
          class: joinClasses('ncx-common-icon-button', `ncx-common-icon-button-${props.size}`, props.selected && 'ncx-common-icon-button-selected'),
          type: 'button',
          disabled: props.disabled,
          'aria-label': props.label,
          'aria-pressed': props.selected ? 'true' : undefined,
          title: props.label,
          onClick: handleClick
        },
        slots.default?.()
      )
  }
})

/** 通用组件ButtonGroup：统一按钮组容器。 */
export const CommonButtonGroup = defineComponent({
  name: '通用组件ButtonGroup',
  setup(_, { slots }) {
    return () => h('div', { class: 'ncx-common-button-group', role: 'group' }, slots.default?.())
  }
})

/** 通用组件LinkButton：统一链接型按钮。 */
export const CommonLinkButton = defineComponent({
  name: '通用组件LinkButton',
  props: {
    href: { type: String, default: '#' },
    disabled: Boolean
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
          'aria-disabled': props.disabled ? 'true' : undefined,
          onClick: handleClick
        },
        slots.default?.()
      )
  }
})

// ========= 输入组件 =========

/** 通用组件Input：统一单行输入。 */
export const CommonInput = defineComponent({
  name: '通用组件Input',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    disabled: Boolean,
    invalid: Boolean
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: joinClasses('ncx-common-field', props.invalid && 'ncx-common-field-invalid'),
        value: props.modelValue,
        placeholder: props.placeholder,
        disabled: props.disabled,
        'aria-invalid': props.invalid ? 'true' : undefined,
        onInput: (event: Event) => emit('update:modelValue', readInputValue(event))
      })
  }
})

/** 通用组件Textarea：统一多行输入。 */
export const CommonTextarea = defineComponent({
  name: '通用组件Textarea',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    rows: { type: Number, default: 4 }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('textarea', {
        class: 'ncx-common-field ncx-common-textarea',
        value: props.modelValue,
        placeholder: props.placeholder,
        rows: props.rows,
        onInput: (event: Event) => emit('update:modelValue', readInputValue(event))
      })
  }
})

/** 通用组件SearchInput：统一搜索输入。 */
export const CommonSearchInput = defineComponent({
  name: '通用组件SearchInput',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '搜索音乐、歌单或小云能力' }
  },
  emits: ['update:modelValue', 'clear'],
  setup(props, { emit }) {
    /** 清空搜索输入内容。 */
    function clearSearch(): void {
      emit('update:modelValue', '')
      emit('clear')
    }

    return () =>
      h('label', { class: 'ncx-common-search' }, [
        h('span', { class: 'ncx-common-search-icon', 'aria-hidden': 'true' }, '⌕'),
        h('input', {
          class: 'ncx-common-search-input',
          value: props.modelValue,
          placeholder: props.placeholder,
          type: 'search',
          onInput: (event: Event) => emit('update:modelValue', readInputValue(event))
        }),
        props.modelValue
          ? h('button', { class: 'ncx-common-search-clear', type: 'button', onClick: clearSearch }, '清除')
          : null
      ])
  }
})

/** 通用组件Select：统一下拉选择。 */
export const CommonSelect = defineComponent({
  name: '通用组件Select',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'select',
        {
          class: 'ncx-common-field ncx-common-select',
          value: props.modelValue,
          onChange: (event: Event) => emit('update:modelValue', readInputValue(event))
        },
        props.options.map((option) =>
          h('option', { value: option.value, disabled: option.disabled }, option.label)
        )
      )
  }
})

/** 通用组件Combobox：统一可输入选择。 */
export const CommonCombobox = defineComponent({
  name: '通用组件Combobox',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    /** 当前组件 datalist 的稳定 ID。 */
    const listId = `ncx-combobox-${Math.random().toString(36).slice(2)}`

    return () =>
      h('div', { class: 'ncx-common-combobox' }, [
        h('input', {
          class: 'ncx-common-field',
          value: props.modelValue,
          list: listId,
          placeholder: props.placeholder,
          onInput: (event: Event) => emit('update:modelValue', readInputValue(event))
        }),
        h(
          'datalist',
          { id: listId },
          props.options.map((option) => h('option', { value: option.value }, option.label))
        )
      ])
  }
})

// ========= 选择组件 =========

/** 通用组件Checkbox：统一复选框。 */
export const CommonCheckbox = defineComponent({
  name: '通用组件Checkbox',
  props: {
    modelValue: Boolean,
    label: { type: String, required: true }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('label', { class: 'ncx-common-check' }, [
        h('input', {
          checked: props.modelValue,
          type: 'checkbox',
          onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked)
        }),
        h('span', props.label)
      ])
  }
})

/** 通用组件RadioGroup：统一单选组。 */
export const CommonRadioGroup = defineComponent({
  name: '通用组件RadioGroup',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] },
    name: { type: String, default: 'ncx-radio-group' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { class: 'ncx-common-radio-group', role: 'radiogroup' },
        props.options.map((option) =>
          h('label', { class: 'ncx-common-check' }, [
            h('input', {
              checked: props.modelValue === option.value,
              disabled: option.disabled,
              name: props.name,
              type: 'radio',
              value: option.value,
              onChange: () => emit('update:modelValue', option.value)
            }),
            h('span', option.label)
          ])
        )
      )
  }
})

/** 通用组件Switch：统一开关。 */
export const CommonSwitch = defineComponent({
  name: '通用组件Switch',
  props: {
    modelValue: Boolean,
    label: { type: String, required: true }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    /** 切换开关状态。 */
    function toggleSwitch(): void {
      emit('update:modelValue', !props.modelValue)
    }

    return () =>
      h('button', {
        class: joinClasses('ncx-common-switch', props.modelValue && 'ncx-common-switch-on'),
        type: 'button',
        role: 'switch',
        'aria-checked': props.modelValue ? 'true' : 'false',
        'aria-label': props.label,
        onClick: toggleSwitch
      }, [h('span'), h('strong', props.label)])
  }
})

/** 通用组件Slider：统一滑块。 */
export const CommonSlider = defineComponent({
  name: '通用组件Slider',
  props: {
    modelValue: { type: Number, default: 50 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    label: { type: String, default: '滑块' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('label', { class: 'ncx-common-slider' }, [
        h('span', props.label),
        h('input', {
          value: props.modelValue,
          min: props.min,
          max: props.max,
          type: 'range',
          onInput: (event: Event) => emit('update:modelValue', Number(readInputValue(event)))
        }),
        h('b', `${props.modelValue}`)
      ])
  }
})

/** 通用组件SegmentedControl：统一分段控制器。 */
export const CommonSegmentedControl = defineComponent({
  name: '通用组件SegmentedControl',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { class: 'ncx-common-segmented', role: 'tablist' },
        props.options.map((option) =>
          h('button', {
            class: joinClasses('ncx-common-segmented-item', props.modelValue === option.value && 'ncx-common-segmented-item-active'),
            type: 'button',
            role: 'tab',
            'aria-selected': props.modelValue === option.value ? 'true' : 'false',
            onClick: () => emit('update:modelValue', option.value)
          }, option.label)
        )
      )
  }
})

// ========= 展示组件 =========

/** 通用组件Avatar：统一头像。 */
export const CommonAvatar = defineComponent({
  name: '通用组件Avatar',
  props: {
    name: { type: String, required: true },
    src: { type: String, default: '' }
  },
  setup(props) {
    /** 头像兜底首字。 */
    const fallback = computed(() => props.name.slice(0, 1).toUpperCase())

    return () =>
      h('span', { class: 'ncx-common-avatar', title: props.name }, [
        props.src ? h('img', { src: props.src, alt: props.name }) : h('span', fallback.value)
      ])
  }
})

/** 通用组件Badge：统一徽标。 */
export const CommonBadge = defineComponent({
  name: '通用组件Badge',
  props: { type: messageTypeProp },
  setup(props, { slots }) {
    return () => h('span', { class: `ncx-common-badge ncx-common-badge-${props.type}` }, slots.default?.())
  }
})

/** 通用组件Tag：统一标签。 */
export const CommonTag = defineComponent({
  name: '通用组件Tag',
  props: { selected: Boolean },
  setup(props, { slots }) {
    return () => h('span', { class: joinClasses('ncx-common-tag', props.selected && 'ncx-common-tag-selected') }, slots.default?.())
  }
})

/** 通用组件Card：统一卡片。 */
export const CommonCard = defineComponent({
  name: '通用组件Card',
  props: { interactive: Boolean },
  setup(props, { slots }) {
    return () => h('section', { class: joinClasses('ncx-common-card', props.interactive && 'ncx-common-card-interactive') }, slots.default?.())
  }
})

/** 通用组件Separator：统一分隔线。 */
export const CommonSeparator = defineComponent({
  name: '通用组件Separator',
  props: { vertical: Boolean },
  setup(props) {
    return () => h('span', { class: joinClasses('ncx-common-separator', props.vertical && 'ncx-common-separator-vertical'), role: 'separator' })
  }
})

/** 通用组件Tooltip：统一提示。 */
export const CommonTooltip = defineComponent({
  name: '通用组件Tooltip',
  props: { text: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h('span', { class: 'ncx-common-tooltip', 'data-tooltip': props.text, tabindex: 0 }, slots.default?.())
  }
})

// ========= 导航组件 =========

/** 通用组件Tabs：统一标签页。 */
export const CommonTabs = defineComponent({
  name: '通用组件Tabs',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array as PropType<CommonOption[]>, default: () => [] }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'ncx-common-tabs' }, [
        h('div', { class: 'ncx-common-tabs-list', role: 'tablist' }, props.options.map((option) =>
          h('button', {
            class: joinClasses('ncx-common-tabs-tab', props.modelValue === option.value && 'ncx-common-tabs-tab-active'),
            type: 'button',
            role: 'tab',
            'aria-selected': props.modelValue === option.value ? 'true' : 'false',
            onClick: () => emit('update:modelValue', option.value)
          }, option.label)
        )),
        h('p', { class: 'ncx-common-tabs-panel' }, `当前标签：${props.modelValue}`)
      ])
  }
})

/** 通用组件DropdownMenu：统一下拉菜单。 */
export const CommonDropdownMenu = defineComponent({
  name: '通用组件DropdownMenu',
  props: {
    label: { type: String, default: '打开菜单' },
    items: { type: Array as PropType<CommonMenuItem[]>, default: () => [] }
  },
  emits: ['select'],
  setup(props, { emit }) {
    /** 下拉菜单是否展开。 */
    const open = ref(false)

    /** 切换下拉菜单展开状态。 */
    function toggleOpen(): void {
      open.value = !open.value
    }

    /** 选择下拉菜单项。 */
    function selectItem(item: CommonMenuItem): void {
      if (item.disabled) return
      emit('select', item.value)
      open.value = false
    }

    return () =>
      h('div', { class: 'ncx-common-menu' }, [
        h(CommonButton, { variant: 'secondary', onClick: toggleOpen }, () => props.label),
        open.value ? h('div', { class: 'ncx-common-menu-panel', role: 'menu' }, props.items.map((item) =>
          h('button', {
            class: joinClasses('ncx-common-menu-item', item.danger && 'ncx-common-menu-item-danger'),
            type: 'button',
            disabled: item.disabled,
            role: 'menuitem',
            onClick: () => selectItem(item)
          }, [h('span', item.label), item.shortcut ? h('kbd', item.shortcut) : null])
        )) : null
      ])
  }
})

/** 通用组件ContextMenu：统一右键菜单。 */
export const CommonContextMenu = defineComponent({
  name: '通用组件ContextMenu',
  props: { items: { type: Array as PropType<CommonMenuItem[]>, default: () => [] } },
  emits: ['select'],
  setup(props, { emit, slots }) {
    /** 右键菜单是否展开。 */
    const open = ref(false)

    /** 右键菜单横向位置。 */
    const x = ref(0)

    /** 右键菜单纵向位置。 */
    const y = ref(0)

    /** 打开右键菜单。 */
    function openMenu(event: MouseEvent): void {
      event.preventDefault()
      x.value = event.offsetX
      y.value = event.offsetY
      open.value = true
    }

    /** 选择右键菜单项。 */
    function selectItem(item: CommonMenuItem): void {
      if (item.disabled) return
      emit('select', item.value)
      open.value = false
    }

    return () =>
      h('div', { class: 'ncx-common-context', onContextmenu: openMenu, onMouseleave: () => (open.value = false) }, [
        slots.default?.(),
        open.value ? h('div', { class: 'ncx-common-menu-panel ncx-common-context-panel', style: { left: `${x.value}px`, top: `${y.value}px` } }, props.items.map((item) =>
          h('button', {
            class: joinClasses('ncx-common-menu-item', item.danger && 'ncx-common-menu-item-danger'),
            type: 'button',
            disabled: item.disabled,
            onClick: () => selectItem(item)
          }, [h('span', item.label), item.shortcut ? h('kbd', item.shortcut) : null])
        )) : null
      ])
  }
})

// ========= 状态组件 =========

/** 通用组件Spinner：统一加载指示。 */
export const CommonSpinner = defineComponent({
  name: '通用组件Spinner',
  props: { size: sizeProp, label: { type: String, default: '加载中' } },
  setup(props) {
    return () => h('span', { class: `ncx-common-spinner ncx-common-spinner-${props.size}`, role: 'status', 'aria-label': props.label })
  }
})

/** 通用组件Progress：统一进度条。 */
export const CommonProgress = defineComponent({
  name: '通用组件Progress',
  props: { value: { type: Number, default: 0 } },
  setup(props) {
    /** 进度条安全显示值。 */
    const safeValue = computed(() => Math.min(100, Math.max(0, props.value)))

    return () => h('div', { class: 'ncx-common-progress', role: 'progressbar', 'aria-valuenow': safeValue.value, 'aria-valuemin': 0, 'aria-valuemax': 100 }, [h('span', { style: { width: `${safeValue.value}%` } })])
  }
})

/** 通用组件Skeleton：统一骨架屏。 */
export const CommonSkeleton = defineComponent({
  name: '通用组件Skeleton',
  props: { lines: { type: Number, default: 3 } },
  setup(props) {
    return () => h('div', { class: 'ncx-common-skeleton', 'aria-hidden': 'true' }, Array.from({ length: props.lines }, (_, index) => h('span', { key: index })))
  }
})

/** 通用组件EmptyState：统一空状态。 */
export const CommonEmptyState = defineComponent({
  name: '通用组件EmptyState',
  props: { title: { type: String, required: true }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () => h('div', { class: 'ncx-common-empty' }, [h('strong', props.title), h('p', props.description), slots.default?.()])
  }
})

/** 通用组件ErrorState：统一错误状态。 */
export const CommonErrorState = defineComponent({
  name: '通用组件ErrorState',
  props: { title: { type: String, required: true }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () => h('div', { class: 'ncx-common-error' }, [h('strong', props.title), h('p', props.description), slots.default?.()])
  }
})

/** 通用组件InlineMessage：统一内联消息。 */
export const CommonInlineMessage = defineComponent({
  name: '通用组件InlineMessage',
  props: { type: messageTypeProp },
  setup(props, { slots }) {
    return () => h('p', { class: `ncx-common-inline-message ncx-common-inline-message-${props.type}` }, slots.default?.())
  }
})

// ========= 浮层组件 =========

/** 通用组件Toast：统一 Toast。 */
export const CommonToast = defineComponent({
  name: '通用组件Toast',
  props: {
    visible: Boolean,
    type: messageTypeProp,
    title: { type: String, required: true },
    message: { type: String, default: '' }
  },
  emits: ['close'],
  setup(props, { emit }) {
    return () => props.visible ? h('aside', { class: `ncx-common-toast ncx-common-toast-${props.type}`, role: 'status' }, [h('strong', props.title), h('span', props.message), h('button', { type: 'button', onClick: () => emit('close') }, '关闭')]) : null
  }
})

/** 通用组件Dialog：统一对话框。 */
export const CommonDialog = defineComponent({
  name: '通用组件Dialog',
  props: { visible: Boolean, title: { type: String, required: true } },
  emits: ['close'],
  setup(props, { emit, slots }) {
    return () => props.visible ? h('div', { class: 'ncx-common-overlay', role: 'presentation' }, [h('section', { class: 'ncx-common-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title }, [h('header', [h('h2', props.title), h('button', { type: 'button', onClick: () => emit('close') }, '关闭')]), h('div', { class: 'ncx-common-modal-body' }, slots.default?.()), h('footer', slots.actions?.())])]) : null
  }
})

/** 通用组件AlertDialog：统一危险确认对话框。 */
export const CommonAlertDialog = defineComponent({
  name: '通用组件AlertDialog',
  props: { visible: Boolean, title: { type: String, required: true }, description: { type: String, default: '' } },
  emits: ['cancel', 'confirm'],
  setup(props, { emit }) {
    return () => props.visible ? h('div', { class: 'ncx-common-overlay', role: 'presentation' }, [h('section', { class: 'ncx-common-modal ncx-common-modal-alert', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': props.title }, [h('h2', props.title), h('p', props.description), h('footer', [h(CommonButton, { variant: 'secondary', onClick: () => emit('cancel') }, () => '取消'), h(CommonButton, { variant: 'danger', onClick: () => emit('confirm') }, () => '确认')])])]) : null
  }
})

/** 通用组件Drawer：统一抽屉。 */
export const CommonDrawer = defineComponent({
  name: '通用组件Drawer',
  props: { visible: Boolean, title: { type: String, required: true } },
  emits: ['close'],
  setup(props, { emit, slots }) {
    return () => props.visible ? h('div', { class: 'ncx-common-overlay ncx-common-overlay-drawer' }, [h('aside', { class: 'ncx-common-drawer', 'aria-label': props.title }, [h('header', [h('h2', props.title), h('button', { type: 'button', onClick: () => emit('close') }, '关闭')]), slots.default?.()])]) : null
  }
})

/** 通用组件Popover：统一弹出层。 */
export const CommonPopover = defineComponent({
  name: '通用组件Popover',
  props: { label: { type: String, default: '打开浮层' } },
  setup(props, { slots }) {
    /** Popover 是否展开。 */
    const open = ref(false)

    return () => h('div', { class: 'ncx-common-popover' }, [h(CommonButton, { onClick: () => (open.value = !open.value) }, () => props.label), open.value ? h('div', { class: 'ncx-common-popover-panel' }, slots.default?.()) : null])
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
