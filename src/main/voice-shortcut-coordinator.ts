import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  globalShortcut,
  shell,
  systemPreferences,
  utilityProcess,
  type UtilityProcess
} from 'electron'

import {
  INPUT_HOOK_PROTOCOL_VERSION,
  InputHookReportSchema,
  type InputHookConfig,
  type InputHookKey
} from '../shared/contracts/input-hook'
import {
  VoiceShortcutSnapshotSchema,
  type VoiceShortcutEvent,
  type VoiceShortcutKey,
  type VoiceShortcutSnapshot
} from '../shared/schemas/voice'

// ========= 类型 =========

/** 协调器依赖，测试可替换原生 Electron 能力。 */
export interface VoiceShortcutCoordinatorOptions {
  /** 语音快捷键配置存储根目录。 */
  readonly userDataPath: string
  /** InputHookHost 构建入口。 */
  readonly hostEntryPath: string
  /** 向 Renderer 发布安全事件。 */
  readonly publish: (event: VoiceShortcutEvent) => void
}

/** 磁盘只保存非敏感的快捷键配置。 */
interface PersistedVoiceShortcutConfig {
  /** 配置 Schema 版本。 */
  readonly schemaVersion: 2
  /** 是否启用全局按住说话。 */
  readonly enabled: boolean
  /** 受限组合键。 */
  readonly chord: VoiceShortcutKey[]
}

// ========= 变量 =========

/** 新安装默认使用 Ctrl+Shift+Q。 */
const DEFAULT_VOICE_SHORTCUT: PersistedVoiceShortcutConfig = {
  schemaVersion: 2,
  enabled: true,
  chord: ['ControlLeft', 'ShiftLeft', 'KeyQ']
}

/** Electron Accelerator 中按键的固定顺序。 */
const ACCELERATOR_ORDER: Readonly<Record<VoiceShortcutKey, number>> = {
  ControlLeft: 0,
  ControlRight: 0,
  AltLeft: 1,
  AltRight: 1,
  ShiftLeft: 2,
  ShiftRight: 2,
  MetaLeft: 3,
  MetaRight: 3,
  KeyQ: 4,
  Space: 4
}

// ========= 类 =========

/** Main 独占的全局快捷键注册、Host 生命周期与 generation 协调器。 */
export class VoiceShortcutCoordinator {
  /** 配置文件路径。 */
  private readonly configPath: string

  /** 当前 InputHookHost。 */
  private host: UtilityProcess | undefined

  /** 本协调器当前拥有的 Electron Accelerator。 */
  private registeredAccelerator: string | undefined

  /** 当前配置 generation。 */
  private generation = 0

  /** 当前稳定配置。 */
  private config: PersistedVoiceShortcutConfig = DEFAULT_VOICE_SHORTCUT

  /** 当前公开状态。 */
  private snapshotValue: VoiceShortcutSnapshot = VoiceShortcutSnapshotSchema.parse({
    enabled: true,
    chord: DEFAULT_VOICE_SHORTCUT.chord,
    accelerator: 'Control+Shift+Q',
    availability: 'registering',
    generation: 0,
    updatedAt: Date.now()
  })

  constructor(private readonly options: VoiceShortcutCoordinatorOptions) {
    this.configPath = join(options.userDataPath, 'ncx-voice-shortcut.json')
  }

  // ========= 函数 =========

  /** 加载配置并启动全局按住说话；失败只禁用全局入口。 */
  start(): VoiceShortcutSnapshot {
    this.config = this.loadConfig()
    if (!this.config.enabled) {
      this.updateSnapshot('disabled')
      return this.snapshot()
    }
    void this.applyConfiguration(this.config.chord)
    return this.snapshot()
  }

  /** 读取不可变公开快照。 */
  snapshot(): VoiceShortcutSnapshot {
    return VoiceShortcutSnapshotSchema.parse(this.snapshotValue)
  }

