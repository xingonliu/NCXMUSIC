<script setup lang="ts">
import { CommonCard } from '../../design-system/components'

// ========= 类型 =========

/** 设置分组的展示属性。 */
interface SettingsSectionProps {
  /** 分组标题。 */
  readonly title: string
  /** 页面内可搜索定位的分组 ID。 */
  readonly sectionId?: string
}

// ========= 变量 =========

/** 当前设置分组属性。 */
defineProps<SettingsSectionProps>()
</script>

<template>
  <section
    :id="sectionId"
    class="settings-section"
  >
    <header class="settings-section-header">
      <h2>{{ title }}</h2>
      <div
        v-if="$slots.actions"
        class="settings-section-actions"
      >
        <slot name="actions" />
      </div>
    </header>
    <CommonCard
      class="settings-list"
      variant="default"
      padding="none"
    >
      <slot />
    </CommonCard>
  </section>
</template>
