// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaybackCoordinator } from '../../src/domains/player/playback-coordinator'
import appShellSource from '../../src/renderer/design-system/patterns/AppShell.vue?raw'
import MusicProgressBar from '../../src/renderer/features/music/components/MusicProgressBar.vue'
import PlayerBar from '../../src/renderer/features/music/components/PlayerBar.vue'
import playerBarSource from '../../src/renderer/features/music/components/PlayerBar.vue?raw'
import routerSource from '../../src/renderer/app/router.ts?raw'
import { useAppPreferences } from '../../src/renderer/features/settings/app-preferences'
import { useImmersivePlayerPresentation } from '../../src/renderer/features/music/immersive-player-presentation'
import { disposePlayer, usePlayer, usePlayerRuntime } from '../../src/renderer/features/music/use-player'

// -- Type Definitions

/** 测试只需要读取命名 props 的组件 wrapper 最小形状。 */
type PropsReadableWrapper = {
  /** 读取指定 props 名称的值。 */
  props: (name: string) => unknown
}

// -- State and Variables

const liquidGlassMock = vi.hoisted(() => ({
  destroy: vi.fn(),
  init: vi.fn()
}))

vi.mock('@ybouane/liquidglass', () => ({
  LiquidGlass: {
    init: liquidGlassMock.init
  }
}))

/** 测试共享的应用外观偏好。 */
const appPreferences = useAppPreferences()

// -- Functions

/** 无动画宿主的测试环境中完成沉浸播放展示层关闭。 */
async function closeImmersivePlayerImmediately(): Promise<void> {
  /** 应用级沉浸播放展示控制器。 */
  const immersivePlayer = useImmersivePlayerPresentation()
  /** 当前可能等待根层 after-leave 的关闭任务。 */
  const closing = immersivePlayer.close()
  await immersivePlayer.completeClose()
  await closing
}

// -- Tests

