<script setup lang="ts">
import { computed } from 'vue'

import { CommonEmptyState } from '../../design-system/components'
import LyricsPanel from './components/LyricsPanel.vue'
import MediaArtwork from './components/MediaArtwork.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** 播放器接口。 */
const player = usePlayer()

/** 播放器快照。 */
const snapshot = player.snapshot

/** 当前曲目摘要。 */
const track = computed(() => snapshot.value.playback.track)

/** 当前曲目封面。 */
const artworkUrl = computed<string | undefined>(() => track.value?.artwork?.at(-1)?.src)

/** 歌手展示文本。 */
const artistText = computed<string>(() => track.value?.artists.join(' / ') ?? '')
</script>

<template>
  <section class="immersive-lyrics-page" aria-labelledby="immersive-lyrics-title">
    <CommonEmptyState
      v-if="!track"
      title="还没有歌词"
      description="开始播放歌曲后再进入沉浸歌词。"
    />

    <template v-else>
      <div class="immersive-backdrop" aria-hidden="true">
        <MediaArtwork :src="artworkUrl" :alt="track.name" size="hero" />
      </div>

      <div class="immersive-shell">
        <aside class="immersive-now-playing">
          <MediaArtwork :src="artworkUrl" :alt="track.name" size="card" />
          <div>
            <p class="music-page-eyebrow">沉浸歌词</p>
            <h1 id="immersive-lyrics-title">{{ track.name }}</h1>
            <p>{{ artistText }} · {{ track.album }}</p>
          </div>
          <PlaybackControls />
        </aside>

        <LyricsPanel
          class="immersive-lyrics-panel"
          immersive
          :track-id="track.trackId"
          :position-ms="snapshot.playback.positionMs"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.immersive-lyrics-page {
  position: relative;
  min-height: calc(100vh - 96px);
  overflow: hidden;
  padding: 68px 48px 84px;
}

.immersive-backdrop {
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0.18;
  filter: blur(28px) saturate(1.25);
  transform: scale(1.18);
}

.immersive-shell {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: var(--ncx-space-10);
  align-items: center;
  width: min(1180px, 100%);
  margin: 0 auto;
}

.immersive-now-playing {
  display: grid;
  gap: var(--ncx-space-5);
  align-content: center;
}

.music-page-eyebrow {
  margin: 0;
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.immersive-now-playing h1 {
  margin: var(--ncx-space-2) 0;
  font-size: 32px;
  line-height: 1.12;
}

.immersive-now-playing p:not(.music-page-eyebrow) {
  margin: 0;
  color: var(--ncx-color-text-secondary);
}

.immersive-lyrics-panel {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding-right: var(--ncx-space-4);
}
</style>
