<script setup lang="ts">
import { ChevronDown, ChevronUp, FolderPlus, Heart, ListPlus, Play, Trash2 } from '@lucide/vue'
import { computed } from 'vue'

import type { StandardSong } from '../../../../shared/schemas/music'
import {
  CommonContextMenu,
  CommonIconButton,
  type CommonMenuItem
} from '../../../design-system/components'
import { formatMusicDuration } from '../music-entity'
import { copyText } from '../../foundation/clipboard'
import MediaArtwork from './MediaArtwork.vue'

// ========= 属性与事件 =========

/** 歌曲行属性。 */
const props = withDefaults(defineProps<{
  /** 标准歌曲实体。 */
  song: StandardSong
  /** 当前歌曲在列表中的序号。 */
  index: number | undefined
  /** 是否为当前播放歌曲。 */
  active?: boolean
  /** 是否展示封面。 */
  showArtwork?: boolean
  /** 是否展示自建歌单歌曲管理动作。 */
  playlistManagement?: boolean
  /** 是否暂时禁用歌单歌曲管理动作。 */
  managementBusy?: boolean
  /** 当前歌曲是否位于歌单首项。 */
  firstInPlaylist?: boolean
  /** 当前歌曲是否位于歌单末项。 */
  lastInPlaylist?: boolean
  /** 当前歌曲是否已收藏。 */
  liked?: boolean
}>(), {
  active: false,
  showArtwork: true,
  playlistManagement: false,
  managementBusy: false,
  firstInPlaylist: false,
  lastInPlaylist: false,
  liked: false
})

/** 歌曲行事件。 */
const emit = defineEmits<{
  (event: 'play', song: StandardSong): void
  (event: 'enqueue', song: StandardSong): void
  (event: 'play-next', song: StandardSong): void
  (event: 'like', song: StandardSong): void
  (event: 'add-to-playlist', song: StandardSong): void
  (event: 'details', song: StandardSong): void
  (event: 'give-agent', song: StandardSong): void
  (event: 'move-up', song: StandardSong): void
  (event: 'move-down', song: StandardSong): void
  (event: 'remove', song: StandardSong): void
}>()

// ========= 变量 =========

/** 歌手展示文本。 */
const artistText = computed<string>(() => {
  return props.song.artists.map((artist) => artist.name).join(' / ') || '未知歌手'
})

/** 专辑展示文本。 */
const albumText = computed<string>(() => props.song.album?.name ?? '未知专辑')

/** 展示用曲目时长。 */
const durationText = computed<string>(() => formatMusicDuration(props.song.durationMs))

/** 是否需要展示 VIP 标签。 */
const hasVipBadge = computed<boolean>(() => props.song.access.badges.includes('vip'))

/** 是否需要展示付费标签。 */
const hasPaidBadge = computed<boolean>(() => props.song.access.badges.includes('paid'))

/** 当前歌曲右键菜单，按冻结矩阵提供首批通用动作。 */
const contextMenuItems = computed<CommonMenuItem[]>(() => {
  /** 当前歌曲可用的通用上下文动作。 */
  const items: CommonMenuItem[] = [
    { value: 'play', label: '立即播放' },
    { value: 'play-next', label: '下一首播放' },
    { value: 'enqueue', label: '添加到队列末尾' },
    { value: 'separator-a', type: 'separator' },
    { value: 'like', label: props.liked ? '取消收藏' : '收藏' },
    { value: 'add-to-playlist', label: '添加到歌单' },
    { value: 'details', label: '查看歌曲详情' },
    { value: 'give-agent', label: '交给 Agent' },
    { value: 'copy-link', label: '复制网易云歌曲链接' }
  ]
  if (props.playlistManagement) {
    items.push(
      { value: 'separator-management', type: 'separator' },
      {
        value: 'move-up',
        label: '上移一位',
        disabled: props.managementBusy || props.firstInPlaylist
      },
      {
        value: 'move-down',
        label: '下移一位',
        disabled: props.managementBusy || props.lastInPlaylist
      },
      {
        value: 'remove',
        label: '从当前歌单移除',
        danger: true,
        disabled: props.managementBusy
      }
    )
  }
  return items
})

// ========= 函数 =========

/** 播放当前行歌曲。 */
function handlePlay(): void {
  emit('play', props.song)
}

/** 把当前行歌曲追加到队列。 */
function handleEnqueue(event: MouseEvent): void {
  event.stopPropagation()
  emit('enqueue', props.song)
}

/** 执行当前歌曲右键菜单动作。 */
function handleContextAction(value: string | number): void {
  /** 统一转换后的上下文动作标识。 */
  const action = String(value)
  if (action === 'play') emit('play', props.song)
  else if (action === 'play-next') emit('play-next', props.song)
  else if (action === 'enqueue') emit('enqueue', props.song)
  else if (action === 'like') emit('like', props.song)
  else if (action === 'add-to-playlist') emit('add-to-playlist', props.song)
  else if (action === 'details') emit('details', props.song)
  else if (action === 'give-agent') emit('give-agent', props.song)
  else if (action === 'move-up') emit('move-up', props.song)
  else if (action === 'move-down') emit('move-down', props.song)
  else if (action === 'remove') emit('remove', props.song)
  else if (action === 'copy-link') {
    void copyText(
      `https://music.163.com/song?id=${props.song.id}`,
      '歌曲链接已复制。'
    )
  }
}
</script>

