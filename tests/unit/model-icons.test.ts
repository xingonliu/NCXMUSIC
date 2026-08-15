import { describe, expect, it } from 'vitest'
import {
  MODEL_ICON_PRESETS,
  fetchIconSvg,
  getModelInitials,
  searchYesIcons
} from '../../src/renderer/features/settings/model-icons'

// ========= 测试 =========

describe('model icons helper', () => {
  it('getModelInitials 正确提取中文和英文的前两个字符作为文字头像', () => {
    expect(getModelInitials('OpenAI')).toBe('Op')
    expect(getModelInitials('Claude 3.7')).toBe('Cl')
    expect(getModelInitials('DeepSeek-V3')).toBe('De')
    expect(getModelInitials('本地 Ollama')).toBe('本地')
    expect(getModelInitials('通义千问 Qwen')).toBe('通义')
    expect(getModelInitials('   ')).toBe('AI')
    expect(getModelInitials('')).toBe('AI')
  })

  it('MODEL_ICON_PRESETS 包含常用品牌与通用概念预设', () => {
    expect(MODEL_ICON_PRESETS.length).toBeGreaterThan(10)
    expect(MODEL_ICON_PRESETS.some((item) => item.id === 'simple-icons:openai')).toBe(true)
    expect(MODEL_ICON_PRESETS.some((item) => item.id === 'simple-icons:anthropic')).toBe(true)
    expect(MODEL_ICON_PRESETS.some((item) => item.id === 'simple-icons:deepseek')).toBe(true)
    expect(MODEL_ICON_PRESETS.some((item) => item.id === 'lucide:sparkles')).toBe(true)
    expect(MODEL_ICON_PRESETS.some((item) => item.id === 'lucide:bot')).toBe(true)
  })

  it('fetchIconSvg 能够命中常用高频嵌入图标', async () => {
    const openaiSvg = await fetchIconSvg('simple-icons:openai')
    expect(openaiSvg).toContain('<svg')
    expect(openaiSvg).toContain('viewBox')

    const botSvg = await fetchIconSvg('lucide:bot')
    expect(botSvg).toContain('<svg')
    expect(botSvg).toContain('rect')
  })

  it('searchYesIcons 在空检索词时返回空数组', async () => {
    const emptyResult = await searchYesIcons('   ')
    expect(emptyResult).toEqual([])
  })
})
