// @vitest-environment happy-dom
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import { PlaybackCoordinator } from '../../src/domains/player/playback-coordinator'
import {
  calculateVolumeStep,
  isEditableTarget,
  isSearchRoute,
  isSliderTarget,
  usePlayerKeyboardShortcuts
} from '../../src/renderer/features/music/use-player-keyboard-shortcuts'
import { disposePlayer } from '../../src/renderer/features/music/use-player'

// ========= 辅助组件与数据 =========

/** 模拟曲目数据。 */
const mockTrack = {
  trackId: 'track-1',
  name: '测试歌曲',
  artists: ['歌手'],
  durationMs: 180000,
  album: '测试专辑'
}

/**
 * 包装快捷键 Hook 的测试宿主组件。
 */
function createShortcutTestHost(options: {
  showPlayerBar: boolean
  isImmersivePlayerOpen: boolean
  routeName?: string
  routePath?: string
}) {
  return defineComponent({
    setup() {
      const showPlayerBar = ref(options.showPlayerBar)
      const isImmersivePlayerOpen = ref(options.isImmersivePlayerOpen)
      const route = {
        name: options.routeName ?? 'discover',
        path: options.routePath ?? '/discover',
        meta: {},
        params: {},
        query: {},
        fullPath: options.routePath ?? '/discover',
        hash: '',
        matched: [],
        redirectedFrom: undefined
      } as unknown as RouteLocationNormalizedLoaded

      usePlayerKeyboardShortcuts({
        showPlayerBar,
        isImmersivePlayerOpen,
        route
      })

      return { showPlayerBar, isImmersivePlayerOpen }
    },
    render() {
      return h('div', { class: 'test-host' })
    }
  })
}

// ========= 测试用例 =========

