import type { AgentMessage } from '../../shared/schemas/agent'
import type {
  MemorySearchHit,
  MemoryStatus,
  WorkingMemorySnapshot
} from '../../shared/schemas/personalization'

// ========= 类型 =========

/** Agent Runtime 使用的账户隔离长期记忆端口。 */
export interface AgentMemoryPort {
  /** 当前账户打开后恢复 Working Memory。 */
  restore(): Promise<void>
  /** 新用户目标前关闭过期块并选择相关历史。 */
  prepareForTurn(
    messages: readonly AgentMessage[],
    currentGoal: string,
    now?: number
  ): Promise<WorkingMemorySnapshot>
  /** 当前用户空闲达到阈值时归档会话块。 */
  archiveIfInactive(messages: readonly AgentMessage[], now?: number): Promise<boolean>
  /** 返回注入模型的最小 Working Memory 文本。 */
  contextText(): string
  /** 搜索当前账户长期记忆。 */
  search(query: string, limit?: number): Promise<MemorySearchHit[]>
  /** 返回长期记忆公开统计。 */
  status(): Promise<MemoryStatus>
}
