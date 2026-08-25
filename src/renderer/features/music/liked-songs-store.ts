import { readonly, ref, watch, type Ref } from 'vue'

import type { RuntimeResult } from '../../../shared/schemas/runtime'
import { useAccountSessionStore } from '../account/account-session-store'

// -- Type Definitions

/** 单次歌曲收藏切换成功后的状态。 */
export interface LikedSongToggleState {
  /** 写入后歌曲是否已收藏。 */
  readonly liked: boolean
}

/** 应用作用域歌曲收藏状态接口。 */
export interface LikedSongsStore {
  /** 当前账户完整收藏歌曲 ID 集合。 */
  readonly songIds: Readonly<Ref<ReadonlySet<string>>>
  /** 收藏状态是否正在读取。 */
  readonly loading: Readonly<Ref<boolean>>
  /** 判断歌曲是否已收藏。 */
  isLiked: (trackId: string) => boolean
  /** 判断歌曲收藏写入是否正在进行。 */
  isPending: (trackId: string) => boolean
  /** 初始化账户感知的收藏状态。 */
  initialize: () => Promise<void>
  /** 使用权威响应同步完整收藏歌曲 ID。 */
  synchronize: (trackIds: readonly string[]) => void
  /** 收藏或取消收藏歌曲。 */
  toggle: (trackId: string) => Promise<RuntimeResult<LikedSongToggleState> | null>
}

// -- State and Variables

/** 应用账户公开状态。 */
const account = useAccountSessionStore()

/** 当前账户完整收藏歌曲 ID 集合。 */
const likedSongIds = ref<ReadonlySet<string>>(new Set())

/** 正在执行收藏写入的歌曲 ID 集合。 */
const pendingSongIds = ref<ReadonlySet<string>>(new Set())

/** 收藏状态是否正在读取。 */
const loading = ref<boolean>(false)

/** 初始化任务，保证全应用只建立一个账户监听。 */
let initializePromise: Promise<void> | undefined

/** 最近一次账户收藏读取任务。 */
let refreshPromise: Promise<void> = Promise.resolve()

/** 收藏读取代次，用于丢弃账户切换后的迟到响应。 */
let refreshGeneration = 0

/** 账户状态监听清理函数。 */
let stopAccountWatch = (): void => {}

// -- Functions

/** 用不可变集合替换当前收藏歌曲 ID，确保所有消费组件同步更新。 */
function synchronizeLikedSongIds(trackIds: readonly string[]): void {
  likedSongIds.value = new Set(trackIds)
}

/** 判断指定歌曲是否已收藏。 */
function isLiked(trackId: string): boolean {
  return likedSongIds.value.has(trackId)
}

/** 判断指定歌曲是否正在执行收藏写入。 */
function isPending(trackId: string): boolean {
  return pendingSongIds.value.has(trackId)
}

/** 返回当前网易云账户与会话代次组合键。 */
function activeAccountKey(): string | null {
  const snapshot = account.snapshot.value
  const activeAccount = snapshot?.activeAccount
  if (snapshot?.state !== 'authenticated' || activeAccount?.kind !== 'netease') return null
  return `${activeAccount.neteaseUserId}:${snapshot.accountGeneration}`
}

/** 更新单首歌曲的收藏状态。 */
function updateLikedSong(trackId: string, liked: boolean): void {
  const nextIds = new Set(likedSongIds.value)
  if (liked) nextIds.add(trackId)
  else nextIds.delete(trackId)
  likedSongIds.value = nextIds
}

/** 更新单首歌曲的写入忙碌状态。 */
function updatePendingSong(trackId: string, pending: boolean): void {
  const nextIds = new Set(pendingSongIds.value)
  if (pending) nextIds.add(trackId)
  else nextIds.delete(trackId)
  pendingSongIds.value = nextIds
}

/** 按当前账户读取完整收藏歌曲 ID，并丢弃账户切换前的迟到响应。 */
async function refreshLikedSongIds(): Promise<void> {
  const generation = ++refreshGeneration
  const snapshot = account.snapshot.value
  const activeAccount = snapshot?.activeAccount
  synchronizeLikedSongIds([])
  if (
    snapshot?.state !== 'authenticated' ||
    activeAccount?.kind !== 'netease'
  ) {
    loading.value = false
    return
  }

  loading.value = true
  const response = await window.ncx.runtime.getLikedSongs({
    userId: activeAccount.neteaseUserId,
    limit: 1
  })
  if (generation !== refreshGeneration) return
  loading.value = false
  if (!response.ok) return

  const result = response.data
  if (result.kind !== 'songCollection' || result.collection !== 'liked') return
  synchronizeLikedSongIds(result.songIds ?? result.songs.map((song) => song.id))
}

/** 建立账户感知的全局收藏状态。 */
async function initializeLikedSongsStore(): Promise<void> {
  if (initializePromise) return initializePromise
  initializePromise = (async () => {
    await account.initialize()
    if (!account.snapshot.value) await account.refresh()
    stopAccountWatch = watch(
      () => {
        const snapshot = account.snapshot.value
        const activeAccount = snapshot?.activeAccount
        return [
          snapshot?.state,
          activeAccount?.kind === 'netease' ? activeAccount.neteaseUserId : null,
          snapshot?.accountGeneration
        ] as const
      },
      () => {
        refreshPromise = refreshLikedSongIds()
      },
      { immediate: true }
    )
    await refreshPromise
  })()
  return initializePromise
}

/** 收藏或取消收藏歌曲，并在成功后同步所有歌曲入口。 */
async function toggleLikedSong(
  trackId: string
): Promise<RuntimeResult<LikedSongToggleState> | null> {
  await initializeLikedSongsStore()
  if (loading.value || isPending(trackId)) return null

  const liked = !isLiked(trackId)
  const accountKey = activeAccountKey()
  updatePendingSong(trackId, true)
  try {
    const response = await window.ncx.runtime.mutateMusic({
      operation: 'likeTrack',
      trackId,
      liked
    })
    if (accountKey !== activeAccountKey()) return null
    if (!response.ok) return response
    updateLikedSong(trackId, liked)
    return { ok: true, data: { liked } }
  } finally {
    updatePendingSong(trackId, false)
  }
}

/** 释放全局收藏状态，仅供测试和应用退出使用。 */
export function disposeLikedSongsStore(): void {
  stopAccountWatch()
  stopAccountWatch = (): void => {}
  refreshGeneration += 1
  refreshPromise = Promise.resolve()
  initializePromise = undefined
  synchronizeLikedSongIds([])
  pendingSongIds.value = new Set()
  loading.value = false
}

/** 使用应用作用域歌曲收藏状态。 */
export function useLikedSongsStore(): LikedSongsStore {
  return {
    songIds: readonly(likedSongIds),
    loading: readonly(loading),
    isLiked,
    isPending,
    initialize: initializeLikedSongsStore,
    synchronize: synchronizeLikedSongIds,
    toggle: toggleLikedSong
  }
}
