<script setup lang="ts">
import { ShieldCheck, TerminalSquare } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import type { ShellWorkspaceSnapshot } from '../../../shared/schemas/shell'
import { CommonButton, CommonSwitch } from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import SafetyControl from '../agent/components/SafetyControl.vue'
import { useAgentStore } from '../agent/agent-store'
import '../agent/agent-page.css'

// ========= 变量 =========

/** 应用作用域 Agent 安全设置。 */
const agent = useAgentStore()

/** 用户明确授权的 Shell 工作区。 */
const shellWorkspaces = ref<ShellWorkspaceSnapshot[]>([])

// ========= 函数 =========

/** 读取 Main 权威工作区授权。 */
async function loadShellWorkspaces(): Promise<void> {
  /** Main 返回的授权列表。 */
  const result = await window.ncx.shellSettings.request({ operation: 'snapshot' })
  shellWorkspaces.value = result.workspaces
}

/** 通过系统目录选择器新增授权。 */
async function chooseShellWorkspace(): Promise<void> {
  /** Main 完成目录选择后的结果。 */
  const result = await window.ncx.shellSettings.request({ operation: 'chooseWorkspace' })
  shellWorkspaces.value = result.workspaces
  if (result.message) showToast(result.message, 'success')
}

/** 移除一个工作区授权。 */
async function removeShellWorkspace(workspaceId: string): Promise<void> {
  /** Main 完成移除后的结果。 */
  const result = await window.ncx.shellSettings.request({ operation: 'removeWorkspace', workspaceId })
  shellWorkspaces.value = result.workspaces
  if (result.message) showToast(result.message, 'success')
}

// ========= 生命周期 =========

onMounted(() => {
  void agent.initialize()
  void loadShellWorkspaces()
})
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
    <section class="settings-row settings-workspace-row">
      <span class="settings-row-icon"><TerminalSquare :size="19" /></span>
      <div class="settings-row-copy">
        <h2>授权工作区</h2>
        <p>Shell 的 cwd 和路径参数必须留在以下目录；未授权时只使用应用临时工作区。</p>
        <div class="settings-workspace-list">
          <span v-for="workspace in shellWorkspaces" :key="workspace.id">
            <span><strong>{{ workspace.name }}</strong><small>{{ workspace.rootPath }}</small></span>
            <CommonButton variant="ghost" @click="removeShellWorkspace(workspace.id)">移除</CommonButton>
          </span>
          <small v-if="shellWorkspaces.length === 0">尚未授权用户目录。</small>
        </div>
      </div>
      <CommonButton variant="secondary" @click="chooseShellWorkspace">授权目录</CommonButton>
    </section>
  </div>
</template>
