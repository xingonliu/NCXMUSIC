import { describe, expect, it, vi } from 'vitest'

import type { PlaybackCoordinator, PlayerSnapshot } from '../../src/domains/player/playback-coordinator'
import { PlayerCommandGateway } from '../../src/domains/player/player-command-gateway'

// ========= 函数 =========

/** 构造命令 Gateway 使用的最小真实形状快照。 */
function snapshot(revision = 3): PlayerSnapshot {
  return {
    playback: {
      status: 'paused',
      intent: 'pause',
      track: null,
      generation: 0,
      positionMs: 0,
      durationMs: null,
      bufferedMs: 0,
      volume: 1,
      muted: false,
      seeking: false,
      error: null,
      actualQuality: null,
      downgraded: false
    },
    queue: { items: [], currentItemId: null, mode: 'loop', revision },
    quality: 'auto'
  }
}

/** 构造只实现 pause 与 getSnapshot 的 Coordinator 测试替身。 */
function coordinatorFixture(): { coordinator: PlaybackCoordinator; pause: ReturnType<typeof vi.fn> } {
  const pause = vi.fn()
  const coordinator = {
    getSnapshot: () => snapshot(),
    pause
  } as unknown as PlaybackCoordinator
  return { coordinator, pause }
}

// ========= 测试 =========

describe('PlayerCommandGateway', () => {
  it('按 commandId 幂等执行并返回真实最新快照', async () => {
    const fixture = coordinatorFixture()
    const gateway = new PlayerCommandGateway(fixture.coordinator)
    const command = {
      commandId: crypto.randomUUID(),
      expectedRevision: 3,
      issuedAt: Date.now(),
      timeoutMs: 500,
      action: { type: 'player.pause' as const }
    }

    const first = await gateway.execute(command)
    const second = await gateway.execute(command)
    expect(first).toMatchObject({ ok: true, code: 'applied', latestRevision: 3 })
    expect(second).toEqual(first)
    expect(fixture.pause).toHaveBeenCalledTimes(1)
  })

  it('expectedRevision 过期时拒绝执行', async () => {
    const fixture = coordinatorFixture()
    const gateway = new PlayerCommandGateway(fixture.coordinator)
    const result = await gateway.execute({
      commandId: crypto.randomUUID(),
      expectedRevision: 2,
      issuedAt: Date.now(),
      action: { type: 'player.pause' }
    })

    expect(result).toMatchObject({ ok: false, code: 'revision-conflict', latestRevision: 3 })
    expect(fixture.pause).not.toHaveBeenCalled()
  })
})
