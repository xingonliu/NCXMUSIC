<script setup lang="ts">
import { AlertCircle, Sparkles, X } from '@lucide/vue'
import { computed, type DeepReadonly } from 'vue'

import type { AgentSnapshot } from '../../../../shared/schemas/agent'
import { CommonButton, CommonIconButton } from '../../../design-system/components'

// ========= 类型 =========

/** 画像分析提示组件属性。 */
interface ProfileAnalysisBannerProps {
  /** 当前 Agent 快照。 */
  readonly snapshot: DeepReadonly<AgentSnapshot>
}

/** 画像分析提示组件事件。 */
interface ProfileAnalysisBannerEmits {
  /** 用户明确启动画像 Job。 */
  (event: 'start', mode: 'initialize' | 'update' | 'regenerate'): void
  /** 用户关闭当前提示。 */
  (event: 'dismiss'): void
}

// ========= 变量 =========

/** 组件属性。 */
const props = defineProps<ProfileAnalysisBannerProps>()

/** 组件事件。 */
const emit = defineEmits<ProfileAnalysisBannerEmits>()

/** 当前脱敏画像快照。 */
const profile = computed(() => props.snapshot.personalization)

/** 是否处于后台采集或模型分析。 */
const working = computed<boolean>(() =>
  ['collecting', 'ready_local', 'analyzing'].includes(profile.value.status))

/** 是否显示失败重试。 */
const failed = computed<boolean>(() => profile.value.status === 'failed')

/** 当前提示是否需要渲染。 */
const visible = computed<boolean>(() => working.value || failed.value || profile.value.prompt.visible)

/** 当前开始按钮对应的 Job 模式。 */
const startMode = computed<'initialize' | 'update' | 'regenerate'>(() => {
  if (profile.value.prompt.kind === 'update') return 'update'
  if (failed.value && profile.value.usable) return 'regenerate'
  return 'initialize'
})

/** 当前标题。 */
const title = computed<string>(() => {
  if (working.value) return profile.value.stageLabel || '正在分析你的音乐口味'
  if (failed.value) return '画像分析未完成'
  if (profile.value.prompt.kind === 'update') return '你的音乐口味有了新变化'
  return '让小云了解你的音乐口味'
})

/** 当前说明。 */
const description = computed<string>(() => {
  if (working.value) return '任务会在后台继续，普通聊天和播放器控制不受影响。'
  if (failed.value) return profile.value.errorMessage || '已保留本地采集结果，可以手动重试。'
  if (profile.value.prompt.kind === 'update') {
    return `变化评分 ${profile.value.prompt.changeScore}。更新仍由你确认，不会静默调用模型。`
  }
  return '开始后会在本地扫描并聚合授权音乐数据，只把聚合特征和有限代表样本发送给当前模型服务，可能产生 Token 费用。'
})
</script>

<template>
  <aside
    v-if="visible"
    class="profile-analysis-banner"
    :class="{ 'is-working': working, 'is-failed': failed }"
    aria-live="polite"
  >
    <span class="profile-analysis-banner-icon">
      <AlertCircle v-if="failed" :size="18" />
      <Sparkles v-else :size="18" />
    </span>
    <div class="profile-analysis-banner-copy">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
      <div v-if="working" class="profile-analysis-progress" role="progressbar" :aria-valuenow="profile.progress" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${profile.progress}%` }" />
      </div>
    </div>
    <CommonButton
      v-if="!working"
      variant="primary"
      size="compact"
      :disabled="!profile.eligible"
      @click="emit('start', startMode)"
    >
      {{ failed ? '重试' : profile.prompt.kind === 'update' ? '更新画像' : '开始分析' }}
    </CommonButton>
    <CommonIconButton
      v-if="!working && profile.prompt.visible"
      label="暂不分析"
      size="compact"
      variant="ghost"
      @click="emit('dismiss')"
    >
      <X :size="15" />
    </CommonIconButton>
  </aside>
</template>