<template>
  <CommonContextMenu
    class="track-row-context"
    :items="contextMenuItems"
    @select="handleContextAction"
  >
    <article
      class="track-row"
      :class="{
        'track-row--active': props.active,
        'track-row--manageable': props.playlistManagement
      }"
      role="button"
      tabindex="0"
      @click="handlePlay"
      @keydown.enter.prevent="handlePlay"
      @keydown.space.prevent="handlePlay"
    >
      <span class="track-row-index">
        {{ props.index !== undefined ? props.index + 1 : '' }}
      </span>

      <MediaArtwork
        v-if="props.showArtwork"
        :src="props.song.album?.artworkUrl"
        :alt="props.song.name"
        size="thumbnail"
      />

      <div class="track-row-main">
        <div class="track-row-title-line">
          <h3>{{ props.song.name }}</h3>
          <span
            v-if="hasVipBadge"
            class="track-row-badge track-row-badge--vip"
          >VIP</span>
          <span
            v-if="hasPaidBadge"
            class="track-row-badge track-row-badge--paid"
          >付费</span>
        </div>
        <p>{{ artistText }}</p>
      </div>

      <p class="track-row-album">
        {{ albumText }}
      </p>

      <span class="track-row-duration">
        {{ durationText }}
      </span>

      <div class="track-row-actions">
        <CommonIconButton
          size="compact"
          variant="ghost"
          label="播放"
          @click.stop="handlePlay"
        >
          <Play
            :size="13"
            fill="currentColor"
          />
        </CommonIconButton>
        <CommonIconButton
          size="compact"
          variant="ghost"
          label="加入队列"
          @click="handleEnqueue"
        >
          <ListPlus :size="13" />
        </CommonIconButton>
        <CommonIconButton
          size="compact"
          variant="ghost"
          :label="props.liked ? '取消收藏' : '收藏'"
          @click.stop="emit('like', props.song)"
        >
          <Heart
            :size="13"
            :fill="props.liked ? 'currentColor' : 'none'"
          />
        </CommonIconButton>
        <CommonIconButton
          size="compact"
          variant="ghost"
          label="添加到歌单"
          @click.stop="emit('add-to-playlist', props.song)"
        >
          <FolderPlus :size="13" />
        </CommonIconButton>
        <template v-if="props.playlistManagement">
          <CommonIconButton
            size="compact"
            variant="ghost"
            label="上移一位"
            :disabled="props.managementBusy || props.firstInPlaylist"
            @click.stop="emit('move-up', props.song)"
          >
            <ChevronUp :size="13" />
          </CommonIconButton>
          <CommonIconButton
            size="compact"
            variant="ghost"
            label="下移一位"
            :disabled="props.managementBusy || props.lastInPlaylist"
            @click.stop="emit('move-down', props.song)"
          >
            <ChevronDown :size="13" />
          </CommonIconButton>
          <CommonIconButton
            size="compact"
            variant="ghost"
            label="从当前歌单移除"
            :disabled="props.managementBusy"
            @click.stop="emit('remove', props.song)"
          >
            <Trash2 :size="13" />
          </CommonIconButton>
        </template>
      </div>
    </article>
  </CommonContextMenu>
</template>

<style scoped>
.track-row {
  display: grid;
  min-height: 56px;
  align-items: center;
  grid-template-columns: 32px auto minmax(180px, 1.5fr) minmax(120px, 1fr) 54px 92px;
  gap: var(--ncx-space-3);
  padding: var(--ncx-space-2) var(--ncx-space-3);
  border-radius: var(--ncx-radius-md);
  cursor: pointer;
  transition:
    background-color var(--ncx-motion-fast),
    color var(--ncx-motion-fast);
}

.track-row--manageable {
  grid-template-columns: 32px auto minmax(150px, 1.5fr) minmax(100px, 1fr) 54px 164px;
}

.track-row-context {
  display: block;
}

.track-row:hover,
.track-row:focus-visible {
  background: color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent);
  outline: none;
}

.track-row--active {
  background: color-mix(in srgb, var(--ncx-color-accent) 12%, transparent);
}

.track-row-index,
.track-row-duration,
.track-row-album {
  overflow: hidden;
  color: var(--ncx-color-text-tertiary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row-index,
.track-row-duration {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.track-row-main {
  min-width: 0;
}

.track-row-title-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ncx-space-2);
}

.track-row h3,
.track-row p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-row h3 {
  color: var(--ncx-color-text-primary);
  font-size: 14px;
  font-weight: 650;
}

.track-row p {
  margin-top: 2px;
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
}

.track-row-badge {
  flex-shrink: 0;
  padding: 2px 5px;
  border-radius: var(--ncx-radius-xs);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.track-row-badge--vip {
  color: var(--ncx-color-vip);
  background: color-mix(in srgb, var(--ncx-color-vip) 14%, transparent);
}

.track-row-badge--paid {
  color: var(--ncx-color-paid);
  background: color-mix(in srgb, var(--ncx-color-paid) 16%, transparent);
}

.track-row-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ncx-space-1);
  opacity: 0;
  transition: opacity var(--ncx-motion-fast);
}

.track-row:hover .track-row-actions,
.track-row:focus-within .track-row-actions {
  opacity: 1;
}
</style>
