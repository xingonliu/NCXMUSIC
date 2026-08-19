// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import {
  CommonAlertDialog,
  CommonCombobox,
  CommonContextMenu,
  CommonDialog,
  CommonDrawer,
  CommonDropdownMenu,
  CommonInput,
  CommonPopover,
  CommonSearchInput,
  CommonSelect,
  CommonTabs,
  CommonTextarea,
  CommonToast,
  type CommonMenuItem,
  type CommonOption
} from '../../src/renderer/design-system/components'

describe('CommonTabs macOS Design System', () => {
  const options: CommonOption[] = [
    { label: 'Tab A', value: 'a', badge: 5 },
    { label: 'Tab B', value: 'b' },
    { label: 'Tab C', value: 'c', disabled: true }
  ]

  it('正确渲染 macOS Segmented Control 胶囊样式与属性', () => {
    const wrapper = mount(CommonTabs, {
      props: {
        modelValue: 'a',
        options,
        variant: 'segmented',
        size: 'default'
      }
    })

    expect(wrapper.classes()).toContain('ncx-common-tabs-segmented')
    expect(wrapper.classes()).toContain('ncx-common-tabs-default')

    const tabs = wrapper.findAll('.ncx-common-tabs-tab')
    expect(tabs).toHaveLength(3)

    expect(tabs[0]?.classes()).toContain('ncx-common-tabs-tab-active')
    expect(tabs[0]?.attributes('aria-selected')).toBe('true')
    expect(tabs[0]?.find('.ncx-common-tabs-tab-badge').text()).toBe('5')

    expect(tabs[2]?.classes()).toContain('ncx-common-tabs-tab-disabled')
    expect(tabs[2]?.attributes('disabled')).toBeDefined()
  })

  it('点击可用的 Tab 触发 update:modelValue 与 change 事件', async () => {
    const wrapper = mount(CommonTabs, {
      props: {
        modelValue: 'a',
        options
      }
    })

    const tabs = wrapper.findAll('.ncx-common-tabs-tab')
    await tabs[1]?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
    expect(wrapper.emitted('change')).toEqual([['b']])

    // 点击禁用的 Tab 不应触发事件
    await tabs[2]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })

  it('支持渲染 default 插槽正文', () => {
    const wrapper = mount(CommonTabs, {
      props: { modelValue: 'a', options },
      slots: {
        default: () => h('div', { class: 'custom-panel' }, 'Panel Content')
      }
    })

    expect(wrapper.find('.custom-panel').text()).toBe('Panel Content')
  })
})

describe('CommonDropdownMenu macOS Design System', () => {
  const menuItems: CommonMenuItem[] = [
    { label: 'Header Title', value: 'h1', type: 'header' },
    { label: 'Item 1', value: 'item1', shortcut: '⌘1', icon: '★' },
    { label: 'Item 2', value: 'item2', checked: true },
    { label: 'Separator', value: 'sep1', type: 'separator' },
    { label: 'Delete', value: 'delete', danger: true }
  ]

  it('默认状态呈现触发按钮，点击后展开 Teleport 浮层', async () => {
    const wrapper = mount(CommonDropdownMenu, {
      attachTo: document.body,
      props: {
        label: '下拉操作',
        items: menuItems
      }
    })

    expect(wrapper.find('button').text()).toContain('下拉操作')
    expect(document.querySelector('.ncx-common-dropdown-panel-teleport')).toBeNull()

    await wrapper.find('button').trigger('click')
    await nextTick()

    const panel = document.querySelector('.ncx-common-dropdown-panel-teleport')
    expect(panel).not.toBeNull()

    const items = panel!.querySelectorAll('.ncx-common-menu-item')
    expect(items.length).toBeGreaterThan(0)
    expect(panel!.querySelector('.ncx-common-menu-header')?.textContent).toBe('Header Title')
    wrapper.unmount()
  })

  it('点击菜单条目选择后触发 select 并自动关闭菜单', async () => {
    const wrapper = mount(CommonDropdownMenu, {
      attachTo: document.body,
      props: {
        label: '下拉操作',
        items: menuItems
      }
    })

    await wrapper.find('button').trigger('click')
    await nextTick()

    const itemBtn = document.querySelector('.ncx-common-dropdown-panel-teleport button:nth-of-type(1)') as HTMLButtonElement
    itemBtn.click()
    await nextTick()

    expect(wrapper.emitted('select')).toEqual([['item1']])
    expect(document.querySelector('.ncx-common-dropdown-panel-teleport')).toBeNull()
    wrapper.unmount()
  })
})

