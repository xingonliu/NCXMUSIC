import { expect, test } from '@playwright/test'

import {
  AgentRuntime,
  type AgentMusicPort,
  type AgentProviderPort,
  type AgentProviderStreamEvent
} from '../../src/domains/agent/agent-runtime'
import type { PlaybackCoordinator, PlayerSnapshot } from '../../src/domains/player/playback-coordinator'
import { PlayerCommandGateway } from '../../src/domains/player/player-command-gateway'
import type { TrackSummary } from '../../src/domains/player/types'
import type { AgentRuntimeEvent, AgentSnapshot, MusicSafetyLevel } from '../../src/shared/schemas/agent'
import type { MusicMutationPayload, MusicReadPayload, StandardSong } from '../../src/shared/schemas/music'

// ========= 类型 =========

/** 可顺序回放的 Provider 响应轮次。 */
type ProviderRound = readonly AgentProviderStreamEvent[]

/** Agent E2E 夹具。 */
interface AgentFixture {
  /** Utility 内的 Agent Runtime。 */
  readonly runtime: AgentRuntime
  /** 全部 Main → Renderer 事件。 */
  readonly events: AgentRuntimeEvent[]
  /** 订阅完整快照。 */
  readonly onSnapshot: (listener: (snapshot: AgentSnapshot) => void) => void
}

// ========= 工具函数 =========

/** 创建标准歌曲实体。 */
function createSong(id: string, name: string, artistName: string): StandardSong {
  return {
    kind: 'song',
    id,
    name,
    artists: [{ id: `${Number(id) + 10}`, name: artistName, alias: [] }],
    album: { id: `${Number(id) + 20}`, name: `${name}专辑` },
    durationMs: 180_000,
    access: { badges: [], playableKnown: true },
    sources: [{ api: 'phase5-e2e', observedAt: '2026-08-10T08:00:00.000Z' }],
    updatedAt: '2026-08-10T08:00:00.000Z'
  }
}

/** 创建满足 Music Service 契约的搜索结果。 */
function createSearchResult(query: string, songs: readonly StandardSong[]): unknown {
  return {
    kind: 'search',
    query,
    songs,
    artists: [],
    albums: [],
    playlists: [],
    updatedAt: '2026-08-10T08:00:00.000Z'
  }
}

/** 创建包含一次 Tool Call 的模型轮次。 */
function createToolRound(
  id: string,
  name: string,
  input: Readonly<Record<string, unknown>>
): ProviderRound {
  return [
    { type: 'tool-call-delta', id, name, argumentsDelta: JSON.stringify(input) },
    { type: 'completed', finishReason: 'tool_calls' }
  ]
}

/** 创建只输出最终文本的模型轮次。 */
function createTextRound(text: string): ProviderRound {
  return [
    { type: 'text-delta', text },
    { type: 'completed', finishReason: 'stop' }
  ]
}

/** 创建按轮次顺序响应的 Provider。 */
function createProvider(rounds: readonly ProviderRound[]): AgentProviderPort {
  /** 下一个 Provider 轮次索引。 */
  let nextRound = 0
  return {
    stream: async function* () {
      /** 当前模型响应轮次。 */
      const round = rounds[nextRound] ?? createTextRound('操作已结束。')
      nextRound += 1
      for (const event of round) yield event
    }
  }
}

/** 创建 Agent Runtime 与事件订阅夹具。 */
function createAgentFixture(input: {
  readonly rounds: readonly ProviderRound[]
  readonly music: AgentMusicPort
  readonly safetyLevel: MusicSafetyLevel
  readonly onPlayerCommand?: (
    event: Extract<AgentRuntimeEvent, { type: 'player-command' }>,
    runtime: AgentRuntime
  ) => void
  readonly onPlayerStateRequest?: (
    event: Extract<AgentRuntimeEvent, { type: 'player-state-request' }>,
    runtime: AgentRuntime
  ) => void
}): AgentFixture {
  /** 测试观察到的完整事件。 */
  const events: AgentRuntimeEvent[] = []
  /** 快照监听器。 */
  const listeners: Array<(snapshot: AgentSnapshot) => void> = []
  /** 被测 Agent Runtime。 */
  const runtime = new AgentRuntime({
    provider: createProvider(input.rounds),
    music: input.music,
    musicSafetyLevel: input.safetyLevel,
    emit: (event) => {
      events.push(event)
      if (event.type === 'snapshot') listeners.forEach((listener) => listener(event.snapshot))
      else if (event.type === 'player-command') input.onPlayerCommand?.(event, runtime)
      else input.onPlayerStateRequest?.(event, runtime)
    }
  })
  runtime.configureProvider({
    profileId: crypto.randomUUID(),
    protocol: 'openai-compatible',
    model: 'phase5-e2e-model',
    baseUrl: 'https://provider.example.com/v1'
  })
  return { runtime, events, onSnapshot: (listener) => listeners.push(listener) }
}

