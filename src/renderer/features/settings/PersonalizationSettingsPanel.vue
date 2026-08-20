<script setup lang="ts">
import { Pause, Play, RotateCcw, Sparkles, Trash2 } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import {
  CommonAlertDialog,
  CommonButton,
  CommonEmptyState,
  CommonInput
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import { translatePublicError } from '../../i18n'
import { useAgentStore } from '../agent/agent-store'

// ========= 类型 =========

/** 个性化设置向父级请求的导航事件。 */
interface PersonalizationSettingsPanelEmits {
  /** 打开当前账户的数据与记忆管理入口。 */
  (event: 'open-data'): void
}

// ========= 变量 =========

/** 组件事件。 */
const emit = defineEmits<PersonalizationSettingsPanelEmits>()

/** 应用作用域 Agent Store。 */
const agent = useAgentStore()

/** 删除画像确认框状态。 */
const deleteDialogVisible = ref<boolean>(false)

/** 用户补充偏好草稿。 */
const supplementDraft = ref<string>('')

/** 各画像结论的纠正草稿。 */
const correctionDrafts = ref<Record<string, string>>({})

/** 当前脱敏画像快照。 */
const profile = computed(() => agent.snapshot.value.personalization)

/** 当前是否正在采集或分析。 */
const working = computed<boolean>(() =>
  ['collecting', 'ready_local', 'analyzing'].includes(profile.value.status))

/** 当前状态文案。 */
const statusLabel = computed<string>(() => ({
  unavailable: '尚未生成',
  collecting: '正在采集',
  ready_local: '本地聚合完成',
  analyzing: '模型分析中',
  ready: '可用',
  stale: '建议更新',
  paused: '已暂停更新',
  failed: '上次任务失败'
})[profile.value.status])

// ========= 函数 =========

/** 从设置页手动生成或更新画像。 */
async function runAnalysis(mode: 'initialize' | 'update' | 'regenerate'): Promise<void> {
  await agent.startProfileAnalysis(mode)
}

/** 暂停或恢复画像更新。 */
async function togglePause(): Promise<void> {
  if (profile.value.paused) await agent.resumeProfile()
  else await agent.pauseProfile()
}

/** 隐藏单条不准确画像结论。 */
async function hideInsight(insightId: string): Promise<void> {
  await agent.setProfileOverride({ kind: 'hidden', insightId })
  showToast('这条结论已隐藏，后续画像与推荐会遵守该修正。', 'success')
}

/** 保存单条画像纠正。 */
async function saveCorrection(insightId: string): Promise<void> {
  /** 当前结论纠正文本。 */
  const value = correctionDrafts.value[insightId]?.trim()
  if (!value) return
  await agent.setProfileOverride({ kind: 'correction', insightId, value })
  correctionDrafts.value[insightId] = ''
  showToast('纠正已保存，并将优先于模型推断。', 'success')
}

/** 保存用户主动补充的音乐偏好。 */
async function saveSupplement(): Promise<void> {
  /** 经裁剪的补充文本。 */
  const value = supplementDraft.value.trim()
  if (!value) return
  await agent.setProfileOverride({ kind: 'supplement', value })
  supplementDraft.value = ''
  showToast('偏好补充已保存。', 'success')
}

/** 确认仅删除当前账户画像与中间证据。 */
async function deleteProfile(): Promise<void> {
  deleteDialogVisible.value = false
  await agent.deleteProfile()
  showToast('音乐人格画像已删除；聊天、记忆与网易云数据保持不变。', 'success')
}

/** 将置信度格式化为百分比。 */
function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** 格式化画像生成时间。 */
function formatUpdatedAt(value: number | undefined): string {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : '—'
}

// ========= 生命周期 =========

onMounted(async () => {
  await agent.initialize()
})
</script>

<template>
  <div class="personalization-settings">
    <section
      id="setting-agent-profile"
      class="personalization-settings-hero"
    >
      <span class="personalization-settings-icon"><Sparkles :size="20" /></span>
      <div>
        <h2>{{ $tSource("音乐人格画像") }}</h2>
        <p>
          {{ $tSource("状态：") }}{{ $tSource(statusLabel) }}<template v-if="profile.usable">
            · v{{ profile.version }} · {{ formatUpdatedAt(profile.updatedAt) }}
          </template>
        </p>
      </div>
      <div class="personalization-settings-actions">
        <CommonButton
          v-if="profile.usable"
          variant="secondary"
          size="compact"
          :disabled="working"
          @click="togglePause"
        >
          <Play
            v-if="profile.paused"
            :size="14"
          />
          <Pause
            v-else
            :size="14"
          />
          {{ $tSource(profile.paused ? '恢复更新' : '暂停更新') }}
        </CommonButton>
        <CommonButton
          v-if="profile.usable"
          variant="secondary"
          size="compact"
          :disabled="working || profile.paused"
          @click="runAnalysis('regenerate')"
        >
          <RotateCcw :size="14" /> {{ $tSource("重新生成") }}
        </CommonButton>
        <CommonButton
          variant="primary"
          size="compact"
          :loading="working"
          :disabled="!profile.eligible || profile.paused"
          @click="runAnalysis(profile.usable ? 'update' : 'initialize')"
        >
          <RotateCcw
            v-if="profile.usable"
            :size="14"
          />
          <Sparkles
            v-else
            :size="14"
          />
          {{ $tSource(profile.usable ? '手动更新' : '开始分析') }}
        </CommonButton>
      </div>
      <div
        v-if="working"
        class="personalization-settings-progress"
      >
        <span :style="{ width: `${profile.progress}%` }" />
        <small>{{ $tSource(profile.stageLabel) }} · {{ profile.progress }}%</small>
      </div>
      <p
        v-if="profile.errorMessage"
        class="personalization-settings-error"
      >
        {{ translatePublicError({ message: profile.errorMessage }) }}
      </p>
      <p class="personalization-settings-disclosure">
        {{ $tSource("完整喜欢与歌单只在本机扫描。云端 Provider 默认只收到聚合特征、有限代表样本和完成当前请求所需的画像/记忆片段，可能产生 Token 费用；不会上传账户数据库、Cookie 或完整歌单文件。") }}
      </p>
    </section>

    <CommonEmptyState
      v-if="!profile.usable"
      :title="$tSource('尚未生成音乐人格画像')"
      :description="$tSource('游客不能生成画像；登录且配置可用模型后，由你手动开始完整分析。')"
    />

    <template v-else>
      <section class="personalization-settings-summary">
        <h3>{{ $tSource("画像摘要") }}</h3>
        <p>{{ profile.summary }}</p>
        <dl v-if="profile.coverage">
          <div><dt>{{ $tSource("喜欢歌曲") }}</dt><dd>{{ profile.coverage.likedSongs }}</dd></div>
          <div><dt>{{ $tSource("自建歌单") }}</dt><dd>{{ profile.coverage.createdPlaylists }}</dd></div>
          <div><dt>{{ $tSource("排行样本") }}</dt><dd>{{ profile.coverage.listeningHistorySongs }}</dd></div>
          <div><dt>{{ $tSource("去重歌曲") }}</dt><dd>{{ profile.coverage.uniqueSongs }}</dd></div>
        </dl>
      </section>

      <section
        id="setting-agent-insights"
        class="personalization-settings-insights"
      >
        <header><h3>{{ $tSource("偏好结论") }}</h3><span>{{ $tSource("变化分") }} {{ profile.prompt.changeScore }}</span></header>
        <article
          v-for="insight in profile.insights"
          :key="insight.insightId"
        >
          <div>
            <span>{{ insight.category }} {{ $tSource("· 置信度") }} {{ formatConfidence(insight.confidence) }}</span>
            <h4>{{ insight.label }}</h4>
            <p>{{ insight.value }}</p>
            <small>{{ insight.evidence.join(' · ') }}</small>
          </div>
          <CommonButton
            variant="ghost"
            size="compact"
            @click="hideInsight(insight.insightId)"
          >
            {{ $tSource("隐藏") }}
          </CommonButton>
          <label>
            <span>{{ $tSource("纠正这条结论") }}</span>
            <CommonInput
              :model-value="correctionDrafts[insight.insightId] ?? ''"
              maxlength="500"
              :placeholder="$tSource('写下你确认的真实偏好')"
              @update:model-value="correctionDrafts[insight.insightId] = String($event)"
            />
          </label>
          <CommonButton
            variant="secondary"
            size="compact"
            :disabled="!correctionDrafts[insight.insightId]?.trim()"
            @click="saveCorrection(insight.insightId)"
          >
            {{ $tSource("保存纠正") }}
          </CommonButton>
        </article>
      </section>

      <section
        id="setting-agent-overrides"
        class="personalization-settings-overrides"
      >
        <h3>{{ $tSource("你的补充与修正") }}</h3>
        <div class="personalization-settings-supplement">
          <CommonInput
            v-model="supplementDraft"
            maxlength="500"
            :placeholder="$tSource('例如：工作时更喜欢无歌词的器乐')"
          />
          <CommonButton
            variant="secondary"
            :disabled="!supplementDraft.trim()"
            @click="saveSupplement"
          >
            {{ $tSource("添加补充") }}
          </CommonButton>
        </div>
        <ul v-if="profile.overrides.length">
          <li
            v-for="override in profile.overrides"
            :key="override.overrideId"
          >
            <span>{{ $tSource(override.kind === 'hidden' ? `已隐藏 ${override.insightId}` : (override.value ?? '')) }}</span>
            <CommonButton
              variant="ghost"
              size="compact"
              @click="agent.removeProfileOverride(override.overrideId)"
            >
              {{ $tSource("移除") }}
            </CommonButton>
          </li>
        </ul>
      </section>

      <section
        id="setting-agent-data"
        class="personalization-settings-data"
      >
        <div>
          <h3>{{ $tSource("记忆与账户数据") }}</h3>
          <p>{{ $tSource("查看当前账户的聊天数量、长期记忆块、画像版本、数据库与缓存，并可按账户清理。") }}</p>
        </div>
        <CommonButton
          variant="secondary"
          @click="emit('open-data')"
        >
          {{ $tSource("查看账户数据") }}
        </CommonButton>
      </section>

      <section
        id="setting-agent-delete-profile"
        class="personalization-settings-danger"
      >
        <div><h3>{{ $tSource("删除画像") }}</h3><p>{{ $tSource("只删除当前账户画像、代表样本缓存和用户修正，不删除聊天、长期记忆或网易云数据。") }}</p></div>
        <CommonButton
          variant="danger"
          @click="deleteDialogVisible = true"
        >
          <Trash2 :size="14" />{{ $tSource("删除画像") }}
        </CommonButton>
      </section>
    </template>

    <CommonAlertDialog
      :visible="deleteDialogVisible"
      :title="$tSource('删除当前账户的音乐人格画像？')"
      :description="$tSource('将删除画像、分析中间特征、代表样本和用户修正；聊天、长期记忆、基础资料与网易云云端数据不会被删除。')"
      :confirm-text="$tSource('删除画像')"
      @cancel="deleteDialogVisible = false"
      @confirm="deleteProfile"
    />
  </div>
</template>

<style scoped>
.personalization-settings { display: grid; gap: 18px; }
.personalization-settings-hero, .personalization-settings-summary, .personalization-settings-insights, .personalization-settings-overrides, .personalization-settings-data, .personalization-settings-danger { padding: 20px; border: 1px solid var(--ncx-color-border); border-radius: var(--ncx-radius-xl); background: var(--ncx-color-surface); }
.personalization-settings-hero { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; }
.personalization-settings-icon { display: inline-flex; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: 14px; color: var(--ncx-color-accent); background: color-mix(in srgb, var(--ncx-color-accent) 12%, transparent); }
.personalization-settings h2, .personalization-settings h3, .personalization-settings h4, .personalization-settings p { margin: 0; }
.personalization-settings-hero > div > p, .personalization-settings-disclosure, .personalization-settings-summary > p, .personalization-settings-danger p { margin-top: 5px; color: var(--ncx-color-text-secondary); font-size: 12px; line-height: 1.55; }
.personalization-settings-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.personalization-settings-progress, .personalization-settings-disclosure, .personalization-settings-error { grid-column: 1 / -1; }
.personalization-settings-progress { display: grid; overflow: hidden; gap: 5px; }
.personalization-settings-progress::before { height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--ncx-color-text-primary) 8%, transparent); content: ''; }
.personalization-settings-progress > span { width: var(--profile-progress, 0%); height: 4px; margin-top: -9px; border-radius: 999px; background: var(--ncx-color-accent); }
.personalization-settings-progress small { color: var(--ncx-color-text-secondary); }
.personalization-settings-error { color: var(--ncx-color-danger); font-size: 12px; }
.personalization-settings-summary dl { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 0; }
.personalization-settings-summary dl > div { padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--ncx-color-text-primary) 4%, transparent); }
.personalization-settings-summary dt { color: var(--ncx-color-text-secondary); font-size: 11px; }
.personalization-settings-summary dd { margin: 4px 0 0; font-size: 18px; font-weight: 700; }
.personalization-settings-insights { display: grid; gap: 10px; }
.personalization-settings-insights > header { display: flex; align-items: center; justify-content: space-between; }
.personalization-settings-insights > header span { color: var(--ncx-color-text-secondary); font-size: 12px; }
.personalization-settings-insights article { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px 14px; padding: 14px; border-radius: 14px; background: color-mix(in srgb, var(--ncx-color-text-primary) 4%, transparent); }
.personalization-settings-insights article > div > span, .personalization-settings-insights article small { color: var(--ncx-color-text-secondary); font-size: 11px; }
.personalization-settings-insights article h4 { margin-top: 4px; }
.personalization-settings-insights article p { margin-top: 4px; font-size: 13px; }
.personalization-settings-insights article small { display: block; margin-top: 6px; }
.personalization-settings-insights label { display: grid; grid-column: 1; gap: 5px; color: var(--ncx-color-text-secondary); font-size: 11px; }
.personalization-settings-supplement { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-top: 12px; }
.personalization-settings-overrides ul { display: grid; gap: 6px; padding: 0; margin: 12px 0 0; list-style: none; }
.personalization-settings-overrides li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--ncx-color-text-primary) 4%, transparent); font-size: 12px; }
.personalization-settings-data { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.personalization-settings-data p { margin-top: 5px; color: var(--ncx-color-text-secondary); font-size: 12px; }
.personalization-settings-danger { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
@media (width < 760px) { .personalization-settings-hero { grid-template-columns: auto 1fr; } .personalization-settings-actions { grid-column: 1 / -1; } .personalization-settings-summary dl { grid-template-columns: repeat(2, 1fr); } }
</style>
