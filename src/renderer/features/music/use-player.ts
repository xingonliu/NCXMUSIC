import { readonly, ref, type Ref } from 'vue'

import { PlaybackCoordinator } from '../../../domains/player/playback-coordinator'
import { PlaybackEngine } from '../../../domains/player/playback-engine'
import { QueueController } from '../../../domains/player/queue-controller'
import type { PlayerSnapshot } from '../../../domains/player/playback-coordinator'
import type { PlayContext } from '../../../domains/player/queue-controller'
import type {
  MusicQualityPreference,
  PlayMode,
  QueueSource,
  TrackSummary
} from '../../../domains/player/types'
import { HtmlAudioAdapter } from './html-audio-adapter'
import { IpcTrackResolver } from './ipc-track-resolver'

// ─────────────────────────────────────────────────────────────────────────────
// 变量区
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 应用作用域唯一的播放器实例。
 *
 * 架构约束 A-012：根层只有一个 AudioHost / 一个 HTMLAudioElement。
 * 主播放、试听与 Agent 点播全部复用这一套，不创建第二个内容播放器。
 */
interface PlayerRuntime {
  coordinator: PlaybackCoordinator
  engine: PlaybackEngine
  adapter: HtmlAudioAdapter
  snapshot: Ref<PlayerSnapshot>
  /** 最近一次「曲目不可播放」提示，UI 消费后可清空 */
  notice: Ref<string | null>
}

let runtime: PlayerRuntime | undefined

// ─────────────────────────────────────────────────────────────────────────────
// 函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 创建播放器运行时（惰性单例） */
function createRuntime(): PlayerRuntime {
  const adapter = new HtmlAudioAdapter()
  const engine = new PlaybackEngine(adapter)
  const queue = new QueueController()
  const resolver = new IpcTrackResolver()
  const coordinator = new PlaybackCoordinator(queue, engine, resolver)

  const snapshot = ref<PlayerSnapshot>(coordinator.getSnapshot())
  const notice = ref<string | null>(null)

  coordinator.subscribe((event) => {
    if (event.type === 'snapshot') {
      snapshot.value = event.snapshot
      return
    }
    notice.value = event.message
  })

  return { coordinator, engine, adapter, snapshot, notice }
}

/**
 * 获取应用唯一播放器。
 *
 * 首次调用时惰性创建运行时；由根层 AudioHost 负责最早触发创建。
 * 其他组件只读取快照并发送命令，不得持有引擎或适配器。
 */
export function usePlayer(): {
  snapshot: Readonly<Ref<PlayerSnapshot>>
  notice: Readonly<Ref<string | null>>
  playContext: (context: PlayContext) => Promise<void>
  playTrack: (track: TrackSummary, source: QueueSource) => Promise<void>
  playQueueItem: (queueItemId: string) => Promise<void>
  toggle: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (positionMs: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setMode: (mode: PlayMode) => Promise<void>
  setQuality: (quality: MusicQualityPreference) => Promise<void>
  enqueue: (tracks: TrackSummary[], source: QueueSource) => void
  remove: (queueItemId: string) => Promise<void>
  clear: () => Promise<void>
  /** 清空提示 */
  dismissNotice: () => void
} {
  runtime ??= createRuntime()
  const active = runtime

  return {
    snapshot: readonly(active.snapshot) as Readonly<Ref<PlayerSnapshot>>,
    notice: readonly(active.notice) as Readonly<Ref<string | null>>,
    playContext: (context) => active.coordinator.playContext(context),
    playTrack: (track, source) => active.coordinator.playTrack(track, source),
    playQueueItem: (queueItemId) => active.coordinator.playQueueItem(queueItemId),
    toggle: () => active.coordinator.toggle(),
    next: () => active.coordinator.next(),
    previous: () => active.coordinator.previous(),
    seek: (positionMs) => active.coordinator.seek(positionMs),
    setVolume: (volume) => active.coordinator.setVolume(volume),
    setMuted: (muted) => active.coordinator.setMuted(muted),
    setMode: (mode) => active.coordinator.setMode(mode),
    setQuality: (quality) => active.coordinator.setQuality(quality),
    enqueue: (tracks, source) => active.coordinator.enqueue(tracks, source),
    remove: (queueItemId) => active.coordinator.remove(queueItemId),
    clear: () => active.coordinator.clear(),
    dismissNotice: () => {
      active.notice.value = null
    }
  }
}

/**
 * 释放播放器单例。仅供测试与应用退出使用。
 * 正常路由切换不得调用——会销毁根层 AudioHost。
 */
export function disposePlayer(): void {
  if (!runtime) return
  // 顺序固定：先停编排（取消在途解析）→ 再停引擎 → 最后解绑原生监听器
  runtime.coordinator.dispose()
  runtime.engine.dispose()
  runtime.adapter.dispose()
  runtime = undefined
}
