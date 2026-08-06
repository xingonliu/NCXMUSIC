<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────────────
// QueueDrawer：播放队列抽屉组件
//
// 展示当前播放队列中歌曲列表、切换模式、删除队列项以及清空队列。
// 遵循 Vue3 Composition API + TypeScript 规范，变量与函数清晰分区并编写注释。
// ─────────────────────────────────────────────────────────────────────────────

import { Play, Repeat, Repeat1, Shuffle, Trash2, Volume2, X } from '@lucide/vue'
import { computed } from 'vue'

import type { PlayMode, QueueItem } from '../../../../domains/player/types'
import {
  CommonButton,
  CommonDrawer,
  CommonIconButton
} from '../../../design-system/components'
import { zhCN } from '../../../locales/zh-CN'
import { usePlayer } from '../use-player'

// ========= 属性与事件 =========

/** 抽屉显示状态与事件控制定义。 */
const props = defineProps<{
  /** 抽屉是否可见。 */
  visible: boolean
}>()

/** 事件派发：关闭抽屉。 */
const emit = defineEmits<{
  (e: 'close'): void
}>()

// ========= 变量 =========

/** 播放器组合式接口。 */
const player = usePlayer()

/** 播放器只读快照引用。 */
const snapshot = player.snapshot

/** PlayerBar 本地化文案集合。 */
const text = zhCN.player

/** 播放队列列表。 */
const queueItems = computed<QueueItem[]>(() => snapshot.value.queue.items)

/** 队列项数量。 */
const queueCount = computed<number>(() => queueItems.value.length)

/** 当前播放队列项 ID。 */
const currentItemId = computed<string | null>(() => snapshot.value.queue.currentItemId)

/** 当前播放模式。 */
const currentMode = computed<PlayMode>(() => snapshot.value.queue.mode)

/** 播放模式循环顺序。 */
const MODE_CYCLE: PlayMode[] = ['loop', 'loop-one', 'shuffle']

/** 下一个播放模式。 */
const nextMode = computed<PlayMode>(() => {
  const index = MODE_CYCLE.indexOf(currentMode.value)
  return MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? 'loop'
})

/** 抽屉标题：包含动态歌曲数量。 */
const drawerTitle = computed<string>(() => {
  return queueCount.value > 0 ? `${text.queueTitle} (${queueCount.value})` : text.queueTitle
})

// ========= 函数 =========

/**
 * 点击切换到指定队列项播放。
 *
 * @param itemId 队列项唯一 ID
 */
async function handlePlayItem(itemId: string): Promise<void> {
  await player.playQueueItem(itemId)
}

/**
 * 移出单个队列项。
 *
 * @param itemId 队列项唯一 ID
 * @param event 鼠标点击事件，阻止事件冒泡
 */
async function handleRemoveItem(itemId: string, event: MouseEvent): Promise<void> {
  event.stopPropagation()
  await player.remove(itemId)
}

/**
 * 清空整个播放队列。
 */
async function handleClearQueue(): Promise<void> {
  await player.clear()
}

/**
 * 切换播放模式。
 */
async function handleToggleMode(): Promise<void> {
  await player.setMode(nextMode.value)
}

/**
 * 关闭抽屉通知事件。
 */
function handleClose(): void {
  emit('close')
}
</script>

