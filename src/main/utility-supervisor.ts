import type { MessagePortMain, UtilityProcess } from 'electron'

import type {
  RuntimeConnectionMetadata,
  RuntimeStatus
} from '../shared/contracts/control-plane'
import { sanitizeErrorMessage } from '../shared/errors/sanitize-error'

const RESTART_DELAYS_MS = [1_000, 2_000, 5_000] as const
const STABLE_WINDOW_MS = 5 * 60 * 1_000

export type UtilitySpawner = () => UtilityProcess

export class UtilitySupervisor {
  private child: UtilityProcess | undefined
  private generation = 0
  private restartCount = 0
  private restartTimer: ReturnType<typeof setTimeout> | undefined
  private stableTimer: ReturnType<typeof setTimeout> | undefined
  private stopping = false
  private status: RuntimeStatus = {
    state: 'stopped',
    generation: 0,
    restartAttempt: 0
  }
  private readonly listeners = new Set<(status: RuntimeStatus) => void>()

  constructor(
    private readonly spawnUtility: UtilitySpawner,
    private readonly writeLog: (stream: 'stdout' | 'stderr', message: string) => void
  ) {}

  start(): RuntimeStatus {
    if (this.child) {
      return this.status
    }
    this.stopping = false
    this.spawn()
    return this.status
  }

  retry(): RuntimeStatus {
    if (this.status.state !== 'disabled') {
      return this.status
    }
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
    this.generation += 1
    child.stdout?.on('data', (chunk: Buffer | string) => this.writeLog('stdout', String(chunk)))
    child.stderr?.on('data', (chunk: Buffer | string) => this.writeLog('stderr', String(chunk)))
    child.once('exit', (code) => {
      if (this.child === child) {
        this.child = undefined
      }
      if (this.stopping) {
        return
      }
      this.handleUnexpectedExit(`Utility Process 意外退出（code=${code}）。`)
    })

    this.stableTimer = setTimeout(() => {
      this.restartCount = 0
      this.updateStatus({
        state: 'ready',
        generation: this.generation,
        restartAttempt: 0
      })
    }, STABLE_WINDOW_MS)

    this.updateStatus({
      state: 'ready',
      generation: this.generation,
      restartAttempt: this.restartCount
    })
  }

  private handleUnexpectedExit(reason: string): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = undefined
    }

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
    for (const listener of this.listeners) {
      listener(status)
    }
  }

  private clearTimers(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = undefined
    }
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = undefined
    }
  }
}
