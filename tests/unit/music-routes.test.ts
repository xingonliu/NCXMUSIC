import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// ========= 测试 =========

describe('music route contract', () => {
  it('注册播放详情、沉浸歌词和歌曲详情正式路由', () => {
    /** 路由组合根源码，用于在 Node 合同测试中避免加载 Vue 页面副作用。 */
    const source = readFileSync(join(process.cwd(), 'src/renderer/app/router.ts'), 'utf8')

    expect(source).toContain("path: '/player'")
    expect(source).toContain("name: 'player-detail'")
    expect(source).toContain("path: '/player/lyrics'")
    expect(source).toContain("presentation: 'immersive'")
    expect(source).toContain("path: '/songs/:songId'")
    expect(source).toContain("name: 'song-detail'")
    expect(source).toContain("path: '/browse/categories'")
    expect(source).toContain("name: 'browse-categories'")
  })
})
