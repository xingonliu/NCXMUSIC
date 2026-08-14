import type {
  StandardAlbum,
  StandardPlaylist,
  StandardSong
} from '../../../shared/schemas/music'
import type { TrackArtwork, TrackSummary } from '../../../domains/player/types'

// ========= 类型 =========

/** 封面语义尺寸。 */
export type MediaArtworkSize = 'backdrop' | 'thumbnail' | 'compact' | 'card' | 'feature' | 'hero'

/** 可播放集合实体。 */
export type PlayableCollection = StandardAlbum | StandardPlaylist

// ========= 变量 =========

/** 语义尺寸对应的网易云封面边长。 */
const ARTWORK_PIXEL_SIZE: Record<MediaArtworkSize, number> = {
  backdrop: 40,
  thumbnail: 96,
  compact: 160,
  card: 320,
  feature: 640,
  hero: 1024
}

// ========= 函数 =========

/**
 * 为网易云图片 URL 增加语义尺寸参数。
 *
 * @param url 原始图片 URL
 * @param size 封面语义尺寸
 */
export function adaptArtworkUrl(url: string | undefined, size: MediaArtworkSize): string | undefined {
  if (!url) return undefined
  const pixelSize = ARTWORK_PIXEL_SIZE[size]
  try {
    const parsed = new URL(url)
    /** 网易云 CDN 复合查询串包含嵌套 imageView/watermark 参数，重新序列化会破坏其语义。 */
    const isNeteaseArtwork = /(?:^|\.)music\.126\.net$/iu.test(parsed.hostname)
    if (isNeteaseArtwork) {
      parsed.protocol = 'https:'
      parsed.search = ''
    }
    parsed.searchParams.set('param', `${pixelSize}y${pixelSize}`)
    return parsed.toString()
  } catch {
    return undefined
  }
}

/**
 * 生成播放器和系统媒体中心可消费的封面候选。
 *
 * @param artworkUrl 标准实体封面 URL
 */
export function buildTrackArtwork(artworkUrl: string | undefined): TrackArtwork[] | undefined {
  if (!artworkUrl) return undefined
  return [
    { src: adaptArtworkUrl(artworkUrl, 'thumbnail') ?? artworkUrl, sizes: '96x96', type: 'image/jpeg' },
    { src: adaptArtworkUrl(artworkUrl, 'hero') ?? artworkUrl, sizes: '512x512', type: 'image/jpeg' }
  ]
}

/**
 * 把标准歌曲实体转为播放器队列摘要。
 *
 * @param song 标准歌曲实体
 */
export function standardSongToTrackSummary(song: StandardSong): TrackSummary {
  /** 当前歌曲封面候选。 */
  const artwork = buildTrackArtwork(song.album?.artworkUrl)

  return {
    trackId: song.id,
    name: song.name,
    artists: song.artists.map((artist) => artist.name),
    album: song.album?.name ?? '',
    ...(artwork ? { artwork } : {}),
    durationMs: song.durationMs ?? null
  }
}

/**
 * 把标准歌曲列表批量转为播放器队列摘要。
 *
 * @param songs 标准歌曲实体列表
 */
export function standardSongsToTrackSummaries(songs: StandardSong[]): TrackSummary[] {
  return songs.map(standardSongToTrackSummary)
}

/**
 * 格式化歌曲时长。
 *
 * @param durationMs 歌曲时长（毫秒）
 */
export function formatMusicDuration(durationMs: number | undefined | null): string {
  if (!durationMs || !Number.isFinite(durationMs)) return '--:--'
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * 读取集合中可播放的歌曲列表。
 *
 * @param collection 标准专辑或歌单实体
 */
export function collectionSongs(collection: PlayableCollection): StandardSong[] {
  return collection.songs
}
