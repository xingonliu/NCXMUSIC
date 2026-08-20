// @vitest-environment happy-dom
import { computed } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import {
  appPrimaryNavigationSections,
  appSettingsNavigationItem
} from '../../src/renderer/app/navigation'
import { useAppPreferences } from '../../src/renderer/features/settings/app-preferences'
import {
  setLocale,
  SUPPORTED_LOCALES,
  t,
  useI18n
} from '../../src/renderer/i18n'

// ========= 变量 =========

/** Renderer 界面偏好的本地存储键。 */
const PREFERENCES_STORAGE_KEY = 'ncx.app-preferences.v1'

// ========= 测试 =========

describe('renderer i18n', () => {
  afterEach(() => {
    useAppPreferences().setLocale('zh-CN')
    localStorage.clear()
  })

  it('exposes Chinese and English locale options', () => {
    expect(SUPPORTED_LOCALES).toEqual([
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' }
    ])
  })

  it('switches translations, route keys, and interpolation reactively', () => {
    /** 导航标签的响应式观察值。 */
    const settingsLabel = computed(() => appSettingsNavigationItem.label)

    setLocale('zh-CN')
    expect(settingsLabel.value).toBe('设置')
    expect(t('routes.songDetail')).toBe('歌曲详情')

    setLocale('en-US')
    expect(settingsLabel.value).toBe('Settings')
    expect(t('routes.songDetail')).toBe('Song Details')
    expect(t('music.search.liked', { song: 'Golden Hour' }))
      .toBe('Added “Golden Hour” to Liked Songs.')
    expect(document.documentElement.lang).toBe('en-US')
  })

  it('updates message dictionaries consumed directly by components', () => {
    /** 测试使用的国际化状态。 */
    const i18n = useI18n()

    /** 当前语言下的播放器播放按钮文案。 */
    const playLabel = computed(() => i18n.messages.value.player.play)

    setLocale('zh-CN')
    expect(playLabel.value).toBe('播放')
    setLocale('en-US')
    expect(playLabel.value).toBe('Play')
  })

  it('keeps navigation getters connected to the active locale', () => {
    /** 侧栏第一个主导航条目。 */
    const discoverItem = appPrimaryNavigationSections[0]?.items[0]
    expect(discoverItem).toBeDefined()

    setLocale('zh-CN')
    expect(discoverItem?.label).toBe('发现音乐')
    setLocale('en-US')
    expect(discoverItem?.label).toBe('Discover')
  })

  it('persists the selected locale with the existing app preferences', () => {
    /** 应用偏好组合式接口。 */
    const appPreferences = useAppPreferences()
    appPreferences.setLocale('en-US')

    /** 写入本地存储的完整偏好对象。 */
    const storedPreferences = JSON.parse(
      localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}'
    ) as Record<string, unknown>

    expect(storedPreferences['locale']).toBe('en-US')
    expect(appPreferences.preferences.value.locale).toBe('en-US')
  })

  it('returns unknown keys unchanged for safe incremental migration', () => {
    setLocale('en-US')
    expect(t('missing.translation.key')).toBe('missing.translation.key')
  })
})
