import { describe, expect, it, vi } from 'vitest'

import type { PlayerSnapshot } from '../../src/domains/player/playback-coordinator'
import type { PlaybackSnapshot, TrackSummary } from '../../src/domains/player/types'
import {
  SystemMediaSessionBridge,
  type SystemMediaCommands,
  type SystemMediaSessionPort,
  type SystemMediaSnapshotSource
} from '../../src/renderer/features/music/system-media-session'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** Media Session 动作名，直接从端口签名推导，避免测试复制生产联合类型。 */
type FakeSystemMediaAction = Parameters<SystemMediaSessionPort['setActionHandler']>[0]

/** 测试环境中的 MediaMetadata 轻量替身。 */
type FakeMetadata = MediaMetadataInit & MediaMetadata

/** 测试触发动作时允许只传和场景有关的 details 字段。 */
type FakeActionDetails = Partial<Omit<MediaSessionActionDetails, 'action'>>

// ─────────────────────────────────────────────────────────────────────────────
// 测试替身区
// ─────────────────────────────────────────────────────────────────────────────

/** 可记录动作、元数据和进度的假 Media Session。 */
class FakeSystemMediaSession implements SystemMediaSessionPort {
  /** 当前系统媒体元数据。 */
  metadata: MediaMetadata | null = null

  /** 当前系统媒体播放状态。 */
  playbackState: MediaSessionPlaybackState = 'none'

  /** 已注册的系统媒体动作处理器。 */
  readonly handlers = new Map<FakeSystemMediaAction, MediaSessionActionHandler>()

  /** 已同步过的位置状态。 */
  readonly positions: Array<MediaPositionState | undefined> = []

  /** 需要模拟为平台不支持的动作。 */
  readonly unsupportedActions = new Set<FakeSystemMediaAction>()

  /** 注册或清理系统媒体动作处理器。 */
  setActionHandler(action: FakeSystemMediaAction, handler: MediaSessionActionHandler | null): void {
    if (this.unsupportedActions.has(action)) throw new Error(`unsupported action: ${action}`)
    if (handler) {
      this.handlers.set(action, handler)
      return
    }
    this.handlers.delete(action)
  }

  /** 记录系统媒体位置状态。 */
  setPositionState(state?: MediaPositionState): void {
    this.positions.push(state ? { ...state } : undefined)
  }

  /** 触发一个已注册的系统媒体动作。 */
  emit(action: FakeSystemMediaAction, details: FakeActionDetails = {}): void {
    this.handlers.get(action)?.({ action, ...details } as MediaSessionActionDetails)
  }
}

/** 可手动推送播放快照的假快照来源。 */
class FakeSnapshotSource implements SystemMediaSnapshotSource {
  /** 当前快照。 */
  private current: PlayerSnapshot

  /** 已订阅的快照监听器。 */
  private readonly listeners = new Set<(snapshot: PlayerSnapshot) => void>()

  constructor(initialSnapshot: PlayerSnapshot) {
    this.current = initialSnapshot
  }

  /** 读取当前快照。 */
  getSnapshot(): PlayerSnapshot {
    return this.current
  }

  /** 订阅快照变化。 */
  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 推送一份新快照。 */
  emit(snapshot: PlayerSnapshot): void {
    this.current = snapshot
    for (const listener of this.listeners) listener(snapshot)
  }

