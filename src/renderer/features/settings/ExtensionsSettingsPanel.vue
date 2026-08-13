<script setup lang="ts">
import { Boxes, Download, PackagePlus, RefreshCw, Server, Upload } from '@lucide/vue'
import { computed, onMounted, ref, shallowRef } from 'vue'

import type {
  ExtensionSettingsSnapshot,
  McpServerEditable,
  McpServerSnapshot,
  SkillSnapshot
} from '../../../shared/schemas/extensions'
import {
  CommonAlertDialog,
  CommonButton,
  CommonInput,
  CommonSelect,
  CommonSwitch,
  CommonTextarea,
  type CommonOption
} from '../../design-system/components'
import { showToast } from '../../design-system/use-toast'
import SettingsSection from './SettingsSection.vue'

// ========= 类型 =========

/** Skill 列表按钮允许的生命周期动作。 */
type SkillAction = 'enable' | 'disable' | 'update' | 'rollback' | 'uninstall'

/** MCP 列表按钮允许的生命周期动作。 */
type McpAction = 'enable' | 'disable' | 'test' | 'rollback' | 'delete'

/** 当前扩展设置面板展示的独立能力。 */
type ExtensionSettingsMode = 'mcp' | 'skill'

/** 扩展设置面板属性。 */
interface ExtensionsSettingsPanelProps {
  /** 当前只展示 MCP 或 Skill，避免两个独立导航入口共享同一页面。 */
  readonly mode: ExtensionSettingsMode
}

/** MCP 编辑表单。 */
interface McpEditor {
  /** 稳定 Server ID。 */
  serverId: string
  /** 展示名称。 */
  displayName: string
  /** 首版稳定传输。 */
  transport: 'stdio' | 'streamable_http'
  /** stdio 命令。 */
  command: string
  /** 每行一个 stdio 参数。 */
  args: string
  /** 可选工作目录。 */
  cwd: string
  /** Streamable HTTP URL。 */
  url: string
  /** 每行 `NAME=value`；读取现有配置时 value 留空。 */
  environment: string
  /** 每行 `Header=value`；读取现有配置时 value 留空。 */
  headers: string
  /** 保存后的初始启用状态。 */
  enabled: boolean
}

/** 设置页用户直接操作的普通确认。 */
interface PendingConfirmation {
  /** 确认标题。 */
  readonly title: string
  /** 操作范围与风险说明。 */
  readonly description: string
  /** 确认按钮文案。 */
  readonly confirmText: string
  /** 普通或危险确认样式。 */
  readonly type: 'warning' | 'danger'
  /** 用户确认后才执行的任务。 */
  readonly task: () => Promise<void>
}

// ========= 变量 =========

/** 当前扩展设置面板属性。 */
const props = defineProps<ExtensionsSettingsPanelProps>()

/** 空扩展快照。 */
const EMPTY_SNAPSHOT: ExtensionSettingsSnapshot = { skills: [], mcpServers: [], updatedAt: 0 }

/** 当前公开扩展快照。 */
const snapshot = ref<ExtensionSettingsSnapshot>(EMPTY_SNAPSHOT)

/** 设置请求是否执行中。 */
const busy = ref<boolean>(false)

/** HTTPS Git Skill URL。 */
const gitUrl = ref<string>('')

/** MCP 导入 JSON 文本。 */
const importDocument = ref<string>('')

/** 上次 MCP 导入预览内容；只含无秘密配置。 */
const importPreview = ref<McpServerEditable[]>([])

/** Main 为当前已展示预览签发的一次性确认令牌。 */
const importPreviewToken = ref<string>('')

/** 当前等待用户普通确认的设置动作。 */
const pendingConfirmation = shallowRef<PendingConfirmation>()

/** MCP 编辑器。 */
const editor = ref<McpEditor>(emptyMcpEditor())

/** 当前选中的 MCP Server。 */
const selectedServer = computed<McpServerSnapshot | undefined>(() =>
  snapshot.value.mcpServers.find((server) => server.serverId === editor.value.serverId)
)

/** MCP Transport 通用选择器选项。 */
const transportOptions: CommonOption[] = [
  { label: 'stdio', value: 'stdio' },
  { label: 'Streamable HTTP', value: 'streamable_http' }
]

// ========= 函数 =========

