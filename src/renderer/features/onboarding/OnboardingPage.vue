<script setup lang="ts">
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Headphones,
  LockKeyhole,
  LogIn,
  Music2,
  Sparkles
} from '@lucide/vue'
import { computed, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'

import { CommonButton } from '../../design-system/components'
import { useAccountSessionStore } from '../account/account-session-store'
import ModelSettingsPanel from '../settings/ModelSettingsPanel.vue'
import '../settings/settings-page.css'
import './onboarding-page.css'

// ========= 类型 =========

/** 首次引导步骤。 */
interface OnboardingStep {
  /** 稳定步骤编号。 */
  readonly id: number
  /** Lucide 主图标。 */
  readonly icon: Component
  /** 标题。 */
  readonly title: string
  /** 简短说明。 */
  readonly description: string
}

// ========= 变量 =========

/** 首次引导完成标记。 */
const ONBOARDING_COMPLETED_KEY = 'ncx.onboarding.completed.v1'

/** 路由控制器。 */
const router = useRouter()

/** 网易云账户控制器。 */
const account = useAccountSessionStore()

/** 冻结七步引导。 */
const steps: readonly OnboardingStep[] = [
  { id: 1, icon: Sparkles, title: '欢迎使用 Ncxmusic', description: '一个高颜值音乐客户端，也是一位真正能替你操作音乐的小云助手。' },
  { id: 2, icon: Headphones, title: '认识播放器', description: '从发现、搜索、歌单到歌词，所有播放入口共享同一队列与真实播放状态。' },
  { id: 3, icon: Bot, title: '认识小云', description: '说出“下一首”或“播放一首周杰伦”，小云会调用工具并等待真实回执。' },
  { id: 4, icon: LogIn, title: '连接网易云账户', description: '使用官方网页登录解锁我喜欢、歌单与评论写入；也可以先以游客身份继续。' },
  { id: 5, icon: LockKeyhole, title: '数据与安全', description: '聊天与账户数据按账号隔离；模型 Key 由系统加密；音乐和命令拥有独立安全等级。' },
  { id: 6, icon: Cloud, title: '配置你的模型', description: '选择协议与服务，填写自己的 API Key，并验证流式与 Tool Call 能力。' },
  { id: 7, icon: Check, title: '准备完成', description: '播放器不依赖模型；以后也可以随时在设置中配置或切换 Provider Profile。' }
]

/** 当前步骤索引。 */
const currentIndex = ref<number>(0)

/** 当前步骤。 */
const currentStep = computed<OnboardingStep>(() => steps[currentIndex.value] ?? steps[0]!)

/** 是否为最后一步。 */
const isLastStep = computed<boolean>(() => currentIndex.value === steps.length - 1)

/** 是否为模型配置步骤。 */
const isModelStep = computed<boolean>(() => currentStep.value.id === 6)

/** 是否为网易云登录步骤。 */
const isAccountStep = computed<boolean>(() => currentStep.value.id === 4)

// ========= 函数 =========

/** 前往上一步。 */
function previous(): void {
  currentIndex.value = Math.max(0, currentIndex.value - 1)
}

/** 前往下一步或完成引导。 */
function next(): void {
  if (isLastStep.value) {
    complete()
    return
  }
  currentIndex.value = Math.min(steps.length - 1, currentIndex.value + 1)
}

/** 打开官方网易云登录。 */
async function login(): Promise<void> {
  await window.ncx.account.login()
  await account.refresh()
}

/** 完成或跳过引导并进入发现页。 */
function complete(): void {
  localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
  void router.replace({ name: 'discover' })
}
</script>

<template>
  <section
    class="onboarding-page"
    aria-labelledby="onboarding-title"
  >
    <header class="onboarding-header">
      <div class="onboarding-brand">
        <Music2 :size="18" /><strong>Ncxmusic</strong>
      </div>
      <button
        type="button"
        @click="complete"
      >
        {{ $tSource("跳过") }}
      </button>
    </header>

    <nav
      class="onboarding-progress"
      :aria-label="$tSource('首次引导进度')"
    >
      <span
        v-for="step in steps"
        :key="step.id"
        :class="{ 'is-current': step.id === currentStep.id, 'is-complete': step.id < currentStep.id }"
      />
    </nav>

    <main
      class="onboarding-content"
      :class="{ 'is-model-step': isModelStep }"
    >
      <section class="onboarding-copy">
        <span class="onboarding-step-icon"><component
          :is="currentStep.icon"
          :size="30"
          :stroke-width="1.65"
        /></span>
        <small>0{{ currentStep.id }} / 07</small>
        <h1 id="onboarding-title">
          {{ $tSource(currentStep.title) }}
        </h1>
        <p>{{ $tSource(currentStep.description) }}</p>
      </section>

      <section
        v-if="currentStep.id === 2"
        class="onboarding-demo player-demo"
        :aria-label="$tSource('播放器能力演示')"
      >
        <div class="demo-artwork">
          <Music2 :size="36" />
        </div>
        <div><strong>{{ $tSource("雨后的城市") }}</strong><span>{{ $tSource("小云精选 · 正在播放") }}</span></div>
        <span class="demo-wave"><i /><i /><i /><i /></span>
      </section>

      <section
        v-else-if="currentStep.id === 3"
        class="onboarding-demo agent-demo"
        :aria-label="$tSource('小云工具演示')"
      >
        <div class="demo-user-message">
          {{ $tSource("下一首") }}
        </div>
        <div class="demo-tool-line">
          <Bot :size="15" /><span>{{ $tSource("控制播放器") }}</span><i />
        </div>
        <div class="demo-agent-message">
          {{ $tSource("已经切换到下一首。") }}
        </div>
      </section>

      <section
        v-else-if="isAccountStep"
        class="onboarding-action-card"
      >
        <LogIn :size="22" />
        <div><strong>{{ $tSource("官方网页登录") }}</strong><span>{{ $tSource("Cookie 只由 Main 持有，不向页面或模型暴露。") }}</span></div>
        <CommonButton
          variant="primary"
          @click="login"
        >
          {{ $tSource("登录网易云") }}
        </CommonButton>
      </section>

      <section
        v-else-if="currentStep.id === 5"
        class="onboarding-security-grid"
      >
        <article><LockKeyhole :size="18" /><strong>{{ $tSource("本地加密") }}</strong><span>{{ $tSource("API Key 不进普通配置") }}</span></article>
        <article><Music2 :size="18" /><strong>M1～M4</strong><span>{{ $tSource("音乐代操作权限") }}</span></article>
        <article><Cloud :size="18" /><strong>S1～S4</strong><span>{{ $tSource("命令执行权限") }}</span></article>
      </section>

      <ModelSettingsPanel
        v-else-if="isModelStep"
        class="onboarding-model-panel"
      />
    </main>

    <footer class="onboarding-footer">
      <CommonButton
        variant="secondary"
        :disabled="currentIndex === 0"
        @click="previous"
      >
        <ChevronLeft :size="15" />{{ $tSource("返回") }}
      </CommonButton>
      <span v-if="isAccountStep || isModelStep">{{ $tSource("可以跳过，稍后在设置中完成") }}</span>
      <CommonButton
        variant="primary"
        @click="next"
      >
        {{ $tSource(isLastStep ? '进入 Ncxmusic' : '下一步') }}<ChevronRight
          v-if="!isLastStep"
          :size="15"
        />
      </CommonButton>
    </footer>
  </section>
</template>
