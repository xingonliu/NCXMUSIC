import { EventEmitter } from 'node:events'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LocalModelInstaller } from '../../src/infrastructure/voice/local-model-installer'
import { LocalAsrCoordinator } from '../../src/main/local-asr-coordinator'

// ========= 类型 =========

/** 测试 Host 收到的最小命令。 */
interface HostCommand {
  /** 命令类型。 */
  readonly type: 'start' | 'chunk' | 'finish' | 'cancel'
  /** 语音会话 ID。 */
  readonly voiceSessionId: string
  /** 本地模型 ID。 */
  readonly modelId?: 'light' | 'accurate'
}

// ========= 变量 =========

/** Electron UtilityProcess 的可控夹具。 */
const electronFixture = vi.hoisted(() => ({
  hosts: [] as MockLocalAsrHost[]
}))

/** 单元测试固定的合法预热后真实会话 ID。 */
const REAL_SESSION_ID = '11111111-1111-4111-8111-111111111111'

// ========= Mock =========

/** 自动响应 ready 的本地 ASR Host。 */
class MockLocalAsrHost extends EventEmitter {
  /** Host 收到的全部命令。 */
  readonly commands: HostCommand[] = []

  /** Host 是否已被结束。 */
  private stopped = false

  /** 接收 Main 命令并异步报告模型就绪。 */
  postMessage(command: HostCommand): void {
    this.commands.push(command)
    if (command.type !== 'start' || !command.modelId) return
    queueMicrotask(() => {
      if (this.stopped) return
      this.emit('message', {
        type: 'ready',
        protocolVersion: 1,
        voiceSessionId: command.voiceSessionId,
        modelId: command.modelId
      })
    })
  }

  /** 模拟显式结束 Host。 */
  kill(): boolean {
    if (this.stopped) return true
    this.stopped = true
    this.emit('exit', 0)
    return true
  }
}

vi.mock('electron', () => ({
  utilityProcess: {
    fork: vi.fn(() => {
      /** 新建的本地 ASR Host。 */
      const host = new MockLocalAsrHost()
      electronFixture.hosts.push(host)
      return host
    })
  }
}))

// ========= 函数 =========

/** 创建指定加载策略的本地 ASR 协调器。 */
function createCoordinator(loadMode: 'on-demand' | 'resident' | (() => 'on-demand' | 'resident')): LocalAsrCoordinator {
  /** 仅实现协调器所需方法的模型安装器。 */
  const installer = {
    isInstalled: () => true,
    modelDirectory: (modelId: 'light' | 'accurate') => `D:/voice-models/${modelId}`
  } as unknown as LocalModelInstaller
  return new LocalAsrCoordinator({
    entryPath: 'D:/out/local-asr/index.js',
    installer,
    loadMode: typeof loadMode === 'function' ? loadMode : () => loadMode,
    publish: () => undefined
  })
}

// ========= 生命周期 =========

afterEach(() => {
  vi.useRealTimers()
  electronFixture.hosts.splice(0)
  vi.clearAllMocks()
})

// ========= 测试 =========

describe('LocalAsrCoordinator resident prewarm', () => {
  it('常驻模式预热后复用同一 Host 启动真实识别', async () => {
    /** 被测协调器。 */
    const coordinator = createCoordinator('resident')

    await coordinator.prewarm('light')
    expect(electronFixture.hosts).toHaveLength(1)
    expect(electronFixture.hosts[0]?.commands.map((command) => command.type)).toEqual(['start', 'cancel'])
    expect(coordinator.snapshot()).toMatchObject({ state: 'ready', modelId: 'light' })

    await coordinator.start({
      voiceSessionId: REAL_SESSION_ID,
      modelId: 'light',
      streaming: true
    })
    expect(electronFixture.hosts).toHaveLength(1)
    expect(electronFixture.hosts[0]?.commands.filter((command) => command.type === 'start')).toHaveLength(2)
    coordinator.cancel({ voiceSessionId: REAL_SESSION_ID })
    coordinator.shutdown()
  })

  it('按需模式不在后台加载模型', async () => {
    /** 被测协调器。 */
    const coordinator = createCoordinator('on-demand')

    await coordinator.prewarm('light')
    expect(electronFixture.hosts).toHaveLength(0)
    expect(coordinator.snapshot().state).toBe('stopped')
    coordinator.shutdown()
  })

  it('从常驻切换到按需后按空闲窗口释放已预热 Host', async () => {
    /** 当前可变加载策略。 */
    let loadMode: 'on-demand' | 'resident' = 'resident'
    /** 被测协调器。 */
    const coordinator = createCoordinator(() => loadMode)
    await coordinator.prewarm('light')
    vi.useFakeTimers()

    loadMode = 'on-demand'
    coordinator.refreshLoadMode()
    await vi.advanceTimersByTimeAsync(15_000)

    expect(coordinator.snapshot().state).toBe('stopped')
    expect(electronFixture.hosts).toHaveLength(1)
    coordinator.shutdown()
  })
})
