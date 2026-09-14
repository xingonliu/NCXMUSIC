// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppShell from '../../src/renderer/design-system/patterns/AppShell.vue'
import HorizontalMediaRail from '../../src/renderer/features/music/components/HorizontalMediaRail.vue'

vi.mock('../../src/renderer/features/account/account-session-store', async () => {
  const { ref } = await import('vue')
  return { useAccountSessionStore: () => ({ snapshot: ref(null), initialize: async () => {} }) }
})

// -- Constants

const EmptyPage = defineComponent({ template: '<div>Page content</div>' })
const routeNames = ['discover', 'browse', 'search', 'agent', 'design-system-lab', 'profile', 'settings', 'playlist-detail', 'liked-songs']

// -- State

const resizeCallbacks: Array<() => void> = []
const wrappers: Array<{ unmount(): void }> = []

// -- Functions

async function mountShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: routeNames.map(name => ({ path: '/' + name, name, component: EmptyPage, meta: { pageLevel: 1 as const, title: name, playerBar: 'hide' as const } }))
  })
  await router.push('/discover')
  const wrapper = mount(AppShell, {
    global: { plugins: [router], stubs: { PlaylistNavigation: true, SettingsSidebar: true } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  const main = wrapper.get('main').element as HTMLElement
  let maximumScroll = 2000
  main.scrollTo = vi.fn((options: ScrollToOptions) => { main.scrollTop = Math.min(options.top ?? 0, maximumScroll) }) as typeof main.scrollTo
  return { router, wrapper, main, setMaximumScroll: (value: number) => { maximumScroll = value } }
}

function opacity(wrapper: Awaited<ReturnType<typeof mountShell>>['wrapper']): string {
  return (wrapper.get('.ncx-page-header').element as HTMLElement).style.getPropertyValue('--ncx-header-opacity')
}

// -- Lifecycle

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resizeCallbacks.push(callback) }
    observe() {}
    disconnect() {}
  })
  Object.defineProperty(window, 'ncx', {
    configurable: true,
    value: {
      platform: 'win32',
      windowControls: {
        onSnapshot: () => () => {},
        snapshot: async () => ({ platform: 'win32', fullscreen: false, maximized: false, focused: true })
      }
    }
  })
})

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  resizeCallbacks.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// -- Tests

describe('Header 与页面滚动', () => {
  it('顶部透明，离开顶部渐显；横向子容器滚动不会改变材质', async () => {
    const { wrapper, main } = await mountShell()
    expect(opacity(wrapper)).toBe('0')
    main.scrollTop = 24
    await wrapper.get('main').trigger('scroll')
    expect(opacity(wrapper)).toBe('0.5')
    main.scrollTop = 90
    await wrapper.get('main').trigger('scroll')
    expect(opacity(wrapper)).toBe('1')
    await wrapper.get('.ncx-page-frame').trigger('scroll')
    expect(opacity(wrapper)).toBe('1')
    main.scrollTop = 0
    await wrapper.get('main').trigger('scroll')
    expect(opacity(wrapper)).toBe('0')
  })

  it('返回后等待异步内容变高再恢复滚动，并同步 Header', async () => {
    const { router, wrapper, main, setMaximumScroll } = await mountShell()
    main.scrollTop = 600
    await wrapper.get('main').trigger('scroll')
    await router.push('/browse')
    await flushPromises()
    expect(main.scrollTop).toBe(0)
    expect(opacity(wrapper)).toBe('0')
    setMaximumScroll(0)
    await router.push('/discover')
    await flushPromises()
    expect(main.scrollTop).toBe(0)
    setMaximumScroll(2000)
    resizeCallbacks.forEach(callback => callback())
    await flushPromises()
    expect(main.scrollTop).toBe(600)
    expect(opacity(wrapper)).toBe('1')
  })

  it('用户开始滚动后，迟到的内容不再把页面拉回旧位置', async () => {
    const { router, wrapper, main, setMaximumScroll } = await mountShell()
    main.scrollTop = 600
    await router.push('/browse')
    await flushPromises()
    setMaximumScroll(0)
    await router.push('/discover')
    await flushPromises()
    await wrapper.get('main').trigger('wheel')
    setMaximumScroll(2000)
    resizeCallbacks.forEach(callback => callback())
    expect(main.scrollTop).toBe(0)
  })
})

describe('横向列表可见区', () => {
  it('按侧边栏右侧可用宽度翻页，并把被遮挡的键盘焦点移回正文', async () => {
    const wrapper = mount(HorizontalMediaRail, {
      attachTo: document.body,
      props: { label: '专辑', labelledby: 'albums' },
      slots: { default: '<button>Album</button>' }
    })
    wrappers.push(wrapper)
    await flushPromises()
    const viewport = wrapper.get('.media-rail-viewport').element as HTMLElement
    Object.defineProperties(viewport, { clientWidth: { value: 1200 }, scrollWidth: { value: 2400 } })
    viewport.style.paddingLeft = '280px'
    viewport.style.paddingRight = '40px'
    const scrollBy = vi.fn()
    viewport.scrollBy = scrollBy
    resizeCallbacks.forEach(callback => callback())
    await flushPromises()
    const controls = wrapper.findAll('.media-rail-controls button')
    expect(controls[0]?.attributes('disabled')).toBeDefined()
    await controls[1]!.trigger('click')
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 880, behavior: 'smooth' })
    const card = wrapper.get('.media-rail-track button')
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 1200 } as DOMRect)
    vi.spyOn(card.element, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 280 } as DOMRect)
    await card.trigger('focusin')
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -180, behavior: 'instant' })
    viewport.scrollLeft = 1200
    await wrapper.get('.media-rail-viewport').trigger('scroll')
    expect(controls[1]?.attributes('disabled')).toBeDefined()
  })
})
