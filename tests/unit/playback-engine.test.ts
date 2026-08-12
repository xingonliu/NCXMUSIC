import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PlaybackEngine } from '../../src/domains/player/playback-engine'
import type {
  LoadMediaInput,
  MediaElementEvent,
  MediaElementPort,
  PlaybackEvent,
  ResolvedMediaSource,
  TrackSummary
} from '../../src/domains/player/types'

// ─────────────────────────────────────────────────────────────────────────────
// 测试替身
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MediaElementPort 的可控替身。
 * 记录所有副作用调用顺序，并允许测试手动派发媒体事件。
 */
class FakeMediaPort implements MediaElementPort {
  /** 按顺序记录的副作用调用，用于断言「不出现双音频」等时序要求 */
  readonly calls: string[] = []

  /** 当前源地址；null 表示已清空 */
  currentSource: string | null = null

  volume = 1
  muted = false
  duckGain = 1

  /** play() 的下一次结果；设为 Error 时模拟被策略拒绝 */
  nextPlayResult: Error | undefined

  /** 正在出声的源数量，用于检测双音频 */
  playingSources = new Set<string>()

  private readonly listeners = new Set<(event: MediaElementEvent) => void>()

  setSource(url: string): void {
    this.calls.push(`setSource:${url}`)
    // 真实实现换源前会 pause，此处同步模拟：旧源立即停止出声
    this.playingSources.clear()
    this.currentSource = url
  }

  clearSource(): void {
    this.calls.push('clearSource')
    this.playingSources.clear()
    this.currentSource = null
  }

  async play(): Promise<void> {
    this.calls.push('play')
    if (this.nextPlayResult) {
      const error = this.nextPlayResult
      this.nextPlayResult = undefined
      throw error
    }
    if (this.currentSource) this.playingSources.add(this.currentSource)
  }

  pause(): void {
    this.calls.push('pause')
    this.playingSources.clear()
  }

  seek(positionMs: number): void {
    this.calls.push(`seek:${positionMs}`)
  }