  /** 原子应用启停与改键；新配置失败时恢复旧绑定和旧 Host。 */
  async configure(enabled: boolean, chord: readonly VoiceShortcutKey[]): Promise<VoiceShortcutSnapshot> {
    if (!enabled) {
      this.config = { schemaVersion: 2, enabled: false, chord: [...chord] }
      this.persistConfig()
      this.stopHost()
      this.unregisterVoiceShortcut()
      this.updateSnapshot('disabled')
      return this.snapshot()
    }
    await this.applyConfiguration(chord)
    return this.snapshot()
  }

  /** 打开当前平台的麦克风/辅助功能权限设置并尝试重新检测。 */
  async openPermissionSettings(): Promise<VoiceShortcutSnapshot> {
    if (process.platform === 'darwin') {
      try {
        systemPreferences.isTrustedAccessibilityClient(true)
      } catch {
        // 测试环境或不支持的环境静默跳过
      }
    }
    /** 平台权限页 URI；无法打开时保留当前状态。 */
    const target = process.platform === 'darwin'
      ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      : 'ms-settings:privacy-microphone'
    await shell.openExternal(target).catch(() => undefined)
    if (this.config.enabled && this.snapshotValue.availability !== 'ready') {
      await this.applyConfiguration(this.config.chord)
    }
    return this.snapshot()
  }

  /** 应用退出前同步停止 Hook、注销快捷键并结束 Host。 */
  shutdown(): void {
    this.stopHost()
    this.unregisterVoiceShortcut()
  }

  /** 注册 Accelerator 并启动新的 InputHookHost。 */
  private async applyConfiguration(chord: readonly VoiceShortcutKey[]): Promise<void> {
    /** 经共享白名单去重和排序的候选组合键。 */
    const normalizedChord = normalizeChord(chord)
    /** 候选 Electron Accelerator。 */
    const accelerator = toAccelerator(normalizedChord)
    /** 改键前仍在工作的旧配置。 */
    const previous = this.config
    /** 改键前仍由本协调器持有的旧 Accelerator。 */
    const oldAccelerator = this.registeredAccelerator
    if (this.host && oldAccelerator === accelerator && this.snapshotValue.availability === 'ready') {
      this.updateSnapshot('ready', undefined, normalizedChord)
      return
    }
    this.updateSnapshot('registering', undefined, normalizedChord)
    /** 新候选配置 generation。 */
    const candidateGeneration = this.generation + 1
    /** 全局快捷键按下时的回调分发。 */
    const onShortcutPress = (): void => {
      console.info(`[VoiceShortcutCoordinator] Electron globalShortcut 捕获到快捷键: accelerator=${accelerator}, generation=${candidateGeneration}`)
      this.options.publish({ type: 'pressed', generation: candidateGeneration })
    }
    /** 同一失败 Host 的重试可复用本应用已经占有的 Accelerator。 */
    const candidateAlreadyRegistered = oldAccelerator === accelerator
    if (!candidateAlreadyRegistered) {
      if (!globalShortcut.register(accelerator, onShortcutPress)) {
        this.config = previous
        this.updateSnapshot('conflict', `快捷键 ${accelerator} 已被系统或其他应用占用。`, previous.chord)
        return
      }
    } else {
      globalShortcut.unregister(accelerator)
      globalShortcut.register(accelerator, onShortcutPress)
    }

    /** 候选 Host，只有报告 ready 后才替换旧 Host。 */
    const candidate = utilityProcess.fork(this.options.hostEntryPath, [], {
      serviceName: 'NcxMusic Input Hook',
      stdio: 'pipe'
    })
    candidate.stdout?.on('data', (chunk: Buffer | string) => {
      process.stdout.write(chunk)
    })
    candidate.stderr?.on('data', (chunk: Buffer | string) => {
      process.stderr.write(chunk)
    })
    /** 下发给 Host 的最小配置。 */
    const hostConfig: InputHookConfig = {
      protocolVersion: INPUT_HOOK_PROTOCOL_VERSION,
      chord: normalizedChord as InputHookKey[],
      sessionGeneration: candidateGeneration
    }

    try {
      await this.waitUntilHostReady(candidate, hostConfig)
    } catch (error) {
      candidate.kill()
      if (!candidateAlreadyRegistered) globalShortcut.unregister(accelerator)
      this.config = previous
      /** Host 失败的原始原因。 */
      const rawReason = error instanceof Error ? error.message : 'InputHookHost 启动失败。'
      /** 检查是否为 macOS 辅助功能或无障碍权限缺失。 */
      const isPermissionDenied = rawReason.includes('permission') ||
        rawReason.includes('AXAPI') ||
        rawReason.includes('assistive devices') ||
        rawReason.includes('Accessibility API')
      /** 规范化用户提示文案。 */
      const reason = isPermissionDenied
        ? '未授予辅助功能权限，无法全局监听按键。'
        : rawReason
      console.warn(`[VoiceShortcutCoordinator] 快捷键 Host 就绪失败:`, reason)
      this.updateSnapshot(isPermissionDenied ? 'permission_denied' : 'hook_failed', reason, previous.chord)
      return
    }

    /** 已通过 ready 门禁的旧 Host。 */
    const oldHost = this.host
    this.host = candidate
    this.generation = candidateGeneration
    this.config = { schemaVersion: 2, enabled: true, chord: normalizedChord }
    this.persistConfig()
    if (oldAccelerator && oldAccelerator !== accelerator) globalShortcut.unregister(oldAccelerator)
    this.registeredAccelerator = accelerator
    oldHost?.kill()
    this.bindStableHost(candidate, candidateGeneration)
    console.info(`[VoiceShortcutCoordinator] 语音快捷键已成功就绪: accelerator=${accelerator}, generation=${candidateGeneration}`)
    this.updateSnapshot('ready', undefined, normalizedChord)
  }

