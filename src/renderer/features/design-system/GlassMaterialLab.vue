<script setup lang="ts">
import { ref } from 'vue'
import GlassSurface from '../../design-system/materials/GlassSurface'
import { CommonButton, CommonIconButton, CommonDialog, CommonDrawer, CommonHeaderButton } from '../../design-system/components'

// -- State and Variables
const clicks = ref(0)
const moving = ref(false)
const dark = ref(false)
const wide = ref(false)
const modalOpen = ref(false)
const drawerOpen = ref(false)
// -- Functions
function toggleTheme(): void {
  dark.value = !dark.value
  document.documentElement.dataset['theme'] = dark.value ? 'dark' : 'light'
}
</script>

<template>
  <section class="glass-material-lab">
    <header class="glass-lab-toolbar">
      <h1>{{ $tSource("液态玻璃材质验证") }}</h1>
      <button @click="toggleTheme">
        {{ $tSource("切换主题") }}
      </button>
      <button @click="moving = !moving">
        {{ $tSource("背景运动") }}
      </button>
      <button @click="wide = !wide">
        {{ $tSource("调整尺寸") }}
      </button>
      <button @click="modalOpen = true">
        {{ $tSource("打开弹窗") }}
      </button>
      <button @click="drawerOpen = true">
        {{ $tSource("打开抽屉") }}
      </button>
      <CommonHeaderButton
        :label="$tSource('Header 返回')"
        @click="clicks++"
      >
        ←
      </CommonHeaderButton>
      <output :aria-label="$tSource('点击次数')">{{ clicks }}</output>
    </header>
    <div
      class="glass-lab-stage"
      :class="{ 'is-moving': moving, 'is-wide': wide }"
    >
      <div class="glass-lab-backdrop" />
      <div class="glass-lab-samples">
        <CommonButton
          class="glass-lab-button"
          material="clear"
          data-testid="clear"
          @click="clicks++"
        >
          {{ $tSource("透明玻璃 · 播放") }}
        </CommonButton>
        <CommonButton
          class="glass-lab-button"
          material="tinted"
          variant="primary"
          data-testid="tinted"
          @click="clicks++"
        >
          {{ $tSource("彩色玻璃 · 应用") }}
        </CommonButton>
        <CommonButton
          class="glass-lab-button"
          material="blur"
          data-testid="blur"
          @click="clicks++"
        >
          {{ $tSource("简化玻璃 · 返回") }}
        </CommonButton>
        <CommonIconButton
          material="clear"
          class="glass-lab-icon"
          data-testid="icon"
          :label="$tSource('收藏')"
          @click="clicks++"
        >
          ♡
        </CommonIconButton>
        <CommonButton
          class="glass-lab-button"
          material="tinted"
          variant="danger"
          data-testid="danger"
          @click="clicks++"
        >
          {{ $tSource("删除") }}
        </CommonButton>
        <CommonButton
          class="glass-lab-button"
          material="blur"
          disabled
          data-testid="disabled"
        >
          {{ $tSource("不可用") }}
        </CommonButton>
      </div>
      <section
        class="glass-lab-panel ncx-glass-host"
        data-testid="dialog"
      >
        <GlassSurface material="dialog" />
        <div class="glass-lab-panel-content">
          <h2>{{ $tSource("Dialog 面板材质") }}</h2>
          <p>{{ $tSource("正文始终清晰，玻璃只折射背后的内容。面板内部滚动、选择文本和按钮操作保持正常。") }}</p>
          <div
            class="glass-lab-scroll"
            tabindex="0"
          >
            <p
              v-for="index in 12"
              :key="index"
            >
              {{ index }} {{ $tSource("· 音乐与材质，清晰的阅读区域") }}
            </p>
          </div>
          <footer>
            <CommonButton
              class="glass-lab-button"
              material="clear"
              @click="clicks++"
            >
              {{ $tSource("取消") }}
            </CommonButton>
            <CommonButton
              class="glass-lab-button"
              material="tinted"
              variant="primary"
              @click="clicks++"
            >
              {{ $tSource("确认") }}
            </CommonButton>
          </footer>
        </div>
      </section>
    </div>
    <CommonDialog
      :visible="modalOpen"
      :title="$tSource('材质弹窗')"
      @close="modalOpen = false"
    >
      <p>{{ $tSource("实际通用弹窗：焦点、键盘、清晰正文。") }}</p>
      <template #actions>
        <CommonButton
          material="tinted"
          variant="primary"
          @click="modalOpen = false"
        >
          {{ $tSource("完成") }}
        </CommonButton>
      </template>
    </CommonDialog>
    <CommonDrawer
      :visible="drawerOpen"
      :title="$tSource('材质抽屉')"
      @close="drawerOpen = false"
    >
      <p
        v-for="index in 40"
        :key="index"
      >
        {{ index }} {{ $tSource("· 可滚动的播放队列") }}
      </p>
    </CommonDrawer>
  </section>
