import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { AgentMusicPort } from '../../src/domains/agent/agent-runtime'
import { UtilityAccountStore } from '../../src/infrastructure/persistence/account-space'
import type { MusicReadPayload, StandardPlaylist, StandardSong } from '../../src/shared/schemas/music'
import {
  PROFILE_EARLY_REPROMPT_DELTA,
  PROFILE_PROMPT_SILENCE_MS,
  PROFILE_UPDATE_THRESHOLD,
  PersonalizationService,
  calculateProfileChangeScore,
  evaluateProfileUpdatePrompt,
  extractLocalMusicProfileFeatures
} from '../../src/utility/personalization-service'

// ========= 变量 =========

/** 当前测试创建的临时目录。 */
const temporaryDirectories: string[] = []

/** 稳定标准实体观测时间。 */
const OBSERVED_AT = '2026-08-11T00:00:00.000Z'

// ========= 函数 =========

/** 创建自动清理的测试数据根目录。 */
function createDataRoot(): string {
  /** 当前测试唯一目录。 */
  const directory = mkdtempSync(join(tmpdir(), 'ncx-phase6-profile-'))
  temporaryDirectories.push(directory)
  return directory
}

/** 创建最小标准歌曲。 */
function song(id: string, artist = '测试歌手', year = 2020): StandardSong {
  return {
    kind: 'song',
    id,
    name: `歌曲 ${id}`,
    artists: [{ id: `${Number(id) + 100}`, name: artist, alias: [] }],
    album: {
      id: `${Number(id) + 200}`,
      name: `专辑 ${id}`,
      publishTime: Date.UTC(year, 0, 1)
    },
    access: { badges: [], playableKnown: true },
    sources: [{ api: 'fixture.song', observedAt: OBSERVED_AT }],
    updatedAt: OBSERVED_AT
  }
}

/** 创建最小标准歌单。 */
function playlist(id: string, owned: boolean, songs: StandardSong[]): StandardPlaylist {
  return {
    kind: 'playlist',
    id,
    name: owned ? `自建 ${id}` : `收藏 ${id}`,
    owned,
    songs,
    trackCount: songs.length,
    sources: [{ api: 'fixture.playlist', observedAt: OBSERVED_AT }],
    updatedAt: OBSERVED_AT
  }
}

/** 创建覆盖画像采集四类标准读取的 Music Service 端口。 */
function musicPort(liked: StandardSong[], playlists: StandardPlaylist[], history: StandardSong[]): AgentMusicPort {
  /** 按 ID 读取歌单详情。 */
  const playlistsById = new Map(playlists.map((item) => [item.id, item]))
  return {
    read: async (_requestId: string, payload: MusicReadPayload): Promise<unknown> => {
      if (payload.operation === 'getLikedSongs') {
        return { kind: 'songCollection', collection: 'liked', ownerId: payload.userId, songs: liked, updatedAt: OBSERVED_AT }
      }
      if (payload.operation === 'getUser') {
        return {
          kind: 'user',
          entity: {
            kind: 'user',
            id: payload.id,
            nickname: '测试用户',
            gender: 0,
            sources: [{ api: 'ncm.user_detail', observedAt: OBSERVED_AT }],
            updatedAt: OBSERVED_AT
          }
        }
      }
      if (payload.operation === 'getUserPlaylists') {
        return { kind: 'playlistCollection', collection: 'user', ownerId: payload.userId, playlists, facets: [], updatedAt: OBSERVED_AT }
      }
      if (payload.operation === 'getListeningHistory') {
        return {
          kind: 'songCollection',
          collection: payload.period === 'week' ? 'historyWeek' : 'historyAll',
          ownerId: payload.userId,
          songs: history,
          updatedAt: OBSERVED_AT
        }
      }
      if (payload.operation === 'getPlaylist') {
        return { kind: 'playlist', entity: playlistsById.get(payload.id) ?? null }
      }
      throw new Error(`Unexpected operation: ${payload.operation}`)
    },
    mutate: async (): Promise<unknown> => ({ kind: 'mutation', operation: 'noop', ok: true }),
    cancel: (): void => undefined
  }
}

// ========= 生命周期 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

// ========= 测试 =========

