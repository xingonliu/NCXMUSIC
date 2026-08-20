<script setup lang="ts">
import { AlertCircle, Check, Copy, Sparkles, X } from '@lucide/vue'
import { computed, ref, watch, type DeepReadonly } from 'vue'

import type { AgentSnapshot } from '../../../../shared/schemas/agent'
import { CommonButton, CommonDialog, CommonIconButton } from '../../../design-system/components'
import { translatePublicError } from '../../../i18n'
import { copyText } from '../../foundation/clipboard'

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

/** 本次会话中用户是否主动关闭了提示。 */
const sessionDismissed = ref<boolean>(false)

/** 当前脱敏画像快照。 */
const profile = computed(() => props.snapshot.personalization)

/** 是否处于后台采集或模型分析。 */
const working = computed<boolean>(() =>
  ['collecting', 'ready_local', 'analyzing'].includes(profile.value.status))

/** 是否显示失败重试。 */
const failed = computed<boolean>(() => profile.value.status === 'failed')

/** 当前提示是否需要渲染。
 * 1. 若当前会话已被用户关闭，则不再显示；
 * 2. 正在执行任务中始终展示进度条；
 * 3. 若已有可用画像（usable 为 true），仅在有更新提示（update 且 prompt.visible）时展示；
 * 4. 若尚未生成画像（usable 为 false），在 prompt.visible 为 true 或失败状态下展示。
 */
const visible = computed<boolean>(() => {
  if (sessionDismissed.value) return false
  if (working.value) return true
  if (profile.value.usable) {
    return profile.value.prompt.kind === 'update' && profile.value.prompt.visible
  }
  return profile.value.prompt.visible || (failed.value && profile.value.eligible)
})

/** 监听任务执行状态：当重新发起分析时，恢复提示展示。 */
watch(working, (isWorking) => {
  if (isWorking) {
    sessionDismissed.value = false
  }
})

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

/** 是否展示原始返回详情弹窗。 */
const detailModalVisible = ref(false)

/** 复制成功提示状态。 */
const copied = ref(false)

// ========= 函数 =========

/** 关闭当前画像提示。 */
function handleDismiss(): void {
  sessionDismissed.value = true
  emit('dismiss')
}

/** 触发开始或重试画像分析。 */
function handleStart(mode: 'initialize' | 'update' | 'regenerate'): void {
  sessionDismissed.value = false
  emit('start', mode)
}

/** 复制模型原始返回内容。 */
async function handleCopyOutput(): Promise<void> {
  const content = profile.value.rawOutput || ''
  if (!content) return
  await copyText(content)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

/** 打开详情弹窗。 */
function handleOpenDetail(): void {
  detailModalVisible.value = true
}

/** 关闭详情弹窗。 */
function handleCloseDetail(): void {
  detailModalVisible.value = false
}

/** 从弹窗中触发重试。 */
function handleRetryFromModal(): void {
  detailModalVisible.value = false
  sessionDismissed.value = false
  emit('start', startMode.value)
}
</script>

<template>
  <aside
    v-if="visible"
    class="profile-analysis-banner"
    :class="{ 'is-working': working, 'is-failed': failed }"
    aria-live="polite"
  >
    <span class="profile-analysis-banner-icon">
      <AlertCircle
        v-if="failed"
        :size="18"
      />
      <Sparkles
        v-else
        :size="18"
      />
    </span>
    <div class="profile-analysis-banner-copy">
      <strong>{{ $tSource(title) }}</strong>
      <p>{{ failed ? translatePublicError({ message: description }) : $tSource(description) }}</p>
      <div
        v-if="working"
        class="profile-analysis-progress"
        role="progressbar"
        :aria-valuenow="profile.progress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${profile.progress}%` }" />
      </div>
    </div>
    <div
      v-if="!working"
      class="profile-analysis-banner-actions"
    >
      <CommonButton
        variant="primary"
        size="compact"
        :disabled="!profile.eligible"
        @click="handleStart(startMode)"
      >
        {{ $tSource(failed ? '重试' : profile.prompt.kind === 'update' ? '更新画像' : '开始分析') }}
      </CommonButton>
      <CommonButton
        v-if="failed"
        variant="secondary"
        size="compact"
        @click="handleOpenDetail"
      >
        {{ $tSource("查看详情") }}
      </CommonButton>
    </div>
    <CommonIconButton
      v-if="!working"
      :label="$tSource('暂不分析')"
      size="compact"
      variant="ghost"
      @click="handleDismiss"
    >
      <X :size="15" />
    </CommonIconButton>

    <!-- 画像分析失败的原始响应详情弹窗 -->
    <CommonDialog
      :visible="detailModalVisible"
      :title="$tSource('画像分析异常详情')"
      :subtitle="$tSource('大模型返回的原始数据与异常信息')"
      width="640px"
      @close="handleCloseDetail"
    >
      <div class="profile-raw-detail-content">
        <section class="profile-raw-detail-section">
          <div class="profile-raw-detail-label">
            {{ $tSource("错误原因") }}
          </div>
          <div class="profile-raw-detail-error">
            {{ translatePublicError({ message: profile.errorMessage || '模型没有返回有效画像 JSON。' }) }}
          </div>
        </section>

        <section class="profile-raw-detail-section">
          <div class="profile-raw-detail-header">
            <span class="profile-raw-detail-label">{{ $tSource("AI 原始返回") }}</span>
            <CommonButton
              v-if="profile.rawOutput"
              variant="ghost"
              size="compact"
              @click="handleCopyOutput"
            >
              <Check
                v-if="copied"
                :size="13"
              />
              <Copy
                v-else
                :size="13"
              />
              <span>{{ $tSource(copied ? '已复制' : '复制内容') }}</span>
            </CommonButton>
          </div>
          <pre class="profile-raw-detail-pre">{{ $tSource(profile.rawOutput || '（模型未返回任何文本内容或响应为空）') }}</pre>
        </section>
      </div>

      <template #actions>
        <CommonButton
          variant="secondary"
          @click="handleCloseDetail"
        >
          {{ $tSource("关闭") }}
        </CommonButton>
        <CommonButton
          variant="primary"
          :disabled="!profile.eligible"
          @click="handleRetryFromModal"
        >
          {{ $tSource("重试生成") }}
        </CommonButton>
      </template>
    </CommonDialog>
  </aside>
</template>
