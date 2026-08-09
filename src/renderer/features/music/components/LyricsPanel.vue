<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { StandardLyrics, StandardLyricsLine } from '../../../../shared/schemas/music'
import {
  CommonEmptyState,
  CommonErrorState,
  CommonSpinner
} from '../../../design-system/components'
import { useAppPreferences } from '../../settings/app-preferences'

// ========= 属性 =========

/** 歌词面板属性。 */
const props = withDefaults(defineProps<{
  /** 当前曲目 ID。 */
  trackId: string | undefined
  /** 当前播放位置（毫秒）。 */
  positionMs: number
  /** 是否使用沉浸式大字号。 */
  immersive?: boolean
}>(), {
  immersive: false
})

// ========= 变量 =========

/** 应用歌词展示偏好。 */
const appPreferences = useAppPreferences()

/** 当前歌词实体。 */
const lyrics = ref<StandardLyrics | null>(null)

/** 当前加载状态。 */
const loading = ref<boolean>(false)

/** 当前错误文案。 */
const errorMessage = ref<string>('')

/** 最近一次歌词请求 ID，用于丢弃迟到响应。 */
let latestRequestId = ''

/** 当前高亮歌词行下标。 */
const activeLineIndex = computed<number>(() => {
  const lines = lyrics.value?.lines ?? []
  if (lines.length === 0) return -1

  let index = 0
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]
    if (!line || line.timeMs > props.positionMs + 220) break
    index = cursor
  }
  return index
})

/** 可展示歌词行。 */
const displayLines = computed<StandardLyricsLine[]>(() => lyrics.value?.lines ?? [])

// ========= 函数 =========

/**
 * 拉取当前曲目的标准歌词。
 *
 * @param trackId 当前曲目 ID
 */
async function loadLyrics(trackId: string | undefined): Promise<void> {
  lyrics.value = null
  errorMessage.value = ''

  if (!trackId) return

  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  loading.value = true

  try {
    const result = await window.ncx.runtime.getLyrics({ id: trackId, requestId })
    if (requestId !== latestRequestId) return
    if (!result.ok) {
      errorMessage.value = result.error.message
      return
    }
    if (result.data.kind !== 'lyrics') {
      errorMessage.value = '歌词响应类型不匹配。'
      return
    }
    lyrics.value = result.data.entity
  } finally {
    if (requestId === latestRequestId) loading.value = false
  }
}

/** 重试读取歌词。 */
function retryLyrics(): void {
  void loadLyrics(props.trackId)
}

// ========= 生命周期 =========

watch(() => props.trackId, (trackId) => {
  void loadLyrics(trackId)
}, { immediate: true })
</script>

<template>
  <section
    class="lyrics-panel"
    :class="{ 'lyrics-panel--immersive': props.immersive }"
    aria-label="歌词"
  >
    <div
      v-if="loading"
      class="lyrics-panel-loading"
    >
      <CommonSpinner
        size="default"
        label="正在加载歌词"
      />
      <span>正在加载歌词</span>
    </div>

    <CommonErrorState
      v-else-if="errorMessage"
      title="歌词读取失败"
      :description="errorMessage"
      @retry="retryLyrics"
    />

    <CommonEmptyState
      v-else-if="displayLines.length === 0"
      title="暂无歌词"
      description="当前歌曲没有可展示的时间轴歌词。"
    />

    <ol
      v-else
      class="lyrics-lines"
    >
      <li
        v-for="(line, index) in displayLines"
        :key="`${line.timeMs}-${index}`"
        class="lyrics-line"
        :class="{ 'lyrics-line--active': index === activeLineIndex }"
      >
        <span>{{ line.text || '…' }}</span>
        <small v-if="line.translation && appPreferences.preferences.value.showLyricTranslation">{{ line.translation }}</small>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.lyrics-panel {
  display: flex;
  min-height: 280px;
  flex-direction: column;
  justify-content: center;
}

.lyrics-panel-loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ncx-space-2);
  color: var(--ncx-color-text-secondary);
  font-size: 13px;
}

.lyrics-lines {
  display: grid;
  gap: var(--ncx-space-4);
  margin: 0;
  padding: var(--ncx-space-4) 0;
  list-style: none;
}

.lyrics-line {
  display: grid;
  gap: var(--ncx-space-1);
  color: var(--ncx-color-text-tertiary);
  font-size: 18px;
  line-height: 1.35;
  transition:
    color var(--ncx-motion-normal),
    transform var(--ncx-motion-normal);
}

.lyrics-line small {
  color: inherit;
  font-size: 13px;
  opacity: 0.72;
}

.lyrics-line--active {
  color: var(--ncx-color-text-primary);
  font-weight: 700;
  transform: translateX(4px);
}

.lyrics-panel--immersive {
  min-height: 520px;
}

.lyrics-panel--immersive .lyrics-lines {
  gap: var(--ncx-space-6);
}

.lyrics-panel--immersive .lyrics-line {
  font-size: 30px;
}

.lyrics-panel--immersive .lyrics-line small {
  font-size: 16px;
}
</style>