/** 等待 Agent 快照满足谓词。 */
function waitForSnapshot(
  fixture: AgentFixture,
  predicate: (snapshot: AgentSnapshot) => boolean
): Promise<AgentSnapshot> {
  return new Promise((resolve, reject) => {
    /** E2E 防挂起硬超时。 */
    const timer = setTimeout(() => reject(new Error('Agent E2E snapshot timeout')), 3_000)
    fixture.onSnapshot((snapshot) => {
      if (!predicate(snapshot)) return
      clearTimeout(timer)
      resolve(snapshot)
    })
  })
}

/** 创建空播放器真实快照。 */
function createPlayerSnapshot(revision: number, track: TrackSummary | null): PlayerSnapshot {
  return {
    playback: {
      status: track ? 'playing' : 'idle',
      intent: track ? 'play' : 'pause',
      track,
      generation: revision,
      positionMs: 0,
      durationMs: track?.durationMs ?? null,
      bufferedMs: 0,
      volume: 1,
      muted: false,
      seeking: false,
      error: null,
      actualQuality: null,
      downgraded: false
    },
    queue: {
      items: [],
      currentItemId: null,
      mode: 'loop',
      revision
    },
    quality: 'auto'
  }
}

/** 创建会真实采用 playTrack 的 PlayerCommandGateway 夹具。 */
function createPlayerGateway(): {
  readonly gateway: PlayerCommandGateway
  readonly playedTracks: TrackSummary[]
  readonly revision: () => number
} {
  /** 已真实进入 Coordinator 的歌曲。 */
  const playedTracks: TrackSummary[] = []
  /** 当前真实队列修订号。 */
  let revision = 0
  /** 当前播放歌曲。 */
  let currentTrack: TrackSummary | null = null
  /** 覆盖本场景所需真实入口的 Coordinator。 */
  const coordinator = {
    getSnapshot: () => createPlayerSnapshot(revision, currentTrack),
    playTrack: async (track: TrackSummary) => {
      playedTracks.push(track)
      currentTrack = track
      revision += 1
    }
  } as unknown as PlaybackCoordinator
  return {
    gateway: new PlayerCommandGateway(coordinator),
    playedTracks,
    revision: () => revision
  }
}

/** 创建默认无副作用 Music Service 夹具。 */
function createMusicPort(songs: readonly StandardSong[]): AgentMusicPort {
  return {
    read: async (_requestId, payload) => createSearchResult(
      payload.operation === 'search' ? payload.query : '测试',
      songs
    ),
    mutate: async (_requestId, payload) => ({
      operation: payload.operation,
      succeeded: true,
      updatedAt: '2026-08-10T08:00:00.000Z'
    }),
    cancel: () => {}
  }
}

// ========= E2E =========

test('小云搜索歌曲后经唯一 PlayerCommandGateway 播放并取得真实回执', async () => {
  /** 可验证真实执行的播放器 Gateway。 */
  const player = createPlayerGateway()
  /** 本场景唯一歌曲。 */
  const song = createSong('1', '晴天', '周杰伦')
  /** 搜播完整 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('search-play', 'smart_search_and_play', { action: 'play', query: '晴天' }),
      createTextRound('已经为你播放《晴天》。')
    ],
    music: createMusicPort([song]),
    safetyLevel: 'M2',
    onPlayerCommand: (event, runtime) => {
      void player.gateway.execute({
        commandId: crypto.randomUUID(),
        expectedRevision: player.revision(),
        issuedAt: Date.now(),
        timeoutMs: 1_000,
        action: event.request.action
      }).then((result) => runtime.command({
        operation: 'playerCommandResult',
        toolCallId: event.request.toolCallId,
        ok: result.ok,
        summary: result.ok ? 'PlayerCommandGateway 已真实播放《晴天》。' : result.code,
        latestRevision: result.latestRevision
      }))
    }
  })
  /** 本轮完成快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({ operation: 'sendMessage', content: '播放晴天' })
  /** 搜播完成快照。 */
  const snapshot = await completed

  expect(player.playedTracks).toMatchObject([{ trackId: '1', name: '晴天' }])
  expect(snapshot.tools[0]).toMatchObject({ status: 'succeeded', resultSummary: 'PlayerCommandGateway 已真实播放《晴天》。' })
})

