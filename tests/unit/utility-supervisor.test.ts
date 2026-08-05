import { PassThrough } from 'node:stream'

import type { UtilityProcess } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UtilitySupervisor } from '../../src/main/utility-supervisor'

class FakeUtilityProcess {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  private exitListener: ((code: number) => void) | undefined
  private messageListener: ((message: unknown) => void) | undefined
  killed = false

  on(event: string, listener: (message: unknown) => void): this {
    if (event === 'message') this.messageListener = listener
    return this
  }

  once(event: string, listener: (code: number) => void): this {
    if (event === 'exit') this.exitListener = listener
    return this
  }

  postMessage(): void {}

  kill(): boolean {
    this.killed = true
    return true
  }

  ready(): void {
    this.messageListener?.({ kind: 'utility.ready', protocolVersion: 1 })
  }

  message(value: unknown): void {
    this.messageListener?.(value)
  }

  exit(code = 1): void {
    this.exitListener?.(code)
  }

  asElectronProcess(): UtilityProcess {
    return this as unknown as UtilityProcess
  }
}

describe('UtilitySupervisor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for ready then restarts after 1s, 2s, and 5s before disabling', () => {
    const children: FakeUtilityProcess[] = []
    const supervisor = new UtilitySupervisor(
      () => {
        const child = new FakeUtilityProcess()
        children.push(child)
        return child.asElectronProcess()
      },
      () => {}
    )

    expect(supervisor.start().state).toBe('starting')
    children[0]?.ready()
    expect(supervisor.currentStatus().state).toBe('ready')
    children[0]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 1_000 })

    vi.advanceTimersByTime(1_000)
    children[1]?.ready()
    children[1]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 2_000 })

    vi.advanceTimersByTime(2_000)
    children[2]?.ready()
    children[2]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 5_000 })

    vi.advanceTimersByTime(5_000)
    children[3]?.ready()
    children[3]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'disabled', restartAttempt: 3 })
    vi.advanceTimersByTime(60_000)
    expect(children).toHaveLength(4)

    expect(supervisor.retry().state).toBe('starting')
    children[4]?.ready()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'ready', restartAttempt: 0 })
  })

  it('treats a missing ready handshake as a failed start', () => {
    const children: FakeUtilityProcess[] = []
    const supervisor = new UtilitySupervisor(
      () => {
        const child = new FakeUtilityProcess()
        children.push(child)
        return child.asElectronProcess()
      },
      () => {}
    )

    supervisor.start()
    vi.advanceTimersByTime(10_000)
    expect(children[0]?.killed).toBe(true)
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 1_000 })
  })

  it('resets failures after five stable minutes and cleans up on shutdown', () => {
    const children: FakeUtilityProcess[] = []
    const writeLog = vi.fn()
    const supervisor = new UtilitySupervisor(
      () => {
        const child = new FakeUtilityProcess()
        children.push(child)
        return child.asElectronProcess()
      },
      writeLog
    )

    supervisor.start()
    children[0]?.ready()
    children[0]?.stdout.write('runtime-ready\n')
    children[0]?.stderr.write('runtime-diagnostic\n')
    expect(writeLog).toHaveBeenCalledWith('stdout', 'runtime-ready\n')
    expect(writeLog).toHaveBeenCalledWith('stderr', 'runtime-diagnostic\n')
    children[0]?.exit()
    vi.advanceTimersByTime(1_000)
    children[1]?.ready()
    vi.advanceTimersByTime(5 * 60 * 1_000)
    expect(supervisor.currentStatus()).toMatchObject({ state: 'ready', restartAttempt: 0 })

    children[1]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 1_000 })
    vi.advanceTimersByTime(1_000)
    children[2]?.ready()
    supervisor.shutdown()
    expect(children[2]?.killed).toBe(true)
    expect(supervisor.currentStatus().state).toBe('stopped')
    children[2]?.exit(0)
    vi.advanceTimersByTime(10_000)
    expect(children).toHaveLength(3)
  })

  it('accepts private control events only from the active Utility generation', () => {
    const children: FakeUtilityProcess[] = []
    const supervisor = new UtilitySupervisor(
      () => {
        const child = new FakeUtilityProcess()
        children.push(child)
        return child.asElectronProcess()
      },
      () => {}
    )
    const listener = vi.fn()
    supervisor.onControlMessage(listener)
    supervisor.start()
    children[0]?.ready()
    expect(supervisor.postControl({ kind: 'auth.lease.revoke' })).toBe(true)
    children[0]?.message({ kind: 'auth.lease.ack' })
    expect(listener).toHaveBeenCalledOnce()

    children[0]?.exit()
    children[0]?.message({ kind: 'stale' })
    expect(listener).toHaveBeenCalledOnce()
    expect(supervisor.postControl({ kind: 'secret' })).toBe(false)
  })
})
