<script setup lang="ts">
import { ChevronDown, ChevronUp, Search, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { CommonButton, CommonInput } from '../../../design-system/components'
import {
  MODEL_ICON_PRESETS,
  getModelInitials,
  searchYesIcons,
  type ModelIconPreset
} from '../model-icons'
import ModelIconView from './ModelIconView.vue'

// ========= 类型 =========

/** 图标选择组件属性。 */
interface ModelIconPickerProps {
  /** 当前选中的图标标识。 */
  modelValue?: string | undefined
  /** 模型展示名称，用于两字回退预览。 */
  displayName?: string | undefined
}

/** 图标选择组件事件。 */
interface ModelIconPickerEmits {
  (event: 'update:modelValue', value: string): void
}

// ========= 变量 =========

/** 组件属性。 */
const props = withDefaults(defineProps<ModelIconPickerProps>(), {
  modelValue: '',
  displayName: ''
})

/** 组件事件发射器。 */
const emit = defineEmits<ModelIconPickerEmits>()

/** 选择器面板展开状态。 */
const expanded = ref<boolean>(false)

/** 搜索关键词。 */
const searchQuery = ref<string>('')

/** 在线搜索状态。 */
const searching = ref<boolean>(false)

/** 在线搜索结果图标列表。 */
const searchResults = ref<string[]>([])

/** 搜索防抖定时器。 */
let searchTimer: ReturnType<typeof setTimeout> | undefined

/** 预设分类过滤方式。 */
const activeCategory = ref<'all' | 'brand' | 'generic'>('all')

/** 过滤后的预设图标列表。 */
const filteredPresets = computed<readonly ModelIconPreset[]>(() => {
  if (activeCategory.value === 'all') return MODEL_ICON_PRESETS
  return MODEL_ICON_PRESETS.filter((item) => item.category === activeCategory.value)
})

// ========= 函数 =========

/**
 * 切换图标选择面板的展开/收起状态。
 */
function toggleExpanded(): void {
  expanded.value = !expanded.value
}

/**
 * 选择指定图标。
 */
function selectIcon(iconId: string): void {
  emit('update:modelValue', iconId)
  expanded.value = false
}

/**
 * 清除已选图标，恢复使用模型名称前两字。
 */
function clearIcon(): void {
  emit('update:modelValue', '')
  expanded.value = false
}

/**
 * 执行 YesIcon / Iconify 图标库搜索。
 */
async function performSearch(query: string): Promise<void> {
  /** 检索词。 */
  const trimmed = query.trim()
  if (!trimmed) {
    searchResults.value = []
    searching.value = false
    return
  }

  searching.value = true
  try {
    /** 搜索结果 ID 列表。 */
    const results = await searchYesIcons(trimmed, 36)
    searchResults.value = results
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

// ========= 侦听与生命周期 =========

watch(searchQuery, (newQuery) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void performSearch(newQuery)
  }, 300)
})
</script>

