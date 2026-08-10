<script setup lang="ts">
import { ShieldCheck, TerminalSquare } from '@lucide/vue'
import { onMounted } from 'vue'

import { CommonSwitch } from '../../design-system/components'
import SafetyControl from '../agent/components/SafetyControl.vue'
import { useAgentStore } from '../agent/agent-store'
import '../agent/agent-page.css'

// ========= 变量 =========

/** 应用作用域 Agent 安全设置。 */
const agent = useAgentStore()

// ========= 生命周期 =========

onMounted(() => { void agent.initialize() })
</script>

<template>
  <div class="settings-list">
    <section class="settings-row">
      <span class="settings-row-icon"><ShieldCheck :size="19" /></span>
      <div class="settings-row-copy">
        <h2>音乐安全</h2>
        <p>M1～M4 只约束小云代操作；界面中的直接操作不经过 Agent 审批。</p>
      </div>
      <SafetyControl
        kind="music"
        :model-value="agent.snapshot.value.musicSafetyLevel"
        @update:model-value="agent.setMusicSafetyLevel($event as typeof agent.snapshot.value.musicSafetyLevel)"
      />
    </section>
    <section class="settings-row">
      <span class="settings-row-icon"><TerminalSquare :size="19" /></span>
      <div class="settings-row-copy">
        <h2>命令安全</h2>
        <p>S1～S4 只影响通过结构、参数和授权工作区审查的 Shell 命令。</p>
      </div>
      <SafetyControl
        kind="command"
        :model-value="agent.snapshot.value.commandSafetyLevel"
        @update:model-value="agent.setCommandSafetyLevel($event as typeof agent.snapshot.value.commandSafetyLevel)"
      />
    </section>
    <section class="settings-row">
      <span class="settings-row-icon"><TerminalSquare :size="19" /></span>
      <div class="settings-row-copy">
        <h2>Shell Tool</h2>
        <p>关闭后小云看不到 Shell Tool，提高 S 等级也不会重新启用。</p>
      </div>
      <CommonSwitch
        :model-value="agent.snapshot.value.shellToolEnabled"
        label="启用 Shell Tool"
        @update:model-value="agent.setShellToolEnabled"
      />
    </section>
  </div>
</template>
