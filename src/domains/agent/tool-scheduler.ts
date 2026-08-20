// ========= 类型 =========

/** Tool 调度任务。 */
export interface ScheduledToolTask<T> {
  /** 稳定 Tool Call ID。 */
  readonly toolCallId: string
  /** 只读任务可并行，其他任务按冲突域串行。 */
  readonly effect: 'read' | 'interaction' | 'write' | 'player'
  /** 冲突资源键。 */
  readonly conflictKeys: readonly string[]
  /** 实际执行函数。 */
  readonly run: () => Promise<T>
}

/** 内部排队任务。 */
interface QueuedTask<T = unknown> {
  /** 调度任务。 */
  readonly task: ScheduledToolTask<T>
  /** 返回调用方的成功回调。 */
  readonly resolve: (value: T) => void
  /** 返回调用方的失败回调。 */
  readonly reject: (reason: unknown) => void
}

// ========= 变量 =========

/** 单 Turn 最大只读并行数。 */
export const MAX_PARALLEL_READ_TOOLS = 4

// ========= 类 =========

/** 保持模型原始入队顺序、只读并行四个且副作用按冲突域串行的调度器。 */
export class ToolScheduler {
  /** 等待执行的任务。 */
  private readonly queue: QueuedTask[] = []

  /** 当前运行中的只读任务数。 */
  private activeReads = 0

  /** 当前被副作用任务持有的冲突锁。 */
  private readonly activeLocks = new Set<string>()

  /** 当前运行中的副作用任务数；副作用任务统一串行。 */
  private activeEffects = 0

  /** 调度器是否已取消。 */
  private cancelled = false

  /** 排队并在符合并发/冲突约束时执行任务。 */
  schedule<T>(task: ScheduledToolTask<T>): Promise<T> {
    if (this.cancelled) return Promise.reject(createCancelledError())
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject } as QueuedTask)
      this.drain()
    })
  }

  /** 取消尚未开始的任务；已经执行的副作用不伪装为回滚。 */
  cancelQueued(): void {
    this.cancelled = true
    for (const item of this.queue.splice(0)) item.reject(createCancelledError())
  }

  /** 尝试按原始队列顺序启动全部当前可运行任务。 */
  private drain(): void {
    for (let index = 0; index < this.queue.length;) {
      /** 当前候选任务。 */
      const item = this.queue[index]
      if (!item || !this.canRun(item.task)) {
        index += 1
        continue
      }
      this.queue.splice(index, 1)
      this.start(item)
    }
  }

  /** 判断任务是否满足并行度与冲突域约束。 */
  private canRun(task: ScheduledToolTask<unknown>): boolean {
    if (task.effect === 'read') return this.activeReads < MAX_PARALLEL_READ_TOOLS
    return this.activeEffects === 0 && task.conflictKeys.every((key) => !this.activeLocks.has(key))
  }

  /** 取得资源后启动任务，并在终态释放资源。 */
  private start(item: QueuedTask): void {
    /** 当前任务。 */
    const task = item.task
    if (task.effect === 'read') this.activeReads += 1
    else {
      this.activeEffects += 1
      for (const key of task.conflictKeys) this.activeLocks.add(key)
    }
    void task.run().then((value) => {
      if (task.effect === 'read') this.activeReads -= 1
      else {
        this.activeEffects -= 1
        for (const key of task.conflictKeys) this.activeLocks.delete(key)
      }
      this.drain()
      item.resolve(value)
    }, (reason: unknown) => {
      if (task.effect === 'read') this.activeReads -= 1
      else {
        this.activeEffects -= 1
        for (const key of task.conflictKeys) this.activeLocks.delete(key)
      }
      this.drain()
      item.reject(reason)
    })
  }
}

// ========= 函数 =========

/** 构造可稳定识别的排队取消错误。 */
function createCancelledError(): Error & { code: 'REQUEST_CANCELLED' } {
  return Object.assign(new Error('Tool 调度已取消。'), { code: 'REQUEST_CANCELLED' as const })
}
