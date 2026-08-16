import type { AgentMusicPort } from './agent-runtime'
import type {
  MusicPersonalizationSnapshot,
  MusicProfileAnalysis,
  MusicProfileBaseline,
  MusicProfileCoverage,
  MusicProfileOverride
} from '../../shared/schemas/personalization'

// ========= 类型 =========

/** 已完成本地聚合并等待模型分析的端口结果。 */
export interface AgentPreparedProfileAnalysis {
  /** 当前画像 Job ID。 */
  readonly jobId: string
  /** 仅含聚合特征与有限代表样本的模型 Prompt。 */
  readonly modelPrompt: string
  /** 当前 Job 数据覆盖范围。 */
  readonly coverage: MusicProfileCoverage
  /** 成功后才能替换的精确变化基线。 */
  readonly baseline: MusicProfileBaseline
}

/** Agent Runtime 使用的音乐画像端口。 */
export interface AgentPersonalizationPort {
  /** 订阅画像状态变化。 */
  subscribe(listener: () => void): () => void
  /** 当前账户打开后恢复画像。 */
  restore(): Promise<void>
  /** 返回 Renderer 可见画像快照。 */
  snapshot(providerConfigured: boolean, now?: number): MusicPersonalizationSnapshot
  /** 返回注入小云 Prompt 的画像片段。 */
  contextText(): string
  /** 启动时只读取轻量集合与计数并刷新更新提示分数。 */
  refreshLightweightChangeScore(music: AgentMusicPort): Promise<number>
  /** 本地采集并准备画像模型调用。 */
  prepareAnalysis(
    music: AgentMusicPort,
    mode: 'initialize' | 'update' | 'regenerate'
  ): Promise<AgentPreparedProfileAnalysis>
  /** 成功后原子替换画像与变化基线。 */
  completeAnalysis(prepared: AgentPreparedProfileAnalysis, analysis: MusicProfileAnalysis): Promise<void>
  /** 标记画像 Job 失败，可附带模型原始响应。 */
  failAnalysis(jobId: string, message: string, rawOutput?: string): Promise<void>
  /** 取消当前画像 Job 的底层音乐请求。 */
  cancelActiveJob(music: AgentMusicPort): void
  /** 关闭当前画像提示。 */
  dismissPrompt(): Promise<void>
  /** 暂停画像更新。 */
  pause(): Promise<void>
  /** 恢复画像更新。 */
  resume(): Promise<void>
  /** 仅删除本地画像与中间证据。 */
  deleteProfile(): Promise<void>
  /** 保存最高优先级用户修正。 */
  saveOverride(override: Omit<MusicProfileOverride, 'overrideId' | 'updatedAt'>): Promise<void>
  /** 删除单条用户修正。 */
  removeOverride(overrideId: string): Promise<void>
  /** 读取代表证据分页。 */
  evidencePage(cursor?: number, limit?: number): Promise<{
    readonly items: readonly unknown[]
    readonly nextCursor?: number
  }>
}
