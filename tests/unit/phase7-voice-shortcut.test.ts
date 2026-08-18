import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

// ========= 变量 =========

/** Electron 全局快捷键和 Host 的可控夹具。 */
const electronFixture = vi.hoisted(() => ({
  registered: new Set<string>(),
  callbacks: new Map<string, () => void>(),
  hosts: [] as Array<{ emit(event: string, ...args: unknown[]): boolean }>,
  hostStatuses: [] as Array<'ready' | 'hook_failed' | { status: 'hook_failed' | 'permission_denied'; reason?: string }>,
  register: vi.fn<(accelerator: string, callback: () => void) => boolean>(),
  unregister: vi.fn<(accelerator: string) => void>(),
  unregisterAll: vi.fn<() => void>(),
  openExternal: vi.fn<() => Promise<void>>(),
  isTrustedAccessibilityClient: vi.fn<(prompt: boolean) => boolean>()
}))

/** 每项测试创建并回收的配置目录。 */
const temporaryDirectories: string[] = []

// ========= Mock =========

vi.mock('electron', async () => {
  /** 延迟加载避免 mock 提升早于 Node 内置模块初始化。 */
  const { EventEmitter } = await import('node:events')
  /** 模拟最小 Electron UtilityProcess。 */
  class MockInputHookHost extends EventEmitter {
    /** 当前 Host 是否已经退出。 */
    private stopped = false

    /** 接收配置后异步返回夹具指定状态。 */
    postMessage(config: { readonly sessionGeneration: number }): void {
      /** 本次候选启动状态。 */
      const item = electronFixture.hostStatuses.shift() ?? 'ready'
      const status = typeof item === 'object' ? item.status : item
      const reason = typeof item === 'object' ? item.reason : (status === 'hook_failed' ? 'fixture hook failure' : undefined)
      queueMicrotask(() => {
        if (this.stopped) return
        this.emit('message', {
          protocolVersion: 1,
          sessionGeneration: config.sessionGeneration,
          status,
          ...(reason ? { reason } : {})
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

  electronFixture.register.mockImplementation((accelerator, callback) => {
    if (electronFixture.registered.has(accelerator)) return false
    electronFixture.registered.add(accelerator)
    electronFixture.callbacks.set(accelerator, callback)
    return true
  })
  electronFixture.unregister.mockImplementation((accelerator) => {
    electronFixture.registered.delete(accelerator)
    electronFixture.callbacks.delete(accelerator)
  })
  electronFixture.unregisterAll.mockImplementation(() => {
    electronFixture.registered.clear()
    electronFixture.callbacks.clear()
  })
  electronFixture.openExternal.mockImplementation(async () => undefined)
  electronFixture.isTrustedAccessibilityClient.mockImplementation(() => true)

  return {
    globalShortcut: {
      register: electronFixture.register,
      unregister: electronFixture.unregister,
      unregisterAll: electronFixture.unregisterAll
    },
    shell: { openExternal: electronFixture.openExternal },
    systemPreferences: { isTrustedAccessibilityClient: electronFixture.isTrustedAccessibilityClient },
    utilityProcess: {
      fork: vi.fn(() => {
        /** 新的 InputHookHost 夹具。 */
        const host = new MockInputHookHost()
        electronFixture.hosts.push(host)
        return host
      })
    }
  }
})

import { VoiceShortcutCoordinator } from '../../src/main/voice-shortcut-coordinator'

// ========= 函数 =========

/** 创建隔离的语音快捷键协调器。 */
function createCoordinator(publish: (event: { readonly type: string; readonly generation?: number }) => void = () => undefined): VoiceShortcutCoordinator {
  /** 本次测试配置目录。 */
  const userDataPath = mkdtempSync(join(tmpdir(), 'ncx-voice-shortcut-'))
  temporaryDirectories.push(userDataPath)
  return new VoiceShortcutCoordinator({
    userDataPath,
    hostEntryPath: join(userDataPath, 'inputHook.js'),
    publish
  })
}

// ========= 生命周期 =========

afterEach(() => {
  electronFixture.registered.clear()
  electronFixture.callbacks.clear()
  electronFixture.hosts.splice(0)
  electronFixture.hostStatuses.splice(0)
  electronFixture.register.mockClear()
  electronFixture.unregister.mockClear()
  electronFixture.unregisterAll.mockClear()
  electronFixture.openExternal.mockClear()
  electronFixture.isTrustedAccessibilityClient.mockClear()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

// ========= 测试 =========

describe('Phase 7 voice shortcut atomic registration', () => {
  it('新安装默认注册 Ctrl+Shift+Q', async () => {
    /** 被测协调器。 */
    const coordinator = createCoordinator()
    electronFixture.hostStatuses.push('ready')

    coordinator.start()
    await vi.waitFor(() => expect(coordinator.snapshot().availability).toBe('ready'))

    expect(coordinator.snapshot().chord).toEqual(['ControlLeft', 'ShiftLeft', 'KeyQ'])
    expect(electronFixture.registered).toEqual(new Set(['Control+Shift+Q']))
    coordinator.shutdown()
  })

  it('重复保存相同组合键复用本应用注册且退出不注销其他快捷键', async () => {
    /** 被测协调器。 */
    const coordinator = createCoordinator()
    electronFixture.hostStatuses.push('ready')

    await coordinator.configure(true, ['AltLeft', 'Space'])
    await coordinator.configure(true, ['AltLeft', 'Space'])

    expect(electronFixture.register).toHaveBeenCalledTimes(1)
    expect(electronFixture.registered).toEqual(new Set(['Alt+Space']))
    coordinator.shutdown()
    expect(electronFixture.unregister).toHaveBeenCalledWith('Alt+Space')
    expect(electronFixture.unregisterAll).not.toHaveBeenCalled()
  })

  it('新 Host 启动失败时只释放候选 Accelerator 并保留旧绑定', async () => {
    /** 被测协调器。 */
    const coordinator = createCoordinator()
    electronFixture.hostStatuses.push('ready', 'hook_failed')
    await coordinator.configure(true, ['AltLeft', 'Space'])

    /** 失败的新绑定快照。 */
    const failed = await coordinator.configure(true, ['ControlLeft', 'Space'])

    expect(failed.chord).toEqual(['AltLeft', 'Space'])
    expect(failed.availability).toBe('hook_failed')
    expect(electronFixture.registered).toEqual(new Set(['Alt+Space']))
    expect(electronFixture.unregister).toHaveBeenCalledWith('Control+Space')
    coordinator.shutdown()
  })

  it('辅助功能权限不足时精准识别 permission_denied 并在打开权限设置后支持重新检测恢复', async () => {
    /** 被测协调器。 */
    const coordinator = createCoordinator()
    electronFixture.hostStatuses.push({
      status: 'hook_failed',
      reason: 'Failed to enable access for assistive devices.'
    })

    coordinator.start()
    await vi.waitFor(() => expect(coordinator.snapshot().availability).toBe('permission_denied'))
    expect(coordinator.snapshot().reason).toContain('未授予辅助功能权限')

    /** 模拟用户在系统授权后点击打开权限设置/重新检测。 */
    electronFixture.hostStatuses.push('ready')
    const result = await coordinator.openPermissionSettings()

    expect(result.availability).toBe('ready')
    expect(electronFixture.openExternal).toHaveBeenCalled()
    coordinator.shutdown()
  })

  it('合并 globalShortcut 与原生 Hook 的重复按下事件，并由松开事件结束', async () => {
    /** Renderer 可见的快捷键状态事件。 */
    const published: Array<{ readonly type: string; readonly generation?: number }> = []
    /** 被测协调器。 */
    const coordinator = createCoordinator((event) => published.push(event))
    electronFixture.hostStatuses.push('ready')

    coordinator.start()
    await vi.waitFor(() => expect(coordinator.snapshot().availability).toBe('ready'))
    /** 当前稳定 generation。 */
    const generation = coordinator.snapshot().generation
    electronFixture.callbacks.get('Control+Shift+Q')?.()
    electronFixture.hosts[0]?.emit('message', {
      protocolVersion: 1,
      sessionGeneration: generation,
      status: 'pressed'
    })
    electronFixture.hosts[0]?.emit('message', {
      protocolVersion: 1,
      sessionGeneration: generation,
      status: 'released'
    })

    expect(published.filter((event) => event.type === 'pressed')).toHaveLength(1)
    expect(published.filter((event) => event.type === 'released')).toHaveLength(1)
    coordinator.shutdown()
  })
})