</template>

<style>
.glass-material-lab { color: var(--ncx-color-text-primary); font-family: system-ui, sans-serif; }
.glass-lab-toolbar { display: flex; align-items: center; gap: 16px; padding: 20px; flex-wrap: wrap; }
.glass-lab-toolbar h1 { margin: 0 auto 0 0; font-size: 20px; }
.glass-lab-stage { position: relative; padding: 60px; min-height: 680px; overflow: hidden; }
.glass-lab-backdrop { position: absolute; inset: -80px; background: repeating-linear-gradient(115deg, transparent 0 35px, rgb(255 255 255 / 65%) 36px 40px, transparent 41px 76px), radial-gradient(ellipse at 15% 20%, #ffd16e, transparent 50%), radial-gradient(ellipse at 85% 80%, #a68cff, transparent 60%), linear-gradient(30deg, #235d78, #9ad1ce); }
.is-moving .glass-lab-backdrop { animation: glass-lab-drift 3s linear infinite alternate; }
.glass-lab-samples { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-bottom: 48px; }
.glass-lab-button { min-height: 48px; min-width: 150px; padding: 12px 24px; border: 0; border-radius: var(--ncx-squircle-radius-lg); background: transparent; color: inherit; font: inherit; cursor: pointer; }
.glass-lab-button:has([data-tone='accent']), .glass-lab-button:has([data-tone='danger']) { color: white; }
.glass-lab-button:focus-visible { outline: 3px solid var(--ncx-color-accent); outline-offset: 5px; }
.glass-lab-button:disabled { opacity: 0.5; cursor: default; }
.glass-lab-label { position: relative; z-index: 1; display: inline-block; transform: translate(var(--ncx-press-x, 0px), var(--ncx-press-y, 0px)) scale(var(--ncx-press-sx, 1), var(--ncx-press-sy, 1)); }
.glass-lab-icon { min-width: 48px; width: 48px; padding: 0; font-size: 28px; }
.glass-lab-panel { width: min(100%, 440px); border-radius: var(--ncx-squircle-radius-2xl); }
.glass-lab-panel-content { position: relative; z-index: 1; padding: 28px; }
.glass-lab-panel-content h2 { margin-top: 0; }
.glass-lab-panel-content p { line-height: 1.65; }
.glass-lab-scroll { height: 100px; overflow: auto; margin: 20px 0; }
.glass-lab-panel-content footer { display: flex; gap: 20px; }
.glass-lab-panel-content footer button { flex: 1; min-width: 0; }
.is-wide .glass-lab-panel { width: min(100%, 680px); }
.is-wide .glass-lab-samples > button { min-width: 190px; }
@keyframes glass-lab-drift { to { transform: translateX(70px); } }
@media (prefers-reduced-motion: reduce) { .is-moving .glass-lab-backdrop { animation: none; } .glass-lab-label { transform: none; } }
</style>
