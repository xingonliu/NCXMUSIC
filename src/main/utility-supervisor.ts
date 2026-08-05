import type { MessagePortMain, UtilityProcess } from 'electron'

import type {
  RuntimeConnectionMetadata,
  RuntimeStatus
} from '../shared/contracts/control-plane'
import { sanitizeErrorMessage } from '../shared/errors/public-error'
import { UtilityReadyMessageSchema } from '../shared/schemas/control-plane'

const RESTART_DELAYS_MS = [1_000, 2_000, 5_000] as const
const STARTUP_TIMEOUT_MS = 10_000
const STABLE_WINDOW_MS = 5 * 60 * 1_000

export type UtilitySpawner = () => UtilityProcess

export class UtilitySupervisor {
  private child: UtilityProcess | undefined
  private generation = 0
  private restartCount = 0
  private restartTimer: ReturnType<typeof setTimeout> | undefined
  private startupTimer: ReturnType<typeof setTimeout> | undefined
  private stableTimer: ReturnType<typeof setTimeout> | undefined
  private stopping = false
  private status: RuntimeStatus = {
    state: 'stopped',
    generation: 0,
    restartAttempt: 0
  }
  private readonly listeners = new Set<(status: RuntimeStatus) => void>()
  private readonly controlMessageListeners = new Set<(message: unknown) => void>()

  constructor(
    private readonly spawnUtility: UtilitySpawner,
    private readonly writeLog: (stream: 'stdout' | 'stderr', message: string) => void
  ) {}

  start(): RuntimeStatus {
    if (this.child) return this.status
    this.stopping = false
    this.spawn()
    return this.status
  }

  retry(): RuntimeStatus {
    if (this.status.state !== 'disabled') return this.status
    this.restartCount = 0
    this.stopping = false
    this.spawn()
    return this.status
  }

  attachPort(port: MessagePortMain, metadata: RuntimeConnectionMetadata): void {
    if (!this.child || this.status.state !== 'ready') {
      throw new Error('Utility process is unavailable')
    }
    if (metadata.utilityGeneration !== this.generation) {
      throw new Error('Utility generation changed before connection')
    }
    this.child.postMessage(metadata, [port])
  }

  postControl(message: unknown): boolean {
    if (!this.child || this.status.state !== 'ready') return false
    this.child.postMessage(message)
    return true
  }

  currentGeneration(): number | undefined {
    return this.child && this.status.state === 'ready' ? this.generation : undefined
  }

  currentStatus(): RuntimeStatus {
    return this.status
  }

  onStatus(listener: (status: RuntimeStatus) => void): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => this.listeners.delete(listener)
  }

  onControlMessage(listener: (message: unknown) => void): () => void {
    this.controlMessageListeners.add(listener)
    return () => this.controlMessageListeners.delete(listener)
  }

  shutdown(): void {
    this.stopping = true
    this.clearTimers()
    const child = this.child
    this.child = undefined
    child?.kill()
    this.updateStatus({
      state: 'stopped',
      generation: this.generation,
      restartAttempt: this.restartCount
    })
  }

  private spawn(): void {
    this.generation += 1
    this.updateStatus({
      state: 'starting',
      generation: this.generation,
      restartAttempt: this.restartCount
    })

    let child: UtilityProcess
    try {
      child = this.spawnUtility()
    } catch (error) {
      this.handleUnexpectedExit(`启动失败：${sanitizeErrorMessage(error)}`)
      return
    }

    this.child = child
    child.stdout?.on('data', (chunk: Buffer | string) => this.writeLog('stdout', String(chunk)))
    child.stderr?.on('data', (chunk: Buffer | string) => this.writeLog('stderr', String(chunk)))
    child.on('message', (message: unknown) => {
      if (this.child !== child) return
      if (UtilityReadyMessageSchema.safeParse(message).success) {
        this.markReady(child)
        return
      }
      for (const listener of this.controlMessageListeners) listener(message)
    })
    child.once('exit', (code) => {
      if (this.child !== child) return
      this.child = undefined
      this.clearChildTimers()
      if (this.stopping) return
      this.handleUnexpectedExit(`Utility Process 意外退出（code=${code}）。`)
    })

    this.startupTimer = setTimeout(() => {
      if (this.child !== child || this.status.state === 'ready') return
      this.child = undefined
      child.kill()
      this.clearChildTimers()
      this.handleUnexpectedExit('Utility Process 启动握手超时。')
    }, STARTUP_TIMEOUT_MS)
  }

  private markReady(child: UtilityProcess): void {
    if (this.child !== child || this.status.state === 'ready') return
    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
      this.startupTimer = undefined
    }
    this.updateStatus({
      state: 'ready',
      generation: this.generation,
      restartAttempt: this.restartCount
    })
    this.stableTimer = setTimeout(() => {
      if (this.child !== child || this.status.state !== 'ready') return
      this.restartCount = 0
      this.updateStatus({
        state: 'ready',
        generation: this.generation,
        restartAttempt: 0
      })
    }, STABLE_WINDOW_MS)
  }

  private handleUnexpectedExit(reason: string): void {
    this.clearChildTimers()
    if (this.restartCount >= RESTART_DELAYS_MS.length) {
      this.updateStatus({
        state: 'disabled',
        generation: this.generation,
        restartAttempt: this.restartCount,
        reason
      })
      return
    }

    const delay = RESTART_DELAYS_MS[this.restartCount]
    this.restartCount += 1
    this.updateStatus({
      state: 'restarting',
      generation: this.generation,
      restartAttempt: this.restartCount,
      nextRetryMs: delay,
      reason
    })
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined
      this.spawn()
    }, delay)
  }

  private updateStatus(status: RuntimeStatus): void {
    this.status = status
    for (const listener of this.listeners) listener(status)
  }

  private clearChildTimers(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
      this.startupTimer = undefined
    }
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = undefined
    }
  }

  private clearTimers(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = undefined
    }
    this.clearChildTimers()
  }
}
