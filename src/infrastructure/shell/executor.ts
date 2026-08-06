import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { createModelSafeShellResult } from './output-buffer'
import {
  ExecuteShellInputSchema,
  ExecuteShellResultSchema,
  SHELL_DEFAULT_TIMEOUT_MS,
  type ExecuteShellInput,
  type ExecuteShellResult,
  type ShellPolicyDecision
} from '../../shared/schemas/shell'
import {
  type ShellPlatform,
  ShellPolicyClassifier,
  type ShellPolicyClassifierOptions
} from './policy-classifier'
import { ShellProcessSupervisor, type ShellProcessHandle } from './process-supervisor'
import { type ResolvedShellWorkspace, ShellWorkspaceRegistry } from './workspace-registry'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export interface ShellApprovalContext {
  /** 是否已有上层 ApprovalCard 对本次命令逐次批准。 */
  approved: boolean
  /** 审批来源说明，用于测试和日志摘要。 */
  source: 'policy-auto' | 'approval-card' | 'test-harness'
}

export interface ShellExecutorOptions {
  /** Shell 执行平台。 */
  platform: ShellPlatform
  /** Shell 策略分类器。 */
  classifier: ShellPolicyClassifier
  /** 工作区注册表。 */
  workspaceRegistry: ShellWorkspaceRegistry
  /** 子进程监督器。 */
  processSupervisor: ShellProcessSupervisor
  /** Utility 管理的 Shell 临时目录。 */
  tempRoot: string
}

export interface ActiveShellCommand {
  /** 命令 ID。 */
  commandId: string
  /** 正在运行的受监督子进程。 */
  handle: ShellProcessHandle
}

// ─────────────────────────────────────────────────────────────────────────────
// ShellExecutor
// ─────────────────────────────────────────────────────────────────────────────

export class ShellExecutor {
  // ── 变量区 ──
  private readonly platform: ShellPlatform
  private readonly classifier: ShellPolicyClassifier
  private readonly workspaceRegistry: ShellWorkspaceRegistry
  private readonly processSupervisor: ShellProcessSupervisor
  private readonly tempRoot: string
  private readonly activeCommands = new Map<string, ActiveShellCommand>()

  constructor(options: ShellExecutorOptions) {
    this.platform = options.platform
    this.classifier = options.classifier
    this.workspaceRegistry = options.workspaceRegistry
    this.processSupervisor = options.processSupervisor
    this.tempRoot = resolve(options.tempRoot)
    mkdirSync(this.tempRoot, { recursive: true })
  }

  // ── 函数区 ──

  /** 构造符合当前平台的完整 Shell 执行器。 */
  static create(options: Omit<ShellPolicyClassifierOptions, 'workspaceRegistry'> & { tempRoot?: string }): ShellExecutor {
    const workspaceRegistry = new ShellWorkspaceRegistry({
      defaultWorkspaceRoot: ShellWorkspaceRegistry.defaultRoot(),
      workspaces: [],
      realpath: (path) => resolve(path)
    })
    const classifier = new ShellPolicyClassifier({ ...options, workspaceRegistry })
    const processSupervisor = new ShellProcessSupervisor({ platform: options.platform })
    return new ShellExecutor({
      platform: options.platform,
      classifier,
      workspaceRegistry,
      processSupervisor,
      tempRoot: options.tempRoot ?? join(tmpdir(), 'ncxmusic-shell')
    })
  }