/** 创建空 MCP 表单。 */
function emptyMcpEditor(): McpEditor {
  return {
    serverId: '',
    displayName: '',
    transport: 'stdio',
    command: '',
    args: '',
    cwd: '',
    url: '',
    environment: '',
    headers: '',
    enabled: false
  }
}

/** 刷新 Skill 与 MCP 公开快照。 */
async function refresh(): Promise<void> {
  busy.value = true
  try {
    /** Main 返回的无秘密设置结果。 */
    const result = await window.ncx.extensions.request({ operation: 'snapshot' })
    snapshot.value = result.snapshot
  } catch (error) {
    showToast(readableError(error), 'warning')
  } finally {
    busy.value = false
  }
}

/** 选择文件夹或 ZIP 导入 Skill。 */
async function chooseSkill(sourceType: 'folder' | 'zip'): Promise<void> {
  requestConfirmation({
    title: `导入 ${sourceType === 'folder' ? '文件夹' : 'ZIP'} Skill？`,
    description: '所选第三方代码将先经过完整校验并以禁用状态安装；启用后会在独立 Skill Host 中运行。',
    confirmText: '选择并导入',
    type: 'warning',
    task: () => runRequest(() => window.ncx.extensions.request({
      operation: 'skill.chooseImport',
      sourceType
    }))
  })
}

/** 从 HTTPS Git 显式安装 Skill。 */
async function installGitSkill(): Promise<void> {
  /** 去除空白后的 HTTPS URL。 */
  const url = gitUrl.value.trim()
  if (!url) {
    showToast('请输入 HTTPS Git URL。', 'warning')
    return
  }
  requestConfirmation({
    title: '从 HTTPS Git 导入 Skill？',
    description: `将暂存、校验并记录该仓库的解析 commit；新 Skill 默认禁用。来源：${url}`,
    confirmText: '导入 Skill',
    type: 'warning',
    task: async () => {
      await runRequest(() => window.ncx.extensions.request({ operation: 'skill.installGit', url }))
      gitUrl.value = ''
    }
  })
}

/** 执行单个 Skill 生命周期操作。 */
function mutateSkill(skill: SkillSnapshot, action: SkillAction): void {
  /** 当前动作展示信息。 */
  const copy = skillActionCopy(skill, action)
  requestConfirmation({
    ...copy,
    task: () => runRequest(() => window.ncx.extensions.request({
      operation: `skill.${action}`,
      name: skill.name
    }))
  })
}

/** 把公开 MCP 快照载入编辑器；秘密值永不回填 Renderer。 */
function editMcp(server: McpServerSnapshot): void {
  editor.value = {
    serverId: server.serverId,
    displayName: server.displayName,
    transport: server.transport,
    command: server.command ?? '',
    args: server.args.join('\n'),
    cwd: server.cwd ?? '',
    url: server.url ?? '',
    environment: server.environmentNames.map((name) => `${name}=`).join('\n'),
    headers: server.headerNames.map((name) => `${name}=`).join('\n'),
    enabled: server.enabled
  }
}

/** 清空 MCP 编辑器以创建新配置。 */
function createMcp(): void {
  editor.value = emptyMcpEditor()
}

/** 设置 MCP 编辑器的传输类型。 */
function setMcpTransport(value: string | number): void {
  editor.value.transport = String(value) === 'streamable_http' ? 'streamable_http' : 'stdio'
}

/** 保存 MCP 无秘密配置与用户本次输入的 Secret。 */
async function saveMcp(): Promise<void> {
  /** 当前表单。 */
  const form = editor.value
  /** 环境变量名和值。 */
  const environment = parseKeyValueLines(form.environment)
  /** HTTP Header 名和值。 */
  const headers = parseKeyValueLines(form.headers)
  /** Renderer 可编辑且不含 Secret 的配置。 */
  const config: McpServerEditable = {
    serverId: form.serverId.trim(),
    displayName: form.displayName.trim(),
    transport: form.transport,
    ...(form.transport === 'stdio' && form.command.trim() ? { command: form.command.trim() } : {}),
    args: lines(form.args),
    ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
    ...(form.transport === 'streamable_http' && form.url.trim() ? { url: form.url.trim() } : {}),
    environmentNames: Object.keys(environment),
    headerNames: Object.keys(headers),
    enabled: form.enabled
  }
  requestConfirmation({
    title: selectedServer.value ? '保存 MCP 配置？' : '新增 MCP Server？',
    description: '保存后仅在测试或实际调用时按需连接；Secret 由系统保护且不会出现在导出文档中。配置或工具范围变化后必须重新批准。',
    confirmText: '保存配置',
    type: 'warning',
    task: () => runRequest(() => window.ncx.extensions.request({
      operation: 'mcp.upsert',
      config,
      environment,
      headers
    }))
  })
}

