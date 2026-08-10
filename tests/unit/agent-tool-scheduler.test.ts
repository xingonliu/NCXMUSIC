import { describe, expect, it } from 'vitest'

import { ToolScheduler } from '../../src/domains/agent/tool-scheduler'

// ========= 工具函数 =========

/** 创建由测试显式完成的 Promise。 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  /** Promise 成功回调。 */
  let resolvePromise!: (value: T) => void
  /** 可控 Promise。 */
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}

// ========= 测试 =========

describe('agent tool scheduler', () => {
  it('最多并行四个只读工具，第五个等待', async () => {
    /** 被测调度器。 */
    const scheduler = new ToolScheduler()
    /** 五个可控只读任务门闩。 */
    const gates = Array.from({ length: 5 }, () => deferred<number>())
    /** 已启动只读任务数。 */
    let started = 0
    /** 五个调度结果。 */
    const tasks = gates.map((gate, index) => scheduler.schedule({
      toolCallId: `read-${index}`,
      effect: 'read',
      conflictKeys: [],
      run: () => {
        started += 1
        return gate.promise
      }
    }))

    expect(started).toBe(4)
    gates[0]?.resolve(0)
    await tasks[0]
    expect(started).toBe(5)
    gates.slice(1).forEach((gate, index) => gate.resolve(index + 1))
    await Promise.all(tasks)
  })

  it('同一冲突域写任务按入队顺序串行', async () => {
    /** 被测调度器。 */
    const scheduler = new ToolScheduler()
    /** 第一项写入门闩。 */
    const firstGate = deferred<string>()
    /** 可观察执行顺序。 */
    const order: string[] = []
    /** 第一项写入。 */
    const first = scheduler.schedule({
      toolCallId: 'write-1',
      effect: 'write',
      conflictKeys: ['account:playlist:1'],
      run: () => {
        order.push('first-start')
        return firstGate.promise
      }
    })
    /** 第二项同域写入。 */
    const second = scheduler.schedule({
      toolCallId: 'write-2',
      effect: 'write',
      conflictKeys: ['account:playlist:1'],
      run: async () => {
        order.push('second-start')
        return 'second'
      }
    })

    expect(order).toEqual(['first-start'])
    firstGate.resolve('first')
    await first
    await second
    expect(order).toEqual(['first-start', 'second-start'])
  })

  it('不同冲突域的副作用在首版仍按模型顺序串行', async () => {
    /** 被测调度器。 */
    const scheduler = new ToolScheduler()
    /** 第一项播放器任务门闩。 */
    const firstGate = deferred<string>()
    /** 可观察执行顺序。 */
    const order: string[] = []
    /** 第一项播放器副作用。 */
    const first = scheduler.schedule({
      toolCallId: 'player-1',
      effect: 'player',
      conflictKeys: ['player:queue'],
      run: () => {
        order.push('player-start')
        return firstGate.promise
      }
    })
    /** 第二项歌单副作用。 */
    const second = scheduler.schedule({
      toolCallId: 'write-2',
      effect: 'write',
      conflictKeys: ['account:playlist:2'],
      run: async () => {
        order.push('playlist-start')
        return 'playlist'
      }
    })

    expect(order).toEqual(['player-start'])
    firstGate.resolve('player')
    await Promise.all([first, second])
    expect(order).toEqual(['player-start', 'playlist-start'])
  })
})