test('M3 将歌曲加入指定歌单时只执行一次 Music Service 写入', async () => {
  /** 观察到的 Music Service 写入。 */
  const mutations: MusicMutationPayload[] = []
  /** 歌单写入 Music Service 夹具。 */
  const music: AgentMusicPort = {
    read: async () => createSearchResult('测试', []),
    mutate: async (_requestId, payload) => {
      mutations.push(payload)
      return {
        operation: payload.operation,
        succeeded: true,
        updatedAt: '2026-08-10T08:00:00.000Z'
      }
    },
    cancel: () => {}
  }
  /** 歌单操作 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('playlist-add', 'playlist_manager', {
        action: 'add_tracks',
        playlistId: '88',
        trackIds: ['1']
      }),
      createTextRound('已经把歌曲加入指定歌单。')
    ],
    music,
    safetyLevel: 'M3'
  })
  /** 本轮完成快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({ operation: 'sendMessage', content: '把晴天加入我的通勤歌单' })
  /** 歌单写入完成快照。 */
  const snapshot = await completed

  expect(mutations).toEqual([{
    operation: 'updatePlaylistTracks',
    playlistId: '88',
    trackIds: ['1'],
    action: 'add'
  }])
  expect(snapshot.tools[0]?.status).toBe('succeeded')
})

test('同名歌曲由搜播工具内部完成 SelectionCard 暂停恢复且不依赖模型二次编排', async () => {
  /** 两个需要消歧的同名歌曲。 */
  const songs = [
    createSong('1', '同名歌曲', '歌手甲'),
    createSong('2', '同名歌曲', '歌手乙')
  ]
  /** 可验证选择后真实执行的播放器 Gateway。 */
  const player = createPlayerGateway()
  /** Music Service 搜索次数。 */
  let searchCount = 0
  /** 只允许首次读取候选的 Music Service。 */
  const music: AgentMusicPort = {
    read: async (_requestId, payload) => {
      if (payload.operation === 'search') searchCount += 1
      return createSearchResult(payload.operation === 'search' ? payload.query : '测试', songs)
    },
    mutate: async () => ({ operation: 'dailySignin', succeeded: true }),
    cancel: () => {}
  }
  /** 消歧完整 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      // 故意模拟模型误用 search；Runtime 应根据播放目标纠正并自行闭环消歧。
      createToolRound('ambiguous-search', 'smart_search_and_play', { action: 'search', query: '同名歌曲' }),
      createTextRound('已经为你播放歌手乙的《同名歌曲》。')
    ],
    music,
    safetyLevel: 'M2',
    onPlayerCommand: (event, runtime) => {
      void player.gateway.execute({
        commandId: crypto.randomUUID(),
        expectedRevision: player.revision(),
        issuedAt: Date.now(),
        timeoutMs: 1_000,
        action: event.request.action
      }).then((result) => runtime.command({
        operation: 'playerCommandResult',
        toolCallId: event.request.toolCallId,
        ok: result.ok,
        summary: result.ok ? '已播放用户选择的歌曲。' : result.code,
        latestRevision: result.latestRevision
      }))
    }
  })
  /** 待选择快照。 */
  const pending = waitForSnapshot(
    fixture,
    (snapshot) => snapshot.selections.some((selection) => selection.status === 'pending')
  )
  await fixture.runtime.command({ operation: 'sendMessage', content: '播放同名歌曲' })
  /** SelectionCard 待决快照。 */
  const pendingSnapshot = await pending
  /** 唯一待决选择。 */
  const selection = pendingSnapshot.selections.find((item) => item.status === 'pending')
  if (!selection) throw new Error('SelectionCard 未创建')
  /** 在提交答案前订阅最终快照，避免同步完成竞态。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({
    operation: 'respondSelection',
    selectionId: selection.selectionId,
    selectedOptionKeys: ['song-2']
  })
  /** 消歧完成快照。 */
  const snapshot = await completed

  expect(snapshot.selections[0]).toMatchObject({ status: 'selected', selectedOptionKeys: ['song-2'] })
  expect(searchCount).toBe(1)
  expect(player.playedTracks).toMatchObject([{ trackId: '2', name: '同名歌曲' }])
  expect(snapshot.tools).toHaveLength(1)
  expect(snapshot.tools[0]).toMatchObject({ toolName: 'smart_search_and_play', status: 'succeeded' })
})

