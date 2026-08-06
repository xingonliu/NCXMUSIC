import type { TrackSummary } from '../domains/player/types'
import { usePlayer } from './features/music/use-player'

// ─────────────────────────────────────────────────────────────────────────────
// T-03 真实媒体链路 Smoke
//
// 驱动生产路径本身：真实 music.resolve-url → 真实 HTMLAudioElement 解码播放。
// 不使用任何假媒体元素或假解析器，否则无法回答 T-03 的通过条件。
// 结果经 document.title 回传 Main，只包含状态与格式信息，不含播放 URL。
// ─────────────────────────────────────────────────────────────────────────────

// ── 类型区 ──

/** 单首曲目的验证结果 */
interface TrackReport {
  trackId: string
  /** 解析是否成功拿到播放地址 */
  resolved: boolean
  /** 上游实际给出的音质等级 */
  actualQuality: string | null
  /** 是否发生音质降级 */
  downgraded: boolean
  /** 上游声明的容器格式（mp3 / flac / aac 等） */
  format: string | null
  /** 上游声明的码率 */
  bitrate: number | null
  /** 元数据解析出的时长（毫秒） */
  durationMs: number | null
  /** 是否到达可播放状态 */
  reachedCanPlay: boolean
  /** 播放后进度是否真实前进（证明确实在解码输出） */
  positionAdvanced: boolean
  /** 观测到的最大播放位置 */
  maxPositionMs: number
  /** 暂停是否生效 */
  paused: boolean
  /** seek 是否到达目标位置附近 */
  seeked: boolean
  /** seek 后的实际位置 */
  seekedPositionMs: number | null
  /** 失败原因；成功时为 null */
  failure: string | null
}

/** Smoke 总结果 */
interface MediaSmokeResult {
  ok: boolean
  checks: Record<string, boolean>
  tracks: TrackReport[]
  /** 快速切歌后最终装载的曲目 */
  finalTrackId: string | null
  failure?: string
}

// ── 常量区 ──

/** 单步等待的轮询间隔 */
const POLL_INTERVAL_MS = 100

/** 播放进度前进的判定阈值：超过 300ms 视为真实解码输出 */
const POSITION_ADVANCE_THRESHOLD_MS = 300

/** seek 命中判定容差 */
const SEEK_TOLERANCE_MS = 3_000

// ── 工具函数区 ──

