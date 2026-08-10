import type { RuntimeStatus } from '../schemas/control-plane'
import type { AccountDataRequest, AccountDataResult } from '../schemas/account-data'
import type { PingResult, RuntimeResult, UtilitySnapshot } from '../schemas/runtime'
import type {
  AlbumId,
  ArtistId,
  MusicReadPayload,
  MusicReadResult,
  MusicMutationPayload,
  MusicMutationResult,
  MusicUserId,
  PlaylistId,
  ResolveTrackUrlPayload,
  ResolvedMediaSource,
  TrackId
} from '../schemas/music'
import type {
  PersistedPlaybackSnapshot,
  PlaybackSnapshotLoadPayload
} from '../schemas/playback-persistence'

// ========= 类型 =========

/** 可取消的运行时请求入参。 */
interface CancellableRuntimeInput {
  /** 调用方指定的 requestId，用于后续取消。 */
  requestId?: string
}

export interface NcxRuntimeBridge {
  waitUntilReady(timeoutMs?: number): Promise<boolean>
  ping(input?: { delayMs?: number; requestId?: string }): Promise<RuntimeResult<PingResult>>
  cancel(requestId: string): boolean
  snapshot(): Promise<RuntimeResult<UtilitySnapshot>>
  retryUtility(): Promise<RuntimeStatus>
  onStatus(listener: (status: RuntimeStatus) => void): () => void
  /** 低层标准 Music Service 只读入口，供 Agent/页面特殊场景复用 */
  readMusic(input: MusicReadPayload & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 低层标准 Music Service 写入入口；调用方必须显式处理失败且不得透明重试。 */
  mutateMusic(input: MusicMutationPayload & CancellableRuntimeInput): Promise<RuntimeResult<MusicMutationResult>>
  /** 搜索歌曲、歌手、专辑和歌单候选 */
  searchMusic(input: { query: string; limit?: number; offset?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准歌曲实体 */
  getSong(input: { id: TrackId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准歌词实体 */
  getLyrics(input: { id: TrackId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准歌手实体 */
  getArtist(input: { id: ArtistId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准专辑实体 */
  getAlbum(input: { id: AlbumId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准歌单实体 */
  getPlaylist(input: { id: PlaylistId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准用户实体 */
  getUser(input: { id: MusicUserId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取发现页平台推荐歌单。 */
  getFeaturedPlaylists(input?: { limit?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取发现页推荐新歌。 */
  getNewSongs(input?: { limit?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取登录账户每日推荐歌曲。 */
  getDailySongs(input?: { limit?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取用户歌单资产。 */
  getUserPlaylists(input: { userId: MusicUserId; limit?: number; offset?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取用户喜欢歌曲。 */
  getLikedSongs(input: { userId: MusicUserId; limit?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取歌手专辑列表。 */
  getArtistAlbums(input: { artistId: ArtistId; limit?: number; offset?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取相似歌手。 */
  getSimilarArtists(input: { artistId: ArtistId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 向 Utility 请求解析指定曲目的短期 HTTPS 播放 URL */
  resolveTrackUrl(
    input: ResolveTrackUrlPayload & { requestId?: string }
  ): Promise<RuntimeResult<ResolvedMediaSource>>
  /** 从 Utility 当前账户 SQLite 读取播放快照。 */
  loadPlaybackSnapshot(
    input: PlaybackSnapshotLoadPayload
  ): Promise<RuntimeResult<PersistedPlaybackSnapshot | null>>
  /** 通过 Utility 单写者保存当前账户播放快照。 */
  savePlaybackSnapshot(
    snapshot: PersistedPlaybackSnapshot
  ): Promise<RuntimeResult<{ savedAt: number }>>
  /** 访问当前账户偏好、Journal、统计与可重建缓存。 */
  accountData(input: AccountDataRequest): Promise<RuntimeResult<AccountDataResult>>
}