<template>
  <CommonDrawer
    :visible="props.visible"
    :title="drawerTitle"
    width="380px"
    placement="right"
    @close="handleClose"
  >
    <!-- Header 额外操作按钮区 -->
    <template #headerActions>
      <div class="queue-drawer-header-actions">
        <CommonIconButton
          size="compact"
          variant="ghost"
          :label="text.mode[currentMode]"
          @click="handleToggleMode"
        >
          <Shuffle
            v-if="currentMode === 'shuffle'"
            :size="14"
          />
          <Repeat1
            v-else-if="currentMode === 'loop-one'"
            :size="14"
          />
          <Repeat
            v-else
            :size="14"
          />
        </CommonIconButton>

        <CommonButton
          v-if="queueCount > 0"
          size="compact"
          variant="ghost"
          class="queue-clear-button"
          @click="handleClearQueue"
        >
          {{ text.clearQueue }}
        </CommonButton>
      </div>
    </template>

    <!-- 队列内容区 -->
    <div class="queue-drawer-body">
      <ul
        v-if="queueCount > 0"
        class="queue-list"
        role="list"
      >
        <li
          v-for="(item, index) in queueItems"
          :key="item.queueItemId"
          class="queue-item"
          :class="{ 'queue-item--active': item.queueItemId === currentItemId }"
          role="listitem"
          @click="handlePlayItem(item.queueItemId)"
        >
          <!-- 播放指示/序号 -->
          <div class="queue-item-indicator">
            <Volume2
              v-if="item.queueItemId === currentItemId"
              :size="14"
              class="queue-playing-icon"
            />
            <span
              v-else
              class="queue-item-index"
            >{{ index + 1 }}</span>
          </div>

          <!-- 曲目与歌手信息 -->
          <div class="queue-item-info">
            <p class="queue-item-name">
              {{ item.track.name }}
            </p>
            <p class="queue-item-artist">
              {{ item.track.artists.join(' / ') }}
            </p>
          </div>

          <!-- 移出动作按钮 -->
          <div class="queue-item-actions">
            <CommonIconButton
              size="compact"
              variant="ghost"
              :label="text.removeTrack"
              class="queue-item-remove-btn"
              @click="(e: MouseEvent) => handleRemoveItem(item.queueItemId, e)"
            >
              <Trash2 :size="13" />
            </CommonIconButton>
          </div>
        </li>
      </ul>

      <!-- 队列为空状态 -->
      <div
        v-else
        class="queue-empty"
      >
        <p class="queue-empty-text">
          {{ text.queueEmpty }}
        </p>
      </div>
    </div>
  </CommonDrawer>
</template>

<style scoped>
.queue-drawer-header-actions {
  display: flex;
  gap: var(--ncx-space-2, 8px);
  align-items: center;
}

.queue-clear-button {
  color: var(--ncx-color-text-secondary);
  font-size: 12px;
}

.queue-drawer-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 8px 12px;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.queue-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--ncx-radius-medium, 8px);
  cursor: pointer;
  user-select: none;
  transition: background-color var(--ncx-motion-fast, 150ms ease);
}

.queue-item:hover {
  background: color-mix(in srgb, var(--ncx-color-text-primary) 6%, transparent);
}

.queue-item--active {
  background: color-mix(in srgb, var(--ncx-color-accent) 12%, transparent);
}

.queue-item--active .queue-item-name {
  color: var(--ncx-color-accent);
  font-weight: 600;
}

.queue-item-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
}

.queue-playing-icon {
  color: var(--ncx-color-accent);
  animation: queue-pulse 1.2s ease-in-out infinite alternate;
}

.queue-item-index {
  color: var(--ncx-color-text-tertiary, #8e8e93);
  font-size: 12px;
}

.queue-item-info {
  flex: 1;
  min-width: 0;
}

.queue-item-name {
  margin: 0;
  overflow: hidden;
  color: var(--ncx-color-text-primary);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-item-artist {
  margin: 1px 0 0;
  overflow: hidden;
  color: var(--ncx-color-text-secondary);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-item-actions {
  opacity: 0;
  transition: opacity var(--ncx-motion-fast, 150ms ease);
}

.queue-item:hover .queue-item-actions {
  opacity: 1;
}

.queue-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.queue-empty-text {
  color: var(--ncx-color-text-tertiary, #8e8e93);
  font-size: 13px;
}

@keyframes queue-pulse {
  from {
    opacity: 0.65;
  }
  to {
    opacity: 1;
  }
}
</style>
