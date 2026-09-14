<script setup lang="ts">
import { TrendingUp } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { StandardPlaylist } from '../../../shared/schemas/music'
import {
  CommonEmptyState,
  CommonErrorState,
  CommonSearchInput,
  CommonSpinner,
  CommonTabs,
  type CommonOption
} from '../../design-system/components'
import EntityCard from './components/EntityCard.vue'
import './music-content-pages.css'
import { translatePublicError } from '../../i18n'

// ========= 变量 =========

/** 页面路由实例。 */
const router = useRouter()

/** 全部公开榜单。 */
const charts = ref<StandardPlaylist[]>([])

/** 页面加载状态。 */
const loading = ref<boolean>(true)

/** 页面错误信息。 */
const errorMessage = ref<string>('')

/** 当前 API 更新频率标签；空字符串表示全部榜单。 */
const activeFrequency = ref<string>('')

/** 榜单名称筛选词。 */
const filterQuery = ref<string>('')

/** 根据排行榜 API 实际返回的更新频率动态生成标签。 */
const tabs = computed<CommonOption[]>(() => {
  /** 去重后的非空更新频率。 */
  const frequencies = [...new Set(charts.value.map((chart) => chart.updateFrequency?.trim()).filter((value): value is string => Boolean(value)))]
  return [
    { value: '', label: '全部榜单' },
    ...frequencies.map((frequency) => ({ value: frequency, label: frequency }))
  ]
})

/** 当前 API 更新频率标签和筛选词共同决定的榜单。 */
const visibleCharts = computed<StandardPlaylist[]>(() => {
  /** 当前筛选词。 */
  const keyword = filterQuery.value.trim().toLocaleLowerCase()
  return charts.value.filter((chart) => {
    /** 当前榜单是否满足 API 更新频率标签。 */
    const matchesTab = !activeFrequency.value || chart.updateFrequency === activeFrequency.value
    /** 当前榜单是否满足名称筛选。 */
    const matchesQuery = !keyword || chart.name.toLocaleLowerCase().includes(keyword)
    return matchesTab && matchesQuery
  })
})

// ========= 函数 =========

/** 读取全部榜单。 */
async function loadCharts(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  /** 排行榜标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getCharts' })
  loading.value = false
  if (!response.ok) {
    errorMessage.value = translatePublicError(response.error)
    return
  }
  if (response.data.kind !== 'playlistCollection' || response.data.collection !== 'charts') {
    errorMessage.value = '排行榜响应类型不匹配。'
    return
  }
  charts.value = response.data.playlists
}

/** 打开榜单详情。 */
function openChart(chart: StandardPlaylist): void {
  void router.push({ name: 'playlist-detail', params: { playlistId: chart.id } })
}

// ========= 生命周期 =========

onMounted(() => {
  void loadCharts()
})
</script>

<template>
  <section
    class="rankings-page music-content-page"
    aria-labelledby="rankings-title"
  >
    <header class="rankings-heading">
      <p class="music-page-eyebrow">
        <TrendingUp :size="13" /> {{ $tSource("浏览") }}
      </p>
      <h1 id="rankings-title">
        {{ $tSource("排行榜") }}
      </h1>
      <p>{{ $tSource("当前可用榜单及其更新节奏集中在一个可筛选的目录中。") }}</p>
    </header>

    <div class="rankings-controls music-surface">
      <CommonTabs
        class="rankings-tabs"
        :model-value="activeFrequency"
        :options="tabs"
        variant="pills"
        size="compact"
        @update:model-value="activeFrequency = $event"
      />
      <CommonSearchInput
        v-model="filterQuery"
        :placeholder="$tSource('筛选榜单')"
        :aria-label="$tSource('筛选榜单')"
      />
    </div>

    <div
      v-if="loading"
      class="rankings-state"
    >
      <CommonSpinner :label="$tSource('正在加载榜单')" /><span>{{ $tSource("正在加载榜单") }}</span>
    </div>
    <CommonErrorState
      v-else-if="errorMessage"
      :title="$tSource('榜单读取失败')"
      :description="errorMessage"
      @retry="loadCharts"
    />
    <CommonEmptyState
      v-else-if="visibleCharts.length === 0"
      :title="$tSource('没有匹配的榜单')"
      :description="$tSource('调整标签或筛选词后再试。')"
    />
    <div
      v-else
      class="rankings-grid"
    >
      <EntityCard
        v-for="chart in visibleCharts"
        :key="chart.id"
        :title="chart.name"
        :subtitle="$tSource(chart.updateFrequency || '持续更新')"
        :artwork-url="chart.artworkUrl"
        @activate="openChart(chart)"
      />
    </div>
  </section>
</template>

<style scoped>
.rankings-page { display: grid; gap: 28px; }
.rankings-heading p, .rankings-heading h1 { margin: 0; }
.rankings-heading .music-page-eyebrow { display: flex; align-items: center; gap: 6px; }
.rankings-heading h1 { margin-top: 7px; font-size: clamp(36px, 5vw, 54px); line-height: 1.04; letter-spacing: -.03em; }
.rankings-heading > p:last-child { margin-top: 10px; color: var(--ncx-color-text-secondary); }
.rankings-controls { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px; border-radius: var(--ncx-squircle-radius-xl); }
.rankings-tabs { min-width: 0; flex: 1; }
.rankings-controls :deep(.ncx-common-search) { width: min(300px, 36vw); }
.rankings-state { display: flex; min-height: 260px; align-items: center; justify-content: center; gap: 10px; color: var(--ncx-color-text-secondary); }
.rankings-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
@media (width < 980px) { .rankings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (width < 680px) { .rankings-controls { align-items: stretch; flex-direction: column; } .rankings-controls :deep(.ncx-common-search) { width: 100%; } .rankings-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .rankings-page button { transition: none !important; } .rankings-page button:hover, .rankings-page button:active { transform: none; } }
</style>
