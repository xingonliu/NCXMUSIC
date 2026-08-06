import { beforeEach, describe, expect, it } from 'vitest'

import { PlaybackCoordinator } from '../../src/domains/player/playback-coordinator'
import { PlaybackEngine } from '../../src/domains/player/playback-engine'
import { QueueController } from '../../src/domains/player/queue-controller'
import type { PlayerEvent } from '../../src/domains/player/playback-coordinator'
import type {
  MediaElementEvent,
  MediaElementPort,
  MusicQualityPreference,
  ResolvedMediaSource,
  TrackResolver,
  TrackSummary
} from '../../src/domains/player/types'

// ─────────────────────────────────────────────────────────────────────────────
// 测试替身区
// ─────────────────────────────────────────────────────────────────────────────

/** 记录所有媒体调用的假媒体元素 */
class FakeMedia implements MediaElementPort {
  /** 按顺序记录 setSource 收到的 URL，用于断言装载顺序 */
  readonly loadedUrls: string[] = []
  readonly calls: string[] = []
  private readonly listeners = new Set<(event: MediaElementEvent) => void>()

  setSource(url: string): void {
    this.loadedUrls.push(url)
    this.calls.push('setSource')
  }

  clearSource(): void {
    this.calls.push('clearSource')
  }

  play(): Promise<void> {
    this.calls.push('play')
    return Promise.resolve()
  }

  pause(): void {
    this.calls.push('pause')
  }

  seek(): void {
    this.calls.push('seek')
  }

  setVolume(): void {}

  setMuted(): void {}

  setDuckGain(): void {}

