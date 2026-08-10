<script setup lang="ts">
import { Maximize2, Music2 } from '@lucide/vue'
import { computed } from 'vue'

import { CommonButton, CommonEmptyState } from '../../design-system/components'
import Cover from './components/Cover.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import { useImmersivePlayerPresentation } from './immersive-player-presentation'
import { usePlayer } from './use-player'

// ========= 变量 =========

/** 全局播放器接口。 */
const player = usePlayer()

/** 沉浸歌词展示控制器。 */
const immersivePlayer = useImmersivePlayerPresentation()

/** 当前播放曲目。 */
const track = computed(() => player.snapshot.value.playback.track)

/** 当前曲目的歌手展示文本。 */
const artistText = computed<string>(() => track.value?.artists.join(' / ') || '未知歌手')

/** 当前曲目首选公开封面地址。 */
const artworkUrl = computed<string | undefined>(() => track.value?.artwork?.[0]?.src)

// ========= 函数 =========

/** 打开具有正式路由的沉浸歌词页。 */
function openImmersiveLyrics(event: MouseEvent): void {
  const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  void immersivePlayer.open(artworkUrl.value, trigger)
}
</script>

<template>
  <section class="playback-detail-page" aria-labelledby="playback-detail-title">
    <template v-if="track">
      <Cover :src="artworkUrl" :alt="track.name" size="hero" />
      <div class="playback-detail-copy">
        <p>正在播放</p>
        <h1 id="playback-detail-title">{{ track.name }}</h1>
        <h2>{{ artistText }}</h2>
        <PlaybackControls />
        <CommonButton variant="secondary" @click="openImmersiveLyrics">
          <Maximize2 :size="15" />
          打开沉浸歌词
        </CommonButton>
      </div>
    </template>
    <CommonEmptyState
      v-else
      title="尚未播放歌曲"
      description="从发现、搜索或音乐库选择一首歌曲。"
    >
      <template #icon><Music2 :size="28" /></template>
    </CommonEmptyState>
  </section>
</template>

<style scoped>
.playback-detail-page {
  display: grid;
  width: min(920px, calc(100% - 48px));
  min-height: calc(100vh - 180px);
  margin: 0 auto;
  padding: 84px 0 144px;
  align-items: center;
  grid-template-columns: minmax(260px, 420px) minmax(260px, 1fr);
  gap: clamp(32px, 7vw, 88px);
}

.playback-detail-copy {
  display: grid;
  justify-items: start;
  gap: var(--ncx-space-3);
}

.playback-detail-copy p,
.playback-detail-copy h1,
.playback-detail-copy h2 {
  margin: 0;
}

.playback-detail-copy p {
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.playback-detail-copy h1 { font-size: clamp(32px, 5vw, 56px); }
.playback-detail-copy h2 { color: var(--ncx-color-text-secondary); font-size: 18px; }

@media (max-width: 720px) {
  .playback-detail-page { grid-template-columns: 1fr; }
}
</style>
