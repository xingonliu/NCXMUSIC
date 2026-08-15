import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** 模型设置面板源码。 */
const modelSettingsSource = readFileSync(
  'src/renderer/features/settings/ModelSettingsPanel.vue',
  'utf8'
)

/** OpenRouter 模型目录服务源码。 */
const modelCatalogSource = readFileSync(
  'src/infrastructure/provider/openrouter-model-catalog.ts',
  'utf8'
)

// ========= 测试 =========

describe('model settings UI contract', () => {
  it('默认展示模型列表，并将新增与删除放入通用弹窗', () => {
    expect(modelSettingsSource).toContain('title="模型列表"')
    expect(modelSettingsSource).toContain('title="新增模型"')
    expect(modelSettingsSource).toContain('<CommonDialog')
    expect(modelSettingsSource).toContain('<CommonAlertDialog')
    expect(modelSettingsSource).toContain('class="model-profile-actions"')
    expect(modelSettingsSource).toContain('<Trash2')
  })

  it('提供居中的预设与自定义分段表单及 API Key 操作按钮', () => {
    expect(modelSettingsSource).toContain('<CommonSegmentedControl')
    expect(modelSettingsSource).toContain("{ label: '预设', value: 'preset' }")
    expect(modelSettingsSource).toContain("{ label: '自定义', value: 'custom' }")
    expect(modelSettingsSource.match(/type="password"/gu)?.length).toBeGreaterThanOrEqual(3)
    expect(modelSettingsSource.match(/clearable/gu)?.length).toBeGreaterThanOrEqual(3)
    expect(modelSettingsSource.match(/revealable/gu)?.length).toBeGreaterThanOrEqual(3)
  })

  it('提供编辑模型功能与 Pencil 编辑按钮并回显 API Key', () => {
    expect(modelSettingsSource).toContain('title="编辑模型"')
    expect(modelSettingsSource).toContain('<Pencil')
    expect(modelSettingsSource).toContain('openEditDialog')
    expect(modelSettingsSource).toContain("editEditor.apiKey = profile.apiKey ?? ''")
    expect(modelSettingsSource).toContain('saveEditProfile')
  })

  it('集成 ModelIconPicker 与 ModelIconView 图标能力', () => {
    expect(modelSettingsSource).toContain('<ModelIconPicker')
    expect(modelSettingsSource).toContain('<ModelIconView')
  })

  it('同时使用 OpenRouter 模型与计数接口，并按 created 排序', () => {
    expect(modelCatalogSource).toContain('`${OPENROUTER_BASE_URL}/models`')
    expect(modelCatalogSource).toContain('`${OPENROUTER_MODELS_URL}/count`')
    expect(modelCatalogSource).toContain('right.created - left.created')
    expect(modelCatalogSource).toContain("replace(/^~/u, '')")
  })
})
