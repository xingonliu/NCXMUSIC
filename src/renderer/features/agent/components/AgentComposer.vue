<script setup lang="ts">
import { ArrowDown, ArrowUp, Folder, Mic, Square } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, watch, type DeepReadonly } from 'vue'

import type { AgentSnapshot } from '../../../../shared/schemas/agent'
import type { PublicProviderProfile } from '../../../../shared/schemas/provider-profile'
import {
  CommonIconButton,
  CommonSelect,
  type CommonOption
} from '../../../design-system/components'
import { showToast } from '../../../design-system/use-toast'
import SafetyControl from './SafetyControl.vue'
import { useVoiceInput } from '../../voice/use-voice-input'

// ========= 类型定义 =========

interface AgentComposerProps {
  readonly snapshot: DeepReadonly<AgentSnapshot>
  readonly contextLabel?: string
  readonly showScrollToBottom?: boolean
}

interface AgentComposerEmits {
  (event: 'send', content: string): void
  (event: 'stop'): void
  (event: 'music-safety', level: AgentSnapshot['musicSafetyLevel']): void
  (event: 'command-safety', level: AgentSnapshot['commandSafetyLevel']): void
  (event: 'scroll-to-bottom'): void
}

// ========= 变量 =========

/** 组件属性定义 */
const props = defineProps<AgentComposerProps>()
/** 组件事件定义 */
const emit = defineEmits<AgentComposerEmits>()

/** 输入框绑定的消息文本 */
const content = ref<string>('')

/** 输入框 HTML 元素引用 */
const textareaRef = ref<HTMLTextAreaElement | null>(null)

/** 可选模型 Profile 列表 */
const profiles = ref<PublicProviderProfile[]>([])

/** 当前全局激活的默认 Profile ID */
const activeProfileId = ref<string | undefined>()

/** 模型列表切换处理中状态 */
const profileChanging = ref<boolean>(false)

/** 应用作用域语音输入控制器 */
const voice = useVoiceInput()

/** 当前 Agent 是否处于活动处理状态 */
const active = computed<boolean>(() => !['idle', 'completed', 'cancelled', 'failed'].includes(props.snapshot.turnStatus))

/** 当前是否具备发送消息条件 */
const canSend = computed<boolean>(() => content.value.trim().length > 0 && props.snapshot.configured)

/** 当前活动模型的展示名称 */
const activeModelDisplayName = computed<string>(() => {
  const activeProfile = profiles.value.find((item) => item.profileId === activeProfileId.value)
  return activeProfile?.displayName ?? 'NCX Agent 极高'
})

/** 快速切换模型的 CommonSelect 选项列表 */
const modelSelectOptions = computed<CommonOption[]>(() => {
  const enabledProfiles = profiles.value.filter((profile) => profile.enabled)
  return enabledProfiles.map((profile) => ({
    label: profile.displayName,
    value: profile.profileId
  }))
})

// ======== 函数 ========

/** 动态计算并调整输入框高度，最高限制为 350px */
function adjustTextareaHeight(): void {
  void nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    if (!content.value) {
      el.style.height = ''
      return
    }
    const targetHeight = Math.min(el.scrollHeight, 350)
    el.style.height = `${targetHeight}px`
  })
}

/** 提交发送消息 */
function submit(): void {
  const trimmed = content.value.trim()
  if (!trimmed || !props.snapshot.configured) return
  content.value = ''
  adjustTextareaHeight()
  emit('send', trimmed)
}

/** 处理键盘按键响应，Enter 发送 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  submit()
}

/** 输入区麦克风按下时捕获指针并开始录音 */
function handleVoicePointerDown(event: PointerEvent): void {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  void voice.press('composer-button')
}

/** 输入区麦克风松开或取消时结束本次录音 */
function handleVoicePointerEnd(event: PointerEvent): void {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
  voice.release('composer-button')
}

/** 键盘按住 Space/Enter 时提供等价的按住说话入口 */
function handleVoiceKeyDown(event: KeyboardEvent): void {
  if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
  event.preventDefault()
  void voice.press('composer-button')
}

/** 键盘松开 Space/Enter 时结束录音 */
function handleVoiceKeyUp(event: KeyboardEvent): void {
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  voice.release('composer-button')
}

