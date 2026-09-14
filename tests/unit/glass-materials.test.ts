// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommonButton, CommonDialog, CommonHeaderButton } from '../../src/renderer/design-system/components'
import { InteractiveHighlight, buttonDeform, drawButton } from '../../src/renderer/design-system/materials/demo/buttons.js'

// -- State and Variables
const wrappers: Array<ReturnType<typeof mount>> = []

// -- Lifecycle Hooks
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.unstubAllGlobals()
})

// -- Tests
describe('Demo liquid glass integration', () => {
  it('retains the demo tint and optical preset for both full buttons', () => {
    const glass = vi.fn()
    const highlight = new InteractiveHighlight()
    drawButton({ glass }, 0, 0, 120, 40, highlight)
    expect(glass).toHaveBeenLastCalledWith(expect.objectContaining({
      blur: 2, refractionHeight: 12, refractionAmount: 24, surface: [0, 0, 0, 0]
    }))
    drawButton({ glass }, 0, 0, 120, 40, highlight, { tint: [0, 0.5, 1] })
    expect(glass).toHaveBeenLastCalledWith(expect.objectContaining({ surface: [0, 0.5, 1, 0.75] }))
  })

  it('retains directional press deformation and settles after release', () => {
    const highlight = new InteractiveHighlight()
    highlight.start(0, 0)
    highlight.move(30, 8)
    for (let i = 0; i < 30; i++) highlight.step(1 / 60)
    const pressed = buttonDeform(120, 40, highlight)
    expect(pressed.sx).toBeGreaterThan(1)
    expect(pressed.tx).toBeGreaterThan(0)
    highlight.end()
    for (let i = 0; i < 240; i++) highlight.step(1 / 60)
    expect(buttonDeform(120, 40, highlight)).toMatchObject({ sx: 1, sy: 1, tx: 0, ty: 0 })
  })

  it('keeps header controls on G1 and respects explicit full button assignments', () => {
    const header = mount(CommonHeaderButton, { props: { label: 'Back' } })
    const button = mount(CommonButton, { props: { material: 'tinted', variant: 'primary' } })
    wrappers.push(header, button)
    expect(header.attributes('data-glass-material')).toBe('frost')
    expect(button.attributes('data-glass-material')).toBe('tinted')
    expect(header.find('feDisplacementMap').exists()).toBe(false)
  })

  it('does not display a dialog before its background capture completes', async () => {
    let finish!: (value: null) => void
    const capture = vi.fn(() => new Promise<null>((resolve) => { finish = resolve }))
    vi.stubGlobal('ncx', { windowControls: { captureBackdrop: capture } })
    const wrapper = mount(CommonDialog, { props: { title: 'Dialog', visible: true }, global: { stubs: { teleport: true } } })
    wrappers.push(wrapper)
    expect(capture).toHaveBeenCalledOnce()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    finish(null)
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').attributes('data-glass-material')).toBe('dialog')
  })

  it('ignores an old capture when the user has already closed the dialog', async () => {
    let finish!: (value: null) => void
    vi.stubGlobal('ncx', { windowControls: { captureBackdrop: () => new Promise<null>((resolve) => { finish = resolve }) } })
    const wrapper = mount(CommonDialog, { props: { title: 'Dialog', visible: true }, global: { stubs: { teleport: true } } })
    wrappers.push(wrapper)
    await wrapper.setProps({ visible: false })
    finish(null)
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
