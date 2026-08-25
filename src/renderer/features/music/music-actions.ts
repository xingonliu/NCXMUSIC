import type {
  MusicMutationPayload,
  MusicMutationResult,
  StandardSong
} from '../../../shared/schemas/music'
import type { RuntimeResult } from '../../../shared/schemas/runtime'
import type { QueueSource } from '../../../domains/player/types'
import { showToast } from '../../design-system/use-toast'
import { translatePublicError } from '../../i18n'
import { useLikedSongsStore } from './liked-songs-store'
import { standardSongToTrackSummary } from './music-entity'
import { usePlayer } from './use-player'

// ========= 函数 =========

/** 执行一次显式音乐写入并原样返回标准协议结果。 */
export async function mutateMusic(
  payload: MusicMutationPayload
): Promise<RuntimeResult<MusicMutationResult>> {
  return window.ncx.runtime.mutateMusic(payload)
}

/** 切换歌曲收藏状态，并统一同步全局状态与操作反馈。 */
export async function toggleSongLike(
  song: Pick<StandardSong, 'id' | 'name'>
): Promise<boolean | undefined> {
  const response = await useLikedSongsStore().toggle(song.id)
  if (!response) return undefined
  if (!response.ok) {
    showToast(translatePublicError(response.error), 'warning')
    return undefined
  }
  showToast(
    response.data.liked ? `已收藏《${song.name}》。` : `已取消收藏《${song.name}》。`,
    response.data.liked ? 'success' : 'info'
  )
  return response.data.liked
}

/** 把单首歌曲插入当前项之后。 */
export function playSongNext(song: StandardSong, source: QueueSource): void {
  const player = usePlayer()
  player.playNext([standardSongToTrackSummary(song)], source)
}