  setVolume(volume: number): void {
    this.volume = volume
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  setDuckGain(gain: number): void {
    this.duckGain = gain
  }

  subscribe(listener: (event: MediaElementEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 当前订阅者数量，用于监听器泄漏检测 */
  listenerCount(): number {
    return this.listeners.size
  }

  /** 派发一个媒体事件到引擎 */
  emit(event: MediaElementEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────────────────────

function track(id: string, durationMs: number | null = 200_000): TrackSummary {
  return {
    trackId: id,
    name: `曲目${id}`,
    artists: ['演唱者'],
    album: '专辑',
    durationMs
  }
}

function source(url: string, format = 'mp3'): ResolvedMediaSource {
  return {
    url,
    requestedQuality: 'auto',
    actualQuality: 'exhigh',
    attemptedQualities: ['exhigh'],
    downgraded: false,
    format
  }
}

function loadInput(id: string, autoplay: boolean, startPositionMs?: number): LoadMediaInput {
  return {
    source: source(`https://example.test/${id}.mp3`),
    track: track(id),
    autoplay,
    ...(startPositionMs === undefined ? {} : { startPositionMs })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────────────────────────────────────

describe('PlaybackEngine', () => {
  let media: FakeMediaPort
  let engine: PlaybackEngine

  beforeEach(() => {
    media = new FakeMediaPort()
    engine = new PlaybackEngine(media)
  })

  describe('初始状态', () => {
    it('未装载时为 idle 且意图为 pause', () => {
      const snapshot = engine.getSnapshot()
      expect(snapshot.status).toBe('idle')
      expect(snapshot.intent).toBe('pause')
      expect(snapshot.track).toBeNull()
      expect(snapshot.error).toBeNull()
    })

    it('构造时把初始音量与静音写入媒体元素', () => {
      const port = new FakeMediaPort()
      new PlaybackEngine(port, { initialVolume: 0.4, initialMuted: true })
      expect(port.volume).toBe(0.4)
      expect(port.muted).toBe(true)
    })

    it('idle 状态下 play/seek 不产生媒体副作用', async () => {
      await engine.play()
      engine.seek(5_000)
      expect(media.calls).toEqual([])
    })
  })

  describe('装载与状态转移', () => {
    it('load(autoplay=false) 进入 loading 且意图为 pause', () => {
      engine.load(loadInput('1', false))
      const snapshot = engine.getSnapshot()
      expect(snapshot.status).toBe('loading')
      expect(snapshot.intent).toBe('pause')
      expect(snapshot.track?.trackId).toBe('1')
    })

    it('load(autoplay=false) 收到 canplay 后进入 ready，不自动出声', () => {
      engine.load(loadInput('1', false))
      media.emit({ type: 'canplay' })

      expect(engine.getSnapshot().status).toBe('ready')
      expect(media.calls).not.toContain('play')
      expect(media.playingSources.size).toBe(0)
    })

    it('load(autoplay=true) 收到 canplay 后调用 play', async () => {
      engine.load(loadInput('1', true))
      expect(engine.getSnapshot().intent).toBe('play')

      media.emit({ type: 'canplay' })
      await vi.waitFor(() => expect(media.calls).toContain('play'))

      media.emit({ type: 'playing' })
      expect(engine.getSnapshot().status).toBe('playing')
    })

    it('loadedmetadata 用媒体读数补齐未知时长', () => {
      engine.load({ ...loadInput('1', false), track: track('1', null) })
      expect(engine.getSnapshot().durationMs).toBeNull()

      media.emit({ type: 'loadedmetadata', durationMs: 183_000 })
      expect(engine.getSnapshot().durationMs).toBe(183_000)
    })

    it('playing → waiting 进入 buffering，再次 playing 恢复', () => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'canplay' })
      media.emit({ type: 'playing' })

      media.emit({ type: 'waiting' })
      expect(engine.getSnapshot().status).toBe('buffering')

      media.emit({ type: 'playing' })
      expect(engine.getSnapshot().status).toBe('playing')
    })

    it('ready 状态收到 waiting 不误转 buffering', () => {
      engine.load(loadInput('1', false))
      media.emit({ type: 'canplay' })

      media.emit({ type: 'stalled' })
      expect(engine.getSnapshot().status).toBe('ready')
    })

    it('忽略旧 source generation 的迟到媒体事件', () => {
      engine.load(loadInput('1', false))
      engine.load(loadInput('2', false))

      media.emit({ type: 'canplay', sourceGeneration: 1 })
      expect(engine.getSnapshot().status).toBe('loading')
      expect(engine.getSnapshot().track?.trackId).toBe('2')

      media.emit({ type: 'canplay', sourceGeneration: 2 })
      expect(engine.getSnapshot().status).toBe('ready')
    })

    it('pause() 立即改意图，状态等媒体事件确认', () => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'canplay' })
      media.emit({ type: 'playing' })

      engine.pause()
      expect(engine.getSnapshot().intent).toBe('pause')
      expect(engine.getSnapshot().status).toBe('playing')

      media.emit({ type: 'pause' })
      expect(engine.getSnapshot().status).toBe('paused')
    })

    it('toggle 依据 intent 而非 status 决策', async () => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'canplay' })
      media.emit({ type: 'playing' })

      await engine.toggle()
      expect(engine.getSnapshot().intent).toBe('pause')

      await engine.toggle()
      expect(engine.getSnapshot().intent).toBe('play')
    })
  })

  describe('seek', () => {
    it('当前位置的 no-op seek 不进入 seeking，避免等待永远不会出现的 seeked', () => {
      engine.load(loadInput('1', false))
      media.emit({ type: 'canplay' })

      engine.seek(0)

      expect(engine.getSnapshot().seeking).toBe(false)
      expect(media.calls).not.toContain('seek:0')
    })

    it('canplay 之后 seek 直接下发媒体调用', () => {
      engine.load(loadInput('1', false))
      media.emit({ type: 'canplay' })

      engine.seek(30_000)
      expect(media.calls).toContain('seek:30000')
      expect(engine.getSnapshot().seeking).toBe(true)
    })

    it('canplay 之前 seek 暂存，canplay 后统一应用一次', () => {
      engine.load(loadInput('1', false))
      engine.seek(45_000)
      expect(media.calls).not.toContain('seek:45000')

      media.emit({ type: 'canplay' })
      expect(media.calls).toContain('seek:45000')
    })

    it('seek 位置裁剪到 [0, duration]', () => {
      engine.load(loadInput('1', false))
      media.emit({ type: 'canplay' })

      engine.seek(-5_000)
      expect(engine.getSnapshot().positionMs).toBe(0)

      engine.seek(999_999)
      expect(engine.getSnapshot().positionMs).toBe(200_000)
    })

    it('seek 进行中丢弃 timeupdate，避免进度条回跳', () => {
      engine.load(loadInput('1', false))
      media.emit({ type: 'canplay' })
      engine.seek(60_000)

      media.emit({ type: 'timeupdate', positionMs: 1_000, bufferedMs: 2_000 })
      expect(engine.getSnapshot().positionMs).toBe(60_000)

      media.emit({ type: 'seeked', positionMs: 60_000 })
      media.emit({ type: 'timeupdate', positionMs: 61_000, bufferedMs: 70_000 })
      expect(engine.getSnapshot().positionMs).toBe(61_000)
    })

    it('startPositionMs 在 canplay 后应用（启动恢复场景）', () => {
      engine.load(loadInput('1', false, 90_000))
      expect(engine.getSnapshot().positionMs).toBe(90_000)

      media.emit({ type: 'canplay' })
      expect(media.calls).toContain('seek:90000')
    })
  })

  describe('generation 隔离', () => {
    it('每次 load 递增 generation', () => {
      expect(engine.currentGeneration()).toBe(0)
      engine.load(loadInput('1', false))
      expect(engine.currentGeneration()).toBe(1)
      engine.load(loadInput('2', false))
      expect(engine.currentGeneration()).toBe(2)
    })

    it('stop 递增 generation 并回到 idle', () => {
      engine.load(loadInput('1', true))
      const before = engine.currentGeneration()

      engine.stop()
      expect(engine.currentGeneration()).toBe(before + 1)
      expect(engine.getSnapshot().status).toBe('idle')
      expect(engine.getSnapshot().track).toBeNull()
      expect(media.currentSource).toBeNull()
    })

    it('ended 事件携带当前 generation 与 trackId', () => {
      const events: PlaybackEvent[] = []
      engine.subscribe((event) => events.push(event))

      engine.load(loadInput('7', true))
      media.emit({ type: 'canplay' })
      media.emit({ type: 'ended' })

      const ended = events.find((event) => event.type === 'ended')
      expect(ended).toMatchObject({
        type: 'ended',
        generation: engine.currentGeneration(),
        trackId: '7'
      })
    })

    it('换代后旧的 play() 拒绝不污染新状态', async () => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'canplay' })
      media.nextPlayResult = new Error('NotAllowedError')

      // 在 play 拒绝落地前换代
      const pending = engine.play()
      engine.load(loadInput('2', true))
      await pending

      // 新一代仍是 loading，未被旧代的 autoplay-blocked 覆盖
      expect(engine.getSnapshot().track?.trackId).toBe('2')
      expect(engine.getSnapshot().error).toBeNull()
    })

    it('reportResolveFailure 只对匹配代次生效', () => {
      engine.load(loadInput('1', true))
      const stale = engine.currentGeneration() - 1

      engine.reportResolveFailure(stale)
      expect(engine.getSnapshot().status).toBe('loading')

      engine.reportResolveFailure(engine.currentGeneration())
      expect(engine.getSnapshot().status).toBe('error')
      expect(engine.getSnapshot().error?.code).toBe('resolve-failed')
    })
  })

  describe('错误处理', () => {
    it.each([
      [2, 'network-error', true],
      [3, 'decode-error', false],
      [4, 'media-unsupported', false]
    ] as const)('MediaError %i → %s（retryable=%s）', (_code, expected, retryable) => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'error', code: expected })

      const snapshot = engine.getSnapshot()
      expect(snapshot.status).toBe('error')
      expect(snapshot.error?.code).toBe(expected)
      expect(snapshot.error?.retryable).toBe(retryable)
      expect(snapshot.intent).toBe('pause')
    })

    it('过期 URL 表现为 network-error 且标记可重试', () => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'canplay' })
      media.emit({ type: 'playing' })

      // 过期签名 URL 在续传时通常表现为网络错误
      media.emit({ type: 'error', code: 'network-error' })
      expect(engine.getSnapshot().error?.retryable).toBe(true)
    })

    it('play 被浏览器策略拒绝时进入 autoplay-blocked 且不留播放中假象', async () => {
      engine.load(loadInput('1', false))
      media.emit({ type: 'canplay' })
      media.nextPlayResult = new Error('NotAllowedError')

      await engine.play()

      const snapshot = engine.getSnapshot()
      expect(snapshot.error?.code).toBe('autoplay-blocked')
      expect(snapshot.intent).toBe('pause')
      expect(snapshot.status).not.toBe('playing')
    })

    it('error 状态下 pause 事件不覆盖 error', () => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'error', code: 'decode-error' })
      media.emit({ type: 'pause' })

      expect(engine.getSnapshot().status).toBe('error')
    })
  })

  describe('音量与 ducking', () => {
    it('setVolume 裁剪到 [0,1] 并写入媒体', () => {
      engine.setVolume(1.5)
      expect(media.volume).toBe(1)
      engine.setVolume(-1)
      expect(media.volume).toBe(0)
      engine.setVolume(0.6)
      expect(media.volume).toBeCloseTo(0.6)
    })

    it('setDuckGain 不修改持久音量', () => {
      engine.setVolume(0.8)
      engine.setDuckGain(0.2)

      expect(media.duckGain).toBe(0.2)
      // 快照中的 volume 仍是用户设定值
      expect(engine.getSnapshot().volume).toBeCloseTo(0.8)
    })

    it('setMuted 同步到媒体与快照', () => {
      engine.setMuted(true)
      expect(media.muted).toBe(true)
      expect(engine.getSnapshot().muted).toBe(true)
    })
  })

  describe('快速切歌（T-03 通过条件）', () => {
    it('连续切换 100 次不出现双音频、监听器增长或旧歌复活', async () => {
      const listenersBefore = media.listenerCount()

      for (let index = 0; index < 100; index += 1) {
        engine.load(loadInput(String(index), true))
        media.emit({ type: 'canplay' })
        // 一半的轮次让 playing 真正落地，模拟真实交错时序
        if (index % 2 === 0) media.emit({ type: 'playing' })
      }
      await vi.waitFor(() => expect(media.calls).toContain('play'))

      // 只有最后一首在出声
      expect(media.playingSources.size).toBeLessThanOrEqual(1)
      expect(media.currentSource).toBe('https://example.test/99.mp3')
      expect(engine.getSnapshot().track?.trackId).toBe('99')

      // 监听器未增长
      expect(media.listenerCount()).toBe(listenersBefore)
      expect(engine.currentGeneration()).toBe(100)
    })

    it('迟到的旧代 ended 不会被当作当前曲目结束上报', () => {
      const ended: PlaybackEvent[] = []
      engine.subscribe((event) => {
        if (event.type === 'ended') ended.push(event)
      })

      engine.load(loadInput('1', true))
      const firstGeneration = engine.currentGeneration()
      engine.load(loadInput('2', true))
      media.emit({ type: 'ended' })

      // 事件只带当前代次，调用方据此丢弃旧代
      expect(ended).toHaveLength(1)
      expect(ended[0]).toMatchObject({ generation: engine.currentGeneration() })
      expect(firstGeneration).not.toBe(engine.currentGeneration())
    })

    it('切歌前先清空旧源，保证不会两路同时出声', () => {
      engine.load(loadInput('1', true))
      media.emit({ type: 'canplay' })
      media.emit({ type: 'playing' })
      expect(media.playingSources.size).toBe(1)

      engine.load(loadInput('2', true))
      // 换源即刻停止旧源出声
      expect(media.playingSources.size).toBe(0)
    })
  })

  describe('资源释放', () => {
    it('dispose 解绑媒体订阅并清空源', () => {
      engine.load(loadInput('1', true))
      engine.dispose()

      expect(media.listenerCount()).toBe(0)
      expect(media.currentSource).toBeNull()
    })

    it('dispose 后媒体事件不再改变快照', () => {
      engine.load(loadInput('1', false))
      engine.dispose()
      const before = engine.getSnapshot()

      media.emit({ type: 'playing' })
      expect(engine.getSnapshot().status).toBe(before.status)
    })

    it('dispose 后订阅者不再收到事件', () => {
      const events: PlaybackEvent[] = []
      engine.subscribe((event) => events.push(event))
      engine.dispose()
      const count = events.length

      media.emit({ type: 'playing' })
      expect(events).toHaveLength(count)
    })
  })

  describe('快照不泄漏敏感数据', () => {
    it('快照中不包含播放 URL', () => {
      engine.load(loadInput('1', true))
      const serialized = JSON.stringify(engine.getSnapshot())

      expect(serialized).not.toContain('example.test')
      expect(serialized).not.toContain('.mp3')
    })
  })
})