  /** 返回当前监听器数量，供 dispose 断言。 */
  listenerCount(): number {
    return this.listeners.size
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 构造测试用曲目摘要。 */
function createTrack(overrides: Partial<TrackSummary> = {}): TrackSummary {
  return {
    trackId: 'track-1',
    name: '系统媒体测试曲',
    artists: ['歌手 A', '歌手 B'],
    album: '测试专辑',
    artwork: [
      {
        src: 'https://img.example.com/cover-512.jpg',
        sizes: '512x512',
        type: 'image/jpeg'
      }
    ],
    durationMs: 180_000,
    ...overrides
  }
}

/** 构造测试用播放快照。 */
function createPlaybackSnapshot(overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  return {
    status: 'playing',
    intent: 'play',
    track: createTrack(),
    generation: 3,
    positionMs: 30_000,
    durationMs: 180_000,
    bufferedMs: 90_000,
    volume: 1,
    muted: false,
    seeking: false,
    error: null,
    actualQuality: 'exhigh',
    downgraded: false,
    ...overrides
  }
}

/** 构造测试用播放器总快照。 */
function createPlayerSnapshot(overrides: Partial<PlaybackSnapshot> = {}): PlayerSnapshot {
  return {
    playback: createPlaybackSnapshot(overrides),
    queue: {
      items: [],
      currentItemId: null,
      mode: 'loop',
      revision: 7
    },
    quality: 'auto'
  }
}

/** 构造系统媒体命令 spy。 */
function createCommands(): SystemMediaCommands & {
  play: ReturnType<typeof vi.fn<() => Promise<void>>>
  pause: ReturnType<typeof vi.fn<() => void>>
  next: ReturnType<typeof vi.fn<() => Promise<void>>>
  previous: ReturnType<typeof vi.fn<() => Promise<void>>>
  seek: ReturnType<typeof vi.fn<(positionMs: number) => void>>
} {
  return {
    play: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    pause: vi.fn<() => void>(),
    next: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    previous: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    seek: vi.fn<(positionMs: number) => void>()
  }
}

/** 创建桥接器测试夹具。 */
function createBridgeFixture(initialSnapshot: PlayerSnapshot = createPlayerSnapshot()): {
  bridge: SystemMediaSessionBridge
  commands: ReturnType<typeof createCommands>
  session: FakeSystemMediaSession
  source: FakeSnapshotSource
} {
  const session = new FakeSystemMediaSession()
  const source = new FakeSnapshotSource(initialSnapshot)
  const commands = createCommands()
  const bridge = new SystemMediaSessionBridge(source, commands, {
    session,
    metadataFactory: (init) => init as FakeMetadata
  })
  return { bridge, commands, session, source }
}

/** 读取最后一次位置状态。 */
function lastPosition(session: FakeSystemMediaSession): MediaPositionState | undefined {
  return session.positions.at(-1)
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试区
// ─────────────────────────────────────────────────────────────────────────────

describe('SystemMediaSessionBridge', () => {
  it('同步曲目元数据、封面、播放状态和进度', () => {
    const { bridge, session } = createBridgeFixture()

    expect(session.metadata).toMatchObject({
      title: '系统媒体测试曲',
      artist: '歌手 A / 歌手 B',
      album: '测试专辑',
      artwork: [
        {
          src: 'https://img.example.com/cover-512.jpg',
          sizes: '512x512',
          type: 'image/jpeg'
        }
      ]
    })
    expect(session.playbackState).toBe('playing')
    expect(lastPosition(session)).toEqual({
      duration: 180,
      playbackRate: 1,
      position: 30
    })

    bridge.dispose()
  })

  it('无当前曲目时清空系统媒体展示状态', () => {
    const { bridge, session } = createBridgeFixture(
      createPlayerSnapshot({
        status: 'idle',
        intent: 'pause',
        track: null,
        positionMs: 0,
        durationMs: null
      })
    )

    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(lastPosition(session)).toBeUndefined()

    bridge.dispose()
  })

  it('系统播放控制全部进入同一播放命令管道', () => {
    const { bridge, commands, session } = createBridgeFixture()

    session.emit('play')
    session.emit('pause')
    session.emit('previoustrack')
    session.emit('nexttrack')
    session.emit('seekto', { seekTime: 42 })
    session.emit('seekbackward', { seekOffset: 15 })
    session.emit('seekforward')

    expect(commands.play).toHaveBeenCalledTimes(1)
    expect(commands.pause).toHaveBeenCalledTimes(1)
    expect(commands.previous).toHaveBeenCalledTimes(1)
    expect(commands.next).toHaveBeenCalledTimes(1)
    expect(commands.seek.mock.calls).toEqual([[42_000], [15_000], [40_000]])

    bridge.dispose()
  })

  it('平台不支持的动作会被跳过且不影响其他动作', () => {
    const session = new FakeSystemMediaSession()
    session.unsupportedActions.add('seekforward')
    const source = new FakeSnapshotSource(createPlayerSnapshot())
    const commands = createCommands()
    const bridge = new SystemMediaSessionBridge(source, commands, {
      session,
      metadataFactory: (init) => init as FakeMetadata
    })

    expect(session.handlers.has('play')).toBe(true)
    expect(session.handlers.has('seekforward')).toBe(false)

    session.emit('play')
    expect(commands.play).toHaveBeenCalledTimes(1)

    bridge.dispose()
  })

  it('订阅快照变化并在 dispose 时清理 handler、元数据和订阅', () => {
    const { bridge, session, source } = createBridgeFixture()

    source.emit(
      createPlayerSnapshot({
        status: 'paused',
        intent: 'pause',
        positionMs: 50_000
      })
    )

    expect(session.playbackState).toBe('paused')
    expect(lastPosition(session)?.position).toBe(50)
    expect(source.listenerCount()).toBe(1)

    bridge.dispose()

    expect(source.listenerCount()).toBe(0)
    expect(session.handlers.size).toBe(0)
    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(lastPosition(session)).toBeUndefined()
  })

  it('进度同步会裁剪超界位置并忽略无效时长', () => {
    const { bridge, session } = createBridgeFixture()

    bridge.sync(
      createPlayerSnapshot({
        positionMs: 999_000,
        durationMs: 180_000
      })
    )
    expect(lastPosition(session)).toEqual({
      duration: 180,
      playbackRate: 1,
      position: 180
    })

    bridge.sync(
      createPlayerSnapshot({
        track: createTrack({ durationMs: null }),
        durationMs: null
      })
    )
    expect(lastPosition(session)).toBeUndefined()

    bridge.dispose()
  })
})