/** 执行 MCP 测试、启停、回滚或删除。 */
function mutateMcp(server: McpServerSnapshot, action: McpAction): void {
  /** 当前动作展示信息。 */
  const copy = mcpActionCopy(server, action)
  requestConfirmation({
    ...copy,
    task: () => executeMcpAction(server, action)
  })
}

/** 在用户确认后执行 MCP 设置动作并同步编辑器。 */
async function executeMcpAction(server: McpServerSnapshot, action: McpAction): Promise<void> {
  await runRequest(() => window.ncx.extensions.request({
    operation: `mcp.${action}`,
    serverId: server.serverId
  }))
  /** 操作后把最新同名快照回填表单。 */
  const next = snapshot.value.mcpServers.find((item) => item.serverId === server.serverId)
  if (next) editMcp(next)
  else if (editor.value.serverId === server.serverId) createMcp()
}

/** 生成并复制无 Secret MCP 配置文档。 */
async function exportMcp(): Promise<void> {
  busy.value = true
  try {
    /** Main 生成的无 Secret 导出。 */
    const result = await window.ncx.extensions.request({ operation: 'mcp.export' })
    snapshot.value = result.snapshot
    if (result.exportDocument) await window.ncx.clipboard.writeText(result.exportDocument)
    showToast(result.message ?? '已复制 MCP 配置。', 'success')
  } catch (error) {
    showToast(readableError(error), 'warning')
  } finally {
    busy.value = false
  }
}

/** 打开用户直接操作的普通确认框。 */
function requestConfirmation(confirmation: PendingConfirmation): void {
  pendingConfirmation.value = confirmation
}

/** 关闭确认框且不执行底层动作。 */
function cancelConfirmation(): void {
  pendingConfirmation.value = undefined
}

/** 只在用户确认后取得并执行当前设置任务。 */
async function confirmPendingAction(): Promise<void> {
  /** 当前不可变确认任务。 */
  const confirmation = pendingConfirmation.value
  pendingConfirmation.value = undefined
  if (!confirmation) return
  await confirmation.task()
}

/** 生成 Skill 生命周期动作的确认文案。 */
function skillActionCopy(
  skill: SkillSnapshot,
  action: SkillAction
): Omit<PendingConfirmation, 'task'> {
  /** 各动作的标题、说明与按钮。 */
  const copies: Record<SkillAction, Omit<PendingConfirmation, 'task'>> = {
    enable: {
      title: `启用 ${skill.name}？`,
      description: '启用后第三方 Prompt 或 JavaScript Tool 将对小云可见；自定义 Tool 仍逐次审批。',
      confirmText: '启用 Skill',
      type: 'warning'
    },
    disable: {
      title: `禁用 ${skill.name}？`,
      description: '将停止当前 Skill Host 并从小云撤销对应 Prompt 与 Tool。',
      confirmText: '禁用 Skill',
      type: 'warning'
    },
    update: {
      title: `检查并更新 ${skill.name}？`,
      description: '新版本会先暂存和完整校验，成功后原子切换并只保留一个上一版本。',
      confirmText: '检查更新',
      type: 'warning'
    },
    rollback: {
      title: `回滚 ${skill.name}？`,
      description: '将重新校验上一版本并替换当前版本，对应 Prompt 与 Tool 范围可能变化。',
      confirmText: '回滚 Skill',
      type: 'warning'
    },
    uninstall: {
      title: `卸载 ${skill.name}？`,
      description: '将立即停用并撤销 Tool，然后移入应用内回收区保留 7 天。',
      confirmText: '卸载 Skill',
      type: 'danger'
    }
  }
  return copies[action]
}