describe('PlayerBar 控件区域 UI 规范测试', () => {
  beforeEach(async () => {
    liquidGlassMock.destroy.mockReset()
    liquidGlassMock.init.mockReset()
    liquidGlassMock.init.mockResolvedValue({
      destroy: liquidGlassMock.destroy
    })
    appPreferences.setTheme('system')
    disposePlayer()
    await closeImmersivePlayerImmediately()
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    appPreferences.setTheme('system')
    disposePlayer()
    await closeImmersivePlayerImmediately()
  })

  it('控件区域渲染 player-transport 容器并使用 CommonIconButton 组件呈现控件', () => {
    const wrapper = mount(PlayerBar)
    const transport = wrapper.find('.player-transport')

    expect(transport.exists()).toBe(true)

    // 查找所有 icon 按钮组件
    const iconButtons = transport.findAllComponents({ name: '通用组件IconButton' })
    expect(iconButtons.length).toBe(4)

    // 四个按钮分别为：播放模式、上一首、暂停/播放、下一首
    const [modeBtn, prevBtn, playBtn, nextBtn] = iconButtons

    expect(modeBtn.attributes('aria-label')).toBeDefined()
    expect(prevBtn.attributes('aria-label')).toBe('上一首')
    expect(playBtn.attributes('aria-label')).toBe('播放')
    expect(nextBtn.attributes('aria-label')).toBe('下一首')
  })

  it('使用官方 LiquidGlass 初始化播放器控制栏材质层', async () => {
    const wrapper = mount(PlayerBar)
    const glass = wrapper.find('.player-bar-glass')

    expect(glass.exists()).toBe(true)
    expect(glass.attributes('data-glass-material')).toBe('regular')
    await vi.waitFor(() => expect(liquidGlassMock.init).toHaveBeenCalledTimes(1))

    const options = liquidGlassMock.init.mock.calls[0]?.[0] as {
      root: HTMLElement
      glassElements: HTMLElement[]
    }
    expect(options.root).toBe(glass.element.parentElement)
    expect(options.glassElements).toEqual([glass.element])
    expect(playerBarSource).toContain("from '@ybouane/liquidglass'")

    wrapper.unmount()
    expect(liquidGlassMock.destroy).toHaveBeenCalledTimes(1)
  })

  it('紧凑窗口仍保留官方 LiquidGlass 初始化', () => {
    expect(playerBarSource).toContain('@media (width < 1100px)')
    expect(playerBarSource).toContain('void initializePlayerBarGlass()')
    expect(playerBarSource).not.toContain('LiquidGlass.vue')
  })

  it('将 AppShell 根节点标记为 LiquidGlass 的逐帧动态采样源', () => {
    expect(appShellSource).toMatch(/class="ncx-app-shell"\s+data-dynamic/)
    expect(playerBarSource).toContain('const glassRoot = glassElement?.parentElement')
  })

  it('小云页直接隐藏 PlayerBar 且组件不保留页面特判与收缩动画', () => {
    expect(routerSource).toMatch(/path: '\/agent'[\s\S]*?playerBar: 'hide'[\s\S]*?keepAlive: true/)
    expect(playerBarSource).not.toContain('isAgentPage')
    expect(playerBarSource).not.toContain('is-compact')
    expect(playerBarSource).not.toContain("from 'vue-router'")
  })

  it('PlayerBar 加载脉冲尊重系统减少动态效果设置', () => {
    expect(playerBarSource).toContain('@media (prefers-reduced-motion: reduce)')
    expect(playerBarSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.player-busy[\s\S]*?animation: none;/)
  })

  it('浅色使用 Regular Glass，深色使用官方 Dark Glass 参数', async () => {
    appPreferences.setTheme('dark')
    const wrapper = mount(PlayerBar)
    const glass = wrapper.find('.player-bar-glass')

    expect(glass.attributes('data-glass-material')).toBe('dark')
    expect(JSON.parse(glass.attributes('data-config') ?? '{}')).toMatchObject({
      brightness: -0.3,
      blurAmount: 0.25
    })

    appPreferences.setTheme('light')
    await wrapper.vm.$nextTick()

    expect(glass.attributes('data-glass-material')).toBe('regular')
    expect(JSON.parse(glass.attributes('data-config') ?? '{}')).toEqual({
      cornerRadius: 30,
      zRadius: 30
    })
  })

  it('跟随系统时响应系统深浅色变化', async () => {
    const colorSchemeListeners = new Set<(event: MediaQueryListEvent) => void>()
    let matches = true
    const colorSchemeQuery = {
      get matches() {
        return matches
      },
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        colorSchemeListeners.add(listener as (event: MediaQueryListEvent) => void)
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        colorSchemeListeners.delete(listener as (event: MediaQueryListEvent) => void)
      }
    } as MediaQueryList
    vi.stubGlobal('matchMedia', vi.fn(() => colorSchemeQuery))

    const wrapper = mount(PlayerBar)
    const glass = wrapper.find('.player-bar-glass')

    await wrapper.vm.$nextTick()
    expect(glass.attributes('data-glass-material')).toBe('dark')

    matches = false
    for (const listener of colorSchemeListeners) {
      listener({ matches } as MediaQueryListEvent)
    }
    await wrapper.vm.$nextTick()

    expect(glass.attributes('data-glass-material')).toBe('regular')

    wrapper.unmount()
    expect(colorSchemeListeners.size).toBe(0)
  })

  it('播放/暂停 icon 按钮具有 default 尺寸与 ghost 变体', () => {
    const wrapper = mount(PlayerBar)
    const transport = wrapper.find('.player-transport')
    const iconButtons = transport.findAllComponents({ name: '通用组件IconButton' })

    const playBtn = iconButtons[2]
    expect(playBtn.props('size')).toBe('default')
    expect(playBtn.props('variant')).toBe('ghost')
  })

  it('上一首、下一首 icon 按钮具有 default 尺寸与 ghost 变体', () => {
    const wrapper = mount(PlayerBar)
    const transport = wrapper.find('.player-transport')
    const iconButtons = transport.findAllComponents({ name: '通用组件IconButton' })

    const [, prevBtn, , nextBtn] = iconButtons
    expect(prevBtn.props('size')).toBe('default')
    expect(prevBtn.props('variant')).toBe('ghost')
    expect(nextBtn.props('size')).toBe('default')
    expect(nextBtn.props('variant')).toBe('ghost')
  })

  it('切歌时长尚未就绪时禁用百分比点击且不把 1ms 误当有效范围', () => {
    disposePlayer()
    /** 模拟切歌后已存在、但尚未取得 metadata 时长的新曲目。 */
    const pendingTrack = {
      trackId: 'pending-duration-track',
      name: 'Pending Duration',
      artists: ['Artist'],
      durationMs: null,
      album: 'Album'
    }
    vi.spyOn(PlaybackCoordinator.prototype, 'getSnapshot').mockReturnValue({
      playback: {
        status: 'loading',
        intent: 'play',
        track: pendingTrack,
        generation: 1,
        positionMs: 0,
        durationMs: null,
        bufferedMs: 0,
        volume: 1,
        muted: false,
        seeking: false,
        error: null,
        actualQuality: null,
        downgraded: false
      },
      queue: {
        items: [{
          queueItemId: 'pending-duration-item',
          track: pendingTrack,
          source: { kind: 'playlist', playlistId: 'pl-1' },
          addedAt: 1700000000000
        }],
        currentItemId: 'pending-duration-item',
        mode: 'loop',
        revision: 1
      },
      quality: 'auto'
    })

    /** 时长尚未就绪时的 PlayerBar 测试实例。 */
    const wrapper = mount(PlayerBar)
    /** PlayerBar 使用的独立音乐进度条。 */
    const progressBar = wrapper.findComponent(MusicProgressBar)

    expect(progressBar.props('disabled')).toBe(true)
    expect(progressBar.props('max')).toBe(1)
    expect(progressBar.attributes('aria-disabled')).toBe('true')
  })

  it('音乐控制栏 icon button 的 tip 显式指定左右方向', () => {
    const wrapper = mount(PlayerBar)
    const transport = wrapper.find('.player-transport')
    const output = wrapper.find('.player-output')

    /** 传输控制区 icon 按钮组件。 */
    const transportButtons = transport.findAllComponents({
      name: '通用组件IconButton'
    }) as PropsReadableWrapper[]

    /** 输出控制区 icon 按钮组件。 */
    const outputButtons = output.findAllComponents({
      name: '通用组件IconButton'
    }) as PropsReadableWrapper[]

    expect(transportButtons.map((button) => button.props('tooltipPlacement'))).toEqual(['right', 'right', 'left', 'left'])
    expect(outputButtons.map((button) => button.props('tooltipPlacement'))).toEqual(['left', 'left'])
  })

  it('点击上一首、下一首、暂停/播放能够触发对应的播放器指令', async () => {
    disposePlayer()
    const mockTrack = { trackId: '1', name: 'Test Song', artists: ['Artist'], durationMs: 180000, album: 'Album' }
    vi.spyOn(PlaybackCoordinator.prototype, 'getSnapshot').mockReturnValue({
      playback: {
        status: 'idle',
        intent: 'pause',
        track: mockTrack,
        generation: 0,
        positionMs: 0,
        durationMs: 180000,
        bufferedMs: 0,
        volume: 1,
        muted: false,
        seeking: false,
        error: null,
        actualQuality: null,
        downgraded: false
      },
      queue: {
        items: [{ queueItemId: '1', track: mockTrack, source: { kind: 'playlist', playlistId: 'pl-1' }, addedAt: 1700000000000 }],
        currentItemId: '1',
        mode: 'loop',
        revision: 1
      },
      quality: 'auto'
    })

    const previousSpy = vi.spyOn(PlaybackCoordinator.prototype, 'previous').mockResolvedValue(undefined)
    const nextSpy = vi.spyOn(PlaybackCoordinator.prototype, 'next').mockResolvedValue(undefined)
    const toggleSpy = vi.spyOn(PlaybackCoordinator.prototype, 'toggle').mockResolvedValue(undefined)

    const wrapper = mount(PlayerBar)
    const transport = wrapper.find('.player-transport')
    const iconButtons = transport.findAllComponents({ name: '通用组件IconButton' })

    const [, prevBtn, playBtn, nextBtn] = iconButtons

    await prevBtn.trigger('click')
    expect(previousSpy).toHaveBeenCalledTimes(1)

    await nextBtn.trigger('click')
    expect(nextSpy).toHaveBeenCalledTimes(1)

    await playBtn.trigger('click')
    expect(toggleSpy).toHaveBeenCalledTimes(1)
  })

  it('仅歌曲封面作为沉浸播放页入口并在点击后打开根层展示状态', async () => {
    /** 带封面的当前播放曲目。 */
    const mockTrack = {
      trackId: 'immersive-1',
      name: 'Immersive Song',
      artists: ['Artist'],
      durationMs: 180000,
      album: 'Album',
      artwork: [{ src: 'https://example.com/cover.jpg', sizes: '96x96', type: 'image/jpeg' }]
    }
    vi.spyOn(PlaybackCoordinator.prototype, 'getSnapshot').mockReturnValue({
      playback: {
        status: 'paused',
        intent: 'pause',
        track: mockTrack,
        generation: 0,
        positionMs: 0,
        durationMs: 180000,
        bufferedMs: 0,
        volume: 1,
        muted: false,
        seeking: false,
        error: null,
        actualQuality: null,
        downgraded: false
      },
      queue: {
        items: [{
          queueItemId: 'immersive-item-1',
          track: mockTrack,
          source: { kind: 'playlist', playlistId: 'pl-1' },
          addedAt: 1700000000000
        }],
        currentItemId: 'immersive-item-1',
        mode: 'loop',
        revision: 1
      },
      quality: 'auto'
    })

    /** 应用级沉浸播放展示控制器。 */
    const immersivePlayer = useImmersivePlayerPresentation()
    /** 当前 PlayerBar 测试实例。 */
    const wrapper = mount(PlayerBar)
    /** 独立的封面展开按钮。 */
    const coverButton = wrapper.find('.player-track-cover-button')

    expect(coverButton.attributes('aria-label')).toContain('Immersive Song')
    expect(wrapper.find('.player-track').attributes('role')).toBeUndefined()
    expect(wrapper.find('.player-track-cover').exists()).toBe(true)
    expect(playerBarSource).not.toContain('viewTransitionName')
    expect(playerBarSource).not.toContain('ncx-now-playing-artwork')

    await coverButton.trigger('click')
    await vi.waitFor(() => expect(immersivePlayer.isOpen.value).toBe(true))
    await closeImmersivePlayerImmediately()
  })

  it('当存在播放 notice 时渲染 CommonToast 浮窗组件并能在关闭时清除提示', async () => {
    disposePlayer()
    const playerRuntime = usePlayerRuntime()
    const player = usePlayer()
    const wrapper = mount(PlayerBar)

    expect(wrapper.findComponent({ name: '通用组件Toast' }).props('visible')).toBe(false)

    ;(playerRuntime.coordinator as unknown as { emit: (event: unknown) => void }).emit({
      type: 'track-unplayable',
      trackId: '101',
      message: '《Test Song》当前无法播放，已自动跳过。'
    })

    await wrapper.vm.$nextTick()

    const toast = wrapper.findComponent({ name: '通用组件Toast' })
    expect(toast.props('visible')).toBe(true)
    expect(toast.props('message')).toBe('《Test Song》当前无法播放，已自动跳过。')

    await toast.vm.$emit('close')
    await wrapper.vm.$nextTick()

    expect(player.notice.value).toBeNull()
  })

  it('底部音乐控制 bar 移除音质展示标签', () => {
    disposePlayer()
    const mockTrack = {
      trackId: '1',
      name: 'Test Song',
      artists: ['Artist A', 'Artist B'],
      durationMs: 180000,
      album: 'Album'
    }
    vi.spyOn(PlaybackCoordinator.prototype, 'getSnapshot').mockReturnValue({
      playback: {
        status: 'playing',
        intent: 'play',
        track: mockTrack,
        generation: 0,
        positionMs: 5000,
        durationMs: 180000,
        bufferedMs: 10000,
        volume: 1,
        muted: false,
        seeking: false,
        error: null,
        actualQuality: 'jyeffect',
        downgraded: true
      },
      queue: {
        items: [{ queueItemId: '1', track: mockTrack, source: { kind: 'playlist', playlistId: 'pl-1' }, addedAt: 1700000000000 }],
        currentItemId: '1',
        mode: 'loop',
        revision: 1
      },
      quality: 'auto'
    })

    const wrapper = mount(PlayerBar)
    const trackMeta = wrapper.find('.player-track-meta')

    expect(trackMeta.exists()).toBe(true)
    expect(trackMeta.text()).toBe('Artist A / Artist B')
    expect(wrapper.find('.player-quality').exists()).toBe(false)
    expect(trackMeta.text()).not.toContain('高清环绕声')
    expect(trackMeta.text()).not.toContain('已降级')
  })
})
