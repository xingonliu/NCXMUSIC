<script setup lang="ts">
import { SlidersHorizontal, UserRound } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { MusicBrowseFacetGroup, StandardArtist } from '../../../shared/schemas/music'
import { CommonEmptyState, CommonErrorState, CommonSpinner } from '../../design-system/components'
import Cover from './components/Cover.vue'
import './music-content-pages.css'
import { translatePublicError } from '../../i18n'

// ========= 变量 =========

/** 页面路由实例。 */
const router = useRouter()

/** 当前歌手结果。 */
const artists = ref<StandardArtist[]>([])

/** 当前页面加载状态。 */
const loading = ref<boolean>(true)

/** 当前页面错误信息。 */
const errorMessage = ref<string>('')

/** 当前地区标签。 */
const activeArea = ref<string>('')

/** 当前歌手类型。 */
const activeType = ref<string>('')

/** 当前首字母筛选；空字符串表示全部。 */
const activeInitial = ref<string>('')

/** API 能力层返回的歌手筛选分组。 */
const browseFacets = ref<MusicBrowseFacetGroup[]>([])

/** API 返回的地区筛选分组。 */
const areaFacet = computed<MusicBrowseFacetGroup | undefined>(() => browseFacets.value.find((group) => group.key === 'artist-area'))

/** API 返回的歌手类型筛选分组。 */
const typeFacet = computed<MusicBrowseFacetGroup | undefined>(() => browseFacets.value.find((group) => group.key === 'artist-type'))

/** API 返回的首字母筛选分组。 */
const initialFacet = computed<MusicBrowseFacetGroup | undefined>(() => browseFacets.value.find((group) => group.key === 'artist-initial'))

/** 最近一次歌手筛选请求 ID。 */
let latestRequestId = ''

// ========= 函数 =========

/** 读取当前筛选条件对应的歌手。 */
async function loadArtists(): Promise<void> {
  if (!activeArea.value || !activeType.value || !activeInitial.value) return
  /** 当前筛选请求唯一 ID。 */
  const requestId = crypto.randomUUID()
  latestRequestId = requestId
  loading.value = true
  errorMessage.value = ''
  /** 歌手探索标准响应。 */
  const response = await window.ncx.runtime.readMusic({
    operation: 'getArtists',
    area: activeArea.value,
    artistType: activeType.value,
    initial: activeInitial.value,
    limit: 40,
    offset: 0,
    requestId
  })
  if (requestId !== latestRequestId) return
  loading.value = false
  if (!response.ok) {
    errorMessage.value = translatePublicError(response.error)
    return
  }
  if (response.data.kind !== 'artistCollection') {
    errorMessage.value = '歌手探索响应类型不匹配。'
    return
  }
  artists.value = response.data.artists
}

/** 读取 API 能力层返回的歌手筛选项。 */
async function loadArtistFacets(): Promise<void> {
  /** 浏览筛选标准响应。 */
  const response = await window.ncx.runtime.readMusic({ operation: 'getBrowseFacets' })
  if (!response.ok || response.data.kind !== 'playlistCollection' || response.data.collection !== 'facets') {
    errorMessage.value = response.ok ? '歌手筛选响应类型不匹配。' : translatePublicError(response.error)
    loading.value = false
    return
  }
  browseFacets.value = response.data.facets
  activeArea.value = areaFacet.value?.options[0]?.value ?? ''
  activeType.value = typeFacet.value?.options[0]?.value ?? ''
  activeInitial.value = initialFacet.value?.options[0]?.value ?? ''
}

/** 打开歌手详情。 */
function openArtist(artist: StandardArtist): void {
  void router.push({ name: 'artist-detail', params: { artistId: artist.id } })
}

// ========= 生命周期 =========

watch([activeArea, activeType, activeInitial], () => {
  void loadArtists()
})

onMounted(() => {
  void loadArtistFacets()
})
</script>

