import type {
  MusicMutationPayload,
  MusicMutationResult,
  StandardSong
} from '../../../shared/schemas/music'
import type { RuntimeResult } from '../../../shared/schemas/runtime'
import type { QueueSource } from '../../../domains/player/types'
import { standardSongToTrackSummary } from './music-entity'
import { usePlayer } from './use-player'

// ========= 函数 =========

/** 执行一次显式音乐写入并原样返回标准协议结果。 */
export async function mutateMusic(
  payload: MusicMutationPayload
): Promise<RuntimeResult<MusicMutationResult>> {
  return window.ncx.runtime.mutateMusic(payload)
}

/** 把单首歌曲插入当前项之后。 */
export function playSongNext(song: StandardSong, source: QueueSource): void {
  const player = usePlayer()
  player.playNext([standardSongToTrackSummary(song)], source)
}

/** 把单首歌曲追加到当前队列末尾。 */
export function enqueueSong(song: StandardSong, source: QueueSource): void {
  const player = usePlayer()
  player.enqueue([standardSongToTrackSummary(song)], source)
}