/** 加载 Main 持有的模型 Profile 列表 */
async function loadProfiles(): Promise<void> {
  try {
    const result = await window.ncx.providerProfiles.request({ operation: 'list' })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
  } catch {
    // 忽略未配置或加载异常，保留默认展示
  }
}

/** 处理模型 CommonSelect 下拉选择 */
async function handleSelectModel(selectedValue: string | number): Promise<void> {
  const selectedId = String(selectedValue)
  if (selectedId === activeProfileId.value || profileChanging.value) return
  profileChanging.value = true

  try {
    const result = await window.ncx.providerProfiles.request({
      operation: 'setDefault',
      profileId: selectedId
    })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
    const targetProfile = result.profiles.find((p) => p.profileId === selectedId)
    if (targetProfile) {
      showToast(`已将默认模型切换为 ${targetProfile.displayName}`, 'success')
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '切换默认模型失败', 'warning')
  } finally {
    profileChanging.value = false
  }
}

// ======== 生命周期 ========

onMounted(() => {
  void loadProfiles()
  adjustTextareaHeight()
})

watch(content, () => {
  adjustTextareaHeight()
})
</script>

<template>
  <section
    class="agent-composer"
    aria-label="给 Agent 发送消息"
  >
    <!-- Floating Context Pill above composer -->
    <div
      v-if="contextLabel"
      class="agent-composer-context-pill"
    >
      <Folder :size="13" />
      <span>{{ contextLabel }}</span>
    </div>

    <!-- Composer Rounded Container -->
    <div class="agent-composer-box">
      <!-- 滚动到底部圆形按钮：在输入框上方水平居中，当不在最底部时展示 -->
      <Transition name="agent-scroll-btn-fade">
        <button
          v-if="showScrollToBottom"
          type="button"
          class="agent-scroll-to-bottom-btn"
          aria-label="滚动到底部"
          title="滚动到底部"
          @click="emit('scroll-to-bottom')"
        >
          <ArrowDown
            :size="16"
            :stroke-width="2.2"
          />
        </button>
      </Transition>

      <textarea
        ref="textareaRef"
        v-model="content"
        rows="1"
        :disabled="!snapshot.configured"
        :placeholder="snapshot.configured ? '随心输入' : '请先配置语言模型'"
        @keydown="handleKeydown"
        @input="adjustTextareaHeight"
      />
      <div class="agent-composer-bottom-bar">
        <div class="agent-composer-left-controls">
          <SafetyControl
            kind="music"
            :model-value="snapshot.musicSafetyLevel"
            @update:model-value="emit('music-safety', $event as AgentSnapshot['musicSafetyLevel'])"
          />
          <SafetyControl
            kind="command"
            :model-value="snapshot.commandSafetyLevel"
            @update:model-value="emit('command-safety', $event as AgentSnapshot['commandSafetyLevel'])"
          />
        </div>
        <div class="agent-composer-right-controls">
          <CommonIconButton
            label="按住说话"
            size="default"
            variant="ghost"
            :class="{ 'is-voice-listening': voice.state.value === 'listening' }"
            @pointerdown="handleVoicePointerDown"
            @pointerup="handleVoicePointerEnd"
            @pointercancel="handleVoicePointerEnd"
            @keydown="handleVoiceKeyDown"
            @keyup="handleVoiceKeyUp"
          >
            <Mic :size="16" />
          </CommonIconButton>

          <!-- 快速切换默认模型 CommonSelect -->
          <CommonSelect
            :model-value="activeProfileId ?? ''"
            :options="modelSelectOptions"
            :placeholder="activeModelDisplayName"
            size="compact"
            class="agent-model-select"
            @change="handleSelectModel"
          />

          <CommonIconButton
            v-if="active"
            label="停止当前任务"
            class="agent-composer-send-btn is-stop"
            @click="emit('stop')"
          >
            <Square
              :size="12"
              fill="currentColor"
            />
          </CommonIconButton>
          <CommonIconButton
            v-else
            label="发送消息"
            class="agent-composer-send-btn"
            :disabled="!canSend"
            @click="submit"
          >
            <ArrowUp
              :size="16"
              :stroke-width="2.2"
            />
          </CommonIconButton>
        </div>
      </div>
    </div>
  </section>
</template>