<template>
  <section
    class="artist-explore-page music-content-page"
    aria-labelledby="artist-explore-title"
  >
    <header class="artist-explore-heading">
      <p class="music-page-eyebrow">
        <UserRound :size="13" /> {{ $tSource("浏览") }}
      </p>
      <h1 id="artist-explore-title">
        {{ $tSource("歌手探索") }}
      </h1>
      <p>{{ $tSource("按地区、类型与首字母逐步收敛，而不是把所有筛选塞进一个菜单。") }}</p>
    </header>

    <section
      class="artist-filter-panel music-surface"
      :aria-label="$tSource('歌手筛选')"
    >
      <header><SlidersHorizontal :size="16" /><h2>{{ $tSource("筛选") }}</h2></header>
      <div
        class="artist-filter-row"
        role="tablist"
        :aria-label="$tSource('地区')"
      >
        <button
          v-for="area in areaFacet?.options ?? []"
          :key="area.value"
          type="button"
          role="tab"
          :aria-selected="activeArea === area.value"
          :class="{ active: activeArea === area.value }"
          @click="activeArea = area.value"
        >
          {{ area.label }}
        </button>
      </div>
      <div
        class="artist-filter-row"
        :aria-label="$tSource('歌手类型')"
      >
        <button
          v-for="artistType in typeFacet?.options ?? []"
          :key="artistType.value"
          type="button"
          :class="{ active: activeType === artistType.value }"
          @click="activeType = artistType.value"
        >
          {{ artistType.label }}
        </button>
      </div>
      <div
        class="artist-filter-row artist-initials"
        :aria-label="$tSource('首字母')"
      >
        <button
          v-for="initial in initialFacet?.options ?? []"
          :key="initial.value"
          type="button"
          :class="{ active: activeInitial === initial.value }"
          @click="activeInitial = initial.value"
        >
          {{ initial.label }}
        </button>
      </div>
    </section>

    <div
      v-if="loading"
      class="artist-explore-state"
    >
      <CommonSpinner :label="$tSource('正在加载歌手')" /><span>{{ $tSource("正在加载歌手") }}</span>
    </div>
    <CommonErrorState
      v-else-if="errorMessage"
      :title="$tSource('歌手读取失败')"
      :description="errorMessage"
      @retry="loadArtists"
    />
    <CommonEmptyState
      v-else-if="artists.length === 0"
      :title="$tSource('没有匹配的歌手')"
      :description="$tSource('调整地区、类型或首字母后再试。')"
    />
    <div
      v-else
      class="artist-explore-grid"
    >
      <button
        v-for="artist in artists"
        :key="artist.id"
        type="button"
        @click="openArtist(artist)"
      >
        <Cover
          :src="artist.artworkUrl"
          :alt="artist.name"
          size="feature"
          shape="circle"
          :show-play-button="false"
        />
        <strong>{{ artist.name }}</strong>
        <span>{{ $tSource(artist.alias.join(' / ') || `${artist.songCount ?? 0} 首作品`) }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.artist-explore-page { display: grid; gap: 28px; }
.artist-explore-heading p, .artist-explore-heading h1 { margin: 0; }
.artist-explore-heading .music-page-eyebrow { display: flex; align-items: center; gap: 6px; }
.artist-explore-heading h1 { margin-top: 7px; font-size: clamp(36px, 5vw, 54px); line-height: 1.04; letter-spacing: -.03em; }
.artist-explore-heading > p:last-child { margin-top: 10px; color: var(--ncx-color-text-secondary); }
.artist-filter-panel { display: grid; gap: 12px; padding: 18px; border-radius: var(--ncx-radius-xl); }
.artist-filter-panel > header { display: flex; align-items: center; gap: 8px; }
.artist-filter-panel h2 { margin: 0; font-size: 14px; }
.artist-filter-row { display: flex; flex-wrap: wrap; gap: 6px; }
.artist-filter-row button { min-width: 40px; padding: 8px 12px; border: 0; border-radius: 999px; color: var(--ncx-color-text-secondary); background: transparent; cursor: pointer; }
.artist-filter-row button:hover, .artist-filter-row button.active { color: var(--ncx-color-text-primary); background: color-mix(in srgb, var(--ncx-color-text-primary) 8%, transparent); }
.artist-filter-row button:active { transform: scale(.95); }
.artist-initials { padding-top: 10px; border-top: 1px solid color-mix(in srgb, var(--ncx-color-text-primary) 7%, transparent); }
.artist-initials button { min-width: 30px; padding: 6px; }
.artist-explore-state { display: flex; min-height: 260px; align-items: center; justify-content: center; gap: 10px; color: var(--ncx-color-text-secondary); }
.artist-explore-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 26px 20px; }
.artist-explore-grid > button { display: grid; min-width: 0; justify-items: center; gap: 6px; padding: 0; border: 0; color: inherit; text-align: center; background: transparent; cursor: pointer; }
.artist-explore-grid strong, .artist-explore-grid span { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.artist-explore-grid strong { margin-top: 10px; font-size: 14px; }
.artist-explore-grid span { color: var(--ncx-color-text-secondary); font-size: 12px; }
@media (width < 1080px) { .artist-explore-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (width < 780px) { .artist-explore-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .artist-explore-page button { transition: none !important; } .artist-explore-page button:active { transform: none; } }
</style>
