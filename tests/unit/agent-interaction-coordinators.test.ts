import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApprovalCoordinator } from '../../src/domains/agent/approval-coordinator'
import { SelectionCoordinator } from '../../src/domains/agent/selection-coordinator'

// ========= 变量 =========

/** 标准歌曲实体夹具。 */
const song = {
  kind: 'song' as const,
  id: '1',
  name: '同名歌曲',
  artists: [],
  access: { badges: [], playableKnown: true },
  sources: [{ api: 'fixture', observedAt: '2026-08-10T08:00:00.000Z' }],
  updatedAt: '2026-08-10T08:00:00.000Z'
}

// ========= 测试 =========

describe('agent interaction coordinators', () => {
  afterEach(() => vi.useRealTimers())

  it('ApprovalCoordinator 区分拒绝与固定五分钟过期', async () => {
    vi.useFakeTimers()
    /** 拒绝场景协调器。 */
    const rejectedCoordinator = new ApprovalCoordinator()
    /** 可主动拒绝的审批。 */
    const rejected = rejectedCoordinator.request({
      toolCallId: crypto.randomUUID(),
      title: '播放歌曲',
      impact: '当前队列',
      riskReason: 'M1 全部审批'
    })
    expect(rejectedCoordinator.respond(rejected.snapshot.approvalId, 'reject')).toBe(true)
    await expect(rejected.outcome).resolves.toBe('rejected')

    /** 过期场景协调器。 */
    const expiredCoordinator = new ApprovalCoordinator()
    /** 等待固定五分钟过期的审批。 */
    const expired = expiredCoordinator.request({
      toolCallId: crypto.randomUUID(),
      title: '修改歌单',
      impact: '歌单 1',
      riskReason: 'M2 需要审批'
    })
    await vi.advanceTimersByTimeAsync(5 * 60 * 1_000)
    await expect(expired.outcome).resolves.toBe('expired')
  })

  it('SelectionCoordinator 只返回答案且单选不接受多个 key', async () => {
    /** 使用本轮事实实体的选择协调器。 */
    const coordinator = new SelectionCoordinator({
      resolveEntity: (reference) => reference === 'song:1' ? song : undefined
    })
    /** 混合实体与文本选项的单选请求。 */
    const selection = coordinator.request({
      toolCallId: crypto.randomUUID(),
      prompt: '请选择歌曲',
      mode: 'single',
      options: [
        { kind: 'entity', optionKey: 'song-1', entityRef: 'song:1' },
        { kind: 'text', optionKey: 'cancel-plan', label: '换一种方案' }
      ]
    })

    expect(coordinator.respond(selection.snapshot.selectionId, ['song-1', 'cancel-plan'])).toBe(false)
    expect(coordinator.respond(selection.snapshot.selectionId, ['song-1'])).toBe(true)
    await expect(selection.outcome).resolves.toEqual({
      status: 'selected',
      selectedOptionKeys: ['song-1'],
      selectedRefs: ['song:1']
    })
  })
})
