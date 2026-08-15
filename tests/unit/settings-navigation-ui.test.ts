import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS_TAB,
  normalizeSettingsTab,
  SETTINGS_NAVIGATION_GROUPS,
  SETTINGS_SEARCH_ITEMS
} from '../../src/renderer/features/settings/settings-navigation'

// ========= 变量 =========

/** 应用壳层样式源码，用于锁定设置当前项的轻量选中外观。 */
const appShellStyleSource = readFileSync(
  join(process.cwd(), 'src/renderer/design-system/patterns/app-shell.css'),
  'utf8'
)

/** 设置面板源码集合，用于防止重新引入未复用的原生表单控件。 */
const settingsPanelSources = [
  'ExtensionsSettingsPanel.vue',
  'ModelSettingsPanel.vue',
  'PersonalizationSettingsPanel.vue',
  'SettingsPage.vue'
].map((fileName) => readFileSync(
  join(process.cwd(), 'src/renderer/features/settings', fileName),
  'utf8'
))

// ========= 测试区 =========

describe('settings navigation UI contract', () => {
  it('默认进入常规设置并兼容旧扩展链接', () => {
    expect(DEFAULT_SETTINGS_TAB).toBe('general')
    expect(normalizeSettingsTab(undefined)).toBe('general')
    expect(normalizeSettingsTab('extensions')).toBe('mcp')
  })

  it('按产品约定固定 Agent 分组及其顺序', () => {
    /** Agent 设置导航分组。 */
    const agentGroup = SETTINGS_NAVIGATION_GROUPS.find((group) => group.label === 'Agent')
    expect(agentGroup?.items.map((item) => item.label)).toEqual([
      '模型',
      '小云',
      'MCP',
      'Skill',
      '语音'
    ])
  })

  it('为主要设置能力提供页面内搜索定位目标', () => {
    expect(SETTINGS_SEARCH_ITEMS.some((item) => item.targetId === 'setting-close-window')).toBe(true)
    expect(SETTINGS_SEARCH_ITEMS.some((item) => item.targetId === 'setting-mcp-servers')).toBe(true)
    expect(SETTINGS_SEARCH_ITEMS.some((item) => item.targetId === 'setting-skill-install')).toBe(true)
    expect(SETTINGS_SEARCH_ITEMS.some((item) => item.targetId === 'setting-lyric-font-weight')).toBe(true)
  })

  it('提供超大号歌词和完整字重预设', () => {
    /** 音乐设置页源码。 */
    const settingsPageSource = settingsPanelSources[3] ?? ''

    expect(settingsPageSource).toContain("{ label: '超大号', value: 'extraLarge' }")
    expect(settingsPageSource).toContain("{ label: '细', value: 'light' }")
    expect(settingsPageSource).toContain("{ label: '常规', value: 'regular' }")
    expect(settingsPageSource).toContain("{ label: '中粗', value: 'semibold' }")
    expect(settingsPageSource).toContain("{ label: '粗体', value: 'bold' }")
    expect(settingsPageSource).toContain("{ label: '超粗体', value: 'heavy' }")
  })

  it('将歌词焦点、动效、字号、字重与已唱歌词配置归属到外观标签', () => {
    /** 歌词外观设置项 ID 列表。 */
    const lyricAppearanceTargetIds = [
      'setting-lyric-alignment',
      'setting-lyric-motion',
      'setting-lyric-font-size',
      'setting-lyric-font-weight',
      'setting-hide-passed-lyrics'
    ]

    for (const targetId of lyricAppearanceTargetIds) {
      /** 搜索索引中匹配的设置项。 */
      const item = SETTINGS_SEARCH_ITEMS.find((entry) => entry.targetId === targetId)
      expect(item?.tab).toBe('appearance')
    }

    /** 设置页源码。 */
    const settingsPageSource = settingsPanelSources[3] ?? ''
    expect(settingsPageSource).toContain('title="歌词页"')
  })

  it('让当前设置项复用 hover 背景且复用通用表单组件', () => {
    expect(appShellStyleSource).toContain('.settings-sidebar-item.is-active:hover')
    expect(appShellStyleSource).toContain('background: var(--ncx-control-hover);')
    for (const source of settingsPanelSources) {
      expect(source).not.toMatch(/<(?:input|textarea|select)\b/u)
    }
  })
})
