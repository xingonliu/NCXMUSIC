import { closeSync, existsSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs'

import { z } from 'zod'

import {
  buildActionJournalCleanupSql,
  type UtilityAccountStore
} from '../infrastructure/persistence/account-space'
import type { AgentMusicPort } from '../domains/agent/agent-runtime'
import type { AgentPreparedProfileAnalysis } from '../domains/agent/personalization-port'
import {
  MusicReadResultSchema,
  type MusicReadPayload,
  type StandardPlaylist,
  type StandardSong
} from '../shared/schemas/music'
import {
  EMPTY_MUSIC_PERSONALIZATION_SNAPSHOT,
  MusicBasicProfileSchema,
  MusicPersonalizationSnapshotSchema,
  MusicProfileAnalysisSchema,
  MusicProfileBaselineSchema,
  MusicProfileCoverageSchema,
  MusicProfileDocumentSchema,
  MusicProfileOverrideSchema,
  ProfilePromptEvaluationInputSchema,
  type MusicPersonalizationSnapshot,
  type MusicBasicProfile,
  type MusicProfileAnalysis,
  type MusicProfileBaseline,
  type MusicProfileCoverage,
  type MusicProfileDocument,
  type MusicProfileOverride,
  type MusicProfileStatus,
  type ProfilePromptEvaluationInput
} from '../shared/schemas/personalization'

// ========= 类型 =========

/** 音乐画像服务持久化查询行。 */
interface MusicProfileStateRow {
  /** 生命周期状态。 */
  status: string
  /** 成功画像版本。 */
  version: number
  /** 最近成功更新时间。 */
  updated_at: number | null
  /** JSON 编码画像。 */
  profile_json: string | null
  /** JSON 编码精确变化基线。 */
  baseline_json: string | null
  /** JSON 编码用户修正。 */
  overrides_json: string
  /** JSON 编码活动或最近证据 Job。 */
  active_job_json: string | null
  /** 当前变化分数。 */
  change_score: number
  /** 最近关闭提示时间。 */
  dismissed_at: number | null
  /** 关闭提示时的变化分数。 */
  dismissed_score: number | null
  /** 最近失败文案。 */
  error_message: string | null
}

/** 当前画像分析 Job。 */
interface ActiveProfileJob {
  /** Job 唯一 ID。 */
  readonly jobId: string
  /** 账户 ID。 */
  readonly accountId: string
  /** 账户 generation。 */
  readonly accountGeneration: number
  /** 初始化、更新或重新生成。 */
  readonly mode: 'initialize' | 'update' | 'regenerate'
  /** 当前 Job 发出的 Music Service 请求 ID。 */
  readonly requestIds: Set<string>
}

/** 本地画像证据项。 */
export interface MusicProfileEvidence {
  /** Job 内稳定证据 ID。 */
  readonly evidenceId: string
  /** 网易云歌曲 ID。 */
  readonly songId: string
  /** 歌曲名。 */
  readonly name: string
  /** 歌手名。 */
  readonly artists: readonly string[]
  /** 专辑名。 */
  readonly album?: string
  /** 发行年份。 */
  readonly year?: number
  /** 证据来源。 */
  readonly sources: readonly ('liked' | 'created_playlist' | 'subscribed_playlist' | 'listening_history')[]
  /** 排行接口明确返回的播放次数。 */
  readonly listeningCount?: number
  /** 歌单详情明确返回的最近加入时间。 */
  readonly addedAt?: number
  /** 本地聚合权重。 */
  readonly weight: number
}

/** 本地预处理后的画像数据。 */
export interface LocalMusicProfileFeatures {
  /** 数据覆盖范围。 */
  readonly coverage: MusicProfileCoverage
  /** 上次成功画像之后的精确变化分数。 */
  readonly changeScore: number
  /** 高权重歌手分布。 */
  readonly topArtists: readonly { readonly name: string; readonly score: number }[]
  /** 发行年代分布。 */
  readonly eraDistribution: readonly { readonly era: string; readonly count: number }[]
  /** 分层代表证据。 */
  readonly evidence: readonly MusicProfileEvidence[]
  /** 当前成功候选基线。 */
  readonly baseline: MusicProfileBaseline
}

/** 已完成本地采集、等待模型分析的 Job 上下文。 */
export interface PreparedMusicProfileAnalysis extends AgentPreparedProfileAnalysis {
  /** 当前 Job ID。 */
  readonly jobId: string
  /** 发送给当前模型的聚合特征与有限代表样本 Prompt。 */
  readonly modelPrompt: string
}

/** 画像证据分页结果。 */
export interface MusicProfileEvidencePage {
  /** 当前页证据。 */
  readonly items: readonly MusicProfileEvidence[]
  /** 下一页游标；无更多数据时省略。 */
  readonly nextCursor?: number
}

/** 服务内存状态。 */
interface PersonalizationState {
  /** 生命周期状态。 */
  status: MusicProfileStatus
  /** 最近成功画像。 */
  document?: MusicProfileDocument | undefined
  /** 最近成功画像变化基线。 */
  baseline?: MusicProfileBaseline | undefined
  /** 用户显式修正。 */
  overrides: MusicProfileOverride[]
  /** 当前变化分数。 */
  changeScore: number
  /** 最近关闭提示时间。 */
  dismissedAt?: number | undefined
  /** 最近关闭提示时的变化分数。 */
  dismissedScore?: number | undefined
  /** 当前 Job。 */
  activeJob?: ActiveProfileJob | undefined
  /** 最近一次可分页证据 Job ID。 */
  evidenceJobId?: string | undefined
  /** 失败重试可复用的本地聚合结果。 */
  retryPrepared?: AgentPreparedProfileAnalysis | undefined
  /** 当前 Job 进度。 */
  progress: number
  /** 当前 Job 阶段文案。 */
  stageLabel: string
  /** 最近失败文案。 */
  errorMessage?: string | undefined
  /** 最近失败时模型返回的原始文本。 */
  rawOutput?: string | undefined
}

/** 画像服务变更监听器。 */
type PersonalizationChangeListener = () => void

// ========= 变量 =========

/** 画像更新固定阈值。 */
export const PROFILE_UPDATE_THRESHOLD = 30

/** 静默期内可提前再次提示所需的追加变化分。 */
export const PROFILE_EARLY_REPROMPT_DELTA = 15

/** 用户关闭提示后的固定静默期。 */
export const PROFILE_PROMPT_SILENCE_MS = 7 * 24 * 60 * 60 * 1_000

/** 画像内部 API 扇出并发上限。 */
const PROFILE_COLLECTION_CONCURRENCY = 4

/** 默认画像证据分页大小。 */
const DEFAULT_EVIDENCE_PAGE_SIZE = 20

/** 发送给模型的默认代表样本上限。 */
const DEFAULT_MODEL_SAMPLE_LIMIT = 28

/** 空服务状态。 */
const EMPTY_STATE: PersonalizationState = {
  status: 'unavailable',
  overrides: [],
  changeScore: 0,
  progress: 0,
  stageLabel: ''
}

// ========= 类 =========

/** Utility 侧账户隔离音乐人格画像、增量评分与证据分页服务。 */
export class PersonalizationService {
  /** 当前账户内存状态。 */
  private state: PersonalizationState = { ...EMPTY_STATE }

  /** 本次应用会话是否关闭过初始化提示。 */
  private initializationPromptDismissed = false

  /** 状态变更监听器。 */
  private readonly listeners = new Set<PersonalizationChangeListener>()

  constructor(private readonly accountStore: UtilityAccountStore) {}

  /** 订阅画像状态变化。 */
  subscribe(listener: PersonalizationChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 当前账户打开后恢复画像状态；游客永远不读取正式账户画像。 */
  async restore(): Promise<void> {
    await this.accountStore.settled()
    /** 当前账户描述。 */
    const account = this.accountStore.current()
    this.initializationPromptDismissed = false
    if (!account || account.kind !== 'netease') {
      this.state = { ...EMPTY_STATE }
      this.notify()
      return
    }
    /** 当前账户画像数据库行。 */
    const row = await this.accountStore.write((database) => database.prepare(`
      SELECT
        status,
        version,
        updated_at,
        profile_json,
        baseline_json,
        overrides_json,
        active_job_json,
        change_score,
        dismissed_at,
        dismissed_score,
        error_message
      FROM music_profile_state
      WHERE singleton_id = 1
    `).get() as MusicProfileStateRow | undefined)
    this.state = row ? restoreProfileState(row) : { ...EMPTY_STATE }
    if (this.state.status === 'collecting' || this.state.status === 'ready_local' || this.state.status === 'analyzing') {
      this.state.status = this.state.document ? 'stale' : 'failed'
      this.state.errorMessage = '上次画像任务已中止，请手动重试。'
      this.state.activeJob = undefined
      this.state.progress = 0
      this.state.stageLabel = ''
      await this.persist()
    }
    if (account.profileJsonPath) {
      /** SQLite 是权威来源；启动时重建快速画像快照可修复损坏文件。 */
      writeJsonAtomically(account.profileJsonPath, JSON.stringify(this.state.document ?? null))
    }
    this.notify()
  }

  /** 返回当前账户与 Provider 条件下的公开快照。 */
  snapshot(providerConfigured: boolean, now = Date.now()): MusicPersonalizationSnapshot {
    /** 当前账户描述。 */
    const account = this.accountStore.current()
    if (!account || account.kind !== 'netease') return EMPTY_MUSIC_PERSONALIZATION_SNAPSHOT
    /** 已有成功画像是否仍可使用。 */
    const usable = Boolean(this.state.document)
    /** 当前是否允许发起完整模型分析。 */
    const eligible = providerConfigured
    /** 更新提示规则结果。 */
    const updatePromptVisible = usable
      && this.state.status !== 'paused'
      && evaluateProfileUpdatePrompt({
        changeScore: this.state.changeScore,
        now,
        ...(this.state.dismissedAt !== undefined ? { dismissedAt: this.state.dismissedAt } : {}),
        ...(this.state.dismissedScore !== undefined ? { dismissedScore: this.state.dismissedScore } : {})
      })
    /** 初始化提示是否可见。 */
    const initializePromptVisible = !usable
      && eligible
      && !this.initializationPromptDismissed
      && !['collecting', 'ready_local', 'analyzing'].includes(this.state.status)
    /** 对 Renderer 可见的提示种类。 */
    const promptKind = initializePromptVisible ? 'initialize' : updatePromptVisible ? 'update' : 'none'
    return MusicPersonalizationSnapshotSchema.parse({
      status: this.state.status,
      eligible,
      usable,
      paused: this.state.status === 'paused',
      version: this.state.document?.version ?? 0,
      ...(this.state.document ? { updatedAt: this.state.document.generatedAt } : {}),
      progress: this.state.progress,
      stageLabel: this.state.stageLabel,
      ...(this.state.document ? {
        summary: this.state.document.summary,
        agentPrompt: applyOverridesToPrompt(this.state.document, this.state.overrides),
        coverage: this.state.document.coverage,
        insights: applyOverridesToInsights(this.state.document, this.state.overrides),
        recentChanges: this.state.document.recentChanges,
        recommendationSeeds: this.state.document.recommendationSeeds
      } : {
        insights: [],
        recentChanges: [],
        recommendationSeeds: []
      }),
      overrides: this.state.overrides,
      prompt: {
        kind: promptKind,
        visible: promptKind !== 'none',
        changeScore: this.state.changeScore,
        ...(this.state.dismissedAt !== undefined
          ? { dismissedUntil: this.state.dismissedAt + PROFILE_PROMPT_SILENCE_MS }
          : {})
      },
      ...(this.state.errorMessage ? { errorMessage: this.state.errorMessage } : {}),
      ...(this.state.rawOutput ? { rawOutput: this.state.rawOutput } : {})
    })
  }

  /** 返回注入小云 Prompt 的最小画像片段与最高优先级用户修正。 */
  contextText(): string {
    if (!this.state.document) return ''
    return applyOverridesToPrompt(this.state.document, this.state.overrides)
  }

  /** 启动时读取喜欢集合与歌单歌曲计数，不采集完整歌单详情或调用模型。 */
  async refreshLightweightChangeScore(music: AgentMusicPort): Promise<number> {
    /** 当前账户描述。 */
    const account = this.accountStore.current()
    if (
      !account
      || account.kind !== 'netease'
      || !this.state.baseline
      || this.state.status === 'paused'
      || this.state.activeJob
    ) return this.state.changeScore
    /** 发起检查时绑定的账户 generation。 */
    const accountGeneration = this.accountStore.currentGeneration()
    /** 当前网易云用户 ID。 */
    const userId = account.accountId.slice('netease:'.length)
    /** 喜欢歌曲轻量请求 ID。 */
    const likedRequestId = crypto.randomUUID()
    /** 歌单摘要轻量请求 ID。 */
    const playlistsRequestId = crypto.randomUUID()
    /** 两类轻量标准响应。 */
    const [likedRaw, playlistsRaw] = await Promise.all([
      music.read(likedRequestId, { operation: 'getLikedSongs', userId, limit: 100_000 }),
      music.read(playlistsRequestId, { operation: 'getUserPlaylists', userId, limit: 100, offset: 0 })
    ])
    if (
      this.accountStore.current()?.accountId !== account.accountId
      || this.accountStore.currentGeneration() !== accountGeneration
    ) throw profileError('PROFILE_JOB_STALE', '账户已切换，忽略迟到的画像变化检查。')
    /** 经共享 Schema 校验的喜欢结果。 */
    const likedResult = MusicReadResultSchema.parse(likedRaw)
    /** 经共享 Schema 校验的歌单摘要结果。 */
    const playlistsResult = MusicReadResultSchema.parse(playlistsRaw)
    if (likedResult.kind !== 'songCollection' || playlistsResult.kind !== 'playlistCollection') {
      throw profileError('PROFILE_DATA_INVALID', '画像轻量变化检查响应类型不匹配。')
    }
    /** 喜欢歌曲精确集合变化 ID。 */
    const likedChanges = symmetricDifference(
      new Set(this.state.baseline.likedSongIds),
      new Set(likedResult.songs.map((song) => song.id))
    )
    /** 自建歌单摘要中的歌曲总数；不读取完整歌单。 */
    const createdPlaylistSongCount = playlistsResult.playlists
      .filter((playlist) => playlist.owned === true)
      .reduce((total, playlist) => total + (playlist.trackCount ?? 0), 0)
    /** 轻量检查只用于决定是否展示提示；成功分析仍使用精确去重集合替换基线。 */
    const score = likedChanges.size * 1.5
      + Math.abs(createdPlaylistSongCount - this.state.baseline.createdPlaylistSongIds.length)
    this.state.changeScore = score
    if (this.state.document && score >= PROFILE_UPDATE_THRESHOLD && this.state.status === 'ready') {
      this.state.status = 'stale'
    }
    await this.persist()
    this.notify()
    return score
  }

  /** 完整采集授权音乐数据、本地聚合并为模型准备有限 Prompt。 */
  async prepareAnalysis(
    music: AgentMusicPort,
    mode: ActiveProfileJob['mode']
  ): Promise<PreparedMusicProfileAnalysis> {
    /** 当前账户描述。 */
    const account = this.accountStore.current()
    if (!account || account.kind !== 'netease') throw profileError('PROFILE_UNAVAILABLE', '游客不能生成音乐人格画像。')
    if (this.state.status === 'paused') throw profileError('PROFILE_PAUSED', '画像更新已暂停，请先恢复。')
    if (this.state.activeJob) throw profileError('PROFILE_JOB_ACTIVE', '已有画像任务正在执行。')
    if (this.state.status === 'failed' && this.state.retryPrepared) {
      /** 复用失败前已成功采集的聚合特征与代表证据。 */
      const prepared = this.state.retryPrepared
      this.state.activeJob = {
        jobId: prepared.jobId,
        accountId: account.accountId,
        accountGeneration: this.accountStore.currentGeneration(),
        mode,
        requestIds: new Set<string>()
      }
      this.state.status = 'analyzing'
      this.state.progress = 76
      this.state.stageLabel = '复用已采集数据，重新生成画像'
      this.state.errorMessage = undefined
      this.state.rawOutput = undefined
      await this.persist()
      this.notify()
      return prepared
    }
    /** 当前网易云用户 ID。 */
    const userId = account.accountId.slice('netease:'.length)
    /** 新画像 Job。 */
    const job: ActiveProfileJob = {
      jobId: crypto.randomUUID(),
      accountId: account.accountId,
      accountGeneration: this.accountStore.currentGeneration(),
      mode,
      requestIds: new Set<string>()
    }
    this.state.activeJob = job
    this.state.evidenceJobId = job.jobId
    this.state.status = 'collecting'
    this.state.progress = 8
    this.state.stageLabel = '正在读取喜欢、歌单与听歌排行'
    this.state.errorMessage = undefined
    this.state.rawOutput = undefined
    await this.persist()
    this.notify()
    try {
      /** 基础资料、喜欢歌曲、歌单清单与两种排行的第一层结果。 */
      const [basicProfile, likedSongs, playlists, weekHistory, allHistory] = await Promise.all([
        this.readBasicProfile(music, job, userId),
        this.readSongs(music, job, { operation: 'getLikedSongs', userId, limit: 100_000 }),
        this.readAllUserPlaylists(music, job, userId),
        this.readSongs(music, job, { operation: 'getListeningHistory', userId, period: 'week', limit: 100 }),
        this.readSongs(music, job, { operation: 'getListeningHistory', userId, period: 'all', limit: 100 })
      ])
      this.assertJobCurrent(job)
      await this.saveBasicProfile(basicProfile)
      this.state.progress = 38
      this.state.stageLabel = '正在扫描并去重歌单歌曲'
      this.notify()
      /** 每个歌单的完整标准详情，内部最多四路并发。 */
      const playlistDetails = await mapWithConcurrency(
        playlists,
        PROFILE_COLLECTION_CONCURRENCY,
        async (playlist) => {
          /** 完整歌单详情。 */
          const detail = await this.readPlaylist(music, job, playlist.id)
          return {
            ...detail,
            ...(playlist.owned !== undefined ? { owned: playlist.owned } : {})
          }
        }
      )
      this.assertJobCurrent(job)
      /** 本地聚合特征与精确变化基线。 */
      const features = extractLocalMusicProfileFeatures({
        likedSongs,
        playlists: playlistDetails,
        listeningHistory: mergeSongsById([...weekHistory, ...allHistory]),
        ...(this.state.baseline ? { previousBaseline: this.state.baseline } : {})
      })
      await this.saveEvidence(job, features.evidence)
      this.state.status = 'ready_local'
      this.state.progress = 68
      this.state.stageLabel = '本地聚合完成，准备生成画像'
      this.state.changeScore = features.changeScore
      await this.persist()
      this.notify()
      /** 默认只发送聚合特征与分层代表样本。 */
      const modelPrompt = buildProfileModelPrompt(features)
      /** 可供失败重试复用的本地聚合结果。 */
      const prepared: AgentPreparedProfileAnalysis = {
        jobId: job.jobId,
        modelPrompt,
        coverage: features.coverage,
        baseline: features.baseline
      }
      this.state.retryPrepared = prepared
      this.state.status = 'analyzing'
      this.state.progress = 76
      this.state.stageLabel = '当前模型正在形成音乐画像'
      await this.persist()
      this.notify()
      return prepared
    } catch (error) {
      if (this.state.activeJob?.jobId === job.jobId) await this.failAnalysis(job.jobId, readableProfileError(error))
      throw error
    }
  }

  /** 模型分析成功后原子替换画像与变化基线。 */
  async completeAnalysis(
    prepared: AgentPreparedProfileAnalysis,
    analysis: MusicProfileAnalysis
  ): Promise<void> {
    /** 当前活动 Job。 */
    const job = this.state.activeJob
    if (!job || job.jobId !== prepared.jobId) throw profileError('PROFILE_JOB_STALE', '画像任务已经失效。')
    this.assertJobCurrent(job)
    /** 经共享 Schema 校验的模型结果。 */
    const parsedAnalysis = MusicProfileAnalysisSchema.parse(analysis)
    /** 下一成功版本。 */
    const nextVersion = (this.state.document?.version ?? 0) + 1
    /** 原子替换的新画像文档。 */
    const document = MusicProfileDocumentSchema.parse({
      ...parsedAnalysis,
      schemaVersion: 1,
      version: nextVersion,
      generatedAt: Date.now(),
      coverage: prepared.coverage
    })
    this.state.document = document
    this.state.baseline = prepared.baseline
    this.state.status = 'ready'
    this.state.changeScore = 0
    this.state.dismissedAt = undefined
    this.state.dismissedScore = undefined
    this.state.activeJob = undefined
    this.state.retryPrepared = undefined
    this.state.progress = 100
    this.state.stageLabel = '音乐人格画像已生成'
    this.state.errorMessage = undefined
    this.state.rawOutput = undefined
    await this.persist()
    await this.appendJournal('profile.generated', { version: document.version, mode: job.mode })
    this.notify()
  }

  /** 画像 Job 失败时保留旧画像、旧基线与已采集证据。 */
  async failAnalysis(jobId: string, message: string, rawOutput?: string): Promise<void> {
    if (this.state.activeJob?.jobId !== jobId) return
    this.state.activeJob = undefined
    this.state.status = 'failed'
    this.state.progress = 0
    this.state.stageLabel = ''
    this.state.errorMessage = message.slice(0, 500)
    this.state.rawOutput = rawOutput ? rawOutput.slice(0, 200_000) : undefined
    await this.persist()
    await this.appendJournal('profile.failed', { hasUsableProfile: Boolean(this.state.document) })
    this.notify()
  }

  /** 账户切换或退出时取消当前 Job 的全部 Music Service 请求。 */
  cancelActiveJob(music: AgentMusicPort): void {
    /** 当前活动 Job。 */
    const job = this.state.activeJob
    if (!job) return
    for (const requestId of job.requestIds) music.cancel(requestId)
    job.requestIds.clear()
    this.state.activeJob = undefined
    this.state.retryPrepared = undefined
  }

  /** 关闭当前画像提示；初始化只关闭本次会话，更新提示执行 7 天/15 分规则。 */
  async dismissPrompt(): Promise<void> {
    if (!this.state.document) {
      this.initializationPromptDismissed = true
      this.notify()
      return
    }
    this.state.dismissedAt = Date.now()
    this.state.dismissedScore = this.state.changeScore
    await this.persist()
    this.notify()
  }

  /** 暂停扫描与更新，同时保留当前画像供推荐与 Agent 使用。 */
  async pause(): Promise<void> {
    if (!this.state.document) throw profileError('PROFILE_UNAVAILABLE', '当前没有可暂停的画像。')
    this.state.status = 'paused'
    this.state.activeJob = undefined
    this.state.progress = 0
    this.state.stageLabel = ''
    await this.persist()
    await this.appendJournal('profile.paused', { version: this.state.document.version })
    this.notify()
  }

  /** 恢复画像更新；现有画像立即恢复可用并等待重新检查变化。 */
  async resume(): Promise<void> {
    if (!this.state.document) throw profileError('PROFILE_UNAVAILABLE', '当前没有可恢复的画像。')
    this.state.status = this.state.changeScore >= PROFILE_UPDATE_THRESHOLD ? 'stale' : 'ready'
    await this.persist()
    await this.appendJournal('profile.resumed', { version: this.state.document.version })
    this.notify()
  }

  /** 删除当前账户画像、中间证据与 override，不触碰聊天或网易云数据。 */
  async deleteProfile(): Promise<void> {
    /** 当前账户快速画像快照路径。 */
    const profileJsonPath = this.accountStore.current()?.profileJsonPath
    await this.accountStore.write((database) => {
      database.exec('BEGIN IMMEDIATE')
      try {
        database.exec('DELETE FROM music_profile_evidence; DELETE FROM music_profile_state;')
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    })
    if (profileJsonPath && existsSync(profileJsonPath)) rmSync(profileJsonPath, { force: true })
    this.state = { ...EMPTY_STATE }
    this.initializationPromptDismissed = false
    await this.appendJournal('profile.deleted', {})
    this.notify()
  }

  /** 保存用户纠正、隐藏或补充，后续重算不得覆盖。 */
  async saveOverride(rawOverride: Omit<MusicProfileOverride, 'overrideId' | 'updatedAt'>): Promise<void> {
    /** 新的显式用户修正。 */
    const override = MusicProfileOverrideSchema.parse({
      ...rawOverride,
      overrideId: crypto.randomUUID(),
      updatedAt: Date.now()
    })
    if (override.insightId) {
      this.state.overrides = this.state.overrides.filter((item) =>
        item.insightId !== override.insightId || item.kind !== override.kind)
    }
    this.state.overrides.push(override)
    await this.persist()
    await this.appendJournal('profile.override.saved', { kind: override.kind })
    this.notify()
  }

  /** 删除单条用户 override。 */
  async removeOverride(overrideId: string): Promise<void> {
    this.state.overrides = this.state.overrides.filter((override) => override.overrideId !== overrideId)
    await this.persist()
    await this.appendJournal('profile.override.removed', {})
    this.notify()
  }

  /** 按当前或最近画像 Job 分页读取归一化证据。 */
  async evidencePage(cursor = 0, limit = DEFAULT_EVIDENCE_PAGE_SIZE): Promise<MusicProfileEvidencePage> {
    /** 当前可查询的证据 Job。 */
    const jobId = this.state.activeJob?.jobId ?? this.state.evidenceJobId
    if (!jobId) return { items: [] }
    /** 经边界裁剪的游标。 */
    const safeCursor = Math.max(0, Math.trunc(cursor))
    /** 经边界裁剪的页大小。 */
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)))
    return this.accountStore.write((database) => {
      /** 多取一项用于判断下一页。 */
      const rows = database.prepare(`
        SELECT evidence_json
        FROM music_profile_evidence
        WHERE job_id = ? AND ordinal >= ?
        ORDER BY ordinal
        LIMIT ?
      `).all(jobId, safeCursor, safeLimit + 1) as unknown as Array<{ evidence_json: string }>
      /** 当前页解析后的证据。 */
      const items = rows.slice(0, safeLimit).map((row) => JSON.parse(row.evidence_json) as MusicProfileEvidence)
      return {
        items,
        ...(rows.length > safeLimit ? { nextCursor: safeCursor + safeLimit } : {})
      }
    })
  }

  /** 使用轻量集合或计数更新变化分与提示状态。 */
  async updateChangeScore(currentBaseline: MusicProfileBaseline): Promise<number> {
    if (!this.state.baseline || this.state.status === 'paused') return this.state.changeScore
    /** 当前精确集合与成功基线之间的变化分。 */
    const changeScore = calculateProfileChangeScore(this.state.baseline, currentBaseline)
    this.state.changeScore = changeScore
    if (this.state.document && changeScore >= PROFILE_UPDATE_THRESHOLD && this.state.status === 'ready') {
      this.state.status = 'stale'
    }
    await this.persist()
    this.notify()
    return changeScore
  }

  /** 读取标准歌曲集合。 */
  private async readSongs(
    music: AgentMusicPort,
    job: ActiveProfileJob,
    payload: MusicReadPayload
  ): Promise<StandardSong[]> {
    /** 当前内部 Music Service 请求 ID。 */
    const requestId = crypto.randomUUID()
    job.requestIds.add(requestId)
    try {
      /** 标准音乐读取结果。 */
      const result = MusicReadResultSchema.parse(await music.read(requestId, payload))
      if (result.kind !== 'songCollection') throw profileError('PROFILE_DATA_INVALID', '画像歌曲数据响应类型不匹配。')
      return result.songs
    } finally {
      job.requestIds.delete(requestId)
    }
  }

  /** 读取并严格收窄 API 明确返回的账户基础资料，不接受模型推断字段。 */
  private async readBasicProfile(
    music: AgentMusicPort,
    job: ActiveProfileJob,
    userId: string
  ): Promise<MusicBasicProfile> {
    /** 当前基础资料请求 ID。 */
    const requestId = crypto.randomUUID()
    job.requestIds.add(requestId)
    try {
      /** 经标准 Music Service Schema 校验的用户详情。 */
      const result = MusicReadResultSchema.parse(await music.read(requestId, { operation: 'getUser', id: userId }))
      this.assertJobCurrent(job)
      if (result.kind !== 'user' || !result.entity) {
        throw profileError('PROFILE_DATA_INVALID', '画像基础资料响应类型不匹配。')
      }
      /** 用户实体的首个明确来源接口。 */
      const source = result.entity.sources[0]
      return MusicBasicProfileSchema.parse({
        nickname: result.entity.nickname,
        gender: result.entity.gender ?? null,
        birthday: result.entity.birthday ?? null,
        sourceApi: source?.api ?? 'ncm.user_detail',
        updatedAt: Date.parse(result.entity.updatedAt)
      })
    } finally {
      job.requestIds.delete(requestId)
    }
  }

  /** 将基础资料写入当前账户 SQLite；空值保持未知，不执行推断补全。 */
  private async saveBasicProfile(profile: MusicBasicProfile): Promise<void> {
    await this.accountStore.write((database) => {
      database.prepare(`
        INSERT INTO account_basic_profile (
          singleton_id, nickname, gender, birthday, source_api, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(singleton_id) DO UPDATE SET
          nickname = excluded.nickname,
          gender = excluded.gender,
          birthday = excluded.birthday,
          source_api = excluded.source_api,
          updated_at = excluded.updated_at
      `).run(
        profile.nickname,
        profile.gender,
        profile.birthday,
        profile.sourceApi,
        profile.updatedAt
      )
    })
  }

  /** 分页读取当前用户的全部歌单摘要。 */
  private async readAllUserPlaylists(
    music: AgentMusicPort,
    job: ActiveProfileJob,
    userId: string
  ): Promise<StandardPlaylist[]> {
    /** 已读取歌单。 */
    const playlists: StandardPlaylist[] = []
    for (let offset = 0; offset <= 5_000; offset += 100) {
      /** 当前分页请求 ID。 */
      const requestId = crypto.randomUUID()
      job.requestIds.add(requestId)
      try {
        /** 当前页标准响应。 */
        const result = MusicReadResultSchema.parse(await music.read(requestId, {
          operation: 'getUserPlaylists',
          userId,
          limit: 100,
          offset
        }))
        if (result.kind !== 'playlistCollection') throw profileError('PROFILE_DATA_INVALID', '画像歌单数据响应类型不匹配。')
        playlists.push(...result.playlists)
        if (result.playlists.length < 100) break
      } finally {
        job.requestIds.delete(requestId)
      }
    }
    return playlists
  }

  /** 读取单个歌单的完整标准详情。 */
  private async readPlaylist(
    music: AgentMusicPort,
    job: ActiveProfileJob,
    playlistId: string
  ): Promise<StandardPlaylist> {
    /** 当前歌单请求 ID。 */
    const requestId = crypto.randomUUID()
    job.requestIds.add(requestId)
    try {
      /** 标准歌单详情响应。 */
      const result = MusicReadResultSchema.parse(await music.read(requestId, { operation: 'getPlaylist', id: playlistId }))
      if (result.kind !== 'playlist' || !result.entity) {
        throw profileError('PROFILE_DATA_INVALID', '画像歌单详情响应类型不匹配。')
      }
      return result.entity
    } finally {
      job.requestIds.delete(requestId)
    }
  }

  /** 保存当前 Job 全部代表证据，失败后允许不重复采集地分页查看。 */
  private async saveEvidence(job: ActiveProfileJob, evidence: readonly MusicProfileEvidence[]): Promise<void> {
    this.assertJobCurrent(job)
    await this.accountStore.write((database) => {
      database.exec('BEGIN IMMEDIATE')
      try {
        database.prepare('DELETE FROM music_profile_evidence WHERE job_id = ?').run(job.jobId)
        /** 单条证据写入语句。 */
        const insert = database.prepare(`
          INSERT INTO music_profile_evidence (job_id, ordinal, evidence_json)
          VALUES (?, ?, ?)
        `)
        for (let ordinal = 0; ordinal < evidence.length; ordinal += 1) {
          insert.run(job.jobId, ordinal, JSON.stringify(evidence[ordinal]))
        }
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    })
  }

  /** 拒绝账户切换后迟到的画像 Job。 */
  private assertJobCurrent(job: ActiveProfileJob): void {
    if (
      this.accountStore.current()?.accountId !== job.accountId
      || this.accountStore.currentGeneration() !== job.accountGeneration
      || this.state.activeJob?.jobId !== job.jobId
    ) throw profileError('PROFILE_JOB_STALE', '账户已切换，画像任务已取消。')
  }

  /** 将当前内存状态写入账户 SQLite。 */
  private async persist(): Promise<void> {
    /** 当前账户描述。 */
    const account = this.accountStore.current()
    if (!account || account.kind !== 'netease') return
    /** 当前 Job 或最近证据元数据。 */
    const jobMetadata = this.state.activeJob
      ? {
          jobId: this.state.activeJob.jobId,
          mode: this.state.activeJob.mode,
          active: true,
          ...(this.state.retryPrepared ? { prepared: this.state.retryPrepared } : {})
        }
      : this.state.evidenceJobId
        ? {
            jobId: this.state.evidenceJobId,
            active: false,
            ...(this.state.retryPrepared ? { prepared: this.state.retryPrepared } : {})
          }
        : undefined
    await this.accountStore.write((database, currentAccount) => {
      if (currentAccount.accountId !== account.accountId) throw profileError('PROFILE_JOB_STALE', '账户已切换。')
      database.prepare(`
        INSERT INTO music_profile_state (
          singleton_id,
          status,
          version,
          updated_at,
          profile_json,
          baseline_json,
          overrides_json,
          active_job_json,
          change_score,
          dismissed_at,
          dismissed_score,
          error_message
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(singleton_id) DO UPDATE SET
          status = excluded.status,
          version = excluded.version,
          updated_at = excluded.updated_at,
          profile_json = excluded.profile_json,
          baseline_json = excluded.baseline_json,
          overrides_json = excluded.overrides_json,
          active_job_json = excluded.active_job_json,
          change_score = excluded.change_score,
          dismissed_at = excluded.dismissed_at,
          dismissed_score = excluded.dismissed_score,
          error_message = excluded.error_message
      `).run(
        this.state.status,
        this.state.document?.version ?? 0,
        this.state.document?.generatedAt ?? null,
        this.state.document ? JSON.stringify(this.state.document) : null,
        this.state.baseline ? JSON.stringify(this.state.baseline) : null,
        JSON.stringify(this.state.overrides),
        jobMetadata ? JSON.stringify(jobMetadata) : null,
        this.state.changeScore,
        this.state.dismissedAt ?? null,
        this.state.dismissedScore ?? null,
        this.state.errorMessage ?? null
      )
      if (currentAccount.profileJsonPath) {
        writeJsonAtomically(currentAccount.profileJsonPath, JSON.stringify(this.state.document ?? null))
      }
    })
  }

  /** 追加画像语义事件并执行账户级 30 天/10,000 条保留策略。 */
  private async appendJournal(eventType: string, payload: Record<string, unknown>): Promise<void> {
    /** 当前账户描述。 */
    const account = this.accountStore.current()
    if (!account || account.kind !== 'netease') return
    await this.accountStore.write((database, currentAccount) => {
      if (currentAccount.accountId !== account.accountId) return
      database.prepare(`
        INSERT INTO action_journal (occurred_at, event_type, payload_json)
        VALUES (?, ?, ?)
      `).run(Date.now(), eventType, JSON.stringify(payload))
      for (const sql of buildActionJournalCleanupSql(Date.now())) database.exec(sql)
    })
  }

  /** 通知 Agent Runtime 与 Renderer 画像状态已变化。 */
  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

// ========= 函数 =========

/** 按喜欢 1.5、自建歌单 1.0、同歌曲取最高权重计算精确变化分。 */
export function calculateProfileChangeScore(
  previous: MusicProfileBaseline,
  current: MusicProfileBaseline
): number {
  /** 经共享 Schema 校验的旧基线。 */
  const before = MusicProfileBaselineSchema.parse(previous)
  /** 经共享 Schema 校验的新基线。 */
  const after = MusicProfileBaselineSchema.parse(current)
  /** 喜欢集合变化歌曲。 */
  const likedChanges = symmetricDifference(new Set(before.likedSongIds), new Set(after.likedSongIds))
  /** 自建歌单集合变化歌曲。 */
  const createdChanges = symmetricDifference(
    new Set(before.createdPlaylistSongIds),
    new Set(after.createdPlaylistSongIds)
  )
  /** 两类变化歌曲去重后按最高类别权重求和。 */
  const changedSongIds = new Set([...likedChanges, ...createdChanges])
  let score = 0
  for (const songId of changedSongIds) score += likedChanges.has(songId) ? 1.5 : 1
  return score
}

/** 判断达到 30 分后的 7 天静默与追加 15 分提前再提示规则。 */
export function evaluateProfileUpdatePrompt(rawInput: ProfilePromptEvaluationInput): boolean {
  /** 经共享 Schema 校验的规则入参。 */
  const input = ProfilePromptEvaluationInputSchema.parse(rawInput)
  if (input.changeScore < PROFILE_UPDATE_THRESHOLD) return false
  if (input.dismissedAt === undefined) return true
  if (input.now >= input.dismissedAt + PROFILE_PROMPT_SILENCE_MS) return true
  return input.dismissedScore !== undefined
    && input.changeScore - input.dismissedScore >= PROFILE_EARLY_REPROMPT_DELTA
}

/** 本地扫描、去重、加权并生成聚合特征与代表样本。 */
export function extractLocalMusicProfileFeatures(input: {
  readonly likedSongs: readonly StandardSong[]
  readonly playlists: readonly StandardPlaylist[]
  readonly listeningHistory: readonly StandardSong[]
  readonly previousBaseline?: MusicProfileBaseline
}): LocalMusicProfileFeatures {
  /** 去重后的喜欢歌曲。 */
  const likedSongs = mergeSongsById(input.likedSongs)
  /** 用户自建歌单。 */
  const createdPlaylists = input.playlists.filter((playlist) => playlist.owned === true)
  /** 用户收藏歌单。 */
  const subscribedPlaylists = input.playlists.filter((playlist) => playlist.owned !== true)
  /** 自建歌单歌曲去重集合。 */
  const createdSongs = mergeSongsById(createdPlaylists.flatMap((playlist) => playlist.songs))
  /** 收藏歌单歌曲去重集合。 */
  const subscribedSongs = mergeSongsById(subscribedPlaylists.flatMap((playlist) => playlist.songs))
  /** 排行歌曲去重集合。 */
  const historySongs = mergeSongsById(input.listeningHistory)
  /** 当前精确变化基线。 */
  const baseline = MusicProfileBaselineSchema.parse({
    likedSongIds: likedSongs.map((song) => song.id).sort(),
    createdPlaylistSongIds: createdSongs.map((song) => song.id).sort(),
    capturedAt: Date.now()
  })
  /** 旧基线存在时计算精确变化分；初始化不产生更新提示。 */
  const changeScore = input.previousBaseline
    ? calculateProfileChangeScore(input.previousBaseline, baseline)
    : 0
  /** 每首歌曲的本地来源与最高权重。 */
  const evidenceBySongId = new Map<string, {
    song: StandardSong
    sources: Set<MusicProfileEvidence['sources'][number]>
    weight: number
    addedAt?: number
  }>()
  /** 合并单个来源的歌曲证据。 */
  const mergeEvidence = (
    songs: readonly StandardSong[],
    source: MusicProfileEvidence['sources'][number],
    weight: number
  ): void => {
    for (const song of songs) {
      /** 已存在的歌曲证据。 */
      const existing = evidenceBySongId.get(song.id)
      if (existing) {
        existing.sources.add(source)
        existing.weight = Math.max(existing.weight, weight)
        if (song.addedAt !== undefined && song.addedAt > (existing.addedAt ?? 0)) {
          existing.addedAt = song.addedAt
        }
      } else {
        evidenceBySongId.set(song.id, {
          song,
          sources: new Set([source]),
          weight,
          ...(song.addedAt !== undefined ? { addedAt: song.addedAt } : {})
        })
      }
    }
  }
  mergeEvidence(subscribedSongs, 'subscribed_playlist', 0)
  mergeEvidence(createdSongs, 'created_playlist', 1)
  mergeEvidence(likedSongs, 'liked', 1.5)
  mergeEvidence(historySongs, 'listening_history', 1.25)

  /** 标准化后的全部代表证据。 */
  const evidence = [...evidenceBySongId.values()]
    .map(({ song, sources, weight, addedAt }, index): MusicProfileEvidence => {
      /** 两年内的歌单加入时间提供最多 0.25 的近期样本排序加权。 */
      const recencyBoost = addedAt === undefined
        ? 0
        : Math.max(0, 1 - Math.max(0, Date.now() - addedAt) / (2 * 365 * 24 * 60 * 60 * 1_000)) * 0.25
      return {
        evidenceId: `song-${String(index + 1).padStart(5, '0')}`,
        songId: song.id,
        name: song.name,
        artists: song.artists.map((artist) => artist.name),
        ...(song.album?.name ? { album: song.album.name } : {}),
        ...(song.album?.publishTime ? { year: new Date(song.album.publishTime).getFullYear() } : {}),
        sources: [...sources].sort(),
        ...(song.listeningCount !== undefined ? { listeningCount: song.listeningCount } : {}),
        ...(addedAt !== undefined ? { addedAt } : {}),
        weight: weight + Math.min(song.listeningCount ?? 0, 100) / 100 + recencyBoost
      }
    })
    .sort((left, right) => right.weight - left.weight || left.songId.localeCompare(right.songId))
  /** 歌手加权分布。 */
  const artistScores = new Map<string, number>()
  /** 年代计数分布。 */
  const eraCounts = new Map<string, number>()
  for (const item of evidence) {
    for (const artist of item.artists) artistScores.set(artist, (artistScores.get(artist) ?? 0) + item.weight)
    if (item.year) {
      /** 十年粒度年代。 */
      const era = `${Math.floor(item.year / 10) * 10}s`
      eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1)
    }
  }
  /** 全部去重歌曲 ID。 */
  const uniqueSongIds = new Set(evidence.map((item) => item.songId))
  return {
    coverage: {
      likedSongs: likedSongs.length,
      createdPlaylists: createdPlaylists.length,
      createdPlaylistSongs: createdSongs.length,
      subscribedPlaylists: subscribedPlaylists.length,
      listeningHistorySongs: historySongs.length,
      uniqueSongs: uniqueSongIds.size
    },
    changeScore,
    topArtists: [...artistScores.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 20)
      .map(([name, score]) => ({ name, score: Number(score.toFixed(2)) })),
    eraDistribution: [...eraCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([era, count]) => ({ era, count })),
    evidence,
    baseline
  }
}

/** 从模型原始输出中剥离思考链并鲁棒提取最外层 JSON 对象文本。 */
export function extractJsonObjectText(value: string): string {
  /** 剥离思考链与首尾空白后的清理文本。 */
  const cleaned = value.trim()
    .replace(/<think>[\s\S]*?<\/think>/giu, '')
    .replace(/<think>[\s\S]*$/giu, '')
    .trim()

  /** 优先尝试匹配 Markdown JSON 代码块。 */
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/giu
  let match: RegExpExecArray | null
  while ((match = codeBlockRegex.exec(cleaned)) !== null) {
    const blockContent = match[1]?.trim()
    if (blockContent && blockContent.startsWith('{') && blockContent.endsWith('}')) {
      return blockContent
    }
  }

  /** 首个大括号位置。 */
  const firstBraceIndex = cleaned.indexOf('{')
  if (firstBraceIndex < 0) {
    throw new Error('模型没有返回有效画像 JSON。')
  }

  /** 当前大括号嵌套深度。 */
  let depth = 0
  /** 是否位于字符串字面量内。 */
  let inString = false
  /** 当前字符是否已被转义。 */
  let isEscaped = false
  /** 识别到的 JSON 起始位置。 */
  let start = -1
  /** 识别到的 JSON 结束位置。 */
  let end = -1

  for (let index = firstBraceIndex; index < cleaned.length; index += 1) {
    const char = cleaned[index]

    if (inString) {
      if (char === '\\' && !isEscaped) {
        isEscaped = true
      } else {
        if (char === '"' && !isEscaped) {
          inString = false
        }
        isEscaped = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }

  if (start >= 0 && end > start && depth === 0) {
    return cleaned.slice(start, end + 1)
  }

  /** 备选：从首个大括号到末尾大括号。 */
  const lastBraceIndex = cleaned.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return cleaned.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  throw new Error('模型没有返回有效画像 JSON。')
}

/** 解析模型返回的 JSON 或 Markdown JSON 代码块。 */
export function parseMusicProfileAnalysisText(value: string): MusicProfileAnalysis {
  try {
    const jsonText = extractJsonObjectText(value)
    const decoded = JSON.parse(jsonText) as unknown
    return MusicProfileAnalysisSchema.parse(decoded)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw profileError('PROFILE_MODEL_INVALID', `模型画像格式校验未通过：${error.issues.map((issue) => issue.message).join('；')}`)
    }
    if (error instanceof SyntaxError) {
      throw profileError('PROFILE_MODEL_INVALID', '模型返回的内容无法解析为有效 JSON。')
    }
    throw profileError('PROFILE_MODEL_INVALID', error instanceof Error ? error.message : '模型没有返回有效画像 JSON。')
  }
}

/** 构造只包含聚合特征和有限代表样本的画像模型 Prompt。 */
function buildProfileModelPrompt(features: LocalMusicProfileFeatures): string {
  /** 默认发送的有限代表样本。 */
  const representativeSamples = features.evidence.slice(0, DEFAULT_MODEL_SAMPLE_LIMIT)
  return [
    '你正在为 NcxMusic 生成“音乐人格画像”。只描述音乐证据支持的偏好、变化与场景，不得推断医学、政治、心理诊断或其他敏感真实人格。',
    '低覆盖或证据冲突必须降低 confidence。严格返回单个 JSON 对象，不要 Markdown。',
    'JSON 结构：{"summary":string,"agentPrompt":string,"insights":[{"insightId":string,"category":"artist|genre|language|era|mood|scene|exploration","label":string,"value":string,"evidence":string[],"coverage":0..1,"confidence":0..1}],"recentChanges":string[],"recommendationSeeds":string[]}',
    `数据覆盖：${JSON.stringify(features.coverage)}`,
    `变化分：${features.changeScore}`,
    `高权重歌手：${JSON.stringify(features.topArtists)}`,
    `年代分布：${JSON.stringify(features.eraDistribution)}`,
    `代表样本（仅 ${representativeSamples.length} 条，完整曲库未发送）：${JSON.stringify(representativeSamples)}`
  ].join('\n\n')
}

/** 将用户显式修正覆盖到供 Agent 使用的画像 Prompt。 */
function applyOverridesToPrompt(
  document: MusicProfileDocument,
  overrides: readonly MusicProfileOverride[]
): string {
  /** 被用户隐藏的模型结论 ID。 */
  const hiddenIds = new Set(overrides
    .filter((override) => override.kind === 'hidden' && override.insightId)
    .map((override) => override.insightId as string))
  /** 仍可供 Agent 使用的模型结论。 */
  const visibleInsights = document.insights
    .filter((insight) => !hiddenIds.has(insight.insightId))
    .map((insight) => `${insight.label}：${insight.value}（置信度 ${Math.round(insight.confidence * 100)}%）`)
  /** 用户纠正与补充。 */
  const explicitOverrides = overrides
    .filter((override) => override.kind !== 'hidden' && override.value)
    .map((override) => override.value as string)
  return [
    document.agentPrompt,
    visibleInsights.length > 0 ? `可见画像结论：${visibleInsights.join('；')}` : '',
    explicitOverrides.length > 0 ? `用户明确修正（最高优先级）：${explicitOverrides.join('；')}` : ''
  ].filter(Boolean).join('\n')
}

/** 将隐藏与纠正 override 应用到 Renderer 可见画像结论。 */
function applyOverridesToInsights(
  document: MusicProfileDocument,
  overrides: readonly MusicProfileOverride[]
): MusicProfileDocument['insights'] {
  /** 被用户隐藏的结论 ID。 */
  const hiddenIds = new Set(overrides
    .filter((override) => override.kind === 'hidden' && override.insightId)
    .map((override) => override.insightId as string))
  /** 每条结论最近的用户纠正文本。 */
  const corrections = new Map<string, string>()
  for (const override of overrides) {
    if (override.kind === 'correction' && override.insightId && override.value) {
      corrections.set(override.insightId, override.value)
    }
  }
  return document.insights
    .filter((insight) => !hiddenIds.has(insight.insightId))
    .map((insight) => corrections.has(insight.insightId)
      ? { ...insight, value: corrections.get(insight.insightId) as string, confidence: 1 }
      : insight)
}

/** 从 SQLite 行恢复并校验画像状态。 */
function restoreProfileState(row: MusicProfileStateRow): PersonalizationState {
  /** 生命周期状态白名单。 */
  const statusValues: readonly MusicProfileStatus[] = [
    'unavailable', 'collecting', 'ready_local', 'analyzing', 'ready', 'stale', 'paused', 'failed'
  ]
  /** 恢复后的成功画像。 */
  let document: MusicProfileDocument | undefined
  /** 恢复后的变化基线。 */
  let baseline: MusicProfileBaseline | undefined
  /** 恢复后的用户修正。 */
  let overrides: MusicProfileOverride[]
  /** 最近证据 Job ID。 */
  let evidenceJobId: string | undefined
  /** 可供失败重试复用的聚合结果。 */
  let retryPrepared: AgentPreparedProfileAnalysis | undefined
  try {
    if (row.profile_json) document = MusicProfileDocumentSchema.parse(JSON.parse(row.profile_json) as unknown)
    if (row.baseline_json) baseline = MusicProfileBaselineSchema.parse(JSON.parse(row.baseline_json) as unknown)
    overrides = MusicProfileOverrideSchema.array().parse(JSON.parse(row.overrides_json) as unknown)
    if (row.active_job_json) {
      /** 未信任 Job 元数据。 */
      const metadata = JSON.parse(row.active_job_json) as { jobId?: unknown; prepared?: unknown }
      if (typeof metadata.jobId === 'string') evidenceJobId = metadata.jobId
      if (isPlainRecord(metadata.prepared)) {
        /** 未信任的本地聚合结果。 */
        const prepared = metadata.prepared
        if (
          typeof prepared['jobId'] === 'string'
          && typeof prepared['modelPrompt'] === 'string'
          && prepared['modelPrompt'].length <= 200_000
        ) {
          retryPrepared = {
            jobId: prepared['jobId'],
            modelPrompt: prepared['modelPrompt'],
            coverage: MusicProfileCoverageSchema.parse(prepared['coverage']),
            baseline: MusicProfileBaselineSchema.parse(prepared['baseline'])
          }
        }
      }
    }
  } catch {
    return { ...EMPTY_STATE, status: 'failed', errorMessage: '本地画像数据损坏，请删除后重新生成。' }
  }
  return {
    status: statusValues.includes(row.status as MusicProfileStatus)
      ? row.status as MusicProfileStatus
      : document ? 'ready' : 'failed',
    ...(document ? { document } : {}),
    ...(baseline ? { baseline } : {}),
    overrides,
    changeScore: Math.max(0, Number(row.change_score) || 0),
    ...(row.dismissed_at !== null ? { dismissedAt: Number(row.dismissed_at) } : {}),
    ...(row.dismissed_score !== null ? { dismissedScore: Number(row.dismissed_score) } : {}),
    ...(evidenceJobId ? { evidenceJobId } : {}),
    ...(retryPrepared ? { retryPrepared } : {}),
    progress: 0,
    stageLabel: '',
    ...(row.error_message ? { errorMessage: row.error_message } : {})
  }
}

/** 对两个集合执行对称差。 */
function symmetricDifference(left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> {
  /** 对称差结果。 */
  const result = new Set<string>()
  for (const value of left) if (!right.has(value)) result.add(value)
  for (const value of right) if (!left.has(value)) result.add(value)
  return result
}

/** 按歌曲 ID 合并重复标准实体，并优先保留字段更完整的实例。 */
function mergeSongsById(songs: readonly StandardSong[]): StandardSong[] {
  /** 去重歌曲映射。 */
  const byId = new Map<string, StandardSong>()
  for (const song of songs) {
    /** 已存在的歌曲。 */
    const existing = byId.get(song.id)
    if (!existing || JSON.stringify(song).length > JSON.stringify(existing).length) byId.set(song.id, song)
  }
  return [...byId.values()]
}

/** 以固定并发上限映射列表，并保持原始顺序。 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  /** 保持输入顺序的结果槽位。 */
  const results = new Array<R>(items.length)
  /** 下一个待处理下标。 */
  let nextIndex = 0
  /** 单个并发 Worker。 */
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      /** 当前 Worker 独占的下标。 */
      const index = nextIndex
      nextIndex += 1
      /** 当前输入项。 */
      const item = items[index]
      if (item !== undefined) results[index] = await mapper(item, index)
    }
  }
  /** 实际 Worker 数量。 */
  const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

/** 构造带稳定错误码的画像错误。 */
function profileError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

/** 把未知画像错误转换为面向用户的短文案。 */
function readableProfileError(error: unknown): string {
  return error instanceof Error ? error.message : '音乐画像任务失败。'
}

/** 判断未信任值是否普通对象。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 通过同目录临时文件、刷新与原子替换写入快速 JSON 快照。 */
function writeJsonAtomically(targetPath: string, contents: string): void {
  /** 同目录唯一临时文件。 */
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporaryPath, contents, 'utf8')
  /** 可刷新写入内容的文件描述符。 */
  const descriptor = openSync(temporaryPath, 'r+')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporaryPath, targetPath)
}
