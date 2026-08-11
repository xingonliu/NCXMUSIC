import { z } from 'zod'

import {
  AgentMessageSchema,
  ApprovalSnapshotSchema,
  SelectionSnapshotSchema,
  ToolExecutionCardSnapshotSchema
} from './agent'

// ========= 变量 =========

/** 当前连续会话快照版本。 */
export const AGENT_CONVERSATION_SNAPSHOT_VERSION = 1 as const

/** Utility SQLite 保存的当前连续会话；时间分块只负责后续摘要归档。 */
export const PersistedAgentConversationSchema = z.strictObject({
  schemaVersion: z.literal(AGENT_CONVERSATION_SNAPSHOT_VERSION),
  savedAt: z.number().int().nonnegative(),
  messages: z.array(AgentMessageSchema),
  tools: z.array(ToolExecutionCardSnapshotSchema),
  approvals: z.array(ApprovalSnapshotSchema),
  selections: z.array(SelectionSnapshotSchema)
})

// ========= 类型 =========

/** 当前账户可恢复的连续 Agent 会话。 */
export type PersistedAgentConversation = z.infer<typeof PersistedAgentConversationSchema>
