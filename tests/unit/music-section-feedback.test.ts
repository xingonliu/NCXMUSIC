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

describe('MusicSection 提示反馈与骨架屏契约', () => {
  it('不在标题下渲染 description', () => {
    expect(musicSectionSource).not.toContain('description?: string')
    expect(musicSectionSource).not.toContain('props.description')
    for (const consumerSource of musicSectionConsumerSources) {
      expect(consumerSource).not.toMatch(/<MusicSection\b[^>]*\s:?description=/)
    }
  })

  it('使用全局 Toast 并在状态组件中展示空状态和错误提示文案', () => {
    expect(musicSectionSource).toContain("import { showToast } from '../../../design-system/use-toast'")
    expect(musicSectionSource).toContain("props.state === 'error'")
    expect(musicSectionSource).toContain('message: props.errorText')
    expect(musicSectionSource).toContain("props.state === 'empty'")
    expect(musicSectionSource).toContain('message: props.emptyText')
    expect(musicSectionSource).toContain(':description="props.errorText"')
    expect(musicSectionSource).toContain(':description="props.emptyText"')
  })

  it('MusicSection 提供具名 skeleton 插槽并优雅降级为居中加载指示器', () => {
    expect(musicSectionSource).toContain('<slot name="skeleton">')
    expect(musicSectionSource).toContain('class="music-section-fallback-spinner"')
  })

  it('发现页与浏览页均在 Section 级别装配独立骨架屏以防加载抖动', () => {
    const discoverSource = readFileSync('src/renderer/features/music/DiscoverPage.vue', 'utf8')
    const browseSource = readFileSync('src/renderer/features/music/BrowsePage.vue', 'utf8')

    expect(discoverSource).toContain('<template #skeleton>')
    expect(discoverSource).toContain('discover-skeleton-card')
    expect(discoverSource).toContain('discover-skeleton-new-song-item')
    expect(discoverSource).toContain('discover-skeleton-artist-card')

    expect(browseSource).toContain('<template #skeleton>')
    expect(browseSource).toContain('browse-skeleton-song-item')
    expect(browseSource).toContain('browse-skeleton-card')
    expect(browseSource).toContain('browse-skeleton-chart-card')
    expect(browseSource).toContain('browse-skeleton-artist-card')
  })
})