<template>
  <div class="model-icon-picker">
    <div class="model-icon-picker-summary">
      <div class="model-icon-preview-box">
        <ModelIconView
          :icon="props.modelValue"
          :name="props.displayName"
          :size="20"
        />
      </div>

      <div class="model-icon-summary-info">
        <span class="model-icon-summary-label">{{ $tSource("模型图标") }}</span>
        <span class="model-icon-summary-status">
          {{ $tSource(props.modelValue ? props.modelValue : `默认使用名称前两字「${getModelInitials(props.displayName)}」`) }}
        </span>
      </div>

      <div class="model-icon-summary-actions">
        <CommonButton
          v-if="props.modelValue"
          size="compact"
          variant="secondary"
          @click="clearIcon"
        >
          <X :size="13" />{{ $tSource("清除图标") }}
        </CommonButton>
        <CommonButton
          size="compact"
          variant="secondary"
          @click="toggleExpanded"
        >
          <component
            :is="expanded ? ChevronUp : ChevronDown"
            :size="13"
          />
          {{ $tSource(expanded ? '收起图标库' : '从 YesIcon 库选择') }}
        </CommonButton>
      </div>
    </div>

    <!-- 图标选择面板 -->
    <div
      v-if="expanded"
      class="model-icon-picker-panel"
    >
      <div class="model-icon-search-bar">
        <CommonInput
          v-model="searchQuery"
          clearable
          :placeholder="$tSource('在 YesIcon 库中搜索（如：openai, claude, bot, 机器人, ai...）')"
        >
          <template #prefix>
            <Search :size="14" />
          </template>
        </CommonInput>
      </div>

      <!-- 搜索结果展示 -->
      <div
        v-if="searchQuery.trim()"
        class="model-icon-results-section"
      >
        <div class="model-icon-section-header">
          <span>{{ $tSource("搜索结果") }}</span>
          <small v-if="searching">{{ $tSource("正在搜索 YesIcon 库…") }}</small>
          <small v-else-if="searchResults.length > 0">{{ $tSource("找到") }} {{ searchResults.length }} {{ $tSource("个图标") }}</small>
          <small v-else>{{ $tSource("未找到匹配图标") }}</small>
        </div>

        <div
          v-if="searchResults.length > 0"
          class="model-icon-grid"
        >
          <button
            v-for="iconId in searchResults"
            :key="iconId"
            type="button"
            class="model-icon-grid-item"
            :class="{ 'is-selected': props.modelValue === iconId }"
            :title="iconId"
            @click="selectIcon(iconId)"
          >
            <ModelIconView
              :icon="iconId"
              :size="20"
            />
          </button>
        </div>
      </div>

      <!-- 预设图标展示 -->
      <div
        v-else
        class="model-icon-presets-section"
      >
        <div class="model-icon-category-tabs">
          <button
            type="button"
            class="model-icon-tab-btn"
            :class="{ 'is-active': activeCategory === 'all' }"
            @click="activeCategory = 'all'"
          >
            {{ $tSource("全部预设") }}
          </button>
          <button
            type="button"
            class="model-icon-tab-btn"
            :class="{ 'is-active': activeCategory === 'brand' }"
            @click="activeCategory = 'brand'"
          >
            {{ $tSource("品牌厂商") }}
          </button>
          <button
            type="button"
            class="model-icon-tab-btn"
            :class="{ 'is-active': activeCategory === 'generic' }"
            @click="activeCategory = 'generic'"
          >
            {{ $tSource("通用概念") }}
          </button>
        </div>

        <div class="model-icon-grid">
          <button
            v-for="preset in filteredPresets"
            :key="preset.id"
            type="button"
            class="model-icon-grid-item"
            :class="{ 'is-selected': props.modelValue === preset.id }"
            :title="`${preset.name} (${preset.id})`"
            @click="selectIcon(preset.id)"
          >
            <ModelIconView
              :icon="preset.id"
              :size="20"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-icon-picker {
  display: flex;
  flex-direction: column;
  gap: var(--ncx-space-2, 8px);
  width: 100%;
}

.model-icon-picker-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--ncx-radius-md, 10px);
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--ncx-color-text-primary, #fff) 8%, transparent);
}

.model-icon-preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--ncx-color-text-primary, #fff);
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 10%, transparent);
  flex-shrink: 0;
}

.model-icon-summary-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.model-icon-summary-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ncx-color-text-primary, #fff);
}

.model-icon-summary-status {
  font-size: 11px;
  color: var(--ncx-color-text-secondary, rgba(255, 255, 255, 0.6));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-icon-summary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.model-icon-picker-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: var(--ncx-radius-md, 10px);
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 3%, transparent);
  border: 1px solid color-mix(in srgb, var(--ncx-color-text-primary, #fff) 8%, transparent);
  animation: picker-fade-in 0.15s ease-out;
}

@keyframes picker-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.model-icon-category-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-icon-tab-btn {
  padding: 4px 10px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--ncx-color-text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-icon-tab-btn:hover {
  color: var(--ncx-color-text-primary, #fff);
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 6%, transparent);
}

.model-icon-tab-btn.is-active {
  color: var(--ncx-color-text-primary, #fff);
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 12%, transparent);
}

.model-icon-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--ncx-color-text-secondary, rgba(255, 255, 255, 0.6));
}

.model-icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  padding: 2px;
}

.model-icon-grid-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 5%, transparent);
  color: var(--ncx-color-text-primary, #fff);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.model-icon-grid-item:hover {
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 12%, transparent);
  border-color: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 20%, transparent);
  transform: scale(1.05);
}

.model-icon-grid-item.is-selected {
  background: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 20%, transparent);
  border-color: color-mix(in srgb, var(--ncx-color-text-primary, #fff) 40%, transparent);
}
</style>