describe('播放器全局快捷键单元测试', () => {
  beforeEach(() => {
    disposePlayer()
    vi.spyOn(PlaybackCoordinator.prototype, 'getSnapshot').mockReturnValue({
      playback: {
        status: 'playing',
        intent: 'play',
        track: mockTrack,
        generation: 1,
        positionMs: 1000,
        durationMs: 180000,
        bufferedMs: 5000,
        volume: 0.8,
        muted: false,
        seeking: false,
        error: null,
        actualQuality: null,
        downgraded: false
      },
      queue: {
        items: [{
          queueItemId: 'item-1',
          track: mockTrack,
          source: { kind: 'playlist', playlistId: 'pl-1' },
          addedAt: 1700000000000
        }],
        currentItemId: 'item-1',
        mode: 'loop',
        revision: 1
      },
      quality: 'auto'
    })
  })

  afterEach(() => {
    disposePlayer()
    vi.restoreAllMocks()
  })

  describe('辅助工具函数', () => {
    it('isSearchRoute 正确识别搜索页与搜索结果页', () => {
      expect(isSearchRoute({ name: 'search', path: '/search' })).toBe(true)
      expect(isSearchRoute({ name: 'search-results', path: '/search/results' })).toBe(true)
      expect(isSearchRoute({ name: 'custom', path: '/search/anything' })).toBe(true)
      expect(isSearchRoute({ name: 'discover', path: '/discover' })).toBe(false)
      expect(isSearchRoute({ name: 'browse', path: '/browse' })).toBe(false)
    })

    it('calculateVolumeStep 正确按 5% 步进并限定在 [0, 1] 范围', () => {
      expect(calculateVolumeStep(0.8, 'up')).toBe(0.85)
      expect(calculateVolumeStep(0.85, 'down')).toBe(0.8)
      expect(calculateVolumeStep(0.98, 'up')).toBe(1)
      expect(calculateVolumeStep(0.02, 'down')).toBe(0)
      expect(calculateVolumeStep(1, 'up')).toBe(1)
      expect(calculateVolumeStep(0, 'down')).toBe(0)
    })

    it('isEditableTarget 正确识别输入控件与可编辑元素', () => {
      const input = document.createElement('input')
      const textarea = document.createElement('textarea')
      const select = document.createElement('select')
      const div = document.createElement('div')
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'

      expect(isEditableTarget(input)).toBe(true)
      expect(isEditableTarget(textarea)).toBe(true)
      expect(isEditableTarget(select)).toBe(true)
      expect(isEditableTarget(div)).toBe(false)
      expect(isEditableTarget(editableDiv)).toBe(true)
    })

    it('isSliderTarget 正确识别滑块控件', () => {
      const slider = document.createElement('div')
      slider.setAttribute('role', 'slider')
      const range = document.createElement('input')
      range.type = 'range'
      const normalDiv = document.createElement('div')

      expect(isSliderTarget(slider)).toBe(true)
      expect(isSliderTarget(range)).toBe(true)
      expect(isSliderTarget(normalDiv)).toBe(false)
    })
  })

  describe('快捷键触发与页面状态生效规则', () => {
    it('在普通页面显示音乐条时，按空格键触发播放暂停', () => {
      const toggleSpy = vi.spyOn(PlaybackCoordinator.prototype, 'toggle').mockResolvedValue(undefined)

      const Host = createShortcutTestHost({
        showPlayerBar: true,
        isImmersivePlayerOpen: false,
        routeName: 'discover'
      })
      const wrapper = mount(Host)

      const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ', cancelable: true })
      window.dispatchEvent(event)

      expect(toggleSpy).toHaveBeenCalledTimes(1)
      expect(event.defaultPrevented).toBe(true)

      wrapper.unmount()
    })

    it('在搜索页即使音乐条显示也禁用快捷键', () => {
      const toggleSpy = vi.spyOn(PlaybackCoordinator.prototype, 'toggle').mockResolvedValue(undefined)
      const prevSpy = vi.spyOn(PlaybackCoordinator.prototype, 'previous').mockResolvedValue(undefined)
      const nextSpy = vi.spyOn(PlaybackCoordinator.prototype, 'next').mockResolvedValue(undefined)
      const volSpy = vi.spyOn(PlaybackCoordinator.prototype, 'setVolume')

      const Host = createShortcutTestHost({
        showPlayerBar: true,
        isImmersivePlayerOpen: false,
        routeName: 'search',
        routePath: '/search'
      })
      const wrapper = mount(Host)

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))

      expect(toggleSpy).not.toHaveBeenCalled()
      expect(prevSpy).not.toHaveBeenCalled()
      expect(nextSpy).not.toHaveBeenCalled()
      expect(volSpy).not.toHaveBeenCalled()

      wrapper.unmount()
    })

    it('在沉浸歌词页中（哪怕底层在搜索页）快捷键正常生效', () => {
      const toggleSpy = vi.spyOn(PlaybackCoordinator.prototype, 'toggle').mockResolvedValue(undefined)

      const Host = createShortcutTestHost({
        showPlayerBar: true,
        isImmersivePlayerOpen: true,
        routeName: 'search',
        routePath: '/search'
      })
      const wrapper = mount(Host)

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }))
      expect(toggleSpy).toHaveBeenCalledTimes(1)

      wrapper.unmount()
    })

    it('音乐条隐藏且未打开沉浸页时禁用快捷键', () => {
      const toggleSpy = vi.spyOn(PlaybackCoordinator.prototype, 'toggle').mockResolvedValue(undefined)

      const Host = createShortcutTestHost({
        showPlayerBar: false,
        isImmersivePlayerOpen: false,
        routeName: 'settings',
        routePath: '/settings'
      })
      const wrapper = mount(Host)

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }))
      expect(toggleSpy).not.toHaveBeenCalled()

      wrapper.unmount()
    })

    it('← 和 → 键能够触发上一首与下一首', () => {
      const prevSpy = vi.spyOn(PlaybackCoordinator.prototype, 'previous').mockResolvedValue(undefined)
      const nextSpy = vi.spyOn(PlaybackCoordinator.prototype, 'next').mockResolvedValue(undefined)

      const Host = createShortcutTestHost({
        showPlayerBar: true,
        isImmersivePlayerOpen: false,
        routeName: 'discover'
      })
      const wrapper = mount(Host)

      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
      window.dispatchEvent(leftEvent)
      expect(prevSpy).toHaveBeenCalledTimes(1)
      expect(leftEvent.defaultPrevented).toBe(true)

      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
      window.dispatchEvent(rightEvent)
      expect(nextSpy).toHaveBeenCalledTimes(1)
      expect(rightEvent.defaultPrevented).toBe(true)

      wrapper.unmount()
    })

    it('↑ 和 ↓ 键能够按 5% 步进调节音量并在静音时恢复', () => {
      disposePlayer()
      vi.spyOn(PlaybackCoordinator.prototype, 'getSnapshot').mockReturnValue({
        playback: {
          status: 'playing',
          intent: 'play',
          track: mockTrack,
          generation: 1,
          positionMs: 1000,
          durationMs: 180000,
          bufferedMs: 5000,
          volume: 0.8,
          muted: true,
          seeking: false,
          error: null,
          actualQuality: null,
          downgraded: false
        },
        queue: {
          items: [{
            queueItemId: 'item-1',
            track: mockTrack,
            source: { kind: 'playlist', playlistId: 'pl-1' },
            addedAt: 1700000000000
          }],
          currentItemId: 'item-1',
          mode: 'loop',
          revision: 1
        },
        quality: 'auto'
      })

      const volSpy = vi.spyOn(PlaybackCoordinator.prototype, 'setVolume')
      const muteSpy = vi.spyOn(PlaybackCoordinator.prototype, 'setMuted')

      const Host = createShortcutTestHost({
        showPlayerBar: true,
        isImmersivePlayerOpen: false,
        routeName: 'discover'
      })
      const wrapper = mount(Host)

      // 按向上键增加 5% -> 0.85，并解除静音
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true })
      window.dispatchEvent(upEvent)
      expect(volSpy).toHaveBeenCalledWith(0.85)
      expect(muteSpy).toHaveBeenCalledWith(false)
      expect(upEvent.defaultPrevented).toBe(true)

      // 按向下键减少 5% -> 0.75
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
      window.dispatchEvent(downEvent)
      expect(volSpy).toHaveBeenCalledWith(0.75)
      expect(downEvent.defaultPrevented).toBe(true)

      wrapper.unmount()
    })

    it('当焦点在可编辑输入框或带有系统修饰键时不触发快捷键', () => {
      const toggleSpy = vi.spyOn(PlaybackCoordinator.prototype, 'toggle').mockResolvedValue(undefined)

      const Host = createShortcutTestHost({
        showPlayerBar: true,
        isImmersivePlayerOpen: false,
        routeName: 'discover'
      })
      const wrapper = mount(Host)

      // 模拟焦点在 input 框
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const inputEvent = new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        bubbles: true
      })
      Object.defineProperty(inputEvent, 'target', { value: input })
      window.dispatchEvent(inputEvent)
      expect(toggleSpy).not.toHaveBeenCalled()

      // 模拟带有 Cmd 修饰键
      const cmdEvent = new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        metaKey: true
      })
      window.dispatchEvent(cmdEvent)
      expect(toggleSpy).not.toHaveBeenCalled()

      document.body.removeChild(input)
      wrapper.unmount()
    })
  })
})