/** 生成 MCP 设置动作的确认文案。 */
function mcpActionCopy(
  server: McpServerSnapshot,
  action: McpAction
): Omit<PendingConfirmation, 'task'> {
  /** 各动作的标题、说明与按钮。 */
  const copies: Record<McpAction, Omit<PendingConfirmation, 'task'>> = {
    enable: {
      title: `启用 ${server.displayName}？`,
      description: '只允许按已批准且未变化的配置按需连接；每次 MCP Tool Call 仍需单独批准。',
      confirmText: '启用 Server',
      type: 'warning'
    },
    disable: {
      title: `禁用 ${server.displayName}？`,
      description: '将显式关闭当前 Client、Transport 和未决会话，不重放中断调用。',
      confirmText: '禁用 Server',
      type: 'warning'
    },
    test: {
      title: `连接测试 ${server.displayName}？`,
      description: '将按当前配置连接一次并读取真实 capabilities 与完整 Tool 列表，随后显式关闭。',
      confirmText: '开始测试',
      type: 'warning'
    },
    rollback: {
      title: `回滚 ${server.displayName} 配置？`,
      description: '将恢复上一份配置并要求按恢复后的指纹与真实工具范围重新批准。',
      confirmText: '回滚配置',
      type: 'warning'
    },
    delete: {
      title: `删除 ${server.displayName}？`,
      description: '只删除 NcxMusic 内的配置、加密 Secret 与应用缓存，不删除外部目录、远程服务或第三方系统中的数据。',
      confirmText: '删除 Server',
      type: 'danger'
    }
  }
  return copies[action]
}

/** 第一次只预览 MCP 导入，第二次显式确认写入。 */
async function importMcp(confirm: boolean): Promise<void> {
  /** 待解析导入文档。 */
  const document = importDocument.value.trim()
  if (!document) {
    showToast('请粘贴 .mcp.json 或 NcxMusic 导出文档。', 'warning')
    return
  }
  busy.value = true
  try {
    /** Main 内存中的导入预览或确认结果。 */
    const result = await window.ncx.extensions.request({
      operation: 'mcp.import',
      document,
      confirm,
      ...(confirm && importPreviewToken.value ? { previewToken: importPreviewToken.value } : {})
    })
    snapshot.value = result.snapshot
    importPreview.value = result.importPreview ?? []
    importPreviewToken.value = result.importToken ?? ''
    showToast(result.message ?? 'MCP 导入处理完成。', confirm ? 'success' : 'info')
    if (confirm) {
      importDocument.value = ''
      importPreview.value = []
      importPreviewToken.value = ''
    }
  } catch (error) {
    showToast(readableError(error), 'warning')
  } finally {
    busy.value = false
  }
}

/** 统一执行设置请求并刷新公开快照。 */
async function runRequest(
  task: () => ReturnType<typeof window.ncx.extensions.request>
): Promise<void> {
  busy.value = true
  try {
    /** Main 返回的扩展设置结果。 */
    const result = await task()
    snapshot.value = result.snapshot
    if (result.message) showToast(result.message, 'success')
  } catch (error) {
    showToast(readableError(error), 'warning')
  } finally {
    busy.value = false
  }
}

/** 解析每行一个参数的文本。 */
function lines(value: string): string[] {
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean)
}

/** 解析 `NAME=value` 行；空值用于保留 Main 已有 Secret。 */
function parseKeyValueLines(value: string): Record<string, string> {
  /** 最终名称和值。 */
  const result: Record<string, string> = {}
  for (const line of lines(value)) {
    /** 首个等号位置。 */
    const separator = line.indexOf('=')
    /** 允许只写名称。 */
    const name = (separator < 0 ? line : line.slice(0, separator)).trim()
    if (!name) continue
    result[name] = separator < 0 ? '' : line.slice(separator + 1)
  }
  return result
}

/** 把未知错误转换成简短文案。 */
function readableError(error: unknown): string {
  return error instanceof Error ? error.message : '扩展设置操作失败。'
}

// ========= 生命周期 =========

onMounted(() => { void refresh() })
</script>

