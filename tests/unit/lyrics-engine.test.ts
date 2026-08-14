import { describe, expect, it } from 'vitest'

import type { StandardLyrics } from '../../src/shared/schemas/music'
import { LayoutAlignAnchor } from '../../src/renderer/features/music/lyrics-engine/base/consts'
import { LayoutCalculator } from '../../src/renderer/features/music/lyrics-engine/base/layout'
import { TimelineController } from '../../src/renderer/features/music/lyrics-engine/base/timeline'
import { adaptStandardLyrics } from '../../src/renderer/features/music/lyrics-engine/standard-lyrics-adapter'

// ========= 变量 =========

/** 歌词引擎测试夹具的固定观测时间。 */
const observedAt = '2026-08-14T12:00:00.000Z'

/** 同时覆盖逐字、背景声和双声部的标准歌词夹具。 */
const standardLyrics: StandardLyrics = {
  kind: 'lyrics',
  trackId: '123',
  lines: [
    {
      lineStartMs: 1_000,
      lineDurationMs: 1_000,
      text: '男：左声部',
      words: [
        { text: '男：', startMs: 1_000, durationMs: 100 },
        { text: '左声部', startMs: 1_100, durationMs: 900 }
      ]
    },
    {
      lineStartMs: 3_000,
      lineDurationMs: 1_000,
      text: '女：右声部',
      words: [
        { text: '女：右', startMs: 3_000, durationMs: 400 },
        { text: '声部', startMs: 3_400, durationMs: 600 }
      ],
      translation: 'Right voice'
    },
    {
      lineStartMs: 3_200,
      lineDurationMs: 600,
      text: '和声：回响',
      words: [{ text: '和声：回响', startMs: 3_200, durationMs: 600 }],
      vocalRole: 'background'
    }
  ],
  sources: [{ api: 'test.lyrics', observedAt }],
  updatedAt: observedAt
}

// ========= 测试 =========

describe('AMLL 歌词视觉与动效引擎', () => {
  it('在展示边界独立生成背景声和右侧双声部标记', () => {
    /** 转换后的 AMLL 歌词数据。 */
    const result = adaptStandardLyrics(standardLyrics, { showTranslation: true })

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ isBG: false, isDuet: false })
    expect(result[0]?.words.map((word) => word.word).join('')).toBe('左声部')
    expect(result[1]).toMatchObject({
      isBG: false,
      isDuet: true,
      translatedLyric: 'Right voice'
    })
    expect(result[1]?.words.map((word) => word.word).join('')).toBe('右声部')
    expect(result[1]?.words[0]).toMatchObject({ startTime: 3_000, endTime: 3_400 })
    expect(result[2]).toMatchObject({ isBG: true, isDuet: false })
    expect(result[2]?.words.map((word) => word.word).join('')).toBe('回响')
  })

  it('普通 LRC 行保持单时间块并可按偏好隐藏翻译', () => {
    /** 只包含普通逐行歌词的标准歌词。 */
    const lineTimedLyrics: StandardLyrics = {
      ...standardLyrics,
      lines: [{
        lineStartMs: 5_000,
        lineDurationMs: 2_000,
        text: '普通歌词',
        words: [],
        translation: 'Plain lyrics'
      }]
    }
    /** 转换后的非逐字 AMLL 歌词行。 */
    const result = adaptStandardLyrics(lineTimedLyrics, { showTranslation: false })

    expect(result[0]?.words).toEqual([{
      word: '普通歌词',
      startTime: 5_000,
      endTime: 7_000
    }])
    expect(result[0]?.translatedLyric).toBe('')
  })

  it('按 AMLL 的四秒阈值生成间奏并支持反向 seek', () => {
    /** 独立的歌词时间线控制器。 */
    const timeline = new TimelineController()
    timeline.setTimeBounds([
      { startTime: 0, endTime: 1_000 },
      { startTime: 6_000, endTime: 7_000 }
    ])

    timeline.sync(3_000, true)
    expect(timeline.getSnapshot().activeInterlude).toEqual({
      startTime: 1_000,
      endTime: 6_000,
      anchorLineIndex: 0
    })
    expect(timeline.getSnapshot().isFocusOnInterlude).toBe(true)

    /** 从间奏反向跳回首行产生的增量。 */
    const seekDiff = timeline.sync(500)
    expect(seekDiff.isTimeJumped).toBe(true)
    expect(timeline.getSnapshot().playingGroups.has(0)).toBe(true)
  })

  it('重叠短句结束时不会把仍在演唱的长句误判为间奏', () => {
    /** 包含长主声部和短重叠声部的歌词时间线控制器。 */
    const timeline = new TimelineController()
    timeline.setTimeBounds([
      { startTime: 0, endTime: 10_000 },
      { startTime: 2_000, endTime: 3_000 },
      { startTime: 8_000, endTime: 9_000 }
    ])

    timeline.sync(5_000, true)

    expect(timeline.getSnapshot().playingGroups.has(0)).toBe(true)
    expect(timeline.getSnapshot().activeInterlude).toBeUndefined()
    expect(timeline.getSnapshot().isFocusOnInterlude).toBe(false)
  })

  it('两千行歌词只把视口和 overscan 范围标记为需要挂载 DOM', () => {
    /** 使用前缀和高度缓存的 AMLL 布局计算器。 */
    const layout = new LayoutCalculator()
    layout.initHeights(2_000, 48)

    /** 焦点位于长歌词中段时的布局会话。 */
    const { session } = layout.beginFrame({
      containerHeight: 800,
      scrollOffset: 0,
      target: { type: 'line', index: 1_000 },
      bottomLineHeight: 0
    }, {
      alignAnchor: LayoutAlignAnchor.Center,
      alignPosition: 0.5,
      overscanPx: 300
    })
    /** 布局计算生成的复用指令池。 */
    const result = layout.commit(session, 0)
    /** 真正落在视口与预渲染缓冲区内的歌词行数量。 */
    const inViewportCount = result.lineInstructions
      .slice(0, result.lineCount)
      .filter((instruction) => instruction.isInViewport)
      .length

    expect(result.lineCount).toBe(2_000)
    expect(inViewportCount).toBeGreaterThan(0)
    expect(inViewportCount).toBeLessThan(80)
  })
})
