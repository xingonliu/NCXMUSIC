import type { RuntimeStatus } from '../schemas/control-plane'
import type { PingResult, RuntimeResult, UtilitySnapshot } from '../schemas/runtime'
import type {
  AlbumId,
  ArtistId,
  MusicReadPayload,
  MusicReadResult,
  MusicUserId,
  PlaylistId,
  ResolveTrackUrlPayload,
  ResolvedMediaSource,
  TrackId
} from '../schemas/music'

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
  /** 搜索歌曲、歌手、专辑和歌单候选 */
  searchMusic(input: { query: string; limit?: number; offset?: number } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准歌曲实体 */
  getSong(input: { id: TrackId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准歌手实体 */
  getArtist(input: { id: ArtistId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准专辑实体 */
  getAlbum(input: { id: AlbumId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准歌单实体 */
  getPlaylist(input: { id: PlaylistId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 读取标准用户实体 */
  getUser(input: { id: MusicUserId } & CancellableRuntimeInput): Promise<RuntimeResult<MusicReadResult>>
  /** 向 Utility 请求解析指定曲目的短期 HTTPS 播放 URL */
  resolveTrackUrl(
    input: ResolveTrackUrlPayload & { requestId?: string }
  ): Promise<RuntimeResult<ResolvedMediaSource>>
}
