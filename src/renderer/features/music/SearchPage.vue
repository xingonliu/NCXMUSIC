<script setup lang="ts">
import { Clock3, Search, X } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { MusicReadResult } from '../../../shared/schemas/music'
import { CommonButton, CommonSearchInput } from '../../design-system/components'
import './music-content-pages.css'

// ========= 变量 =========

/** Router 实例，用于进入搜索结果页。 */
const router = useRouter()

/** 搜索输入框当前内容。 */
const query = ref<string>('')

/** 搜索历史本地存储键。 */
const SEARCH_HISTORY_KEY = 'ncx.search-history.v1'

/** API 返回的实时搜索建议。 */
const apiSuggestions = ref<string[]>([])

/** 实时搜索建议加载状态。 */
const suggestionsLoading = ref<boolean>(false)

/** 搜索建议防抖计时器。 */
let suggestionTimer: ReturnType<typeof setTimeout> | undefined

/** 最近一次搜索建议请求 ID。 */
let latestSuggestionRequestId = ''

/** 最近搜索历史。 */
const searchHistory = ref<string[]>(readSearchHistory())

/** 随输入动态收敛的搜索建议。 */
const suggestions = computed<string[]>(() => {
  const keyword = query.value.trim().toLocaleLowerCase()
  const candidates = keyword ? apiSuggestions.value : searchHistory.value
  const unique = [...new Set(candidates)]
  return (keyword ? unique.filter((item) => item.toLocaleLowerCase().includes(keyword)) : unique).slice(0, 8)
})

// ========= 函数 =========

/** 从本地存储读取最近搜索。 */
function readSearchHistory(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 8)
      : []
  } catch {
    return []
  }
}

/** 保存一个搜索词到最近搜索首位。 */
function rememberSearch(value: string): void {
  searchHistory.value = [value, ...searchHistory.value.filter((item) => item !== value)].slice(0, 8)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
}

/** 提交当前搜索词。 */
function submitSearch(): void {
  const trimmed = query.value.trim()
  if (!trimmed) return
  rememberSearch(trimmed)
  void router.push({ name: 'search-results', query: { q: trimmed } })
}

/** 使用建议搜索词搜索。 */
function useSuggestion(value: string): void {
  query.value = value
  submitSearch()
}

/** 清除全部最近搜索。 */
function clearSearchHistory(): void {
  searchHistory.value = []
  localStorage.removeItem(SEARCH_HISTORY_KEY)
}

/** 从标准搜索建议响应提取去重后的可提交关键词。 */
function collectSuggestionLabels(result: Extract<MusicReadResult, { kind: 'search' }>): string[] {
  /** 歌曲、歌手、专辑和歌单候选名称。 */
  const labels = [
    ...result.songs.map((item) => item.name),
    ...result.artists.map((item) => item.name),
    ...result.albums.map((item) => item.name),
    ...result.playlists.map((item) => item.name)
  ]
  return [...new Set(labels)].slice(0, 8)
}

/** 读取当前输入对应的网易云实时搜索建议。 */
async function loadSearchSuggestions(): Promise<void> {
  /** 发起请求时的关键词快照。 */
  const keyword = query.value.trim()
  if (!keyword) {
    apiSuggestions.value = []
    suggestionsLoading.value = false
    return
  }
  /** 当前搜索建议请求 ID。 */
  const requestId = crypto.randomUUID()
  latestSuggestionRequestId = requestId
  suggestionsLoading.value = true
  /** 搜索建议标准响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getSearchSuggestions',
    query: keyword,
    limit: 8,
    requestId
  })
  if (requestId !== latestSuggestionRequestId || keyword !== query.value.trim()) return
  suggestionsLoading.value = false
  if (!response.ok || response.data.kind !== 'search') {
    apiSuggestions.value = []
    return
  }
  apiSuggestions.value = collectSuggestionLabels(response.data)
}

// ========= 生命周期 =========

watch(query, () => {
  if (suggestionTimer) clearTimeout(suggestionTimer)
  suggestionTimer = setTimeout(() => {
    void loadSearchSuggestions()
  }, 180)
})

onBeforeUnmount(() => {
  if (suggestionTimer) clearTimeout(suggestionTimer)
  if (latestSuggestionRequestId) window.ncx.runtime.cancel(latestSuggestionRequestId)
})
</script>

<template>
  <section
    class="music-search-page music-content-page"
    aria-labelledby="music-search-title"
  >
    <div class="music-search-intro">
      <h1 id="music-search-title">
        搜索
      </h1>
      <p class="music-page-description">
        歌曲、歌手、专辑与歌单
      </p>
    </div>

    <form
      class="music-search-box"
      @submit.prevent="submitSearch"
    >
      <CommonSearchInput
        v-model="query"
        size="prominent"
        auto-focus
        placeholder="搜索歌曲、歌手、专辑或歌单"
        @search="submitSearch"
      />
      <CommonButton
        variant="primary"
        size="prominent"
        type="submit"
      >
        <Search :size="16" />
        搜索
      </CommonButton>
    </form>

    <section
      v-if="suggestions.length > 0"
      class="music-search-suggestion-section"
    >
      <header>
        <h2>{{ query.trim() ? suggestionsLoading ? '正在获取建议' : '实时建议' : '最近搜索' }}</h2>
        <button
          v-if="!query.trim() && searchHistory.length > 0"
          type="button"
          @click="clearSearchHistory"
        >
          <X :size="13" />
          清除
        </button>
      </header>
      <TransitionGroup
        name="music-chip-list"
        tag="div"
        class="music-search-suggestions"
        aria-label="搜索建议"
      >
        <button
          v-for="item in suggestions"
          :key="item"
          type="button"
          @click="useSuggestion(item)"
        >
          <Clock3
            v-if="searchHistory.includes(item)"
            :size="13"
          />
          {{ item }}
        </button>
      </TransitionGroup>
    </section>
  </section>
</template>
