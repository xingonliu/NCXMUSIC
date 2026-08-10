import type {
  CommandSafetyLevel,
  MusicSafetyLevel
} from '../../shared/schemas/agent'

// ========= 类型 =========

/** 已注册音乐动作的稳定风险类别。 */
export type MusicRiskAction =
  | 'music.playback_queue'
  | 'music.library_playlist'
  | 'music.public_social'
  | 'music.account_high_impact'

/** Shell 纯函数分类器输出的稳定类别。 */
export type CommandRiskAction =
  | 'command.read_only'
  | 'command.workspace_development'
  | 'command.workspace_network'
  | 'command.restricted'

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

/** 命令策略判断输入。 */
export interface CommandPolicyInput {
  /** Shell Tool 是否由用户启用。 */
  readonly shellToolEnabled: boolean
  /** 命令是否已经通过结构、参数与工作区作用域校验。 */
  readonly registered: boolean
  /** 确定性命令风险类别。 */
  readonly action?: CommandRiskAction
  /** 用户当前命令安全等级。 */
  readonly level: CommandSafetyLevel
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

/** 命令安全等级排序。 */
const COMMAND_LEVEL_ORDER: Readonly<Record<CommandSafetyLevel, number>> = {
  S1: 1,
  S2: 2,
  S3: 3,
  S4: 4
}

/** 命令类别免审所需最低等级。 */
const COMMAND_ALLOW_LEVEL: Readonly<Record<Exclude<CommandRiskAction, 'command.restricted'>, CommandSafetyLevel>> = {
  'command.read_only': 'S2',
  'command.workspace_development': 'S3',
  'command.workspace_network': 'S4'
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

/** 以 Shell 开关、正向能力边界和 S1～S4 矩阵判断一次命令。 */
export function evaluateCommandPolicy(input: CommandPolicyInput): PolicyDecision {
  if (!input.shellToolEnabled) {
    return { decision: 'deny', reason: 'Shell Tool 已关闭。' }
  }
  if (!input.registered || !input.action || input.action === 'command.restricted') {
    return { decision: 'deny', reason: '命令未通过结构、参数或授权工作区审查。' }
  }
  /** 当前命令免审所需最低等级。 */
  const required = COMMAND_ALLOW_LEVEL[input.action]
  return COMMAND_LEVEL_ORDER[input.level] >= COMMAND_LEVEL_ORDER[required]
    ? { decision: 'allow', reason: `${input.level} 已允许当前工作区命令。` }
    : { decision: 'ask', reason: `${input.action} 需要 ${required}，当前为 ${input.level}。` }
}