  subscribe(listener: (event: MediaElementEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 触发媒体事件 */
  emit(event: MediaElementEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }

  /** 走完 loading → canplay 流程 */
  reachCanPlay(): void {
    this.emit({ type: 'loadedmetadata', durationMs: 200_000 })
    this.emit({ type: 'canplay' })
  }
}

/** 可控时序的假解析器 */
class FakeResolver implements TrackResolver {
  /** 已收到的解析请求 */
  readonly requests: Array<{ trackId: string; quality: MusicQualityPreference }> = []

  /** trackId → 手动 resolve/reject 句柄 */
  private readonly deferred = new Map<
    string,
    { resolve: (value: ResolvedMediaSource) => void; reject: (error: unknown) => void }
  >()

  /** 收到解析请求时被中止的 trackId */
  readonly aborted: string[] = []

  /** 设为 true 时所有解析立即成功，不需要手动 settle */
  autoResolve = false

  resolve(
    trackId: string,
    quality: MusicQualityPreference,
    signal: AbortSignal
  ): Promise<ResolvedMediaSource> {
    this.requests.push({ trackId, quality })

    if (this.autoResolve) return Promise.resolve(source(trackId))

    return new Promise<ResolvedMediaSource>((resolve, reject) => {
      this.deferred.set(trackId, { resolve, reject })
      signal.addEventListener('abort', () => {
        this.aborted.push(trackId)
        // 中止也要从在途表中移除，否则 pendingCount 会把已取消的解析算成悬挂
        this.deferred.delete(trackId)
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
  }

  /** 手动让指定 trackId 的解析成功 */
  settle(trackId: string, override: Partial<ResolvedMediaSource> = {}): void {
    this.deferred.get(trackId)?.resolve({ ...source(trackId), ...override })
    this.deferred.delete(trackId)
  }

  /** 手动让指定 trackId 的解析失败 */
  fail(trackId: string, error: unknown = new Error('resolve failed')): void {
    this.deferred.get(trackId)?.reject(error)
    this.deferred.delete(trackId)
  }

  /** 是否仍有在途解析 */
  pendingCount(): number {
    return this.deferred.size
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 构造曲目摘要 */
function track(trackId: string, name = `曲目${trackId}`): TrackSummary {
  return {
    trackId,
    name,
    artists: ['测试歌手'],
    album: '测试专辑',
    durationMs: 200_000
  }
}

/** 构造解析结果；URL 中带 trackId 便于断言装载的是哪一首 */
function source(trackId: string): ResolvedMediaSource {
  return {
    url: `https://music.example.com/${trackId}.mp3?sign=short-lived`,
    requestedQuality: 'auto',
    actualQuality: 'exhigh',
    attemptedQualities: ['exhigh'],
    downgraded: false,
    bitrate: 320_000,
    format: 'mp3'
  }
}

/** 让微任务队列跑空 */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve()
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试区
// ─────────────────────────────────────────────────────────────────────────────

describe('PlaybackCoordinator', () => {
  let media: FakeMedia
  let engine: PlaybackEngine
  let queue: QueueController
  let resolver: FakeResolver
  let coordinator: PlaybackCoordinator
  let events: PlayerEvent[]

  beforeEach(() => {
    media = new FakeMedia()
    engine = new PlaybackEngine(media)
    // 注入确定性 ID，使断言不依赖随机 UUID
    let seq = 0
    queue = new QueueController({
      createId: () => `q${(seq += 1)}`,
      random: () => 0,
      now: () => 1_700_000_000_000
    })
    resolver = new FakeResolver()
    coordinator = new PlaybackCoordinator(queue, engine, resolver)
    events = []
    coordinator.subscribe((event) => events.push(event))
  })

  describe('解析 → 装载编排', () => {
    it('歌单播放解析首项并装载，URL 只经引擎不进入队列快照', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })

      expect(resolver.requests).toEqual([{ trackId: '1', quality: 'auto' }])
      expect(media.loadedUrls).toEqual(['https://music.example.com/1.mp3?sign=short-lived'])

      // 队列快照里只有曲目摘要，没有任何播放地址
      const snapshot = coordinator.getSnapshot()
      expect(JSON.stringify(snapshot.queue)).not.toContain('music.example.com')
      expect(JSON.stringify(snapshot.queue)).not.toContain('sign=')
    })

    it('单曲点播插入当前项之后并切换播放', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      await coordinator.playTrack(track('9'), { kind: 'agent' })

      const snapshot = coordinator.getSnapshot()
      expect(snapshot.queue.items.map((item) => item.track.trackId)).toEqual(['1', '9', '2'])
      expect(snapshot.playback.track?.trackId).toBe('9')
    })

    it('autoplay=true 时在 canplay 后真正出声', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1')],
        source: { kind: 'search' }
      })

      expect(media.calls).not.toContain('play')
      media.reachCanPlay()
      await flush()
      expect(media.calls).toContain('play')
      expect(coordinator.getSnapshot().playback.intent).toBe('play')
    })

    it('playQueueItem 同时更新队列当前项与引擎装载', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2'), track('3')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })

      const items = coordinator.getSnapshot().queue.items
      const third = items[2]?.queueItemId ?? ''
      await coordinator.playQueueItem(third)

      const snapshot = coordinator.getSnapshot()
      // 队列与引擎必须指向同一首，否则 next() 会从错误位置前进
      expect(snapshot.queue.currentItemId).toBe(third)
      expect(snapshot.playback.track?.trackId).toBe('3')
    })
  })

  describe('切歌竞态（T-03 通过条件）', () => {
    it('快速切歌时取消上一次解析', async () => {
      // 解析未完成就发起切歌：不能 await playContext，否则测试自身死锁
      const started = coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      const advance = coordinator.next()

      resolver.settle('2')
      await Promise.all([started, advance])

      expect(resolver.aborted).toContain('1')
      expect(resolver.requests.map((request) => request.trackId)).toEqual(['1', '2'])
    })

    it('迟到的旧解析结果被丢弃，不会装载旧歌', async () => {
      const started = coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      const advance = coordinator.next()

      // 旧解析在切歌之后才返回
      resolver.settle('1')
      resolver.settle('2')
      await Promise.all([started, advance])
      await flush()

      // 只有新曲目被装载，旧歌没有复活
      expect(media.loadedUrls).toEqual(['https://music.example.com/2.mp3?sign=short-lived'])
      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('2')
    })

    it('连续切换 20 次后只装载最后一首，且没有解析泄漏', async () => {
      const tracks = Array.from({ length: 20 }, (_, index) => track(String(index + 1)))
      const first = coordinator.playContext({
        tracks,
        source: { kind: 'playlist', playlistId: 'p1' }
      })

      // 不等待解析完成，连续快进
      const advances: Array<Promise<void>> = []
      for (let i = 0; i < 19; i += 1) advances.push(coordinator.next())

      // 最后一首才真正返回结果
      resolver.settle('20')
      await Promise.all([first, ...advances])
      await flush()

      expect(media.loadedUrls).toEqual(['https://music.example.com/20.mp3?sign=short-lived'])
      // 除最后一首外全部被中止，没有悬挂的解析
      expect(resolver.pendingCount()).toBe(0)
      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('20')
    })

    it('装载新源前先清空旧源，不出现双音频', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()
      media.calls.length = 0

      await coordinator.next()
      await flush()

      // setSource 之前必须有 pause，保证旧音频先停
      const setSourceIndex = media.calls.indexOf('setSource')
      expect(setSourceIndex).toBeGreaterThan(-1)
      expect(media.calls.slice(0, setSourceIndex)).toContain('pause')
    })
  })

