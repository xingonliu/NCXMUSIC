<script setup lang="ts">
import { ChevronRight, Clock3, TrendingUp } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { StandardPlaylist } from '../../../shared/schemas/music'
import { CommonEmptyState, CommonErrorState, CommonSearchInput, CommonSpinner } from '../../design-system/components'
import Cover from './components/Cover.vue'
import './music-content-pages.css'

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
const tabs = computed<ReadonlyArray<{ value: string; label: string }>>(() => {
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
    errorMessage.value = response.error.message
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
  <section class="rankings-page music-content-page" aria-labelledby="rankings-title">
    <header class="rankings-heading">
      <p class="music-page-eyebrow"><TrendingUp :size="13" /> 浏览</p>
      <h1 id="rankings-title">排行榜</h1>
      <p>当前可用榜单及其更新节奏集中在一个可筛选的目录中。</p>
    </header>

    <div class="rankings-controls music-surface">
      <div class="rankings-tabs" role="tablist" aria-label="榜单分类">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="activeFrequency === tab.value"
          :class="{ active: activeFrequency === tab.value }"
          @click="activeFrequency = tab.value"
        >
          <Clock3 v-if="tab.value" :size="14" />
          {{ tab.label }}
        </button>
      </div>
      <CommonSearchInput v-model="filterQuery" placeholder="筛选榜单" aria-label="筛选榜单" />
    </div>

    <div v-if="loading" class="rankings-state"><CommonSpinner label="正在加载榜单" /><span>正在加载榜单</span></div>
    <CommonErrorState v-else-if="errorMessage" title="榜单读取失败" :description="errorMessage" @retry="loadCharts" />
    <CommonEmptyState v-else-if="visibleCharts.length === 0" title="没有匹配的榜单" description="调整标签或筛选词后再试。" />
    <div v-else class="rankings-grid">
      <button v-for="chart in visibleCharts" :key="chart.id" type="button" @click="openChart(chart)">
        <Cover :src="chart.artworkUrl" :alt="chart.name" size="card" :show-play-button="false" />
        <span><strong>{{ chart.name }}</strong><small>{{ chart.updateFrequency || '持续更新' }}</small></span>
        <ChevronRight :size="17" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.rankings-page { display: grid; gap: 28px; }
.rankings-heading p, .rankings-heading h1 { margin: 0; }
.rankings-heading .music-page-eyebrow { display: flex; align-items: center; gap: 6px; }
.rankings-heading h1 { margin-top: 7px; font-size: clamp(36px, 5vw, 54px); line-height: 1.04; letter-spacing: -.03em; }
.rankings-heading > p:last-child { margin-top: 10px; color: var(--ncx-color-text-secondary); }
.rankings-controls { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px; border-radius: var(--ncx-radius-xl); }
.rankings-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.rankings-tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border: 0; border-radius: 999px; color: var(--ncx-color-text-secondary); background: transparent; cursor: pointer; }
.rankings-tabs button:hover, .rankings-tabs button.active { color: var(--ncx-color-text-primary); background: color-mix(in srgb, var(--ncx-color-text-primary) 8%, transparent); }
.rankings-tabs button:active { transform: scale(.96); }
.rankings-controls :deep(.common-input-shell) { width: min(300px, 36vw); }
.rankings-state { display: flex; min-height: 260px; align-items: center; justify-content: center; gap: 10px; color: var(--ncx-color-text-secondary); }
.rankings-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.rankings-grid > button { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 15px; padding: 14px; border: 0; border-radius: var(--ncx-radius-xl); color: inherit; text-align: left; background: var(--ncx-color-surface); cursor: pointer; }
.rankings-grid > button:hover { transform: translateY(-2px); box-shadow: var(--ncx-shadow-md); }
.rankings-grid > button:active { transform: scale(.985); }
.rankings-grid > button > span { display: grid; min-width: 0; }
.rankings-grid strong, .rankings-grid small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rankings-grid small { margin-top: 5px; color: var(--ncx-color-text-secondary); }
@media (width < 980px) { .rankings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (width < 680px) { .rankings-controls { align-items: stretch; flex-direction: column; } .rankings-controls :deep(.common-input-shell) { width: 100%; } .rankings-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .rankings-page button { transition: none !important; } .rankings-page button:hover, .rankings-page button:active { transform: none; } }
</style>