  /** 等待候选 Host 报告 ready 或明确失败。 */
  private waitUntilHostReady(host: UtilityProcess, config: InputHookConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      /** Host 启动有限等待。 */
      const timer = setTimeout(() => finish(new Error('InputHookHost 启动超时。')), 8_000)
      /** 只处理候选 generation 的 Host 报告。 */
      const handleMessage = (message: unknown): void => {
        const report = InputHookReportSchema.safeParse(message)
        if (!report.success || report.data.sessionGeneration !== config.sessionGeneration) return
        if (report.data.status === 'ready') finish()
        else if (report.data.status === 'permission_denied' || report.data.status === 'hook_failed') {
          finish(new Error(report.data.reason ?? report.data.status))
        }
      }
      /** Host 在 ready 前退出即视为失败。 */
      const handleExit = (): void => finish(new Error('InputHookHost 在启动期间退出。'))
      /** 统一收尾候选监听。 */
      const finish = (error?: Error): void => {
        clearTimeout(timer)
        host.off('message', handleMessage)
        host.off('exit', handleExit)
        if (error) reject(error)
        else resolve()
      }
      host.on('message', handleMessage)
      host.once('exit', handleExit)
      host.postMessage(config)
    })
  }

  /** 将稳定 Host 报告转换为 Renderer 最小事件。 */
  private bindStableHost(host: UtilityProcess, generation: number): void {
    host.on('message', (message: unknown) => {
      if (this.host !== host) return
      const report = InputHookReportSchema.safeParse(message)
      if (!report.success || report.data.sessionGeneration !== generation) return
      console.info(`[VoiceShortcutCoordinator] 收到 Hook 进程报告: status=${report.data.status}, generation=${generation}`)
      if (report.data.status === 'pressed' || report.data.status === 'released') {
        this.options.publish({ type: report.data.status, generation })
      } else if (report.data.status === 'permission_denied' || report.data.status === 'hook_failed') {
        this.updateSnapshot(report.data.status, report.data.reason)
        this.options.publish({ type: 'cancelled', generation, reason: report.data.reason })
      }
    })
    host.once('exit', () => {
      if (this.host !== host) return
      this.host = undefined
      console.warn(`[VoiceShortcutCoordinator] InputHookHost 意外退出`)
      this.updateSnapshot('hook_failed', 'InputHookHost 意外退出；应用内麦克风仍可使用。')
      this.options.publish({ type: 'cancelled', generation, reason: 'InputHookHost 意外退出。' })
    })
  }

  /** 停止当前稳定 Host。 */
  private stopHost(): void {
    /** 待停止 Host。 */
    const current = this.host
    this.host = undefined
    current?.kill()
  }

  /** 只注销语音协调器拥有的 Accelerator，不影响未来其他全局快捷键。 */
  private unregisterVoiceShortcut(): void {
    if (this.registeredAccelerator) globalShortcut.unregister(this.registeredAccelerator)
    this.registeredAccelerator = undefined
  }

  /** 更新公开快照并广播状态。 */
  private updateSnapshot(
    availability: VoiceShortcutSnapshot['availability'],
    reason?: string,
    chord: readonly VoiceShortcutKey[] = this.config.chord
  ): void {
    this.snapshotValue = VoiceShortcutSnapshotSchema.parse({
      enabled: availability !== 'disabled',
      chord,
      accelerator: toAccelerator(chord),
      availability,
      ...(reason ? { reason: reason.slice(0, 300) } : {}),
      generation: this.generation,
      updatedAt: Date.now()
    })
    this.options.publish({ type: 'status', snapshot: this.snapshotValue })
  }

  /** 读取已持久化配置；损坏配置回退默认值。 */
  private loadConfig(): PersistedVoiceShortcutConfig {
    try {
      if (!existsSync(this.configPath)) return DEFAULT_VOICE_SHORTCUT
      /** 未信任磁盘配置。 */
      const decoded = JSON.parse(readFileSync(this.configPath, 'utf8')) as Partial<Omit<PersistedVoiceShortcutConfig, 'schemaVersion'>> & { schemaVersion?: 1 | 2 }
      if ((decoded.schemaVersion !== 1 && decoded.schemaVersion !== 2) || typeof decoded.enabled !== 'boolean' || !Array.isArray(decoded.chord)) {
        return DEFAULT_VOICE_SHORTCUT
      }
      /** v1 的旧默认值迁移为新默认值，用户自定义组合键保持不变。 */
      const chord = decoded.schemaVersion === 1
        && decoded.chord.length === 2
        && decoded.chord.includes('AltLeft')
        && decoded.chord.includes('Space')
        ? DEFAULT_VOICE_SHORTCUT.chord
        : decoded.chord as VoiceShortcutKey[]
      return {
        schemaVersion: 2,
        enabled: decoded.enabled,
        chord: normalizeChord(chord)
      }
    } catch {
      return DEFAULT_VOICE_SHORTCUT
    }
  }

  /** 原子保存当前快捷键配置。 */
  private persistConfig(): void {
    /** 配置文件目录。 */
    const directory = dirname(this.configPath)
    /** 同目录临时文件。 */
    const temporaryPath = `${this.configPath}.tmp`
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporaryPath, `${JSON.stringify(this.config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    renameSync(temporaryPath, this.configPath)
  }
}

// ========= 函数 =========

/** 将组合键去重、排序并强制包含一个受限触发键与至少一个修饰键。 */
export function normalizeChord(chord: readonly VoiceShortcutKey[]): VoiceShortcutKey[] {
  /** 去重后的候选按键。 */
  const normalized = [...new Set(chord)].sort((left, right) => ACCELERATOR_ORDER[left] - ACCELERATOR_ORDER[right])
  if (!normalized.includes('Space') && !normalized.includes('KeyQ')) throw new Error('语音快捷键必须包含 Q 或 Space。')
  if (normalized.includes('Space') && normalized.includes('KeyQ')) throw new Error('语音快捷键只能包含一个触发键。')
  if (normalized.length < 2) throw new Error('语音快捷键必须包含至少一个修饰键。')
  return normalized
}

/** 将物理左右修饰键映射为 Electron Accelerator。 */
export function toAccelerator(chord: readonly VoiceShortcutKey[]): string {
  /** 去重后的 Electron 修饰键。 */
  const parts = new Set<string>()
  for (const key of chord) {
    if (key.startsWith('Control')) parts.add('Control')
    else if (key.startsWith('Alt')) parts.add('Alt')
    else if (key.startsWith('Shift')) parts.add('Shift')
    else if (key.startsWith('Meta')) parts.add(process.platform === 'darwin' ? 'Command' : 'Super')
    else if (key === 'KeyQ') parts.add('Q')
    else if (key === 'Space') parts.add('Space')
  }
  return [...parts].join('+')
}
