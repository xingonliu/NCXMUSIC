import type { MusicSafetyLevel } from '../../shared/schemas/agent'

// ========= 类型 =========

/** 已注册音乐动作的稳定风险类别。 */
export type MusicRiskAction =
  | 'music.playback_queue'
  | 'music.library_playlist'
  | 'music.public_social'
  | 'music.account_high_impact'

/** 策略引擎确定性结果。 */
export type PolicyDecision =
  | { readonly decision: 'allow'; readonly reason: string }
  | { readonly decision: 'ask'; readonly reason: string }
  | { readonly decision: 'deny'; readonly reason: string }

/** 音乐策略判断输入。 */
export interface MusicPolicyInput {
  /** 动作是否已由正向 Registry 注册。 */
  readonly registered: boolean
  /** 已注册动作的稳定风险类别。 */
  readonly action?: MusicRiskAction
  /** 用户当前音乐安全等级。 */
  readonly level: MusicSafetyLevel
}

// ========= 变量 =========

/** 音乐动作免审所需最低等级。 */
const MUSIC_ALLOW_LEVEL: Readonly<Record<MusicRiskAction, MusicSafetyLevel>> = {
  'music.playback_queue': 'M2',
  'music.library_playlist': 'M3',
  'music.public_social': 'M3',
  'music.account_high_impact': 'M4'
}

/** 音乐安全等级排序。 */
const MUSIC_LEVEL_ORDER: Readonly<Record<MusicSafetyLevel, number>> = {
  M1: 1,
  M2: 2,
  M3: 3,
  M4: 4
}

// ========= 函数 =========

/** 以正向能力注册和 M1～M4 矩阵判断一次 Agent 音乐操作。 */
export function evaluateMusicPolicy(input: MusicPolicyInput): PolicyDecision {
  if (!input.registered || !input.action) {
    return { decision: 'deny', reason: '能力未注册，安全等级不能创建新能力。' }
  }
  /** 当前动作免审所需最低等级。 */
  const required = MUSIC_ALLOW_LEVEL[input.action]
  return MUSIC_LEVEL_ORDER[input.level] >= MUSIC_LEVEL_ORDER[required]
    ? { decision: 'allow', reason: `${input.level} 已允许当前注册音乐动作。` }
    : { decision: 'ask', reason: `${input.action} 需要 ${required}，当前为 ${input.level}。` }
}