/** 把结果写入 document.title 交给 Main 读取 */
function emit(result: MediaSmokeResult): void {
  document.title = `NCX_T03_RESULT ${encodeURIComponent(JSON.stringify(result))}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 轮询等待条件成立。
 *
 * @param predicate 判定函数
 * @param timeoutMs 超时上限
 * @returns 条件是否在超时前成立
 */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await delay(POLL_INTERVAL_MS)
  }
  return predicate()
}

/** 构造最小曲目摘要；解析只依赖 trackId，展示字段用占位值 */
function placeholderTrack(trackId: string): TrackSummary {
  return {
    trackId,
    name: `T03-${trackId}`,
    artists: ['T03'],
    album: 'T03',
    durationMs: null
  }
}

/** 从查询串读取待验证的曲目 ID 列表 */
function requestedTrackIds(): string[] {
  const raw = new URLSearchParams(window.location.search).get('t03tracks') ?? ''
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d{1,20}$/u.test(value))
}

// ── 单曲验证区 ──

/**
 * 验证单首曲目的 load / play / pause / seek 全流程。
 *
 * @param player   播放器门面
 * @param trackId  待验证曲目 ID
 */
async function verifyTrack(
  player: ReturnType<typeof usePlayer>,
  trackId: string
): Promise<TrackReport> {
  const report: TrackReport = {
    trackId,
    resolved: false,
    actualQuality: null,
    downgraded: false,
    format: null,
    bitrate: null,
    durationMs: null,
    reachedCanPlay: false,
    positionAdvanced: false,
    maxPositionMs: 0,
    paused: false,
    seeked: false,
    seekedPositionMs: null,
    failure: null
  }

  // 先单独调一次解析，拿到格式与音质证据
  const resolved = await window.ncx.runtime.resolveTrackUrl({ trackId, quality: 'auto' })
  if (!resolved.ok) {
    report.failure = `resolve 失败：${resolved.error.code}`
    return report
  }
  report.resolved = true
  report.actualQuality = resolved.data.actualQuality
  report.downgraded = resolved.data.downgraded
  report.format = resolved.data.format ?? null
  report.bitrate = resolved.data.bitrate ?? null

  // 走生产路径装载并播放
  await player.playContext({
    tracks: [placeholderTrack(trackId)],
    source: { kind: 'search' }
  })

  const snapshot = player.snapshot
  report.reachedCanPlay = await waitFor(
    () => ['ready', 'playing', 'buffering', 'paused'].includes(snapshot.value.playback.status),
    20_000
  )
  if (!report.reachedCanPlay) {
    report.failure = `未到达可播放状态；status=${snapshot.value.playback.status}`
    return report
  }
  report.durationMs = snapshot.value.playback.durationMs

  // 等待进度真实前进，证明确实在解码输出而非仅完成加载
  await player.play()
  report.positionAdvanced = await waitFor(
    () => snapshot.value.playback.positionMs > POSITION_ADVANCE_THRESHOLD_MS,
    20_000
  )
  report.maxPositionMs = snapshot.value.playback.positionMs
  if (!report.positionAdvanced) {
    report.failure = `播放进度未前进；status=${snapshot.value.playback.status}，error=${
      snapshot.value.playback.error?.code ?? 'none'
    }`
    return report
  }

  // 暂停
  player.pause()
  report.paused = await waitFor(
    () => snapshot.value.playback.status === 'paused' && snapshot.value.playback.intent === 'pause',
    5_000
  )
  if (!report.paused) {
    report.failure = `暂停未生效；status=${snapshot.value.playback.status}`
    return report
  }

  // seek 到中段；时长未知时退回固定目标
  const duration = report.durationMs
  const target = duration !== null && duration > 20_000 ? Math.floor(duration / 2) : 10_000
  player.seek(target)
  report.seeked = await waitFor(
    () =>
      !snapshot.value.playback.seeking &&
      Math.abs(snapshot.value.playback.positionMs - target) < SEEK_TOLERANCE_MS,
    10_000
  )
  report.seekedPositionMs = snapshot.value.playback.positionMs
  if (!report.seeked) {
    report.failure = `seek 未命中；目标 ${target}，实际 ${report.seekedPositionMs}`
  }

  return report
}

// ── 主流程区 ──

export async function runMediaSmoke(): Promise<void> {
  try {
    const trackIds = requestedTrackIds()
    if (trackIds.length === 0) {
      emit({
        ok: false,
        checks: {},
        tracks: [],
        finalTrackId: null,
        failure: '未提供合法的 t03tracks 查询参数'
      })
      return
    }

    const player = usePlayer()
    const checks: Record<string, boolean> = {}

    // 运行时必须就绪，否则 resolve 一定失败
    checks.runtimeReady = await window.ncx.runtime.waitUntilReady(15_000)
    if (!checks.runtimeReady) {
      emit({ ok: false, checks, tracks: [], finalTrackId: null, failure: '运行时未就绪' })
      return
    }

    // 逐首验证
    const tracks: TrackReport[] = []
    for (const trackId of trackIds) {
      tracks.push(await verifyTrack(player, trackId))
    }
    checks.allTracksResolved = tracks.every((report) => report.resolved)
    checks.allTracksPlayed = tracks.every((report) => report.positionAdvanced)
    checks.allTracksPaused = tracks.every((report) => report.paused)
    checks.allTracksSeeked = tracks.every((report) => report.seeked)

    // 取消：发起解析后立即取消，必须拿到 REQUEST_CANCELLED
    const cancelRequestId = crypto.randomUUID()
    const pendingResolve = window.ncx.runtime.resolveTrackUrl({
      trackId: trackIds[0] ?? '',
      quality: 'lossless',
      requestId: cancelRequestId
    })
    checks.cancelDispatched = window.ncx.runtime.cancel(cancelRequestId)
    const cancelled = await pendingResolve
    checks.resolveCancelled = !cancelled.ok && cancelled.error.code === 'REQUEST_CANCELLED'

    // 快速切歌：单首时重复装载同一首，多首时轮转
    const switchCount = 30
    for (let index = 0; index < switchCount; index += 1) {
      const trackId = trackIds[index % trackIds.length] ?? ''
      void player.playTrack(placeholderTrack(trackId), { kind: 'agent' })
    }
    const expectedFinal = trackIds[(switchCount - 1) % trackIds.length] ?? null
    checks.rapidSwitchSettled = await waitFor(
      () => player.snapshot.value.playback.track?.trackId === expectedFinal,
      25_000
    )
    const finalTrackId = player.snapshot.value.playback.track?.trackId ?? null
    checks.finalTrackCorrect = finalTrackId === expectedFinal

    // 切歌风暴后仍必须能正常播放，证明没有把引擎搞成死状态
    await player.play()
    checks.playableAfterRapidSwitch = await waitFor(
      () => player.snapshot.value.playback.positionMs > POSITION_ADVANCE_THRESHOLD_MS,
      20_000
    )

    // 快照不得泄漏播放地址
    const serialized = JSON.stringify(player.snapshot.value)
    checks.snapshotHasNoUrl =
      !serialized.includes('http') && !serialized.includes('MUSIC_U')

    player.pause()
    emit({
      ok: Object.values(checks).every(Boolean) && tracks.every((r) => r.failure === null),
      checks,
      tracks,
      finalTrackId
    })
  } catch (error) {
    emit({
      ok: false,
      checks: {},
      tracks: [],
      finalTrackId: null,
      failure: error instanceof Error ? error.message : String(error)
    })
  }
}
