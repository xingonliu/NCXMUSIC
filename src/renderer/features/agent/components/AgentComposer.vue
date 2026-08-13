<script setup lang="ts">
import { ArrowUp, ChevronDown, Folder, Mic, Plus, Square } from '@lucide/vue'
import { computed, onMounted, ref, type DeepReadonly } from 'vue'
import { useRouter } from 'vue-router'

import type { AgentSnapshot } from '../../../../shared/schemas/agent'
import type { PublicProviderProfile } from '../../../../shared/schemas/provider-profile'
import {
  CommonDropdownMenu,
  CommonIconButton,
  type CommonMenuItem
} from '../../../design-system/components'
import { showToast } from '../../../design-system/use-toast'
import SafetyControl from './SafetyControl.vue'
import { useVoiceInput } from '../../voice/use-voice-input'

// ========= 类型 =========

interface AgentComposerProps {
  readonly snapshot: DeepReadonly<AgentSnapshot>
  readonly contextLabel?: string
}

interface AgentComposerEmits {
  (event: 'send', content: string): void
  (event: 'stop'): void
  (event: 'music-safety', level: AgentSnapshot['musicSafetyLevel']): void
  (event: 'command-safety', level: AgentSnapshot['commandSafetyLevel']): void
}

// ========= 变量 =========

const props = defineProps<AgentComposerProps>()
const emit = defineEmits<AgentComposerEmits>()

/** 路由实例，用于跳转模型设置。 */
const router = useRouter()

/** 输入框绑定的消息文本。 */
const content = ref<string>('')

/** 可选模型 Profile 列表。 */
const profiles = ref<PublicProviderProfile[]>([])

/** 当前全局激活的默认 Profile ID。 */
const activeProfileId = ref<string | undefined>()

/** 模型列表切换处理中状态。 */
const profileChanging = ref<boolean>(false)

/** 应用作用域语音输入控制器。 */
const voice = useVoiceInput()

/** 当前 Agent 是否正在处于活动处理状态。 */
const active = computed<boolean>(() => !['idle', 'completed', 'cancelled', 'failed'].includes(props.snapshot.turnStatus))

/** 当前是否具备发送消息条件。 */
const canSend = computed<boolean>(() => content.value.trim().length > 0 && props.snapshot.configured)

/** 当前活动模型的展示名称。 */
const activeModelDisplayName = computed<string>(() => {
  const activeProfile = profiles.value.find((item) => item.profileId === activeProfileId.value)
  return activeProfile?.displayName ?? 'NCX Agent 极高'
})

/** 快速切换模型的下拉菜单项列表。 */
const modelMenuItems = computed<CommonMenuItem[]>(() => {
  const items: CommonMenuItem[] = []
  const enabledProfiles = profiles.value.filter((profile) => profile.enabled)

  if (enabledProfiles.length > 0) {
    items.push({ type: 'header', label: '默认模型', value: 'header-models' })
    for (const profile of enabledProfiles) {
      items.push({
        label: profile.displayName,
        value: profile.profileId,
        checked: profile.profileId === activeProfileId.value,
        indented: true
      })
    }
    items.push({ type: 'separator', label: '', value: 'sep-settings' })
  }

  items.push({
    label: '⚙️ 模型设置...',
    value: '__go_to_settings__'
  })

  return items
})

// ========= 函数 =========

/** 提交发送消息。 */
function submit(): void {
  const trimmed = content.value.trim()
  if (!trimmed || !props.snapshot.configured) return
  content.value = ''
  emit('send', trimmed)
}

/** 处理键盘按键响应，Enter 发送。 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  submit()
}

/** 输入区麦克风按下时捕获指针并开始录音。 */
function handleVoicePointerDown(event: PointerEvent): void {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  void voice.press('composer-button')
}

/** 输入区麦克风松开或取消时结束本次录音。 */
function handleVoicePointerEnd(event: PointerEvent): void {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
  voice.release('composer-button')
}

/** 键盘按住 Space/Enter 时提供等价的按住说话入口。 */
function handleVoiceKeyDown(event: KeyboardEvent): void {
  if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
  event.preventDefault()
  void voice.press('composer-button')
}

/** 键盘松开 Space/Enter 时结束录音。 */
function handleVoiceKeyUp(event: KeyboardEvent): void {
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  voice.release('composer-button')
}

/** 加载 Main 持有的模型 Profile 列表。 */
async function loadProfiles(): Promise<void> {
  try {
    const result = await window.ncx.providerProfiles.request({ operation: 'list' })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
  } catch {
    // 忽略未配置或加载异常，保留默认展示
  }
}

/** 处理模型下拉菜单选择。 */
async function handleSelectModel(selectedValue: string): Promise<void> {
  if (selectedValue === '__go_to_settings__') {
    void router.push({ name: 'settings', query: { tab: 'models' } })
    return
  }

  if (selectedValue === activeProfileId.value || profileChanging.value) return
  profileChanging.value = true

  try {
    const result = await window.ncx.providerProfiles.request({
      operation: 'setDefault',
      profileId: selectedValue
    })
    profiles.value = result.profiles
    activeProfileId.value = result.activeProfileId
    const targetProfile = result.profiles.find((p) => p.profileId === selectedValue)
    if (targetProfile) {
      showToast(`已将默认模型切换为 ${targetProfile.displayName}`, 'success')
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '切换默认模型失败', 'warning')
  } finally {
    profileChanging.value = false
  }
}

// ========= 生命周期 =========

onMounted(() => {
  void loadProfiles()
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
      <textarea
        v-model="content"
        rows="1"
        :disabled="!snapshot.configured"
        :placeholder="snapshot.configured ? '随心输入' : '请先配置语言模型'"
        @keydown="handleKeydown"
      />
      <div class="agent-composer-bottom-bar">
        <div class="agent-composer-left-controls">
          <CommonIconButton
            label="添加文件或上下文"
            size="default"
            variant="ghost"
          >
            <Plus :size="16" />
          </CommonIconButton>
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

          <!-- 快速切换默认模型下拉菜单 -->
          <CommonDropdownMenu
            :items="modelMenuItems"
            placement="top-end"
            @select="handleSelectModel"
            @open-change="loadProfiles"
          >
            <template #trigger="{ open, toggle }">
              <button
                type="button"
                class="agent-model-select-pill"
                :class="{ 'is-open': open }"
                @click="toggle"
              >
                <span>{{ activeModelDisplayName }}</span>
                <ChevronDown
                  :size="12"
                  class="agent-model-chevron"
                />
              </button>
            </template>
          </CommonDropdownMenu>

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

