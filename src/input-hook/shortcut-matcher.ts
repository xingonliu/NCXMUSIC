import type {
  InputHookConfig,
  InputHookKey,
  InputHookNativeEvent,
  InputHookReport
} from '../shared/contracts/input-hook'
import { INPUT_HOOK_PROTOCOL_VERSION } from '../shared/contracts/input-hook'

// ========= 类型 =========
/** 用于测试和故障诊断的匹配器状态快照，不含任何非快捷键输入。 */
export interface ShortcutMatcherSnapshot {
  /** 当前仍被视为按下的快捷键白名单按键。 */
  pressedKeys: InputHookKey[]
  /** 当前组合键是否已经进入按住说话状态。 */
  listening: boolean
}

// ========= 函数 =========
/** 去重当前快捷键配置，避免重复键造成永远无法满足的组合。 */
function uniqueChordKeys(chord: readonly InputHookKey[]): Set<InputHookKey> {
  return new Set(chord)
}

/** 生成符合跨进程契约的状态报告。 */
function reportFor(
  config: InputHookConfig,
  status: InputHookReport['status'],
  reason?: string
): InputHookReport {
  return {
    protocolVersion: INPUT_HOOK_PROTOCOL_VERSION,
    status,
    sessionGeneration: config.sessionGeneration,
    ...(reason ? { reason } : {})
  }
}

// ========= 类 =========
/** 将最小按键事件转换为 pressed/released 状态转换。 */
export class ShortcutMatcher {
  /** 当前配置的快捷键集合。 */
  private readonly chord: Set<InputHookKey>
  /** 已按下且属于快捷键白名单的按键集合。 */
  private readonly pressed = new Set<InputHookKey>()
  /** 是否已经为当前按住过程发出 pressed。 */
  private listening = false

  /** 初始化指定 generation 的快捷键匹配器。 */
  constructor(private readonly config: InputHookConfig) {
    this.chord = uniqueChordKeys(config.chord)
  }

  /** 同步外部（如主进程 globalShortcut）发起的聆听状态。 */
  setListening(listening: boolean): void {
    this.listening = listening
  }

  /** 处理一条归一化输入事件，必要时返回状态转换报告。 */
  handle(event: InputHookNativeEvent): InputHookReport | undefined {
    if (event.type === 'disconnect') {
      const hadActiveSession = this.listening
      this.reset()
      return reportFor(this.config, hadActiveSession ? 'released' : 'stopped', 'hook disconnected')
    }

    const key = event.key

    if (event.type === 'keyup') {
      if (key) this.pressed.delete(key)
      if (this.listening) {
        this.listening = false
        return reportFor(this.config, 'released')
      }
      return undefined
    }

    if (!key || !this.chord.has(key)) return undefined

    if (event.type === 'keydown') {
      this.pressed.add(key)
      if (this.listening || !this.isChordPressed()) return undefined
      this.listening = true
      return reportFor(this.config, 'pressed')
    }

    return undefined
  }

  /** 清空按键状态，用于 Host 断连、重配或退出。 */
  reset(): void {
    this.pressed.clear()
    this.listening = false
  }

  /** 返回当前匹配器状态，测试中用于确认没有泄漏无关按键。 */
  snapshot(): ShortcutMatcherSnapshot {
    return {
      pressedKeys: [...this.pressed],
      listening: this.listening
    }
  }

  /** 判断配置组合键中的每个键是否都处于按下状态。 */
  private isChordPressed(): boolean {
    for (const key of this.chord) {
      if (!this.pressed.has(key)) return false
    }
    return true
  }
}
