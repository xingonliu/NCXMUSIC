import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { UtilityAccountStore } from '../../src/infrastructure/persistence/account-space'
import type { AgentMessage } from '../../src/shared/schemas/agent'
import {
  CONVERSATION_BLOCK_IDLE_MS,
  ConversationMemoryService
} from '../../src/utility/conversation-memory-service'

// ========= 变量 =========

/** 当前测试创建的临时目录。 */
const temporaryDirectories: string[] = []

// ========= 函数 =========

/** 创建自动清理的测试数据根目录。 */
function createDataRoot(): string {
  /** 当前测试唯一目录。 */
  const directory = mkdtempSync(join(tmpdir(), 'ncx-phase6-memory-'))
  temporaryDirectories.push(directory)
  return directory
}

/** 创建稳定 Agent 消息。 */
function message(
  messageId: string,
  role: AgentMessage['role'],
  content: string,
  createdAt: number
): AgentMessage {
  return {
    messageId,
    role,
    content,
    toolCallIds: [],
    createdAt,
    streaming: false,
    interrupted: false
  }
}

// ========= 生命周期 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

// ========= 测试 =========

describe('Phase 6 会话块、FTS5 与 Working Memory', () => {
  it('十分钟无用户消息后归档摘要并检索相关块', async () => {
    /** 当前账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: createDataRoot() })
    await store.open('netease:1001', 1)
    /** 当前账户长期记忆服务。 */
    const memory = new ConversationMemoryService(store)
    await memory.restore()
    /** 固定块开始时间。 */
    const startedAt = Date.UTC(2026, 7, 11, 8)
    /** 待归档连续消息。 */
    const messages = [
      message('00000000-0000-4000-8000-000000000001', 'user', '我工作时喜欢听无歌词器乐', startedAt),
      message('00000000-0000-4000-8000-000000000002', 'assistant', '记住了，工作场景优先器乐。', startedAt + 2_000)
    ]
    expect(await memory.archiveIfInactive(messages, startedAt + CONVERSATION_BLOCK_IDLE_MS - 1)).toBe(false)
    expect(await memory.archiveIfInactive(messages, startedAt + CONVERSATION_BLOCK_IDLE_MS)).toBe(true)
    expect(await memory.archiveIfInactive(messages, startedAt + CONVERSATION_BLOCK_IDLE_MS + 1)).toBe(false)

    /** 与下一目标相关的 Working Memory。 */
    const working = await memory.prepareForTurn(messages, '工作时放点器乐', startedAt + CONVERSATION_BLOCK_IDLE_MS + 2)
    expect(working.currentGoal).toBe('工作时放点器乐')
    expect(working.selectedMemories[0]?.summary).toContain('无歌词器乐')
    expect(memory.contextText()).toContain('相关长期记忆')
    await expect(memory.status()).resolves.toMatchObject({ conversationBlocks: 1, indexedBlocks: 1 })
    /** 损坏的快速快照。 */
    const workingMemoryPath = store.current()?.workingMemoryPath
    expect(workingMemoryPath).toBeDefined()
    writeFileSync(workingMemoryPath as string, '{broken', 'utf8')
    await memory.restore()
    expect(JSON.parse(readFileSync(workingMemoryPath as string, 'utf8'))).toMatchObject({
      currentGoal: '工作时放点器乐'
    })
    await store.close()
  })

  it('账户切换后 Working Memory 与 FTS5 结果不串号', async () => {
    /** 多账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: createDataRoot() })
    await store.open('netease:1001', 1)
    /** 复用同一 Utility 服务实例。 */
    const memory = new ConversationMemoryService(store)
    await memory.restore()
    /** 第一个账户的历史消息。 */
    const firstMessages = [message(
      '00000000-0000-4000-8000-000000000011',
      'user',
      '只喜欢爵士钢琴',
      1
    )]
    await memory.archiveIfInactive(firstMessages, 1 + CONVERSATION_BLOCK_IDLE_MS)
    await memory.prepareForTurn(firstMessages, '爵士', 1 + CONVERSATION_BLOCK_IDLE_MS + 1)
    expect(memory.contextText()).toContain('爵士钢琴')

    await store.switchAccount('netease:1002', 2)
    await memory.restore()
    expect(memory.contextText()).toBe('')
    await expect(memory.search('爵士')).resolves.toEqual([])
    await expect(memory.status()).resolves.toMatchObject({ conversationBlocks: 0, indexedBlocks: 0 })
    await store.close()
  })
})
