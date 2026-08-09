<script setup lang="ts">
import { Maximize2 } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { CommonButton, CommonEmptyState } from '../../design-system/components'
import LyricsPanel from './components/LyricsPanel.vue'
import Cover from './components/Cover.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** Router 实例，用于进入沉浸歌词页。 */
const router = useRouter()

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

/** 当前队列预览。 */
const queuePreview = computed(() => snapshot.value.queue.items.slice(0, 5))

// ========= 函数 =========

/** 打开沉浸歌词页。 */
function openImmersiveLyrics(): void {
  void router.push({ name: 'immersive-lyrics' })
}
</script>

<template>
  <section class="playback-detail-page" aria-labelledby="playback-detail-title">
    <CommonEmptyState
      v-if="!track"
      title="还没有播放内容"
      description="去搜索页找一首歌开始播放。"
    />

    <template v-else>
      <div class="playback-detail-hero">
        <Cover
          :src="artworkUrl"
          :alt="track.name"
          size="hero"
          always-show-shadow
          :show-play-button="false"
        />
        <div class="playback-detail-copy">
          <p class="music-page-eyebrow">正在播放</p>
          <h1 id="playback-detail-title">{{ track.name }}</h1>
          <p>{{ artistText }} · {{ track.album }}</p>
          <PlaybackControls prominent />
        </div>
      </div>

      <div class="playback-detail-grid">
        <article class="playback-panel playback-panel--lyrics">
          <header class="playback-panel-header">
            <h2>歌词</h2>
            <CommonButton variant="ghost" size="compact" @click="openImmersiveLyrics">
              <Maximize2 :size="14" />
              沉浸歌词
            </CommonButton>
          </header>
          <LyricsPanel :track-id="track.trackId" :position-ms="snapshot.playback.positionMs" />
        </article>

        <aside class="playback-panel playback-panel--queue">
          <h2>队列</h2>
          <ol class="playback-queue-list">
            <li
              v-for="item in queuePreview"
              :key="item.queueItemId"
              :class="{ 'playback-queue-item--active': item.queueItemId === snapshot.queue.currentItemId }"
            >
              <span>{{ item.track.name }}</span>
              <small>{{ item.track.artists.join(' / ') }}</small>
            </li>
          </ol>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.playback-detail-page {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  padding: 72px 0 96px;
}

.playback-detail-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--ncx-space-10);
  align-items: end;
}

.playback-detail-copy {
  display: grid;
  gap: var(--ncx-space-4);
}

.music-page-eyebrow {
  margin: 0;
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.playback-detail-copy h1 {
  margin: 0;
  font-size: 46px;
  line-height: 1.06;
}

.playback-detail-copy p:not(.music-page-eyebrow) {
  margin: 0;
  color: var(--ncx-color-text-secondary);
}

.playback-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--ncx-space-4);
  margin-top: var(--ncx-space-10);
}

.playback-panel {
  min-height: 320px;
  padding: var(--ncx-space-6);
  border-radius: var(--ncx-radius-xl);
  background: var(--ncx-color-surface);
  box-shadow: var(--ncx-shadow-elevation-1);
}

.playback-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ncx-space-3);
}

.playback-panel h2 {
  margin: 0;
  font-size: 18px;
}

.playback-queue-list {
  display: grid;
  gap: var(--ncx-space-2);
  margin: var(--ncx-space-4) 0 0;
  padding: 0;
  list-style: none;
}

.playback-queue-list li {
  display: grid;
  gap: 2px;
  padding: var(--ncx-space-2);
  border-radius: var(--ncx-radius-md);
}

.playback-queue-item--active {
  color: var(--ncx-color-accent);
  background: color-mix(in srgb, var(--ncx-color-accent) 12%, transparent);
}

.playback-queue-list span,
.playback-queue-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playback-queue-list small {
  color: var(--ncx-color-text-secondary);
}
</style>
