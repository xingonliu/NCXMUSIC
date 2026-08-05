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

  once(event: string, listener: (code: number) => void): this {
    if (event === 'exit') {
      this.exitListener = listener
    }
    return this
  }

  on(event: string, listener: (message: unknown) => void): this {
    if (event === 'message') {
      this.messageListener = listener
    }
    return this
  }

  postMessage(): void {}

  kill(): boolean {
    this.killed = true
    return true
  }

  exit(code = 1): void {
    this.exitListener?.(code)
  }

  message(value: unknown): void {
    this.messageListener?.(value)
  }

  asElectronProcess(): UtilityProcess {
    return this as unknown as UtilityProcess
  }
}

describe('UtilitySupervisor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('restarts after 1s, 2s, and 5s, then disables until explicit retry', () => {
    const children: FakeUtilityProcess[] = []
    const supervisor = new UtilitySupervisor(() => {
      const child = new FakeUtilityProcess()
      children.push(child)
      return child.asElectronProcess()
    }, () => {})

    supervisor.start()
    expect(children).toHaveLength(1)
    children[0]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 1_000 })

    vi.advanceTimersByTime(1_000)
    children[1]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 2_000 })

    vi.advanceTimersByTime(2_000)
    children[2]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 5_000 })

    vi.advanceTimersByTime(5_000)
    children[3]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'disabled', restartAttempt: 3 })
    vi.advanceTimersByTime(60_000)
    expect(children).toHaveLength(4)

    supervisor.retry()
    expect(children).toHaveLength(5)
    expect(supervisor.currentStatus()).toMatchObject({ state: 'ready', restartAttempt: 0 })
  })

  it('resets the failure window after five stable minutes and cleans up on shutdown', () => {
    const children: FakeUtilityProcess[] = []
    const writeLog = vi.fn()
    const supervisor = new UtilitySupervisor(() => {
      const child = new FakeUtilityProcess()
      children.push(child)
      return child.asElectronProcess()
    }, writeLog)

    supervisor.start()
    children[0]?.stdout.write('runtime-ready\n')
    children[0]?.stderr.write('runtime-diagnostic\n')
    expect(writeLog).toHaveBeenCalledWith('stdout', 'runtime-ready\n')
    expect(writeLog).toHaveBeenCalledWith('stderr', 'runtime-diagnostic\n')
    children[0]?.exit()
    vi.advanceTimersByTime(1_000)
    vi.advanceTimersByTime(5 * 60 * 1_000)
    expect(supervisor.currentStatus()).toMatchObject({ state: 'ready', restartAttempt: 0 })

    children[1]?.exit()
    expect(supervisor.currentStatus()).toMatchObject({ state: 'restarting', nextRetryMs: 1_000 })
    vi.advanceTimersByTime(1_000)
    supervisor.shutdown()
    expect(children[2]?.killed).toBe(true)
    expect(supervisor.currentStatus().state).toBe('stopped')
    children[2]?.exit(0)
    vi.advanceTimersByTime(10_000)
    expect(children).toHaveLength(3)
  })

  it('reclaims the private control channel when a Utility generation exits', () => {
    const children: FakeUtilityProcess[] = []
    const supervisor = new UtilitySupervisor(() => {
      const child = new FakeUtilityProcess()
      children.push(child)
      return child.asElectronProcess()
    }, () => {})
    const listener = vi.fn()
    supervisor.onControlMessage(listener)
    supervisor.start()
    children[0]?.message({ kind: 'auth.lease.ack' })
    expect(listener).toHaveBeenCalledOnce()

    children[0]?.exit()
    children[0]?.message({ kind: 'stale' })
    expect(listener).toHaveBeenCalledOnce()
    expect(supervisor.postControl({ kind: 'secret' })).toBe(false)
  })
})