  describe('错误策略', () => {
    it('解析失败时发出轻量提示并自动跳到下一首', async () => {
      const started = coordinator.playContext({
        tracks: [track('1', '不可用歌曲'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })

      resolver.fail('1')
      await flush()
      resolver.settle('2')
      await started
      await flush()

      const notice = events.find((event) => event.type === 'track-unplayable')
      expect(notice).toMatchObject({ type: 'track-unplayable', trackId: '1' })
      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('2')
    })

    it('全部曲目解析失败时停止，不无限跳转', async () => {
      const started = coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })

      resolver.fail('1')
      await flush()
      resolver.fail('2')
      await started
      await flush()

      // 两首都失败后必须停下来
      expect(resolver.requests.length).toBeLessThanOrEqual(3)
      expect(coordinator.getSnapshot().playback.status).toBe('idle')
    })

    it('媒体播放错误按错误策略跳过当前曲目', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      media.emit({ type: 'error', code: 'media-unsupported' })
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('2')
    })

    it('autoplay-blocked 不触发跳歌，留在当前曲目等用户操作', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      media.emit({ type: 'error', code: 'autoplay-blocked' })
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('1')
    })

    it('解析被取消不产生不可播放提示', async () => {
      const started = coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      const advance = coordinator.next()
      resolver.settle('2')
      await Promise.all([started, advance])
      await flush()

      // 取消是正常切歌行为，不该报错给用户
      expect(events.some((event) => event.type === 'track-unplayable')).toBe(false)
    })
  })

  describe('播放结束推进', () => {
    it('ended 交给队列决策下一首', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      media.emit({ type: 'ended' })
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('2')
    })

    it('loop-one 下 ended 重播当前曲目', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      await coordinator.setMode('loop-one')
      await flush()

      media.reachCanPlay()
      await flush()
      media.emit({ type: 'ended' })
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('1')
    })

    it('末项 ended 在 loop 模式下回到第一项', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' },
        startIndex: 1
      })
      media.reachCanPlay()
      await flush()

      media.emit({ type: 'ended' })
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('1')
    })
  })

  describe('队列操作与播放的关系', () => {
    it('删除非当前项不打断播放', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      const items = coordinator.getSnapshot().queue.items
      await coordinator.remove(items[1]?.queueItemId ?? '')
      await flush()

      // 当前曲目必须保持不变
      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('1')
      expect(coordinator.getSnapshot().playback.status).not.toBe('idle')
    })

    it('切换播放模式不打断当前播放', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      await coordinator.setMode('loop-one')
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('1')
      expect(coordinator.getSnapshot().playback.status).not.toBe('idle')
    })

    it('clear 停止播放并回到 idle', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      await coordinator.clear()
      await flush()

      const snapshot = coordinator.getSnapshot()
      expect(snapshot.playback.status).toBe('idle')
      expect(snapshot.playback.track).toBeNull()
      expect(snapshot.queue.items).toHaveLength(0)
    })

    it('删除当前项切换到同位置的下一项', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1'), track('2'), track('3')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })

      const items = coordinator.getSnapshot().queue.items
      await coordinator.remove(items[0]?.queueItemId ?? '')
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('2')
    })

    it('enqueue 不改变当前播放', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      coordinator.enqueue([track('5')], { kind: 'search' })
      await flush()

      expect(coordinator.getSnapshot().playback.track?.trackId).toBe('1')
      expect(coordinator.getSnapshot().queue.items).toHaveLength(2)
    })
  })

  describe('音质切换', () => {
    it('播放中切音质保位重载并沿用播放意图', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()
      media.emit({ type: 'timeupdate', positionMs: 45_000, bufferedMs: 60_000 })

      await coordinator.setQuality('lossless')
      await flush()

      // 用新音质重新请求了同一首
      expect(resolver.requests.filter((request) => request.trackId === '1')).toHaveLength(2)
      expect(resolver.requests.at(-1)?.quality).toBe('lossless')
      expect(coordinator.getSnapshot().quality).toBe('lossless')
      expect(coordinator.getSnapshot().playback.intent).toBe('play')
    })

    it('未播放时切音质只更新偏好，不触发解析', async () => {
      await coordinator.setQuality('hires')
      await flush()

      expect(resolver.requests).toHaveLength(0)
      expect(coordinator.getSnapshot().quality).toBe('hires')
    })

    it('重复设置同一音质不触发重载', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      const before = resolver.requests.length

      await coordinator.setQuality('auto')
      await flush()

      expect(resolver.requests).toHaveLength(before)
    })

    it('降级结果反映到快照', async () => {
      const started = coordinator.playContext({
        tracks: [track('1')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      resolver.settle('1', {
        actualQuality: 'standard',
        downgraded: true,
        downgradeReason: 'account-unavailable'
      })
      await started
      await flush()

      const playback = coordinator.getSnapshot().playback
      expect(playback.actualQuality).toBe('standard')
      expect(playback.downgraded).toBe(true)
    })
  })

  describe('资源释放', () => {
    it('dispose 取消在途解析并解绑监听', async () => {
      // 解析故意留在在途状态，验证 dispose 会中止它
      const started = coordinator.playContext({
        tracks: [track('1')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })

      coordinator.dispose()
      await started
      expect(resolver.aborted).toContain('1')

      // dispose 后引擎事件不再产生 Coordinator 事件
      const before = events.length
      media.emit({ type: 'canplay' })
      await flush()
      expect(events).toHaveLength(before)
    })

    it('dispose 后重复调用不抛错', () => {
      coordinator.dispose()
      expect(() => coordinator.dispose()).not.toThrow()
    })
  })

  describe('快照不泄漏敏感数据', () => {
    it('完整快照序列化后不含播放 URL 或签名参数', async () => {
      resolver.autoResolve = true
      await coordinator.playContext({
        tracks: [track('1')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      media.reachCanPlay()
      await flush()

      const serialized = JSON.stringify(coordinator.getSnapshot())
      expect(serialized).not.toContain('music.example.com')
      expect(serialized).not.toContain('sign=')
      expect(serialized).not.toContain('MUSIC_U')
    })

    it('track-unplayable 提示只含曲目名，不含地址', async () => {
      const started = coordinator.playContext({
        tracks: [track('1', '测试歌曲')],
        source: { kind: 'playlist', playlistId: 'p1' }
      })
      resolver.fail('1')
      await started
      await flush()

      const notice = events.find((event) => event.type === 'track-unplayable')
      expect(notice?.type === 'track-unplayable' && notice.message).toContain('测试歌曲')
      expect(JSON.stringify(notice)).not.toContain('http')
    })
  })
})