  /** 分类并执行 Shell 命令；需要审批的命令在未批准时返回 rejected。 */
  async execute(
    commandId: string,
    rawInput: unknown,
    approval?: ShellApprovalContext
  ): Promise<ExecuteShellResult> {
    const input = ExecuteShellInputSchema.safeParse(rawInput)
    if (!input.success) throw Object.assign(new Error('Shell 执行参数不合法。'), { code: 'PROTOCOL_INVALID_MESSAGE' })

    let workspace: ResolvedShellWorkspace
    let decision: ShellPolicyDecision
    try {
      workspace = this.workspaceRegistry.resolve(input.data.workspaceId, input.data.cwd)
      decision = await this.classifier.classify(input.data)
    } catch (error) {
      return this.rejectedResult(error instanceof Error ? error.message : 'Shell 工作区解析失败。')
    }

    if (decision.action === 'deny') return this.rejectedResult(decision.reason)
    if (decision.action === 'ask' && approval?.approved !== true) {
      return this.rejectedResult(decision.reason)
    }

    const timeoutMs = input.data.timeoutMs ?? SHELL_DEFAULT_TIMEOUT_MS
    const shell = this.createShellInvocation(input.data)
    const handle = this.processSupervisor.run({
      commandId,
      file: shell.file,
      args: shell.args,
      cwd: workspace.cwd,
      timeoutMs,
      env: this.createEnvironment(workspace)
    })
    this.activeCommands.set(commandId, { commandId, handle })

    try {
      const result = await handle.result
      this.activeCommands.delete(commandId)
      const parsed = ExecuteShellResultSchema.parse({
        status: result.status,
        exitCode: result.exitCode,
        signal: result.signal,
        durationMs: result.durationMs,
        stdout: result.stdout,
        stderr: result.stderr,
        stdoutTruncated: result.stdoutTruncated,
        stderrTruncated: result.stderrTruncated
      })
      return createModelSafeShellResult(parsed).result
    } catch {
      this.activeCommands.delete(commandId)
      throw Object.assign(new Error('Shell 子进程监督失败。'), { code: 'UTILITY_UNAVAILABLE' })
    }
  }

  /** 按 requestId 取消正在运行的命令。 */
  cancel(commandId: string, reason: 'user' | 'shutdown' = 'user'): boolean {
    const active = this.activeCommands.get(commandId)
    if (!active) return false
    active.handle.cancel(reason)
    return true
  }

  /** Utility 退出前取消所有 Shell 命令，并回收进程树。 */
  shutdown(): void {
    for (const command of this.activeCommands.values()) command.handle.cancel('shutdown')
    this.activeCommands.clear()
    this.processSupervisor.shutdown()
  }

  private createShellInvocation(input: ExecuteShellInput): { file: string; args: string[] } {
    if (this.platform === 'win32') {
      return {
        file: 'powershell.exe',
        args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', input.command]
      }
    }
    return { file: '/bin/zsh', args: ['-f', '-c', input.command] }
  }

  private createEnvironment(workspace: ResolvedShellWorkspace): NodeJS.ProcessEnv {
    const tempPath = join(this.tempRoot, workspace.workspaceId)
    mkdirSync(tempPath, { recursive: true })
    const safePath = this.safePath()
    if (this.platform === 'win32') {
      return {
        SystemRoot: process.env['SystemRoot'] ?? 'C:\\Windows',
        WINDIR: process.env['WINDIR'] ?? process.env['SystemRoot'] ?? 'C:\\Windows',
        ComSpec: process.env['ComSpec'] ?? 'C:\\Windows\\System32\\cmd.exe',
        PATH: safePath,
        Path: safePath,
        PATHEXT: process.env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD;.PS1',
        TEMP: tempPath,
        TMP: tempPath,
        npm_config_cache: join(tempPath, 'npm-cache'),
        PNPM_HOME: join(tempPath, 'pnpm-home')
      }
    }

    return {
      HOME: tempPath,
      PATH: safePath,
      TMPDIR: tempPath,
      LANG: 'C.UTF-8',
      npm_config_cache: join(tempPath, 'npm-cache'),
      PNPM_HOME: join(tempPath, 'pnpm-home')
    }
  }

  private safePath(): string {
    const currentPath = process.env['PATH'] ?? process.env['Path'] ?? ''
    if (currentPath.trim()) return currentPath
    if (this.platform === 'win32') return 'C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0'
    return '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin'
  }

  private rejectedResult(reason: string): ExecuteShellResult {
    return {
      status: 'rejected',
      exitCode: null,
      signal: null,
      durationMs: 0,
      stdout: '',
      stderr: reason,
      stdoutTruncated: false,
      stderrTruncated: false
    }
  }
}
