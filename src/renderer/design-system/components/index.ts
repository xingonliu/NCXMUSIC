/* eslint vue/multi-word-component-names: off, vue/one-component-per-file: off */
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, Teleport, Transition, watch, type PropType } from 'vue'

// ========= 类型 =========

/** 通用组件尺寸。 */
type CommonComponentSize = 'compact' | 'default' | 'prominent'

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
    delay: { type: Number, default: 300 },
    /** 是否禁用提示。 */
    disabled: { type: Boolean, default: false }
  },
  setup(props, { slots }) {
    /** 提示框是否处于开启显示状态。 */
    const visible = ref(false)
    /** 延迟计时器。 */
    let timer: ReturnType<typeof setTimeout> | null = null

    /** 鼠标移入逻辑。 */
    function handleMouseEnter(): void {
      if (props.disabled) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        visible.value = true
      }, props.delay)
    }

    /** 鼠标移出逻辑。 */
    function handleMouseLeave(): void {
      if (timer) clearTimeout(timer)
      visible.value = false
    }

    /** 获得焦点。 */
    function handleFocusIn(): void {
      if (props.disabled) return
      if (timer) clearTimeout(timer)
      visible.value = true
    }

    /** 失去焦点。 */
    function handleFocusOut(): void {
      if (timer) clearTimeout(timer)
      visible.value = false
    }

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

    function openMenu(event: MouseEvent): void {
      if (props.disabled) return
      event.preventDefault()
      event.stopPropagation()

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
      const panelEl = document.querySelector('.ncx-common-context-panel-teleport')
      if (panelEl?.contains(e.target as Node)) return
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
                class: 'ncx-common-modal',
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
                class: joinClasses('ncx-common-modal', 'ncx-common-modal-alert', `ncx-common-modal-alert-${props.type}`),
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
      h(Transition, { name: 'ncx-drawer-slide' }, () =>
        props.visible
          ? h('div', {
              class: joinClasses('ncx-common-overlay', 'ncx-common-overlay-drawer', `ncx-common-overlay-drawer-${props.placement}`),
              role: 'presentation',
              onClick: handleOverlayClick
            }, [
              h('aside', {
                class: joinClasses('ncx-common-drawer', `ncx-common-drawer-${props.placement}`),
                style: { width: props.width },
                'aria-label': props.title
              }, [
                h('header', { class: 'ncx-common-drawer-header' }, [
                  h('h2', { class: 'ncx-common-drawer-title' }, props.title),
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
