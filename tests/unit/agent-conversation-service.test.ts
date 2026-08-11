import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { UtilityAccountStore } from '../../src/infrastructure/persistence/account-space'
import type { PersistedAgentConversation } from '../../src/shared/schemas/agent-persistence'
import { AgentConversationService } from '../../src/utility/agent-conversation-service'

// ========= 变量 =========

/** 测试创建的临时目录，结束后清理。 */
const temporaryDirectories: string[] = []

// ========= 函数 =========

/** 创建独占的账户数据根目录。 */
function dataRoot(): string {
  /** 本测试创建的临时根目录。 */
  const root = mkdtempSync(join(tmpdir(), 'ncx-agent-conversation-'))
  temporaryDirectories.push(root)
  return root
}

/** 创建包含消息和关联工具卡的合法连续会话。 */
function conversation(content: string): PersistedAgentConversation {
  /** 关联消息与工具的稳定 Tool Call ID。 */
  const toolCallId = crypto.randomUUID()
  return {
    schemaVersion: 1,
    savedAt: Date.now(),
    messages: [{
      messageId: crypto.randomUUID(),
      role: 'assistant',
      content,
      toolCallIds: [toolCallId],
      createdAt: Date.now(),
      streaming: false,
      interrupted: false
    }],
    tools: [{
      toolCallId,
      toolName: 'smart_search_and_play',
      title: '搜索并播放',
      category: 'player',
      status: 'succeeded',
      parameterSummary: 'action: play · query: 晴天',
      startedAt: Date.now(),
      endedAt: Date.now()
    }],
    approvals: [],
    selections: []
  }
}

// ========= 测试 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('AgentConversationService', () => {
  it('应用重启后从同一账户 SQLite 恢复消息与工具关联', async () => {
    /** Utility 账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: dataRoot() })
    await store.open('netease:10001', 1)
    /** 首次应用进程中的会话服务。 */
    const firstService = new AgentConversationService(store)
    await firstService.save(conversation('已经为你播放《晴天》。'))

    /** 模拟重启后重新构造的会话服务。 */
    const restartedService = new AgentConversationService(store)
    /** 恢复后的当前连续会话。 */
    const restored = await restartedService.load()

    expect(restored?.messages[0]?.content).toContain('晴天')
    expect(restored?.messages[0]?.toolCallIds).toEqual([restored?.tools[0]?.toolCallId])
    await store.close()
  })

  it('不同账户的连续会话严格隔离', async () => {
    /** Utility 账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: dataRoot() })
    /** 按当前账户读写的会话服务。 */
    const service = new AgentConversationService(store)
    await store.open('netease:10001', 1)
    await service.save(conversation('账户一'))
    await store.switchAccount('netease:10002', 2)
    await service.save(conversation('账户二'))

    expect((await service.load())?.messages[0]?.content).toBe('账户二')
    await store.switchAccount('netease:10001', 3)
    expect((await service.load())?.messages[0]?.content).toBe('账户一')
    await store.close()
  })
})
