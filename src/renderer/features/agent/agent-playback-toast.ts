import type { PlayerSnapshot } from '../../../domains/player/playback-coordinator'
import type { TrackSummary } from '../../../domains/player/types'
import type { PlayerCommandAction } from '../../../shared/schemas/player-command'
import { showToast } from '../../design-system/use-toast'

// ========= 类型 =========

/** 小云播放提示只需要的播放器回执字段。 */
export interface AgentPlaybackCommandResult {
  /** 播放器命令是否成功应用。 */
  readonly ok: boolean
  /** 命令完成后的真实播放器状态。 */
  readonly snapshot: {
    /** 用于确认播放意图和最终歌曲名的播放快照。 */
    readonly playback: Pick<PlayerSnapshot['playback'], 'intent'> & {
      /** 命令完成后实际选中的歌曲。 */
      readonly track: Pick<TrackSummary, 'name'> | null
    }
  }
}

// ========= 变量 =========

/** 成功后可能开始播放或切换歌曲的播放器动作。 */
const PLAYBACK_START_ACTION_TYPES: ReadonlySet<PlayerCommandAction['type']> = new Set([
  'player.play-context',
  'player.play-track',
  'player.play-queue-item',
  'player.play',
  'player.toggle',
  'player.next',
  'player.previous'
])

// ========= 函数 =========

/**
 * 小云成功开始播放或切歌后，根据命令完成时的真实歌曲弹出成功提示。
 *
 * @param action 小云请求执行的播放器动作
 * @param result 统一播放器网关返回的真实执行结果
 */
export function showAgentPlaybackToast(
  action: PlayerCommandAction,
  result: AgentPlaybackCommandResult
): void {
  if (!result.ok || !PLAYBACK_START_ACTION_TYPES.has(action.type)) return
  if (result.snapshot.playback.intent !== 'play') return

  /** 命令完成后实际处于播放位的歌曲名。 */
  const trackName = result.snapshot.playback.track?.name.trim()
  if (!trackName) return

  showToast(`开始播放《${trackName}》`, 'success')
}
