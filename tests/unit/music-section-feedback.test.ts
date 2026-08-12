import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** 通用音乐 Section 组件源码。 */
const musicSectionSource = readFileSync(
  'src/renderer/features/music/components/MusicSection.vue',
  'utf8'
)

/** 使用通用音乐 Section 的页面源码。 */
const musicSectionConsumerSources = [
  'src/renderer/features/music/ArtistDetailPage.vue',
  'src/renderer/features/music/BrowsePage.vue',
  'src/renderer/features/music/DiscoverPage.vue'
].map((filePath) => readFileSync(filePath, 'utf8'))

// ========= 测试 =========

describe('MusicSection 提示反馈', () => {
  it('不在标题下渲染 description', () => {
    expect(musicSectionSource).not.toContain('description?: string')
    expect(musicSectionSource).not.toContain('props.description')
    for (const consumerSource of musicSectionConsumerSources) {
      expect(consumerSource).not.toMatch(/<MusicSection\b[^>]*\s:?description=/)
    }
  })

  it('使用全局 Toast 展示空状态和错误提示文案', () => {
    expect(musicSectionSource).toContain("import { showToast } from '../../../design-system/use-toast'")
    expect(musicSectionSource).toContain("props.state === 'error'")
    expect(musicSectionSource).toContain('message: props.errorText')
    expect(musicSectionSource).toContain("props.state === 'empty'")
    expect(musicSectionSource).toContain('message: props.emptyText')
    expect(musicSectionSource).not.toContain(':description="props.errorText"')
    expect(musicSectionSource).not.toContain(':description="props.emptyText"')
  })
})
