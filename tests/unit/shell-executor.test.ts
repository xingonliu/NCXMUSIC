import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ShellExecutor } from '../../src/infrastructure/shell/executor'
import { ShellPolicyClassifier, type PowerShellAstInspector } from '../../src/infrastructure/shell/policy-classifier'
import { ShellProcessSupervisor, type ShellProcessHandle } from '../../src/infrastructure/shell/process-supervisor'
import { ShellWorkspaceRegistry } from '../../src/infrastructure/shell/workspace-registry'

// ─────────────────────────────────────────────────────────────────────────────
// 测试夹具区
// ─────────────────────────────────────────────────────────────────────────────

const rootPath = resolve('D:/code/NCXMUSIC')

const astInspector: PowerShellAstInspector = {
  inspect: async () => ({ syntaxOk: true, commands: ['Get-Location'], hasUnsafeAst: false })
}

class FakeSupervisor extends ShellProcessSupervisor {
  readonly runs: Array<{ file: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }> = []
  private currentCancel: (() => void) | undefined

  constructor(private readonly stdout = 'ok') {
    super({ platform: 'win32' })
  }

  override run(request: Parameters<ShellProcessSupervisor['run']>[0]): ShellProcessHandle {
    this.runs.push({ file: request.file, args: request.args, cwd: request.cwd, env: request.env })
    let cancelled = false
    this.currentCancel = () => {
      cancelled = true
    }
    return {
      cancel: () => this.currentCancel?.(),
      result: Promise.resolve({
        commandId: request.commandId ?? crypto.randomUUID(),
        status: cancelled ? 'cancelled' : 'succeeded',
        exitCode: cancelled ? null : 0,
        signal: cancelled ? 'SIGTERM' : null,
        durationMs: 1,
        stdout: this.stdout,
        stderr: '',
        stdoutTruncated: false,
        stderrTruncated: false
      })
    }
  }
}

/** 构造可控的 ShellExecutor。 */
function createExecutor(level: 'S1' | 'S2' | 'S3' | 'S4', stdout = 'ok') {
  const workspaceRegistry = new ShellWorkspaceRegistry({
    defaultWorkspaceRoot: rootPath,
    workspaces: [{ id: 'repo', rootPath }],
    realpath: (path) => resolve(path)
  })
  const classifier = new ShellPolicyClassifier({
    platform: 'win32',
    safetyLevel: level,
    workspaceRegistry,
    powershellAstInspector: astInspector
  })
  const supervisor = new FakeSupervisor(stdout)
  const executor = new ShellExecutor({
    platform: 'win32',
    classifier,
    workspaceRegistry,
    processSupervisor: supervisor,
    tempRoot: resolve('D:/tmp/ncx-shell')
  })
  return { executor, supervisor }
}

// ─────────────────────────────────────────────────────────────────────────────
// 执行器
// ─────────────────────────────────────────────────────────────────────────────

describe('ShellExecutor', () => {
  it('自动放行匹配 S2 的只读模板并使用固定 PowerShell 启动参数', async () => {
    const { executor, supervisor } = createExecutor('S2')
    const result = await executor.execute(crypto.randomUUID(), {
      command: 'Get-Location',
      workspaceId: 'repo',
      purpose: '读取当前目录'
    })

    expect(result).toMatchObject({ status: 'succeeded', stdout: 'ok' })
    expect(supervisor.runs[0]).toMatchObject({
      file: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', 'Get-Location']
    })
    expect(supervisor.runs[0]?.env).not.toHaveProperty('MUSIC_U')
    expect(supervisor.runs[0]?.env).not.toHaveProperty('Authorization')
  })

  it('S1 或 ask 决策在无审批时返回 rejected，不启动子进程', async () => {
    const { executor, supervisor } = createExecutor('S1')
    const result = await executor.execute(crypto.randomUUID(), {
      command: 'Get-Location',
      workspaceId: 'repo',
      purpose: '读取当前目录'
    })

    expect(result.status).toBe('rejected')
    expect(supervisor.runs).toHaveLength(0)
  })

  it('审批明确通过后可以执行 ask 决策命令', async () => {
    const { executor, supervisor } = createExecutor('S1')
    const result = await executor.execute(
      crypto.randomUUID(),
      { command: 'Get-Location', workspaceId: 'repo', purpose: '审批后读取目录' },
      { approved: true, source: 'test-harness' }
    )

    expect(result.status).toBe('succeeded')
    expect(supervisor.runs).toHaveLength(1)
  })

  it('超过模型结果上限时裁剪 stdout 并标记截断', async () => {
    const { executor } = createExecutor('S2', 'x'.repeat(80 * 1024))
    const result = await executor.execute(crypto.randomUUID(), {
      command: 'Get-Location',
      workspaceId: 'repo',
      purpose: '产生大量输出'
    })

    expect(result.stdoutTruncated).toBe(true)
    expect(result.stdout).toContain('clipped')
  })

  it('非法输入抛出协议错误供 RuntimeServer 映射', async () => {
    const { executor } = createExecutor('S2')

    await expect(executor.execute(crypto.randomUUID(), { command: '', purpose: '' })).rejects.toMatchObject({
      code: 'PROTOCOL_INVALID_MESSAGE'
    })
  })

  it('执行前已取消时直接返回 cancelled 且不启动子进程', async () => {
    const { executor, supervisor } = createExecutor('S2')
    /** 已取消的 Agent Turn 控制器。 */
    const controller = new AbortController()
    controller.abort('user_stopped')

    const result = await executor.execute(crypto.randomUUID(), {
      command: 'Get-Location',
      workspaceId: 'repo',
      purpose: '验证取消传播'
    }, undefined, controller.signal)

    expect(result.status).toBe('cancelled')
    expect(supervisor.runs).toHaveLength(0)
  })

  it('在执行命令前自动创建不存在的工作区目录', async () => {
    /** 临时测试目录，确保在运行前不存在。 */
    const uniqueWorkspaceDir = resolve(tmpdir(), 'ncx-test-workspace-' + crypto.randomUUID())
    expect(existsSync(uniqueWorkspaceDir)).toBe(false)

    try {
      const workspaceRegistry = new ShellWorkspaceRegistry({
        defaultWorkspaceRoot: uniqueWorkspaceDir,
        workspaces: [{ id: 'temp-workspace', rootPath: uniqueWorkspaceDir }],
        realpath: (path) => resolve(path)
      })
      const classifier = new ShellPolicyClassifier({
        platform: 'win32',
        safetyLevel: 'S2',
        workspaceRegistry,
        powershellAstInspector: astInspector
      })
      const supervisor = new FakeSupervisor('ok')
      const executor = new ShellExecutor({
        platform: 'win32',
        classifier,
        workspaceRegistry,
        processSupervisor: supervisor,
        tempRoot: resolve(tmpdir(), 'ncx-test-temp-' + crypto.randomUUID())
      })

      const result = await executor.execute(crypto.randomUUID(), {
        command: 'Get-Location',
        workspaceId: 'temp-workspace',
        purpose: '验证工作目录自动创建'
      })

      expect(result.status).toBe('succeeded')
      expect(existsSync(uniqueWorkspaceDir)).toBe(true)
    } finally {
      try {
        rmSync(uniqueWorkspaceDir, { recursive: true, force: true })
      } catch {
        // 忽略测试清理错误
      }
    }
  })
})
