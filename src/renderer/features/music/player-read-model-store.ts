import { defineStore } from 'pinia'
import { computed } from 'vue'

import { usePlayer } from './use-player'

// ========= Store =========

/** 播放器只读读模型 Store。 */
export const usePlayerReadModelStore = defineStore('player-read-model', () => {
  /** 播放器单例接口。 */
  const player = usePlayer()

  /** 合并后的播放器快照。 */
  const snapshot = computed(() => player.snapshot.value)

  /** 播放事实状态。 */
  const playback = computed(() => snapshot.value.playback)

  /** 队列事实状态。 */
  const queue = computed(() => snapshot.value.queue)

  /** 当前音质偏好。 */
  const quality = computed(() => snapshot.value.quality)

  /** 当前轻提示。 */
  const notice = computed(() => player.notice.value)

  return {
    snapshot,
    playback,
    queue,
    quality,
    notice
  }
})