test('普通点播遇到同名版本时优先原唱或最高相关候选而不弹选择卡', async () => {
  /** 上游首位原唱与次位翻唱候选。 */
  const songs = [
    createSong('1', '爱我还是他', '陶喆'),
    createSong('2', '爱我还是他（翻唱版）', '翻唱歌手')
  ]
  /** 可验证直接播放结果的播放器 Gateway。 */
  const player = createPlayerGateway()
  /** 普通点播 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('direct-original', 'smart_search_and_play', { action: 'play', query: '爱我还是他 原版' }),
      createTextRound('已经为你播放陶喆的《爱我还是他》。')
    ],
    music: createMusicPort(songs),
    safetyLevel: 'M2',
    onPlayerCommand: (event, runtime) => {
      void runtime.command({
        operation: 'playerCommandResult',
        toolCallId: event.request.toolCallId,
        ok: true,
        summary: '已直接播放原唱。',
        latestRevision: 1
      })
      if (event.request.action.type === 'player.play-track') player.playedTracks.push(event.request.action.track)
    }
  })
  /** 本轮完成快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({ operation: 'sendMessage', content: '随便放首爱我还是他，原版就行' })
  /** 直接点播完成快照。 */
  const snapshot = await completed

  expect(player.playedTracks).toMatchObject([{ trackId: '1', name: '爱我还是他' }])
  expect(snapshot.selections).toHaveLength(0)
})

test('随机点播查询由 Runtime 路由到公开新歌而不是把推荐短语送入关键词搜索', async () => {
  /** 随机点播候选。 */
  const song = createSong('31', '今天的新歌', '测试歌手')
  /** 实际收到的 Music Service 读取载荷。 */
  const payloads: MusicReadPayload[] = []
  /** 只允许读取公开新歌集合的 Music Service。 */
  const music: AgentMusicPort = {
    read: async (_requestId, payload) => {
      payloads.push(payload)
      return {
        kind: 'songCollection',
        collection: 'new',
        songs: [song],
        updatedAt: '2026-08-10T08:00:00.000Z'
      }
    },
    mutate: async () => ({ operation: 'dailySignin', succeeded: true }),
    cancel: () => {}
  }
  /** 随机点播 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('random-play', 'smart_search_and_play', { action: 'play', query: '随机推荐' }),
      createTextRound('已经为你播放《今天的新歌》。')
    ],
    music,
    safetyLevel: 'M2',
    onPlayerCommand: (event, runtime) => {
      void runtime.command({
        operation: 'playerCommandResult',
        toolCallId: event.request.toolCallId,
        ok: true,
        summary: '已播放公开新歌。',
        latestRevision: 1
      })
    }
  })
  /** 本轮完成快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({ operation: 'sendMessage', content: '随便放首歌' })
  await completed

  expect(payloads).toEqual([{ operation: 'getNewSongs', limit: 10 }])
})

test('播放器失败后即使模型声称已播放也由 Runtime 改写为真实失败结果', async () => {
  /** 播放失败场景的候选歌曲。 */
  const song = createSong('41', '无法播放的歌', '测试歌手')
  /** 播放失败 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('failed-play', 'smart_search_and_play', { action: 'play', query: '无法播放的歌' }),
      createTextRound('已经为你播放《无法播放的歌》。')
    ],
    music: createMusicPort([song]),
    safetyLevel: 'M2',
    onPlayerCommand: (event, runtime) => {
      void runtime.command({
        operation: 'playerCommandResult',
        toolCallId: event.request.toolCallId,
        ok: false,
        summary: '歌曲当前不可播放。'
      })
    }
  })
  /** 本轮完成快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({ operation: 'sendMessage', content: '播放无法播放的歌' })
  /** 经过事实守卫的最终快照。 */
  const snapshot = await completed

  expect(snapshot.tools[0]).toMatchObject({ status: 'failed', errorCode: 'PLAYER_COMMAND_FAILED' })
  expect(snapshot.messages.at(-1)?.content).toBe('未能完成播放：歌曲当前不可播放。')
})

