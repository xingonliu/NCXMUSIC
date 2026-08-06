import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { redactSensitiveText } from '../../shared/errors/redact-sensitive-text'
import { type ShellExecutionStatus, type ShellOutputEvent } from '../../shared/schemas/shell'
import { ShellOutputBuffer } from './output-buffer'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export interface ShellSpawnRequest {
  /** 要启动的 Shell 可执行文件。 */
  file: string
  /** Shell 的固定启动参数。 */
  args: string[]
  /** 已验证的工作目录。 */
  cwd: string
  /** 命令超时时间。 */
  timeoutMs: number
  /** 最小化且脱敏的环境变量。 */
  env: NodeJS.ProcessEnv
  /** 外部传入的命令 ID，用于流式事件关联。 */
  commandId?: string
}

export interface ShellProcessResult {
  /** Shell 命令 ID。 */
  commandId: string
  /** Shell 进程终态。 */
  status: ShellExecutionStatus
  /** 退出码。 */
  exitCode: number | null
  /** 退出信号。 */
  signal: string | null
  /** 执行耗时。 */
  durationMs: number
  /** stdout 裁剪结果。 */
  stdout: string
  /** stderr 裁剪结果。 */
  stderr: string
  /** stdout 是否超过 1 MiB。 */
  stdoutTruncated: boolean
  /** stderr 是否超过 1 MiB。 */
  stderrTruncated: boolean
}

export interface ShellProcessHandle {
  /** 取消正在执行的 Shell 命令。 */
  cancel(reason?: 'user' | 'shutdown'): void
  /** 等待 Shell 命令进入终态。 */
  result: Promise<ShellProcessResult>
}

export interface ShellProcessSupervisorOptions {
  /** 当前平台；只支持 Windows 与 macOS。 */
  platform: NodeJS.Platform
  /** 流式输出事件发布器。 */
  onOutput?: (event: ShellOutputEvent) => void | Promise<void>
  /** 可测试替换的 spawn。 */
  spawnProcess?: (file: string, args: string[], options?: Parameters<typeof spawn>[2]) => ChildProcessWithoutNullStreams
  /** 子进程树强杀宽限期。 */
  gracefulKillMs?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量区
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_GRACEFUL_KILL_MS = 2_000

// ─────────────────────────────────────────────────────────────────────────────
// ShellProcessSupervisor
// ─────────────────────────────────────────────────────────────────────────────

export class ShellProcessSupervisor {
  // ── 变量区 ──
  private readonly platform: NodeJS.Platform
  private readonly onOutput: (event: ShellOutputEvent) => void | Promise<void>
  private readonly spawnProcess: (file: string, args: string[], options?: Parameters<typeof spawn>[2]) => ChildProcessWithoutNullStreams
  private readonly gracefulKillMs: number
  private readonly activeChildren = new Map<string, ChildProcessWithoutNullStreams>()

  constructor(options: ShellProcessSupervisorOptions) {
    this.platform = options.platform
    this.onOutput = options.onOutput ?? (() => {})
    this.spawnProcess =
      options.spawnProcess ??
      ((file, args, options) =>
        spawn(file, args, { ...options, stdio: 'pipe' }) as ChildProcessWithoutNullStreams)
    this.gracefulKillMs = options.gracefulKillMs ?? DEFAULT_GRACEFUL_KILL_MS
  }

  // ── 生命周期区 ──

  /** 启动并监督一棵 Shell 子进程树。 */
  run(request: ShellSpawnRequest): ShellProcessHandle {
    const commandId = request.commandId ?? randomUUID()
    const startedAt = Date.now()
    const stdout = new ShellOutputBuffer()
    const stderr = new ShellOutputBuffer()
    let sequence = 0
    let timeout: ReturnType<typeof setTimeout> | undefined
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined
    let requestedStatus: ShellExecutionStatus | undefined
    let settled = false

    const child = this.spawnProcess(request.file, request.args, {
      cwd: request.cwd,
      env: request.env,
      detached: this.platform === 'darwin',
      windowsHide: true
    })
    this.activeChildren.set(commandId, child)
    child.stdin.end()

    const publish = (stream: 'stdout' | 'stderr', chunk: Buffer | string): void => {
      const snapshot = stream === 'stdout' ? stdout.append(chunk) : stderr.append(chunk)
      if (!snapshot.text && !snapshot.truncated) return
      sequence += 1
      const source = stream === 'stdout' ? child.stdout : child.stderr
      source.pause()
      void Promise.resolve(
        this.onOutput({
          kind: 'shell.output',
          commandId,
          sequence,
          stream,
          chunk: snapshot.text,
          truncated: snapshot.truncated
        })
      ).finally(() => source.resume())
    }

    const cancel = (reason: 'user' | 'shutdown' = 'user'): void => {
      if (settled) return
      requestedStatus = reason === 'shutdown' ? 'cancelled' : 'cancelled'
      this.terminateTree(child)
      forceKillTimer = setTimeout(() => this.forceKillTree(child), this.gracefulKillMs)
    }

    const result = new Promise<ShellProcessResult>((resolve) => {
      timeout = setTimeout(() => {
        if (settled) return
        requestedStatus = 'timed_out'
        this.terminateTree(child)
        forceKillTimer = setTimeout(() => this.forceKillTree(child), this.gracefulKillMs)
      }, request.timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => publish('stdout', chunk))
      child.stderr.on('data', (chunk: Buffer) => publish('stderr', chunk))
      child.once('error', (error) => {
        publish('stderr', redactSensitiveText(error.message))
      })
      child.once('exit', (code, signal) => {
        settled = true
        if (timeout) clearTimeout(timeout)
        if (forceKillTimer) clearTimeout(forceKillTimer)
        this.activeChildren.delete(commandId)
        const stdoutSnapshot = stdout.snapshot()
        const stderrSnapshot = stderr.snapshot()
        resolve({
          commandId,
          status: requestedStatus ?? (code === 0 ? 'succeeded' : 'failed'),
          exitCode: code,
          signal,
          durationMs: Date.now() - startedAt,
          stdout: stdoutSnapshot.text,
          stderr: stderrSnapshot.text,
          stdoutTruncated: stdoutSnapshot.truncated,
          stderrTruncated: stderrSnapshot.truncated
        })
      })
    })

    return { cancel, result }
  }

  /** 应用退出或 Utility 故障前取消所有活动 Shell 子进程。 */
  shutdown(): void {
    for (const child of this.activeChildren.values()) this.terminateTree(child)
  }

  // ── 函数区 ──

  private terminateTree(child: ChildProcessWithoutNullStreams): void {
    if (this.platform === 'win32') {
      if (child.pid !== undefined) this.spawnProcess('taskkill', ['/pid', String(child.pid), '/t'])
      else child.kill()
      return
    }

    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    } else {
      child.kill('SIGTERM')
    }
  }

  private forceKillTree(child: ChildProcessWithoutNullStreams): void {
    if (this.platform === 'win32') {
      if (child.pid !== undefined) this.spawnProcess('taskkill', ['/pid', String(child.pid), '/t', '/f'])
      else child.kill('SIGKILL')
      return
    }

    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
    } else {
      child.kill('SIGKILL')
    }
  }
}