<template>
  <div class="extensions-settings">
    <SettingsSection
      v-if="props.mode === 'skill'"
      section-id="setting-skill-install"
      title="Skill 管理"
      description="新安装默认禁用；JavaScript Skill 在独立受限 Host 中运行，更新仅保留一版回滚。"
    >
      <template #actions>
        <div class="settings-inline-actions">
          <CommonButton
            variant="secondary"
            :loading="busy"
            @click="chooseSkill('folder')"
          >
            <PackagePlus :size="14" />文件夹
          </CommonButton>
          <CommonButton
            variant="secondary"
            :loading="busy"
            @click="chooseSkill('zip')"
          >
            <Upload :size="14" />ZIP
          </CommonButton>
          <CommonButton
            variant="ghost"
            :loading="busy"
            @click="refresh"
          >
            <RefreshCw :size="14" />扫描
          </CommonButton>
        </div>
      </template>
      <div class="extensions-section-body">
        <div class="extensions-import-row">
          <CommonInput
            v-model="gitUrl"
            type="url"
            autocomplete="off"
            placeholder="https://github.com/org/skill.git"
            aria-label="Skill HTTPS Git URL"
          />
          <CommonButton
            :loading="busy"
            @click="installGitSkill"
          >
            导入 Git Skill
          </CommonButton>
        </div>
        <div
          id="setting-skill-list"
          class="extension-card-list"
        >
          <div
            v-if="snapshot.skills.length === 0"
            class="extensions-empty"
          >
            尚未发现 Skill。
          </div>
          <article
            v-for="skill in snapshot.skills"
            :key="`${skill.name}-${skill.updatedAt}`"
            class="extension-card"
          >
            <span class="settings-row-icon"><Boxes :size="18" /></span>
            <div class="extension-card-copy">
              <strong>{{ skill.name }} <small>v{{ skill.version }}</small></strong>
              <p>{{ skill.description }}</p>
              <small>{{ skill.sourceType }} · {{ skill.sourceLabel }} · {{ skill.tools.length }} tools · {{ skill.state }}</small>
            </div>
            <div class="settings-inline-actions">
              <CommonButton
                v-if="skill.state === 'enabled'"
                variant="secondary"
                @click="mutateSkill(skill, 'disable')"
              >
                禁用
              </CommonButton>
              <CommonButton
                v-else-if="skill.state !== 'trashed'"
                variant="secondary"
                @click="mutateSkill(skill, 'enable')"
              >
                启用
              </CommonButton>
              <CommonButton
                v-if="skill.sourceType !== 'appdata' && skill.state !== 'trashed'"
                variant="ghost"
                @click="mutateSkill(skill, 'update')"
              >
                检查更新
              </CommonButton>
              <CommonButton
                v-if="skill.previousVersionAvailable && skill.state !== 'trashed'"
                variant="ghost"
                @click="mutateSkill(skill, 'rollback')"
              >
                回滚
              </CommonButton>
              <CommonButton
                v-if="skill.state !== 'trashed'"
                variant="danger"
                @click="mutateSkill(skill, 'uninstall')"
              >
                卸载
              </CommonButton>
            </div>
          </article>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection
      v-else
      section-id="setting-mcp-servers"
      title="MCP Servers"
      description="只支持 stdio 与 Streamable HTTP；实际工具范围变化会自动禁用并要求重新批准。"
    >
      <template #actions>
        <div class="settings-inline-actions">
          <CommonButton
            variant="secondary"
            @click="createMcp"
          >
            <Server :size="14" />新建
          </CommonButton>
          <CommonButton
            variant="ghost"
            @click="exportMcp"
          >
            <Download :size="14" />复制导出
          </CommonButton>
        </div>
      </template>

      <div class="extensions-section-body">
        <div class="mcp-settings-layout">
          <div class="mcp-server-list">
            <CommonButton
              v-for="server in snapshot.mcpServers"
              :key="server.serverId"
              class="mcp-server-option"
              :class="{ 'is-active': selectedServer?.serverId === server.serverId }"
              variant="ghost"
              @click="editMcp(server)"
            >
              <span><strong>{{ server.displayName }}</strong><small>{{ server.serverId }} · {{ server.connectionState }}</small></span>
              <em>{{ server.approvalState === 'approved' ? '已批准' : '需重批' }}</em>
            </CommonButton>
            <p
              v-if="snapshot.mcpServers.length === 0"
              class="extensions-empty"
            >
              尚未配置 MCP Server。
            </p>
          </div>

          <form
            class="mcp-editor"
            @submit.prevent="saveMcp"
          >
            <label><span>Server ID</span><CommonInput
              v-model="editor.serverId"
              required
              pattern="[a-z][a-z0-9-]{1,62}"
              :disabled="Boolean(selectedServer)"
            /></label>
            <label><span>名称</span><CommonInput
              v-model="editor.displayName"
              required
            /></label>
            <label><span>传输</span><CommonSelect
              :model-value="editor.transport"
              :options="transportOptions"
              @update:model-value="setMcpTransport"
            /></label>
            <label v-if="editor.transport === 'stdio'"><span>Command</span><CommonInput
              v-model="editor.command"
              required
              placeholder="npx"
            /></label>
            <label v-if="editor.transport === 'stdio'"><span>Args</span><CommonTextarea
              v-model="editor.args"
              :rows="3"
              placeholder="每行一个参数；版本必须锁定"
            /></label>
            <label v-if="editor.transport === 'stdio'"><span>CWD</span><CommonInput
              v-model="editor.cwd"
              placeholder="可选绝对目录"
            /></label>
            <label v-else><span>URL</span><CommonInput
              v-model="editor.url"
              type="url"
              required
              placeholder="https://example.com/mcp"
            /></label>
            <label v-if="editor.transport === 'stdio'"><span>环境变量</span><CommonTextarea
              v-model="editor.environment"
              :rows="3"
              placeholder="NAME=value；已有 Secret 不回显"
            /></label>
            <label v-else><span>Headers</span><CommonTextarea
              v-model="editor.headers"
              :rows="3"
              placeholder="Authorization=Bearer …；已有 Secret 不回显"
            /></label>
            <div class="mcp-editor-actions">
              <CommonSwitch
                v-model="editor.enabled"
                label="保存后启用"
              />
              <CommonButton
                type="submit"
                :loading="busy"
              >
                保存配置
              </CommonButton>
            </div>
            <div
              v-if="selectedServer"
              class="mcp-editor-actions"
            >
              <CommonButton
                variant="secondary"
                @click="mutateMcp(selectedServer, 'test')"
              >
                测试并读取工具
              </CommonButton>
              <CommonButton
                v-if="selectedServer.previousConfigAvailable"
                variant="ghost"
                @click="mutateMcp(selectedServer, 'rollback')"
              >
                回滚
              </CommonButton>
              <CommonButton
                variant="danger"
                @click="mutateMcp(selectedServer, 'delete')"
              >
                删除
              </CommonButton>
            </div>
            <div
              v-if="selectedServer"
              class="mcp-capabilities"
            >
              <strong>实际工具（{{ selectedServer.lastKnownTools.length }}）</strong>
              <span
                v-for="tool in selectedServer.lastKnownTools"
                :key="tool.name"
              >mcp.{{ selectedServer.serverId }}.{{ tool.name }}</span>
              <small v-if="selectedServer.lastError">{{ selectedServer.lastError }}</small>
            </div>
          </form>
        </div>

        <div
          id="setting-mcp-import"
          class="mcp-import-box"
        >
          <CommonTextarea
            v-model="importDocument"
            :rows="5"
            placeholder="粘贴 .mcp.json 或 NcxMusic 导出文档"
          />
          <div
            v-if="importPreview.length > 0"
            class="mcp-capabilities"
            aria-live="polite"
          >
            <strong>待导入配置预览（{{ importPreview.length }}）</strong>
            <span
              v-for="server in importPreview"
              :key="server.serverId"
            >
              {{ server.displayName }} · {{ server.serverId }} · {{ server.transport }} · 默认禁用
            </span>
          </div>
          <div class="settings-inline-actions">
            <CommonButton
              variant="secondary"
              :loading="busy"
              @click="importMcp(false)"
            >
              预览导入
            </CommonButton>
            <CommonButton
              v-if="importPreview.length > 0"
              :loading="busy"
              @click="importMcp(true)"
            >
              确认导入 {{ importPreview.length }} 项
            </CommonButton>
          </div>
        </div>
      </div>
    </SettingsSection>

    <CommonAlertDialog
      :visible="Boolean(pendingConfirmation)"
      :title="pendingConfirmation?.title ?? '确认扩展操作'"
      :description="pendingConfirmation?.description ?? ''"
      :confirm-text="pendingConfirmation?.confirmText ?? '确认'"
      :type="pendingConfirmation?.type ?? 'warning'"
      @cancel="cancelConfirmation"
      @confirm="confirmPendingAction"
    />
  </div>
</template>
