<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { fetchIconSvg, getModelInitials } from '../model-icons'

// ========= 类型 =========

/** 模型图标视图组件属性。 */
interface ModelIconViewProps {
  /** 图标唯一标识，例如 simple-icons:openai。 */
  icon?: string | undefined
  /** 模型展示名称，用于生成前两字文字回退。 */
  name?: string | undefined
  /** 图标像素尺寸。 */
  size?: number | undefined
}

// ========= 变量 =========

/** 组件属性。 */
const props = withDefaults(defineProps<ModelIconViewProps>(), {
  icon: '',
  name: '',
  size: 20
})

/** 已加载的 SVG 文本。 */
const svgHtml = ref<string>('')

/** 是否正在加载 SVG。 */
const loading = ref<boolean>(false)

// ========= 函数 =========

/**
 * 根据图标标识拉取或读取 SVG 文本。
 */
async function loadSvg(): Promise<void> {
  /** 当前传入的图标标识。 */
  const iconId = (props.icon || '').trim()
  if (!iconId) {
    svgHtml.value = ''
    return
  }

  loading.value = true
  try {
    /** 获取到的 SVG 字符串。 */
    const svg = await fetchIconSvg(iconId)
    svgHtml.value = svg
  } catch {
    svgHtml.value = ''
  } finally {
    loading.value = false
  }
}

// ========= 侦听与生命周期 =========

watch(
  () => props.icon,
  () => {
    void loadSvg()
  }
)

onMounted(() => {
  void loadSvg()
})
</script>

<template>
  <span
    class="model-icon-view-container"
    :style="{ fontSize: `${props.size}px` }"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <span
      v-if="svgHtml"
      class="model-icon-view-svg"
      v-html="svgHtml"
    />
    <span
      v-else
      class="model-icon-view-initials"
    >
      {{ getModelInitials(props.name) }}
    </span>
  </span>
</template>

<style scoped>
.model-icon-view-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  user-select: none;
}

.model-icon-view-svg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  color: inherit;
}

.model-icon-view-svg :deep(svg) {
  width: 1em;
  height: 1em;
  fill: currentColor;
}

.model-icon-view-initials {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  color: inherit;
}
</style>
