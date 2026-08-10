import {
  PlayerCommandSchema,
  type PlayerCommand,
  type PlayerCommandResult
} from '../../shared/schemas/player-command'
import type { PlaybackCoordinator, PlayerSnapshot } from './playback-coordinator'

// ========= 类型 =========

/** 带真实最新播放快照的播放器命令回执。 */
export type TypedPlayerCommandResult = Omit<PlayerCommandResult, 'snapshot'> & {
  /** 命令执行结束时 Coordinator 的真实快照。 */
  snapshot: PlayerSnapshot
}

// ========= 变量 =========

/** 命令幂等回执缓存上限。 */
const RESULT_CACHE_LIMIT = 200

// ========= 类 =========

/** 所有 UI、系统媒体键、Agent 与语音入口共用的唯一播放命令 Gateway。 */
export class PlayerCommandGateway {
  /** 已完成 commandId 的幂等回执缓存。 */
  private readonly results = new Map<string, TypedPlayerCommandResult>()

  constructor(private readonly coordinator: PlaybackCoordinator) {}

  /** 校验、执行并返回 Coordinator 的真实执行回执。 */
  async execute(rawCommand: unknown): Promise<TypedPlayerCommandResult> {
    /** 经共享 Schema 校验的播放器命令。 */
    const parsed = PlayerCommandSchema.safeParse(rawCommand)
    if (!parsed.success) {
      /** 无法解析时仍使用安全 commandId 供调用方关联。 */
      /** 仅保留合法 UUID；无效输入不得污染标准回执契约。 */
      const rawCommandId = (rawCommand as { commandId?: unknown } | null)?.commandId
      const commandId = typeof rawCommandId === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(rawCommandId)
        ? rawCommandId
        : crypto.randomUUID()
      return this.result(commandId, false, 'invalid-command')
    }
    /** 已经执行过的相同命令回执。 */
    const cached = this.results.get(parsed.data.commandId)
    if (cached) return cached

    if (parsed.data.expectedRevision !== this.coordinator.getSnapshot().queue.revision) {
      return this.cache(this.result(parsed.data.commandId, false, 'revision-conflict'))
    }

    try {
      /** 真正的 Coordinator 执行任务。 */
      const execution = this.apply(parsed.data)
      /** 命令自身的有限超时计时器。 */
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined
      /** 命令自身的有限超时任务。 */
      const timeout = new Promise<'timeout'>((resolve) => {
        timeoutTimer = setTimeout(() => resolve('timeout'), parsed.data.timeoutMs)
      })
      /** 首个完成的执行状态。 */
      let outcome: 'applied' | 'timeout'
      try {
        outcome = await Promise.race([execution.then(() => 'applied' as const), timeout])
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer)
      }
      return this.cache(this.result(
        parsed.data.commandId,
        outcome === 'applied',
        outcome
      ))
    } catch {
      return this.cache(this.result(parsed.data.commandId, false, 'execution-failed'))
    }
  }

  /** 将类型化动作映射到唯一 Coordinator。 */
  private async apply(command: PlayerCommand): Promise<void> {
    const action = command.action
    if (action.type === 'player.play-context') {
      await this.coordinator.playContext({
        tracks: action.tracks,
        source: action.source,
        ...(action.startIndex !== undefined ? { startIndex: action.startIndex } : {})
      })
    } else if (action.type === 'player.play-track') {
      await this.coordinator.playTrack(action.track, action.source)
    } else if (action.type === 'player.play-queue-item') {
      await this.coordinator.playQueueItem(action.queueItemId)
    } else if (action.type === 'player.play') await this.coordinator.play()
    else if (action.type === 'player.pause') this.coordinator.pause()
    else if (action.type === 'player.toggle') await this.coordinator.toggle()
    else if (action.type === 'player.next') await this.coordinator.next()
    else if (action.type === 'player.previous') await this.coordinator.previous()
    else if (action.type === 'player.seek') this.coordinator.seek(action.positionMs)
    else if (action.type === 'player.set-volume') this.coordinator.setVolume(action.volume)
    else if (action.type === 'player.set-muted') this.coordinator.setMuted(action.muted)
    else if (action.type === 'player.set-mode') await this.coordinator.setMode(action.mode)
    else if (action.type === 'player.set-quality') await this.coordinator.setQuality(action.quality)
    else if (action.type === 'player.enqueue') this.coordinator.enqueue(action.tracks, action.source)
    else if (action.type === 'player.play-next') this.coordinator.playNext(action.tracks, action.source)
    else if (action.type === 'player.reorder') this.coordinator.reorder(action.queueItemId, action.toIndex)
    else if (action.type === 'player.remove') await this.coordinator.remove(action.queueItemId)
    else await this.coordinator.clear()
  }

  /** 构造携带最新真实快照的命令回执。 */
  private result(
    commandId: string,
    ok: boolean,
    code: TypedPlayerCommandResult['code']
  ): TypedPlayerCommandResult {
    /** 命令完成时的最新 Coordinator 快照。 */
    const snapshot = this.coordinator.getSnapshot()
    return {
      commandId,
      ok,
      code,
      latestRevision: snapshot.queue.revision,
      snapshot
    }
  }

  /** 缓存回执并按固定上限淘汰最旧 commandId。 */
  private cache(result: TypedPlayerCommandResult): TypedPlayerCommandResult {
    this.results.set(result.commandId, result)
    while (this.results.size > RESULT_CACHE_LIMIT) {
      /** Map 插入顺序中的最旧 commandId。 */
      const oldestCommandId = this.results.keys().next().value as string | undefined
      if (!oldestCommandId) break
      this.results.delete(oldestCommandId)
    }
    return result
  }
}