describe('CommonContextMenu macOS Design System', () => {
  const items: CommonMenuItem[] = [
    { label: 'Copy', value: 'copy', shortcut: '⌘C' },
    { label: 'Paste', value: 'paste', shortcut: '⌘V' }
  ]

  it('右键触发 contextmenu 事件后定位并呈现浮层', async () => {
    const wrapper = mount(CommonContextMenu, {
      attachTo: document.body,
      props: { items },
      slots: {
        default: () => h('div', { class: 'target-zone' }, 'Context Area')
      }
    })

    const zone = wrapper.find('.target-zone')
    await zone.trigger('contextmenu', { clientX: 120, clientY: 240 })
    await nextTick()

    const panel = document.querySelector('.ncx-common-context-panel-teleport') as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.style.left).toBe('120px')
    expect(panel.style.top).toBe('240px')
    wrapper.unmount()
  })
})

describe('CommonToast macOS Design System', () => {
  it('正确渲染 Toast 浮窗与 Teleport 结构，仅展示 desc 正文而无 title', async () => {
    document.body.innerHTML = ''
    const wrapper = mount(CommonToast, {
      attachTo: document.body,
      props: {
        visible: true,
        type: 'success',
        message: '已经成功提交更新'
      }
    })
    await nextTick()

    const toastEl = document.querySelector('.ncx-common-toast')
    expect(toastEl).not.toBeNull()
    expect(toastEl?.classList.contains('ncx-common-toast-success')).toBe(true)
    expect(toastEl?.querySelector('.ncx-common-toast-title')).toBeNull()
    expect(toastEl?.querySelector('.ncx-common-toast-message')?.textContent).toBe('已经成功提交更新')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('点击关闭按钮触发 close 事件', async () => {
    document.body.innerHTML = ''
    const wrapper = mount(CommonToast, {
      attachTo: document.body,
      props: {
        visible: true,
        message: '测试 Toast'
      }
    })
    await nextTick()

    const closeBtn = document.querySelector('.ncx-common-toast-close') as HTMLButtonElement
    expect(closeBtn).not.toBeNull()
    closeBtn.click()
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})

describe('CommonDialog macOS Design System', () => {
  it('正确渲染 Dialog 模态窗口与插槽内容', async () => {
    const wrapper = mount(CommonDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        title: '设置窗口',
        subtitle: '系统配置选项'
      },
      slots: {
        default: () => h('div', { class: 'dialog-content' }, 'Form Content'),
        actions: () => h('button', { class: 'dialog-save' }, '保存')
      }
    })
    await nextTick()

    const overlay = document.querySelector('.ncx-common-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay?.querySelector('.ncx-common-modal-title')?.textContent).toBe('设置窗口')
    expect(overlay?.querySelector('.ncx-common-modal-subtitle')?.textContent).toBe('系统配置选项')
    expect(overlay?.querySelector('.dialog-content')?.textContent).toBe('Form Content')
    expect(overlay?.querySelector('.dialog-save')).not.toBeNull()
    wrapper.unmount()
  })

  it('按下 Esc 键触发 close 事件', async () => {
    const wrapper = mount(CommonDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        title: 'Esc 测试'
      }
    })
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('CommonAlertDialog macOS Design System', () => {
  it('渲染 macOS NSAlert 警示样式及触发 confirm/cancel 事件', async () => {
    const wrapper = mount(CommonAlertDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        type: 'danger',
        title: '确认删除？',
        description: '此操作无法撤销。',
        confirmText: '永久删除',
        cancelText: '取消'
      }
    })
    await nextTick()

    const modalAlert = document.querySelector('.ncx-common-modal-alert')
    expect(modalAlert).not.toBeNull()
    expect(modalAlert?.querySelector('.ncx-common-alert-title')?.textContent).toBe('确认删除？')
    expect(modalAlert?.querySelector('.ncx-common-alert-description')?.textContent).toBe('此操作无法撤销。')

    const buttons = modalAlert?.querySelectorAll('button')
    expect(buttons?.length).toBe(2)

    // 点击取消
    buttons?.[0]?.click()
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    // 点击确认
    buttons?.[1]?.click()
    await nextTick()
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    wrapper.unmount()
  })
})

describe('CommonDrawer macOS Design System', () => {
  it('正确渲染 Drawer 侧边抽屉面板与点击 overlay 关闭', async () => {
    const wrapper = mount(CommonDrawer, {
      attachTo: document.body,
      props: {
        visible: true,
        title: '详情面板',
        placement: 'right'
      },
      slots: {
        default: () => h('div', { class: 'drawer-body-text' }, 'Drawer Body')
      }
    })
    await nextTick()

    const drawer = document.querySelector('.ncx-common-drawer')
    expect(drawer).not.toBeNull()
    expect(drawer?.querySelector('.ncx-common-drawer-title')?.textContent).toBe('详情面板')
    expect(drawer?.querySelector('.drawer-body-text')?.textContent).toBe('Drawer Body')

    const overlay = document.querySelector('.ncx-common-overlay-drawer') as HTMLElement
    overlay.click()
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })

  it('正确渲染 headerActions 标头扩展插槽与内容容器结构', async () => {
    const wrapper = mount(CommonDrawer, {
      attachTo: document.body,
      props: {
        visible: true,
        title: '播放队列 (107)',
        placement: 'right'
      },
      slots: {
        headerActions: () => h('button', { class: 'custom-header-action' }, '清空'),
        default: () => h('div', { class: 'queue-list-fixture' }, 'List Items')
      }
    })
    await nextTick()

    const headerActions = document.querySelector('.ncx-common-drawer-header-actions')
    expect(headerActions).not.toBeNull()
    expect(headerActions?.querySelector('.custom-header-action')?.textContent).toBe('清空')

    const drawerBody = document.querySelector('.ncx-common-drawer-body')
    expect(drawerBody).not.toBeNull()
    expect(drawerBody?.querySelector('.queue-list-fixture')).not.toBeNull()

    wrapper.unmount()
  })
})

describe('CommonPopover macOS Design System', () => {
  it('点击 Trigger 按钮展开并收起 Popover Panel', async () => {
    const wrapper = mount(CommonPopover, {
      props: {
        label: '打开气泡'
      },
      slots: {
        default: () => h('div', { class: 'popover-slot' }, 'Popover Inside')
      }
    })

    expect(wrapper.find('.ncx-common-popover-panel').exists()).toBe(false)

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(wrapper.find('.ncx-common-popover-panel').exists()).toBe(true)
    expect(wrapper.find('.popover-slot').text()).toBe('Popover Inside')

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(wrapper.find('.ncx-common-popover-panel').exists()).toBe(false)
  })
})

describe('CommonInput macOS Design System', () => {
  it('正确渲染单行输入框、尺寸与禁用/错误状态', () => {
    const wrapper = mount(CommonInput, {
      props: {
        modelValue: 'hello',
        placeholder: '请输入',
        size: 'prominent',
        invalid: true,
        disabled: true
      }
    })

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('hello')
    expect(input.classes()).toContain('ncx-common-field--prominent')
    expect(input.classes()).toContain('ncx-common-field-invalid')
    expect(input.classes()).toContain('ncx-common-field-disabled')
    expect(input.attributes('aria-invalid')).toBe('true')
  })

  it('输入内容触发 update:modelValue, input, change 事件', async () => {
    const wrapper = mount(CommonInput, {
      props: { modelValue: '' }
    })

    const input = wrapper.find('input')
    await input.setValue('ncx music')

    expect(wrapper.emitted('update:modelValue')).toEqual([['ncx music']])
    expect(wrapper.emitted('input')).toEqual([['ncx music']])
    expect(wrapper.emitted('change')).toEqual([['ncx music']])
  })

  it('支持 clearable 属性与清空按钮交互', async () => {
    const wrapper = mount(CommonInput, {
      props: { modelValue: 'test value', clearable: true }
    })

    const clearBtn = wrapper.find('.ncx-common-input-clear')
    expect(clearBtn.exists()).toBe(true)

    await clearBtn.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('密码输入框默认圆点遮罩，并支持清空与明文显隐按钮', async () => {
    /** 带密码操作按钮的输入框。 */
    const wrapper = mount(CommonInput, {
      props: {
        modelValue: 'secret-key',
        type: 'password',
        clearable: true,
        revealable: true
      }
    })

    /** 原生密码输入节点。 */
    const input = wrapper.find('input')
    /** 明文显示切换按钮。 */
    const revealButton = wrapper.find('.ncx-common-input-reveal')
    expect(input.attributes('type')).toBe('password')
    expect(wrapper.find('.ncx-common-input-clear').exists()).toBe(true)
    expect(revealButton.attributes('aria-label')).toBe('显示密码')

    await revealButton.trigger('click')
    expect(input.attributes('type')).toBe('text')
    expect(revealButton.attributes('aria-label')).toBe('隐藏密码')
  })
})

describe('CommonTextarea macOS Design System', () => {
  it('正确渲染多行文本框与尺寸样式', () => {
    const wrapper = mount(CommonTextarea, {
      props: {
        modelValue: 'multiline content',
        rows: 6,
        size: 'compact',
        resize: 'none'
      }
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('multiline content')
    expect(textarea.classes()).toContain('ncx-common-textarea--compact')
    expect(textarea.attributes('rows')).toBe('6')
  })

  it('输入内容触发 update:modelValue 事件', async () => {
    const wrapper = mount(CommonTextarea, {
      props: { modelValue: '' }
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('new line text')

    expect(wrapper.emitted('update:modelValue')).toEqual([['new line text']])
  })
})

describe('CommonSearchInput macOS Design System', () => {
  it('正确渲染 macOS NSSearchField 样式、图标与尺寸', () => {
    const wrapper = mount(CommonSearchInput, {
      props: {
        modelValue: 'Jay Chou',
        placeholder: '搜索音乐',
        size: 'prominent'
      }
    })

    expect(wrapper.classes()).toContain('ncx-common-search')
    expect(wrapper.classes()).toContain('ncx-common-search--prominent')
    expect(wrapper.find('.ncx-common-search-icon').exists()).toBe(true)

    const input = wrapper.find('input[type="search"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Jay Chou')

    const clearBtn = wrapper.find('.ncx-common-search-clear')
    expect(clearBtn.exists()).toBe(true)
  })

  it('点击清空按钮触发 clear 与 update:modelValue', async () => {
    const wrapper = mount(CommonSearchInput, {
      props: { modelValue: 'Search query' }
    })

    const clearBtn = wrapper.find('.ncx-common-search-clear')
    await clearBtn.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('按下 Esc 键触发清空，按下 Enter 键触发 search 事件', async () => {
    const wrapper = mount(CommonSearchInput, {
      props: { modelValue: 'Search query' }
    })

    const input = wrapper.find('input')

    // 按下 Enter
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('search')).toEqual([['Search query']])

    // 按下 Escape
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})

describe('CommonSelect macOS Design System', () => {
  const options: CommonOption[] = [
    { label: '标准音质', value: 'standard' },
    { label: '高清音质', value: 'hq' },
    { label: '无损音质', value: 'sq', disabled: true }
  ]

  it('正确渲染 macOS NSPopUpButton 结构、双箭角指示器与选项', () => {
    const wrapper = mount(CommonSelect, {
      props: {
        modelValue: 'hq',
        options,
        placeholder: '请选择音质',
        size: 'default'
      }
    })

    expect(wrapper.classes()).toContain('ncx-common-select-wrapper')
    expect(wrapper.find('.ncx-common-select-chevron').exists()).toBe(true)

    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    expect((select.element as HTMLSelectElement).value).toBe('hq')

    const optionEls = select.findAll('option')
    // 包括 placeholder 共 4 个 option
    expect(optionEls).toHaveLength(4)
    expect(optionEls[0]?.text()).toBe('请选择音质')
    expect(optionEls[3]?.attributes('disabled')).toBeDefined()
  })

  it('选择新选项触发 update:modelValue 与 change 事件', async () => {
    const wrapper = mount(CommonSelect, {
      props: { modelValue: 'standard', options }
    })

    const select = wrapper.find('select')
    await select.setValue('hq')

    expect(wrapper.emitted('update:modelValue')).toEqual([['hq']])
    expect(wrapper.emitted('change')).toEqual([['hq']])
  })
})

describe('CommonCombobox macOS Design System', () => {
  const options: CommonOption[] = [
    { label: 'Standard', value: 'standard' },
    { label: 'High Quality', value: 'hq' }
  ]

  it('正确渲染 macOS NSComboBox 结构、下拉触发按钮与 datalist', () => {
    const wrapper = mount(CommonCombobox, {
      props: {
        modelValue: 'standard',
        options,
        placeholder: '输入或选择',
        clearable: true
      }
    })

    expect(wrapper.classes()).toContain('ncx-common-combobox')
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('standard')

    const triggerBtn = wrapper.find('.ncx-common-combobox-trigger')
    expect(triggerBtn.exists()).toBe(true)

    const clearBtn = wrapper.find('.ncx-common-combobox-clear')
    expect(clearBtn.exists()).toBe(true)

    const datalist = wrapper.find('datalist')
    expect(datalist.exists()).toBe(true)
    expect(datalist.findAll('option')).toHaveLength(2)
  })

  it('输入与清空操作触发对应事件', async () => {
    const wrapper = mount(CommonCombobox, {
      props: { modelValue: 'std', options, clearable: true }
    })

    const input = wrapper.find('input')
    await input.setValue('hq')
    expect(wrapper.emitted('update:modelValue')).toEqual([['hq']])

    const clearBtn = wrapper.find('.ncx-common-combobox-clear')
    await clearBtn.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})