describe('Phase 6 画像变化规则', () => {
  it('按 1.5/1.0 权重计算对称差并对同一歌曲取最高权重', () => {
    /** 旧成功基线。 */
    const previous = {
      likedSongIds: ['1', '2'],
      createdPlaylistSongIds: ['2', '3'],
      capturedAt: 1
    }
    /** 当前精确集合。 */
    const current = {
      likedSongIds: ['2', '4'],
      createdPlaylistSongIds: ['2', '4', '5'],
      capturedAt: 2
    }
    expect(calculateProfileChangeScore(previous, current)).toBe(5)
  })

  it('执行 30 分、7 天静默和追加 15 分提前提示', () => {
    /** 固定规则评估时间。 */
    const now = Date.UTC(2026, 7, 11)
    expect(evaluateProfileUpdatePrompt({ changeScore: PROFILE_UPDATE_THRESHOLD - 0.5, now })).toBe(false)
    expect(evaluateProfileUpdatePrompt({ changeScore: PROFILE_UPDATE_THRESHOLD, now })).toBe(true)
    expect(evaluateProfileUpdatePrompt({
      changeScore: PROFILE_UPDATE_THRESHOLD + PROFILE_EARLY_REPROMPT_DELTA - 0.5,
      now,
      dismissedAt: now - 1_000,
      dismissedScore: PROFILE_UPDATE_THRESHOLD
    })).toBe(false)
    expect(evaluateProfileUpdatePrompt({
      changeScore: PROFILE_UPDATE_THRESHOLD + PROFILE_EARLY_REPROMPT_DELTA,
      now,
      dismissedAt: now - 1_000,
      dismissedScore: PROFILE_UPDATE_THRESHOLD
    })).toBe(true)
    expect(evaluateProfileUpdatePrompt({
      changeScore: PROFILE_UPDATE_THRESHOLD,
      now,
      dismissedAt: now - PROFILE_PROMPT_SILENCE_MS,
      dismissedScore: PROFILE_UPDATE_THRESHOLD
    })).toBe(true)
  })

  it('本地去重聚合收藏歌单但不给它变化权重', () => {
    /** 喜欢、自建和收藏共享的重复歌曲。 */
    const sharedSong = song('1', 'A', 1998)
    /** 本地聚合结果。 */
    const features = extractLocalMusicProfileFeatures({
      likedSongs: [sharedSong],
      playlists: [playlist('10', true, [sharedSong, song('2', 'B')]), playlist('11', false, [song('3', 'C')])],
      listeningHistory: [sharedSong]
    })
    expect(features.coverage).toMatchObject({
      likedSongs: 1,
      createdPlaylists: 1,
      createdPlaylistSongs: 2,
      subscribedPlaylists: 1,
      uniqueSongs: 3
    })
    expect(features.evidence.find((item) => item.songId === '1')?.sources).toEqual([
      'created_playlist',
      'liked',
      'listening_history'
    ])
  })
})

describe('Phase 6 画像持久化与删除边界', () => {
  it('只在网易云账户完成用户触发分析，并独立删除画像', async () => {
    /** 当前账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: createDataRoot() })
    await store.open('netease:1001', 3)
    /** 当前账户画像服务。 */
    const service = new PersonalizationService(store)
    await service.restore()
    expect(service.snapshot(true).prompt).toMatchObject({ kind: 'initialize', visible: true })

    /** 测试曲库。 */
    const liked = [song('1', 'A'), song('2', 'A')]
    /** 测试歌单。 */
    const playlists = [playlist('10', true, [liked[0] as StandardSong, song('3', 'B')])]
    /** 完成本地采集的画像 Job。 */
    const prepared = await service.prepareAnalysis(musicPort(liked, playlists, [song('4', 'C')]), 'initialize')
    /** 内部代表证据分页只返回当前 Job 的归一化数据。 */
    const evidencePage = await service.evidencePage(0, 1)
    expect(evidencePage.items).toHaveLength(1)
    expect(evidencePage.nextCursor).toBe(1)
    await service.completeAnalysis(prepared, {
      summary: '偏爱旋律清晰、歌手风格稳定的歌曲。',
      agentPrompt: '推荐时优先考虑 A，并保留适度探索。',
      insights: [{
        insightId: 'artist.a',
        category: 'artist',
        label: '偏好歌手 A',
        value: 'A 在喜欢与自建歌单中重复出现。',
        evidence: ['歌曲 1', '歌曲 2'],
        coverage: 0.75,
        confidence: 0.85
      }],
      recentChanges: [],
      recommendationSeeds: ['歌手 A']
    })
    expect(service.snapshot(true)).toMatchObject({ status: 'ready', usable: true, version: 1 })
    await service.saveOverride({ kind: 'supplement', value: '工作时偏爱无歌词器乐。' })
    expect(service.contextText()).toContain('最高优先级')

    /** API 明确返回的基础资料已按来源存储，缺失生日保持未知。 */
    const basicProfile = await store.write((database) => database.prepare(`
      SELECT nickname, gender, birthday, source_api
      FROM account_basic_profile
      WHERE singleton_id = 1
    `).get() as { nickname: string; gender: number; birthday: number | null; source_api: string })
    expect(basicProfile).toEqual({
      nickname: '测试用户',
      gender: 0,
      birthday: null,
      source_api: 'ncm.user_detail'
    })

    await service.deleteProfile()
    expect(service.snapshot(true)).toMatchObject({ status: 'unavailable', usable: false, version: 0 })
    /** 画像删除后画像相关表为空，独立的 API 基础资料仍保留。 */
    const counts = await store.write((database) => ({
      profiles: Number((database.prepare('SELECT COUNT(*) AS count FROM music_profile_state').get() as { count: number }).count),
      evidence: Number((database.prepare('SELECT COUNT(*) AS count FROM music_profile_evidence').get() as { count: number }).count),
      basicProfiles: Number((database.prepare('SELECT COUNT(*) AS count FROM account_basic_profile').get() as { count: number }).count)
    }))
    expect(counts).toEqual({ profiles: 0, evidence: 0, basicProfiles: 1 })
    await store.close()
  })

  it('游客空间始终不提供画像初始化提示', async () => {
    /** 游客账户 SQLite 单写者。 */
    const store = new UtilityAccountStore({ dataRoot: createDataRoot() })
    await store.open('guest:local', 0)
    /** 游客画像服务。 */
    const service = new PersonalizationService(store)
    await service.restore()
    expect(service.snapshot(true)).toMatchObject({ eligible: false, usable: false, status: 'unavailable' })
    await expect(service.prepareAnalysis(musicPort([], [], []), 'initialize')).rejects.toThrow('游客不能生成')
    await store.close()
  })
})