test('已注册选择工具的参数错误返回可重试参数码而不是能力不可用', async () => {
  /** 参数错误场景 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('invalid-selection', 'request_user_selection', {
        prompt: '请选择版本',
        mode: 'single',
        options: [
          { kind: 'entity', optionKey: 'first' },
          { kind: 'entity', optionKey: 'second' }
        ]
      }),
      createTextRound('选择参数有误，请重试。')
    ],
    music: createMusicPort([]),
    safetyLevel: 'M2'
  })
  /** 本轮完成快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({ operation: 'sendMessage', content: '帮我选择一个版本' })
  /** 参数错误完成快照。 */
  const snapshot = await completed

  expect(snapshot.tools[0]).toMatchObject({
    toolName: 'request_user_selection',
    status: 'failed',
    errorCode: 'TOOL_ARGUMENTS_INVALID'
  })
})

test('M1 用户拒绝后播放器和 Music Service 均为零执行', async () => {
  /** 唯一歌曲。 */
  const song = createSong('1', '晴天', '周杰伦')
  /** 写入执行次数。 */
  let mutationCount = 0
  /** 拒绝场景 Music Service。 */
  const music = createMusicPort([song])
  /** 包装后可观察写入的 Music Service。 */
  const observableMusic: AgentMusicPort = {
    ...music,
    mutate: async (requestId, payload) => {
      mutationCount += 1
      return music.mutate(requestId, payload)
    }
  }
  /** M1 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('reject-play', 'smart_search_and_play', { action: 'play', query: '晴天' }),
      createTextRound('已按你的选择取消操作。')
    ],
    music: observableMusic,
    safetyLevel: 'M1'
  })
  /** 待审批快照。 */
  const pending = waitForSnapshot(
    fixture,
    (snapshot) => snapshot.approvals.some((approval) => approval.status === 'pending')
  )
  await fixture.runtime.command({ operation: 'sendMessage', content: '播放晴天' })
  /** ApprovalCard 待决快照。 */
  const pendingSnapshot = await pending
  /** 唯一待决审批。 */
  const approval = pendingSnapshot.approvals.find((item) => item.status === 'pending')
  if (!approval) throw new Error('ApprovalCard 未创建')
  /** 在拒绝前订阅最终快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({
    operation: 'respondApproval',
    approvalId: approval.approvalId,
    decision: 'reject'
  })
  /** 拒绝后的完成快照。 */
  const snapshot = await completed

  expect(snapshot.tools[0]).toMatchObject({ status: 'rejected', errorCode: 'USER_REJECTED' })
  expect(fixture.events.some((event) => event.type === 'player-command')).toBe(false)
  expect(mutationCount).toBe(0)
})

test('control_player 通过 Renderer 状态桥读取真实播放与队列快照', async () => {
  /** 播放器状态读取 Agent 夹具。 */
  const fixture = createAgentFixture({
    rounds: [
      createToolRound('player-state', 'control_player', { action: 'get_state' }),
      createTextRound('当前正在播放《晴天》。')
    ],
    music: createMusicPort([]),
    safetyLevel: 'M1',
    onPlayerStateRequest: (event, runtime) => {
      void runtime.command({
        operation: 'playerStateResult',
        toolCallId: event.request.toolCallId,
        state: {
          playbackStatus: 'playing',
          currentTrack: {
            trackId: '1',
            name: '晴天',
            artists: ['周杰伦'],
            album: '叶惠美',
            durationMs: 269_000
          },
          positionMs: 12_000,
          durationMs: 269_000,
          volume: 0.8,
          muted: false,
          mode: 'loop',
          revision: 7,
          queue: []
        }
      })
    }
  })
  /** 本轮完成快照。 */
  const completed = waitForSnapshot(fixture, (snapshot) => snapshot.turnStatus === 'completed')
  await fixture.runtime.command({ operation: 'sendMessage', content: '现在播放到哪里了' })
  /** 播放器状态读取完成快照。 */
  const snapshot = await completed

  expect(snapshot.tools[0]).toMatchObject({
    status: 'succeeded',
    resultSummary: '当前playing：《晴天》，音量 80%。'
  })
})
