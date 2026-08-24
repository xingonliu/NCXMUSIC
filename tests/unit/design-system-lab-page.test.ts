// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DesignSystemLabPage from '../../src/renderer/features/design-system/DesignSystemLabPage.vue'

describe('DesignSystemLabPage 通用组件交互测试页规范测试', () => {
  it('应当成功渲染并包含 8 大类标题', () => {
    // ========= 变量 =========
    /** 挂载通用组件交互测试页。 */
    const wrapper = mount(DesignSystemLabPage)

    // ======== 断言说明 ======
    /** 验证大类分类块数量。 */
    const categories = wrapper.findAll('.ncx-design-lab-category')
    expect(categories.length).toBe(8)

    /** 验证大类 1 到 8 的标题节点文本。 */
    const categoryTitles = wrapper.findAll('.ncx-design-lab-category-title h2')
    expect(categoryTitles.map((title) => title.text())).toEqual([
      '操作类组件 (Actions)',
      '输入类组件 (Inputs)',
      '选择类组件 (Selections)',
      '展示类组件 (Display)',
      '导航与菜单类组件 (Navigation & Menus)',
      '状态与反馈类组件 (Status & Feedback)',
      '浮层类组件 (Overlays)',
      '容器与高级布局类组件 (Containers & Layout)'
    ])
  })

  it('应当包含规范的小类分隔头与具体组件卡片', () => {
    // ========= 变量 =========
    /** 挂载通用组件交互测试页。 */
    const wrapper = mount(DesignSystemLabPage)

    // ======== 断言说明 ======
    /** 验证包含小类分隔标头。 */
    const subcategories = wrapper.findAll('.ncx-design-lab-subcategory')
    expect(subcategories.length).toBeGreaterThanOrEqual(8)

    /** 验证包含具体组件展示卡片。 */
    const componentCards = wrapper.findAll('.ncx-design-lab-component-card')
    expect(componentCards.length).toBeGreaterThanOrEqual(15)

    /** 验证包含组件名展示区。 */
    const componentNames = wrapper.findAll('.ncx-design-lab-component-name')
    expect(componentNames.some((el) => el.text().includes('CommonButton'))).toBe(true)
    expect(componentNames.some((el) => el.text().includes('CommonInput'))).toBe(true)
    expect(componentNames.some((el) => el.text().includes('CommonCheckbox'))).toBe(true)
    expect(componentNames.some((el) => el.text().includes('CommonToast'))).toBe(true)
  })

  it('应当展示七级 Squircle 尺寸阶梯', () => {
    const wrapper = mount(DesignSystemLabPage)
    const samples = wrapper.findAll('.ncx-design-lab-squircle-sample')

    expect(samples).toHaveLength(7)
    expect(samples.map((sample) => sample.find('strong').text())).toEqual([
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',
      'full'
    ])
  })
})
