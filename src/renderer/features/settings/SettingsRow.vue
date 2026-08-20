<script setup lang="ts">
// ========= 类型 =========

/** 标准设置行属性。 */
interface SettingsRowProps {
  /** 设置项标题。 */
  readonly title: string
  /** 可选的设置项辅助说明。 */
  readonly description?: string | undefined
  /** 页面内可搜索定位的设置项 ID。 */
  readonly settingId?: string | undefined
  /** 是否让控制区与多行内容顶部对齐。 */
  readonly align?: 'center' | 'start'
}

// ========= 变量 =========

/** 当前设置行属性。 */
withDefaults(defineProps<SettingsRowProps>(), {
  description: '',
  settingId: undefined,
  align: 'center'
})
</script>

<template>
  <div
    :id="settingId"
    class="settings-row"
    :class="{ 'settings-row--start': align === 'start' }"
  >
    <div class="settings-row-copy">
      <h3>
        <slot name="title">
          {{ $tSource(title) }}
        </slot>
      </h3>
      <p v-if="description || $slots.description">
        <slot name="description">
          {{ $tSource(description) }}
        </slot>
      </p>
      <slot name="details" />
    </div>
    <div
      v-if="$slots.default"
      class="settings-row-control"
    >
      <slot />
    </div>
  </div>
</template>
