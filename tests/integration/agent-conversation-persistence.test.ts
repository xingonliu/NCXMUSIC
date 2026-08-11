import { describe, expect, it } from 'vitest'

import {
  AgentRuntime,
  type AgentConversationPersistencePort
} from '../../src/domains/agent/agent-runtime'
import type { PersistedAgentConversation } from '../../src/shared/schemas/agent-persistence'

// ========= 工具函数 =========

/** 创建包含未完成消息、工具和交互卡的磁盘会话。 */
function savedConversation(): PersistedAgentConversation {
  /** 工具与消息之间的稳定关联 ID。 */
  const toolCallId = crypto.randomUUID()
  return {
    schemaVersion: 1,
    savedAt: Date.now(),
    messages: [{
      messageId: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      toolCallIds: [toolCallId],
      createdAt: Date.now(),
      streaming: true,
      interrupted: false
    }],
    tools: [{
      toolCallId,
      toolName: 'smart_search_and_play',
      title: '搜索并播放',
      category: 'player',
      status: 'running',
      parameterSummary: 'action: play · query: 晴天',
      startedAt: Date.now()
    }],
    approvals: [{
      approvalId: crypto.randomUUID(),
      toolCallId,
      title: '搜索并播放',
      impact: '将播放选中的歌曲',
      riskReason: '测试未完成审批恢复',
      status: 'pending',
      expiresAt: Date.now() + 60_000
    }],
    selections: [{
      selectionId: crypto.randomUUID(),
      toolCallId,
      prompt: '请选择歌曲',
      mode: 'single',
      options: [
        { kind: 'text', optionKey: 'first', label: '第一首' },
        { kind: 'text', optionKey: 'second', label: '第二首' }
      ],
      selectedOptionKeys: [],
      status: 'pending',
      expiresAt: Date.now() + 60_000
    }]
  }
}

// ========= 测试 =========

describe('Agent Runtime conversation persistence', () => {
  it('重启恢复消息与工具关联，并把未完成状态确定性中止后刷新', async () => {
    /** 模拟磁盘中的旧会话。 */
    const persisted = savedConversation()
    /** 捕获 Runtime 刷新的新会话快照。 */
    const writes: PersistedAgentConversation[] = []
    /** 内存持久化端口。 */
    const persistence: AgentConversationPersistencePort = {
      load: async () => persisted,
      save: async (snapshot) => { writes.push(snapshot) }
    }
    /** 被测 Agent Runtime。 */
    const runtime = new AgentRuntime({
      provider: {
        stream: async function* () {
          yield { type: 'completed', finishReason: 'stop' }
        }
      },
      music: {
        read: async () => ({ operation: 'unused' }),
        mutate: async () => ({ operation: 'unused' }),
        cancel: () => {}
      },
      conversationPersistence: persistence,
      emit: () => {}
    })

    await runtime.restoreConversation()
    /** 从磁盘恢复并规范化后的会话。 */
    const restored = runtime.snapshot()
    expect(restored.messages[0]).toMatchObject({
      toolCallIds: [persisted.tools[0]?.toolCallId],
      streaming: false,
      interrupted: true
    })
    expect(restored.tools[0]).toMatchObject({ status: 'cancelled', errorCode: 'APP_RESTARTED' })
    expect(restored.approvals[0]?.status).toBe('cancelled')
    expect(restored.selections[0]?.status).toBe('cancelled')

    await runtime.flushConversation()
    expect(writes.at(-1)?.messages[0]?.toolCallIds).toEqual([persisted.tools[0]?.toolCallId])
    expect(writes.at(-1)?.tools[0]?.status).toBe('cancelled')
  })
})
