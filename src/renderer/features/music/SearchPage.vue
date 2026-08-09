<script setup lang="ts">
import { Search } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { CommonButton, CommonSearchInput } from '../../design-system/components'

// ========= 变量 =========

/** Router 实例，用于进入搜索结果页。 */
const router = useRouter()

/** 搜索输入框当前内容。 */
const query = ref<string>('')

/** 示例搜索词。 */
const suggestions = ['光年之外', '周杰伦', '夜空中最亮的星', '写代码时听']

// ========= 函数 =========

/** 提交当前搜索词。 */
function submitSearch(): void {
  const trimmed = query.value.trim()
  if (!trimmed) return
  void router.push({ name: 'search-results', query: { q: trimmed } })
}

/** 使用建议搜索词搜索。 */
function useSuggestion(value: string): void {
  query.value = value
  submitSearch()
}
</script>

<template>
  <section class="music-search-page" aria-labelledby="music-search-title">
    <div class="music-search-copy">
      <p class="music-page-eyebrow">Phase 3</p>
      <h1 id="music-search-title">搜索到播放</h1>
      <p>搜索歌曲、歌手、专辑和歌单；歌曲结果可以直接插播，集合结果进入详情后整体替换队列。</p>
    </div>

    <form class="music-search-box" @submit.prevent="submitSearch">
      <CommonSearchInput
        v-model="query"
        size="prominent"
        auto-focus
        placeholder="搜索歌曲、歌手、专辑或歌单"
        @search="submitSearch"
      />
      <CommonButton variant="primary" size="prominent" type="submit">
        <Search :size="16" />
        搜索
      </CommonButton>
    </form>

    <div class="music-search-suggestions" aria-label="搜索建议">
      <button
        v-for="item in suggestions"
        :key="item"
        type="button"
        @click="useSuggestion(item)"
      >
        {{ item }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.music-search-page {
  width: min(1060px, calc(100% - 48px));
  margin: 0 auto;
  padding: 92px 0 132px;
}

.music-search-copy {
  max-width: 720px;
}

.music-page-eyebrow {
  margin: 0;
  color: var(--ncx-color-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.music-search-copy h1 {
  margin: var(--ncx-space-2) 0 var(--ncx-space-3);
  font-size: 46px;
  line-height: 1.08;
}

.music-search-copy p:last-child {
  margin: 0;
  color: var(--ncx-color-text-secondary);
  font-size: 15px;
  line-height: 1.7;
}

.music-search-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--ncx-space-3);
  max-width: 760px;
  margin-top: 44px;
}

.music-search-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ncx-space-2);
  margin-top: var(--ncx-space-4);
}

.music-search-suggestions button {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--ncx-radius-full);
  color: var(--ncx-color-text-secondary);
  background: var(--ncx-color-surface);
  cursor: pointer;
}

.music-search-suggestions button:hover {
  color: var(--ncx-color-text-primary);
  background: var(--ncx-color-control-hover);
}
</style>
