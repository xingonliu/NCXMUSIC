<script setup lang="ts">
// ─────────────────────────────────────────────────────────────────────────────
// AudioHost：应用作用域唯一的内容音频宿主
//
// 架构约束 A-012：常驻 AppShell 根层，位于 RouterView 之外。
// 正常路由切换不得卸载该组件。
//
// HTMLAudioElement 由 HtmlAudioAdapter 在模块作用域创建并持有，不挂到模板上——
// 元素生命周期因此与组件树解耦，即使本组件被意外卸载也不会中断播放。
// 本组件的唯一职责是在根层建立播放器单例，不渲染任何可见内容。
// ─────────────────────────────────────────────────────────────────────────────

import { usePlayer } from '../use-player'

// ── 变量区 ──

// 首次调用即惰性创建播放器单例（引擎、队列、解析器、音频元素）
usePlayer()
</script>

<template>
  <!-- 无可见输出：音频元素由适配器在模块作用域持有 -->
  <span
    class="audio-host"
    aria-hidden="true"
  />
</template>

<style scoped>
/* 不参与布局，不响应指针事件 */
.audio-host {
  display: none;
}
</style>
