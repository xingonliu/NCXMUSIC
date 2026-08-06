import { PassThrough } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { ShellProcessSupervisor } from '../../src/infrastructure/shell/process-supervisor'

// ─────────────────────────────────────────────────────────────────────────────
// 测试夹具区
// ─────────────────────────────────────────────────────────────────────────────

class FakeChildProcess {
  readonly stdin = new PassThrough()
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly pid: number
  private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  readonly killedSignals: Array<string | undefined> = []

  constructor(pid: number) {
    this.pid = pid
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    const listeners = this.listeners.get(event) ?? []
    listeners.push(listener)
    this.listeners.set(event, listeners)
    return this
  }

  once(event: string, listener: (...args: unknown[]) => void): this {
    const wrapped = (...args: unknown[]): void => {
      this.off(event, wrapped)
      listener(...args)
    }
    return this.on(event, wrapped)
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.set(
      event,
      (this.listeners.get(event) ?? []).filter((item) => item !== listener)
    )
    return this
  }

  kill(signal?: string): boolean {
    this.killedSignals.push(signal)
    return true
  }

  emitExit(code: number | null, signal: string | null): void {
    for (const listener of this.listeners.get('exit') ?? []) listener(code, signal)
  }

  emitError(error: Error): void {
    for (const listener of this.listeners.get('error') ?? []) listener(error)
  }
}

/** 构造可记录 spawn 调用的监督器测试环境。 */
function harness(platform: 'win32' | 'darwin') {
  const children: FakeChildProcess[] = []
  const spawnCalls: Array<{ file: string; args: string[] }> = []
  const events: unknown[] = []
  const supervisor = new ShellProcessSupervisor({
    platform,
    gracefulKillMs: 10,
    onOutput: (event) => {
      events.push(event)
    },
    spawnProcess: (file, args) => {
      spawnCalls.push({ file, args })
      const child = new FakeChildProcess(10_000 + children.length)
      children.push(child)
      return child as never
    }
  })

  return { supervisor, children, spawnCalls, events }
}

// ─────────────────────────────────────────────────────────────────────────────
// 监督与终止
// ─────────────────────────────────────────────────────────────────────────────

describe('ShellProcessSupervisor', () => {
  it('收集并脱敏 stdout/stderr 后返回成功终态', async () => {
    const { supervisor, children, events } = harness('win32')
    const running = supervisor.run({
      file: 'powershell.exe',
      args: ['-Command', 'Get-Location'],
      cwd: process.cwd(),
      timeoutMs: 1_000,
      env: {},
      commandId: crypto.randomUUID()
    })
    children[0]?.stdout.write('ok\n')
    children[0]?.stderr.write('Authorization: Bearer secret\n')
    children[0]?.emitExit(0, null)

    await expect(running.result).resolves.toMatchObject({
      status: 'succeeded',
      exitCode: 0,
      stdout: 'ok\n'
    })
    const result = await running.result
    expect(result.stderr).toContain('[REDACTED]')
    expect(result.stderr).not.toContain('secret')
    expect(events).toHaveLength(2)
  })

  it('Windows 取消使用 taskkill /t，并在宽限期后追加 /f', async () => {
    vi.useFakeTimers()
    const { supervisor, children, spawnCalls } = harness('win32')
    const running = supervisor.run({
      file: 'powershell.exe',
      args: ['-Command', 'Start-Sleep -Seconds 30'],
      cwd: process.cwd(),
      timeoutMs: 60_000,
      env: {}
    })

    running.cancel('user')
    expect(spawnCalls.at(-1)).toMatchObject({ file: 'taskkill', args: ['/pid', '10000', '/t'] })
    vi.advanceTimersByTime(10)
    expect(spawnCalls.at(-1)).toMatchObject({ file: 'taskkill', args: ['/pid', '10000', '/t', '/f'] })
    children[0]?.emitExit(null, 'SIGTERM')

    await expect(running.result).resolves.toMatchObject({ status: 'cancelled' })
    vi.useRealTimers()
  })

  it('macOS 使用独立进程组，超时后返回 timed_out', async () => {
    vi.useFakeTimers()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const { supervisor, children } = harness('darwin')
    const running = supervisor.run({
      file: '/bin/zsh',
      args: ['-f', '-c', 'sleep 30'],
      cwd: process.cwd(),
      timeoutMs: 10,
      env: {}
    })

    vi.advanceTimersByTime(10)
    expect(killSpy).toHaveBeenCalledWith(-10000, 'SIGTERM')
    children[0]?.emitExit(null, 'SIGTERM')

    await expect(running.result).resolves.toMatchObject({ status: 'timed_out' })
    killSpy.mockRestore()
    vi.useRealTimers()
  })
})
