// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PlaybackCoordinator } from '../../src/domains/player/playback-coordinator'
import PlayerBar from '../../src/renderer/features/music/components/PlayerBar.vue'
import playerBarSource from '../../src/renderer/features/music/components/PlayerBar.vue?raw'
import { useImmersivePlayerPresentation } from '../../src/renderer/features/music/immersive-player-presentation'
import { disposePlayer, usePlayer, usePlayerRuntime } from '../../src/renderer/features/music/use-player'

// ========= 变量 =========

/** 测试只需要读取命名 props 的组件 wrapper 最小形状。 */
type PropsReadableWrapper = {
  /** 读取指定 props 名称的值。 */
  props: (name: string) => unknown
}

// ========= 生命周期 =========

describe('PlayerBar 控件区域 UI 规范测试', () => {
  beforeEach(() => {
    disposePlayer()
    void useImmersivePlayerPresentation().close()
  })

  afterEach(() => {
    disposePlayer()
    void useImmersivePlayerPresentation().close()
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

  it('使用 LiquidGlass 作为播放器控制栏材质层', () => {
    const wrapper = mount(PlayerBar)

    expect(wrapper.find('.player-bar-glass').exists()).toBe(true)
    expect(wrapper.find('.effect .filter').exists()).toBe(true)
  })

  it('紧凑窗口仍保留 Liquid Glass 位移滤镜', () => {
    expect(playerBarSource).toContain('@media (width < 1100px)')
    expect(playerBarSource).not.toContain('backdrop-filter: none !important')
  })

  it('支持在设置中动态切换深色/浅色模式时更新 PlayerBar 内阴影变量', () => {
    expect(playerBarSource).toContain('--ncx-player-bar-shadow')
    expect(playerBarSource).toContain(":root[data-theme='dark'] .player-bar-glass")
  })

  it('播放/暂停 icon 按钮具有 prominent 尺寸与 primary 变体', () => {
    const wrapper = mount(PlayerBar)
    const transport = wrapper.find('.player-transport')
    const iconButtons = transport.findAllComponents({ name: '通用组件IconButton' })

    const playBtn = iconButtons[2]
    expect(playBtn.props('size')).toBe('prominent')
    expect(playBtn.props('variant')).toBe('primary')
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

    await coverButton.trigger('click')
    await vi.waitFor(() => expect(immersivePlayer.isOpen.value).toBe(true))
    await immersivePlayer.close()
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
})
