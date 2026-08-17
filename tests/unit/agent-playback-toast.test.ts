import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  showAgentPlaybackToast,
  type AgentPlaybackCommandResult
} from '../../src/renderer/features/agent/agent-playback-toast'
import { dismissToast, toastList } from '../../src/renderer/design-system/use-toast'
import type { PlayerCommandAction } from '../../src/shared/schemas/player-command'

// ========= 变量 =========

/** 搜索后播放歌曲的标准播放器动作。 */
const playTrackAction: PlayerCommandAction = {
  type: 'player.play-track',
  track: {
    trackId: 'track-1',
    name: '请求中的旧名称',
    artists: ['周杰伦'],
    album: '叶惠美',
    durationMs: 269_000
  },
  source: { kind: 'agent' }
}

/** 切换到下一首的标准播放器动作。 */
const nextAction: PlayerCommandAction = { type: 'player.next' }

// ========= 函数 =========

/** 创建只包含播放提示所需字段的播放器回执。 */
function playbackResult(
  ok: boolean,
  trackName: string | null,
  intent: 'play' | 'pause' = 'play'
): AgentPlaybackCommandResult {
  return {
    ok,
    snapshot: {
      playback: {
        intent,
        track: trackName === null ? null : { name: trackName }
      }
    }
  }
}

// ========= 测试 =========

describe('小云播放成功 Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dismissToast()
  })

  afterEach(() => {
    dismissToast()
    vi.useRealTimers()
  })

  it('成功播放歌曲后提示命令完成时的真实歌曲名', () => {
    showAgentPlaybackToast(playTrackAction, playbackResult(true, '晴天'))

    expect(toastList.value).toHaveLength(1)
    expect(toastList.value[0]).toMatchObject({
      message: '开始播放《晴天》',
      type: 'success'
    })
  })

  it('成功切歌后提示切换后的歌曲名', () => {
    showAgentPlaybackToast(nextAction, playbackResult(true, '七里香'))

    expect(toastList.value[0]?.message).toBe('开始播放《七里香》')
  })

  it('命令失败、暂停结果或非播放动作均不提示', () => {
    showAgentPlaybackToast(nextAction, playbackResult(false, '七里香'))
    showAgentPlaybackToast({ type: 'player.toggle' }, playbackResult(true, '七里香', 'pause'))
    showAgentPlaybackToast({ type: 'player.set-volume', volume: 0.5 }, playbackResult(true, '七里香'))

    expect(toastList.value).toHaveLength(0)
  })
})
