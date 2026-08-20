<script setup lang="ts">
import {
  Boxes,
  Download,
  ExternalLink,
  Globe2,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Upload
} from '@lucide/vue'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'

import type {
  ExtensionSettingsSnapshot,
  McpMarketServer,
  McpServerEditable,
  McpServerSnapshot,
  SkillMarketItem,
  SkillSnapshot
} from '../../../shared/schemas/extensions'
import {
  CommonAlertDialog,
  CommonButton,
  CommonDialog,
  CommonInput,
  CommonSearchInput,
  CommonSelect,
  CommonSwitch,
  CommonTabs,
  CommonTextarea,
  type CommonOption
} from '../../design-system/components'
import CommonPagination from '../../design-system/components/CommonPagination.vue'
import { showToast } from '../../design-system/use-toast'
import { translatePublicError } from '../../i18n'
import SettingsSection from './SettingsSection.vue'

// ========= 类型 =========

/** Skill 列表按钮允许的生命周期动作。 */
type SkillAction = 'enable' | 'disable' | 'update' | 'rollback' | 'uninstall'

/** MCP 列表按钮允许的生命周期动作。 */
type McpAction = 'enable' | 'disable' | 'test' | 'rollback' | 'delete'

/** 当前扩展设置面板展示的独立能力。 */
type ExtensionSettingsMode = 'mcp' | 'skill'

/** Skill 设置页内部标签。 */
type SkillSettingsTab = 'installed' | 'market'

/** MCP 设置页内部标签。 */
type McpSettingsTab = 'installed' | 'market'

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
  /** MCP 稳定传输选项。 */
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
  readonly task: () => Promise<unknown>
}

// ========= 变量 =========

/** 当前扩展设置面板属性。 */
const props = defineProps<ExtensionsSettingsPanelProps>()

/** 空扩展快照。 */
const EMPTY_SNAPSHOT: ExtensionSettingsSnapshot = { skills: [], mcpServers: [], updatedAt: 0 }

/** Skill 设置页统一分页大小（每页 12 条）。 */
const SKILL_PAGE_SIZE = 12

/** MCP 设置页统一分页大小（每页 12 条）。 */
const MCP_PAGE_SIZE = 12

/** MCP 市场搜索候选集上限。 */
const MCP_MARKET_TOP_K = 100

/** 当前公开扩展快照。 */
const snapshot = ref<ExtensionSettingsSnapshot>(EMPTY_SNAPSHOT)

/** 设置请求是否执行中。 */
const busy = ref<boolean>(false)

/** Skill 设置页当前标签。 */
const activeSkillTab = ref<SkillSettingsTab>('installed')

/** Skill 新增弹窗显示状态。 */
const skillDialogVisible = ref<boolean>(false)

/** HTTPS Git Skill URL。 */
const gitUrl = ref<string>('')

/** SkillHub 快捷安装 slug。 */
const skillHubSlug = ref<string>('')

/** 已安装 Skill 当前页。 */
const installedSkillPage = ref<number>(1)

/** Skill 市场搜索输入框草稿。 */
const skillMarketSearchDraft = ref<string>('')

/** Skill 市场已提交搜索词。 */
const skillMarketQuery = ref<string>('')

/** Skill 市场当前页。 */
const skillMarketPage = ref<number>(1)

/** Skill 市场当前页条目。 */
const skillMarketItems = ref<SkillMarketItem[]>([])

/** Skill 市场总页数。 */
const skillMarketTotalPages = ref<number>(1)

/** Skill 市场总条目数。 */
const skillMarketTotalCount = ref<number>(0)

/** Skill 市场是否正在加载。 */
const skillMarketLoading = ref<boolean>(false)

/** Skill 市场加载错误文案。 */
const skillMarketError = ref<string>('')

/** 正在执行直接安装的 Skill slug。 */
const installingSkillSlug = ref<string>('')

/** 最近一次 Skill 市场请求 ID，用于丢弃迟到响应。 */
let latestSkillMarketRequestId = ''

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

/** MCP 新增/编辑弹窗显示状态。 */
const mcpDialogVisible = ref<boolean>(false)

/** 当前正在编辑的已安装 MCP Server ID；空值代表新增。 */
const editingMcpServerId = ref<string>('')

/** MCP 设置页当前标签。 */
const activeMcpTab = ref<McpSettingsTab>('installed')

/** 已安装 MCP 当前页。 */
const installedPage = ref<number>(1)

/** MCP 市场搜索输入框草稿。 */
const marketSearchDraft = ref<string>('')

/** MCP 市场已提交搜索词。 */
const marketQuery = ref<string>('')

/** MCP 市场当前页。 */
const marketPage = ref<number>(1)

/** MCP 市场当前页 Server。 */
const marketServers = ref<McpMarketServer[]>([])

/** MCP 市场总页数。 */
const marketTotalPages = ref<number>(1)

/** MCP 市场总条目数。 */
const marketTotalCount = ref<number>(0)

/** MCP 市场是否正在加载。 */
const marketLoading = ref<boolean>(false)

/** MCP 市场加载错误文案。 */
const marketError = ref<string>('')

/** 正在解析详情或执行直接安装的市场条目 ID。 */
const resolvingServerId = ref<string>('')

/** 最近一次 MCP 市场请求 ID，用于丢弃迟到响应。 */
let latestMarketRequestId = ''

/** MCP Transport 通用选择器选项。 */
const transportOptions: CommonOption[] = [
  { label: 'stdio', value: 'stdio' },
  { label: 'Streamable HTTP', value: 'streamable_http' }
]

/** 紧凑展示使用次数的数字格式器。 */
const useCountFormatter = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1
})

/** Skill 标签页选项。 */
const skillTabOptions = computed<CommonOption[]>(() => {
  /** 已安装标签项。 */
  const installedOption: CommonOption = { label: '已安装', value: 'installed', badge: snapshot.value.skills.length }
  /** 市场标签项。 */
  const marketOption: CommonOption = { label: '市场', value: 'market' }
  if (skillMarketTotalCount.value > 0) marketOption.badge = skillMarketTotalCount.value
  return [installedOption, marketOption]
})

/** 已安装 Skill 总页数。 */
const installedSkillTotalPages = computed<number>(() =>
  Math.max(1, Math.ceil(snapshot.value.skills.length / SKILL_PAGE_SIZE))
)

/** 当前页展示的已安装 Skill。 */
const paginatedSkills = computed<SkillSnapshot[]>(() => {
  /** 当前页的起始下标。 */
  const start = (installedSkillPage.value - 1) * SKILL_PAGE_SIZE
  return snapshot.value.skills.slice(start, start + SKILL_PAGE_SIZE)
})

/** 当前选中的 MCP Server。 */
const selectedServer = computed<McpServerSnapshot | undefined>(() => {
  if (!editingMcpServerId.value) return undefined
  return snapshot.value.mcpServers.find((server) => server.serverId === editingMcpServerId.value)
})

/** MCP 弹窗是否处于编辑模式。 */
const isEditingMcp = computed<boolean>(() => Boolean(selectedServer.value))

/** MCP 弹窗标题。 */
const mcpDialogTitle = computed<string>(() => isEditingMcp.value ? '编辑 MCP Server' : '新增 MCP Server')

/** MCP 弹窗说明。 */
const mcpDialogSubtitle = computed<string>(() => isEditingMcp.value
  ? '修改配置后需要重新测试真实工具范围；Secret 留空表示沿用已保存值。'
  : '和新增模型一样通过弹窗创建；市场只预填名称和 ID，连接方式仍需按服务说明补齐。')

/** MCP 标签页选项。 */
const mcpTabOptions = computed<CommonOption[]>(() => {
  /** 已安装标签项。 */
  const installedOption: CommonOption = { label: '已安装', value: 'installed', badge: snapshot.value.mcpServers.length }
  /** 市场标签项。 */
  const marketOption: CommonOption = { label: '市场', value: 'market' }
  if (marketTotalCount.value > 0) marketOption.badge = marketTotalCount.value
  return [installedOption, marketOption]
})

/** 已安装 MCP 总页数。 */
const installedTotalPages = computed<number>(() =>
  Math.max(1, Math.ceil(snapshot.value.mcpServers.length / MCP_PAGE_SIZE))
)

/** 当前页展示的已安装 MCP Server。 */
const paginatedMcpServers = computed<McpServerSnapshot[]>(() => {
  /** 当前页的起始下标。 */
  const start = (installedPage.value - 1) * MCP_PAGE_SIZE
  return snapshot.value.mcpServers.slice(start, start + MCP_PAGE_SIZE)
})

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

/** 打开 Skill 新增弹窗。 */
function openCreateSkillDialog(): void {
  gitUrl.value = ''
  skillHubSlug.value = ''
  skillDialogVisible.value = true
}

/** 关闭 Skill 新增弹窗。 */
function closeSkillDialog(): void {
  if (busy.value) return
  skillDialogVisible.value = false
  gitUrl.value = ''
  skillHubSlug.value = ''
}

/** 切换 Skill 设置页标签。 */
function setSkillTab(value: string): void {
  if (value !== 'installed' && value !== 'market') return
  activeSkillTab.value = value
  if (value === 'market' && skillMarketItems.value.length === 0 && !skillMarketLoading.value) {
    void loadSkillMarket()
  }
}

/** 从 SkillHub 市场读取公开 Skill 列表。 */
async function loadSkillMarket(): Promise<void> {
  /** 当前请求的唯一 ID。 */
  const requestId = crypto.randomUUID()
  latestSkillMarketRequestId = requestId
  skillMarketLoading.value = true
  skillMarketError.value = ''
  try {
    /** 已提交搜索词。 */
    const query = skillMarketQuery.value.trim()
    /** Main 代理返回的市场结果。 */
    const result = await window.ncx.extensions.request({
      operation: 'skill.market.search',
      page: skillMarketPage.value,
      pageSize: SKILL_PAGE_SIZE,
      sortBy: 'downloads',
      ...(query ? { q: query } : {})
    })
    if (requestId !== latestSkillMarketRequestId) return
    snapshot.value = result.snapshot
    skillMarketItems.value = result.skillMarket?.skills ?? []
    skillMarketTotalPages.value = Math.max(1, result.skillMarket?.pagination.totalPages ?? 1)
    skillMarketTotalCount.value = result.skillMarket?.pagination.totalCount ?? skillMarketItems.value.length
  } catch (error) {
    if (requestId !== latestSkillMarketRequestId) return
    skillMarketItems.value = []
    skillMarketTotalPages.value = 1
    skillMarketTotalCount.value = 0
    skillMarketError.value = readableError(error)
  } finally {
    if (requestId === latestSkillMarketRequestId) skillMarketLoading.value = false
  }
}

/** 提交 Skill 市场搜索并回到第一页。 */
function submitSkillMarketSearch(): void {
  skillMarketQuery.value = skillMarketSearchDraft.value.trim()
  skillMarketPage.value = 1
  void loadSkillMarket()
}

/** 清空 Skill 市场搜索并回到推荐列表。 */
function clearSkillMarketSearch(): void {
  skillMarketSearchDraft.value = ''
  skillMarketQuery.value = ''
  skillMarketPage.value = 1
  void loadSkillMarket()
}

/** 跳转已安装 Skill 分页。 */
function goToInstalledSkillPage(page: number): void {
  installedSkillPage.value = Math.min(installedSkillTotalPages.value, Math.max(1, page))
}

/** 跳转 Skill 市场分页。 */
function goToSkillMarketPage(page: number): void {
  skillMarketPage.value = Math.min(skillMarketTotalPages.value, Math.max(1, page))
  void loadSkillMarket()
}

/** 判断市场中的条目是否已在本地安装。 */
function isInstalledSkill(item: SkillMarketItem): boolean {
  /** 小写规范化 slug。 */
  const normalizedSlug = item.slug.trim().toLowerCase()
  /** 小写规范化 name。 */
  const normalizedName = item.name.trim().toLowerCase()
  return snapshot.value.skills.some((skill) => {
    const skillName = skill.name.toLowerCase()
    return skillName === normalizedSlug || skillName === normalizedName
  })
}

/** 从 SkillHub 市场一键安装指定技能。 */
function installMarketSkill(item: SkillMarketItem): void {
  requestConfirmation({
    title: `安装 ${item.name}？`,
    description: `将从 SkillHub 下载并校验 ${item.slug}（v${item.version}）安装包；新 Skill 默认处于禁用状态。`,
    confirmText: '立即安装',
    type: 'warning',
    task: async () => {
      installingSkillSlug.value = item.slug
      try {
        await runRequest(() => window.ncx.extensions.request({
          operation: 'skill.installMarket',
          slug: item.slug,
          version: item.version
        }))
      } finally {
        installingSkillSlug.value = ''
      }
    }
  })
}

/** 通过 SkillHub 技能标识安装。 */
async function installSlugSkill(): Promise<void> {
  /** 去除空白后的 slug。 */
  const slug = skillHubSlug.value.trim()
  if (!slug) {
    showToast('请输入 SkillHub 技能标识（Slug）。', 'warning')
    return
  }
  requestConfirmation({
    title: `安装 SkillHub 技能 ${slug}？`,
    description: '将从 SkillHub 市场拉取该技能安装包并校验安装，默认保持禁用。',
    confirmText: '安装 Skill',
    type: 'warning',
    task: async () => {
      const ok = await runRequest(() => window.ncx.extensions.request({
        operation: 'skill.installMarket',
        slug
      }))
      if (ok) {
        skillHubSlug.value = ''
        closeSkillDialog()
      }
    }
  })
}

/** 打开 Skill 市场条目的外部主页。 */
function openSkillHomepage(item: SkillMarketItem): void {
  const url = item.homepage && /^https?:\/\//iu.test(item.homepage)
    ? item.homepage
    : `https://skillhub.cn/skills/${encodeURIComponent(item.slug)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** 选择文件夹或 ZIP 导入 Skill。 */
async function chooseSkill(sourceType: 'folder' | 'zip'): Promise<void> {
  requestConfirmation({
    title: `导入 ${sourceType === 'folder' ? '文件夹' : 'ZIP'} Skill？`,
    description: '所选第三方代码将先经过完整校验并以禁用状态安装；启用后会在独立 Skill Host 中运行。',
    confirmText: '选择并导入',
    type: 'warning',
    task: async () => {
      const ok = await runRequest(() => window.ncx.extensions.request({
        operation: 'skill.chooseImport',
        sourceType
      }))
      if (ok) closeSkillDialog()
    }
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
      const ok = await runRequest(() => window.ncx.extensions.request({ operation: 'skill.installGit', url }))
      if (ok) {
        gitUrl.value = ''
        closeSkillDialog()
      }
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
function fillMcpEditor(server: McpServerSnapshot): void {
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

/** 打开 MCP 新增弹窗。 */
function openCreateMcpDialog(prefill: Partial<McpEditor> = {}): void {
  editingMcpServerId.value = ''
  editor.value = { ...emptyMcpEditor(), ...prefill }
  mcpDialogVisible.value = true
}

/** 打开 MCP 编辑弹窗。 */
function openEditMcpDialog(server: McpServerSnapshot): void {
  editingMcpServerId.value = server.serverId
  fillMcpEditor(server)
  mcpDialogVisible.value = true
}

/** 在非保存状态下关闭 MCP 弹窗。 */
function closeMcpDialog(): void {
  if (busy.value) return
  mcpDialogVisible.value = false
  editingMcpServerId.value = ''
  editor.value = emptyMcpEditor()
}

/** 切换 MCP 设置页标签。 */
function setMcpTab(value: string): void {
  if (value !== 'installed' && value !== 'market') return
  activeMcpTab.value = value
  if (value === 'market' && marketServers.value.length === 0 && !marketLoading.value) {
    void loadMcpMarket()
  }
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
    title: isEditingMcp.value ? '保存 MCP 配置？' : '新增 MCP Server？',
    description: '保存后仅在测试或实际调用时按需连接；Secret 由系统保护且不会出现在导出文档中。配置或工具范围变化后必须重新批准。',
    confirmText: '保存配置',
    type: 'warning',
    task: async () => {
      const ok = await runRequest(() => window.ncx.extensions.request({
        operation: 'mcp.upsert',
        config,
        environment,
        headers
      }))
      if (ok) closeMcpDialog()
    }
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
  const ok = await runRequest(() => window.ncx.extensions.request({
    operation: `mcp.${action}`,
    serverId: server.serverId
  }))
  if (!ok) return
  /** 操作后查找最新同名快照。 */
  const next = snapshot.value.mcpServers.find((item) => item.serverId === server.serverId)
  if (next && editingMcpServerId.value === server.serverId) fillMcpEditor(next)
  if (!next && editingMcpServerId.value === server.serverId) closeMcpDialog()
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
      description: '只删除 Ncxmusic 内的配置、加密 Secret 与应用缓存，不删除外部目录、远程服务或第三方系统中的数据。',
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
    showToast('请粘贴 .mcp.json 或 Ncxmusic 导出文档。', 'warning')
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
  task: () => ReturnType<typeof window.ncx.extensions.request>,
  options?: { silentSuccess?: boolean }
): Promise<boolean> {
  busy.value = true
  try {
    /** Main 返回的扩展设置结果。 */
    const result = await task()
    snapshot.value = result.snapshot
    if (result.message && !options?.silentSuccess) showToast(result.message, 'success')
    return true
  } catch (error) {
    showToast(readableError(error), 'warning')
    return false
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

/** 把市场条目名称规范化为 MCP Server ID。 */
function normalizeMarketServerId(server: McpMarketServer): string {
  /** 市场条目的优先稳定名称。 */
  const source = server.qualifiedName || server.namespace || server.displayName
  /** 只保留本地 MCP ID 允许的字符。 */
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/^@/u, '')
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/-{2,}/gu, '-')
    .replace(/^-|-$/gu, '')
  /** 保证首字符为字母。 */
  const withInitial = /^[a-z]/u.test(normalized) ? normalized : `mcp-${normalized}`
  /** 截断后再次去掉尾部分隔符。 */
  const trimmed = withInitial.slice(0, 63).replace(/-+$/u, '')
  return trimmed.length >= 2 ? trimmed : 'mcp-server'
}

/** 检查市场条目是否已被本地安装。 */
function isInstalledServer(server: McpMarketServer): boolean {
  const serverId = normalizeMarketServerId(server)
  return snapshot.value.mcpServers.some((item) => item.serverId === serverId)
}

/** 使用市场条目直接安装免密 MCP 或智能预填打开 MCP 弹窗。 */
async function useMarketServer(server: McpMarketServer): Promise<void> {
  /** 从市场条目推导出的本地 Server ID。 */
  const serverId = normalizeMarketServerId(server)
  /** 已经安装的同名 MCP Server。 */
  const existing = snapshot.value.mcpServers.find((item) => item.serverId === serverId)
  if (existing) {
    openEditMcpDialog(existing)
    showToast('该 MCP Server 已安装，已打开编辑弹窗。', 'info')
    return
  }

  resolvingServerId.value = server.id
  busy.value = true
  try {
    /** 向 Main 请求在线解析该 MCP 的连接详情与参数要求。 */
    const result = await window.ncx.extensions.request({
      operation: 'mcp.market.resolve',
      qualifiedName: server.qualifiedName
    })
    const detail = result.marketDetail
    const primaryConnection = detail?.connections?.[0]
    const deploymentUrl = primaryConnection?.deploymentUrl || detail?.deploymentUrl
    const command = primaryConnection?.command || detail?.command || 'npx'
    const args = primaryConnection?.args || detail?.args || ['-y', server.qualifiedName]
    const envObj = primaryConnection?.env || detail?.env || {}
    const envKeys = Object.keys(envObj)

    // 分支 1：免必填 Key 的 Remote MCP，支持一键直接安装并自动测试
    if (deploymentUrl && envKeys.length === 0) {
      requestConfirmation({
        title: `直接安装 ${server.displayName}？`,
        description: `将配置远程 MCP Server (${deploymentUrl})，安装后将自动测试连接并发现实际工具。`,
        confirmText: '立即安装',
        type: 'warning',
        task: async () => {
          const config: McpServerEditable = {
            serverId,
            displayName: server.displayName,
            transport: 'streamable_http',
            url: deploymentUrl,
            args: [],
            environmentNames: [],
            headerNames: [],
            enabled: true
          }
          const saved = await runRequest(() => window.ncx.extensions.request({
            operation: 'mcp.upsert',
            config,
            environment: {},
            headers: {}
          }), { silentSuccess: true })
          if (!saved) return
          await runRequest(() => window.ncx.extensions.request({
            operation: 'mcp.test',
            serverId
          }))
        }
      })
      return
    }

    // 分支 2：免环境变量的本地 stdio MCP，支持一键直接安装并自动测试
    if (!deploymentUrl && envKeys.length === 0) {
      requestConfirmation({
        title: `直接安装 ${server.displayName}？`,
        description: `将配置本地 stdio MCP (${command} ${args.join(' ')})，安装后将自动测试连接并发现实际工具。`,
        confirmText: '立即安装',
        type: 'warning',
        task: async () => {
          const config: McpServerEditable = {
            serverId,
            displayName: server.displayName,
            transport: 'stdio',
            command,
            args,
            environmentNames: [],
            headerNames: [],
            enabled: true
          }
          const saved = await runRequest(() => window.ncx.extensions.request({
            operation: 'mcp.upsert',
            config,
            environment: {},
            headers: {}
          }), { silentSuccess: true })
          if (!saved) return
          await runRequest(() => window.ncx.extensions.request({
            operation: 'mcp.test',
            serverId
          }))
        }
      })
      return
    }

    // 分支 3：需要输入环境变量凭据（如 API Key）等，智能预填打开弹窗
    const isRemote = Boolean(deploymentUrl || server.remote)
    openCreateMcpDialog({
      serverId,
      displayName: server.displayName,
      transport: isRemote ? 'streamable_http' : 'stdio',
      command: isRemote ? '' : command,
      args: isRemote ? '' : args.join('\n'),
      url: deploymentUrl ?? '',
      headers: '',
      environment: envKeys.map((k) => `${k}=`).join('\n'),
      enabled: true
    })
    if (envKeys.length > 0) {
      showToast(`已预填连接信息；该 MCP 需要配置 ${envKeys.join('、')}，请补齐凭据后保存。`, 'info')
    }
  } catch {
    // 降级兜底：在线解析失败时打开基础弹窗
    openCreateMcpDialog({
      serverId,
      displayName: server.displayName,
      transport: server.remote ? 'streamable_http' : 'stdio',
      command: server.remote ? '' : 'npx',
      args: server.remote ? '' : `-y\n${server.qualifiedName}`,
      enabled: true
    })
    showToast('未能获取在线连接配置，已打开基础创建弹窗。', 'warning')
  } finally {
    resolvingServerId.value = ''
    busy.value = false
  }
}

/** 从 MCP Hub 中国公开市场读取 MCP Server 列表。 */
async function loadMcpMarket(): Promise<void> {
  /** 当前请求的唯一 ID。 */
  const requestId = crypto.randomUUID()
  latestMarketRequestId = requestId
  marketLoading.value = true
  marketError.value = ''
  try {
    /** 已提交搜索词。 */
    const query = marketQuery.value.trim()
    /** Main 代理返回的市场结果。 */
    const result = await window.ncx.extensions.request({
      operation: 'mcp.market.search',
      page: marketPage.value,
      pageSize: MCP_PAGE_SIZE,
      ...(query ? { q: query, topK: MCP_MARKET_TOP_K } : {})
    })
    if (requestId !== latestMarketRequestId) return
    snapshot.value = result.snapshot
    marketServers.value = result.mcpMarket?.servers ?? []
    marketTotalPages.value = Math.max(1, result.mcpMarket?.pagination.totalPages ?? 1)
    marketTotalCount.value = result.mcpMarket?.pagination.totalCount ?? marketServers.value.length
  } catch (error) {
    if (requestId !== latestMarketRequestId) return
    marketServers.value = []
    marketTotalPages.value = 1
    marketTotalCount.value = 0
    marketError.value = readableError(error)
  } finally {
    if (requestId === latestMarketRequestId) marketLoading.value = false
  }
}

/** 提交 MCP 市场搜索并回到第一页。 */
function submitMarketSearch(): void {
  marketQuery.value = marketSearchDraft.value.trim()
  marketPage.value = 1
  void loadMcpMarket()
}

/** 清空 MCP 市场搜索并回到推荐列表。 */
function clearMarketSearch(): void {
  marketSearchDraft.value = ''
  marketQuery.value = ''
  marketPage.value = 1
  void loadMcpMarket()
}

/** 跳转已安装 MCP 分页。 */
function goToInstalledPage(page: number): void {
  installedPage.value = Math.min(installedTotalPages.value, Math.max(1, page))
}

/** 跳转 MCP 市场分页。 */
function goToMarketPage(page: number): void {
  marketPage.value = Math.min(marketTotalPages.value, Math.max(1, page))
  void loadMcpMarket()
}

/** 紧凑格式化市场使用次数。 */
function formatUseCount(value: number): string {
  return useCountFormatter.format(value)
}

/** 读取 MCP 连接状态文案。 */
function connectionStateLabel(server: McpServerSnapshot): string {
  /** MCP 连接状态展示字典。 */
  const labels: Record<McpServerSnapshot['connectionState'], string> = {
    disconnected: '未连接',
    connecting: '连接中',
    ready: '已就绪',
    failed_disabled: '失败停用'
  }
  return labels[server.connectionState]
}

/** 读取 MCP 批准状态文案。 */
function approvalStateLabel(server: McpServerSnapshot): string {
  return server.approvalState === 'approved' ? '已批准' : '需重批'
}

/** 打开市场条目的外部主页。 */
function openMarketHomepage(server: McpMarketServer): void {
  if (!server.homepage || !/^https?:\/\//iu.test(server.homepage)) return
  window.open(server.homepage, '_blank', 'noopener,noreferrer')
}

// ========= 生命周期 =========

watch(installedSkillTotalPages, (totalPages) => {
  if (installedSkillPage.value > totalPages) installedSkillPage.value = totalPages
})

watch(installedTotalPages, (totalPages) => {
  if (installedPage.value > totalPages) installedPage.value = totalPages
})

onMounted(() => { void refresh() })
</script>

<template>
  <div class="extensions-settings">
    <SettingsSection
      v-if="props.mode === 'skill'"
      section-id="setting-skill-install"
      :title="$tSource('Skill 管理')"
    >
      <template #actions>
        <div class="settings-inline-actions">
          <CommonButton
            size="compact"
            variant="primary"
            @click="openCreateSkillDialog"
          >
            <Plus :size="14" />{{ $tSource("新增 Skill") }}
          </CommonButton>
          <CommonButton
            size="compact"
            variant="ghost"
            :loading="busy"
            @click="refresh"
          >
            <RefreshCw :size="14" />{{ $tSource("扫描") }}
          </CommonButton>
        </div>
      </template>

      <div class="extensions-section-body">
        <CommonTabs
          :model-value="activeSkillTab"
          :options="skillTabOptions"
          @update:model-value="setSkillTab"
        />

        <template v-if="activeSkillTab === 'installed'">
          <div
            v-if="snapshot.skills.length === 0"
            class="mcp-empty-state"
          >
            <Boxes :size="28" />
            <p>{{ $tSource("尚未安装 Skill") }}</p>
            <span>{{ $tSource("点击右上角“新增 Skill”打开弹窗导入，或切换到“市场”标签浏览并安装社区技能。") }}</span>
          </div>

          <div
            v-else
            id="setting-skill-list"
            class="extension-card-list"
          >
            <article
              v-for="skill in paginatedSkills"
              :key="`${skill.name}-${skill.updatedAt}`"
              class="extension-card mcp-installed-card"
            >
              <span class="settings-row-icon"><Boxes :size="18" /></span>
              <div class="extension-card-copy">
                <strong>{{ skill.name }} <small>v{{ skill.version }}</small></strong>
                <p>{{ skill.description }}</p>
                <small>{{ skill.sourceType }} · {{ skill.sourceLabel }} · {{ skill.tools.length }} tools · {{ skill.state }}</small>
              </div>
              <div class="settings-inline-actions mcp-card-actions">
                <CommonButton
                  v-if="skill.state === 'enabled'"
                  size="compact"
                  variant="secondary"
                  @click="mutateSkill(skill, 'disable')"
                >
                  {{ $tSource("禁用") }}
                </CommonButton>
                <CommonButton
                  v-else-if="skill.state !== 'trashed'"
                  size="compact"
                  variant="secondary"
                  @click="mutateSkill(skill, 'enable')"
                >
                  {{ $tSource("启用") }}
                </CommonButton>
                <CommonButton
                  v-if="skill.sourceType !== 'appdata' && skill.state !== 'trashed'"
                  size="compact"
                  variant="ghost"
                  @click="mutateSkill(skill, 'update')"
                >
                  {{ $tSource("检查更新") }}
                </CommonButton>
                <CommonButton
                  v-if="skill.previousVersionAvailable && skill.state !== 'trashed'"
                  size="compact"
                  variant="ghost"
                  @click="mutateSkill(skill, 'rollback')"
                >
                  {{ $tSource("回滚") }}
                </CommonButton>
                <CommonButton
                  v-if="skill.state !== 'trashed'"
                  size="compact"
                  variant="danger"
                  @click="mutateSkill(skill, 'uninstall')"
                >
                  {{ $tSource("卸载") }}
                </CommonButton>
              </div>
            </article>
          </div>

          <CommonPagination
            v-if="snapshot.skills.length > 0"
            :current-page="installedSkillPage"
            :total-pages="installedSkillTotalPages"
            :total-count="snapshot.skills.length"
            @page-change="goToInstalledSkillPage"
          />
        </template>

        <template v-else>
          <div class="mcp-market-toolbar">
            <CommonSearchInput
              v-model="skillMarketSearchDraft"
              :placeholder="$tSource('在 SkillHub 搜索技能名称或描述…')"
              :disabled="skillMarketLoading"
              @submit="submitSkillMarketSearch"
              @clear="clearSkillMarketSearch"
            />
            <CommonButton
              size="compact"
              variant="secondary"
              :loading="skillMarketLoading"
              @click="submitSkillMarketSearch"
            >
              {{ $tSource("搜索") }}
            </CommonButton>
            <CommonButton
              v-if="skillMarketQuery"
              size="compact"
              variant="ghost"
              :disabled="skillMarketLoading"
              @click="clearSkillMarketSearch"
            >
              {{ $tSource("推荐") }}
            </CommonButton>
          </div>

          <p class="mcp-market-caption">
            {{ $tSource(skillMarketQuery
              ? `搜索 “${skillMarketQuery}” · 共 ${skillMarketTotalCount} 项`
              : `推荐 Skill · 共 ${skillMarketTotalCount} 项`) }}
          </p>

          <div
            v-if="skillMarketError"
            class="mcp-market-error"
          >
            <span>{{ translatePublicError({ message: skillMarketError }) }}</span>
            <CommonButton
              size="compact"
              variant="secondary"
              @click="loadSkillMarket"
            >
              {{ $tSource("重试") }}
            </CommonButton>
          </div>

          <div
            v-else-if="skillMarketLoading && skillMarketItems.length === 0"
            class="mcp-empty-state"
          >
            <RefreshCw
              :size="24"
              class="is-spinning"
            />
            <p>{{ $tSource("正在拉取 SkillHub 市场…") }}</p>
          </div>

          <div
            v-else-if="skillMarketItems.length === 0"
            class="mcp-empty-state"
          >
            <Globe2 :size="28" />
            <p>{{ $tSource("未找到匹配的 Skill") }}</p>
            <span>{{ $tSource("换个关键词试试，或直接在“新增 Skill”弹窗中通过 Git / 本地方式导入。") }}</span>
          </div>

          <div
            v-else
            class="mcp-market-list"
          >
            <article
              v-for="item in skillMarketItems"
              :key="item.slug"
              class="mcp-market-card"
            >
              <span class="mcp-market-icon">
                <img
                  v-if="item.iconUrl"
                  :src="item.iconUrl"
                  :alt="item.name"
                  loading="lazy"
                >
                <Boxes
                  v-else
                  :size="18"
                />
              </span>
              <div class="mcp-market-copy">
                <strong>
                  {{ item.name }}
                  <small v-if="item.verified"><ShieldCheck :size="12" />{{ $tSource("已验证") }}</small>
                </strong>
                <p>{{ $tSource(item.descriptionZh || item.description || '暂无描述。') }}</p>
                <small>{{ item.slug }} · {{ formatUseCount(item.downloads) }} {{ $tSource("次下载 ·") }} {{ item.stars }} {{ $tSource("收藏 · v") }}{{ item.version }}</small>
              </div>
              <div class="settings-inline-actions mcp-card-actions">
                <CommonButton
                  v-if="isInstalledSkill(item)"
                  size="compact"
                  variant="secondary"
                  disabled
                >
                  {{ $tSource("已安装") }}
                </CommonButton>
                <CommonButton
                  v-else
                  size="compact"
                  variant="primary"
                  :loading="installingSkillSlug === item.slug"
                  @click="installMarketSkill(item)"
                >
                  {{ $tSource("直接安装") }}
                </CommonButton>
                <CommonButton
                  size="compact"
                  variant="ghost"
                  @click="openSkillHomepage(item)"
                >
                  <ExternalLink :size="14" />
                </CommonButton>
              </div>
            </article>
          </div>

          <CommonPagination
            v-if="skillMarketItems.length > 0"
            :current-page="skillMarketPage"
            :total-pages="skillMarketTotalPages"
            :total-count="skillMarketTotalCount"
            @page-change="goToSkillMarketPage"
          />
        </template>
      </div>
    </SettingsSection>

    <SettingsSection
      v-else
      section-id="setting-mcp-servers"
      title="MCP Servers"
    >
      <template #actions>
        <div class="settings-inline-actions">
          <CommonButton
            size="compact"
            variant="primary"
            @click="openCreateMcpDialog()"
          >
            <Plus :size="14" />{{ $tSource("新增 MCP") }}
          </CommonButton>
          <CommonButton
            size="compact"
            variant="ghost"
            :loading="busy"
            @click="exportMcp"
          >
            <Download :size="14" />{{ $tSource("复制导出") }}
          </CommonButton>
          <CommonButton
            size="compact"
            variant="ghost"
            :loading="busy"
            @click="refresh"
          >
            <RefreshCw :size="14" />{{ $tSource("刷新") }}
          </CommonButton>
        </div>
      </template>

      <div class="extensions-section-body">
        <CommonTabs
          :model-value="activeMcpTab"
          :options="mcpTabOptions"
          variant="segmented"
          full-width
          @update:model-value="setMcpTab"
        />

        <div
          v-if="activeMcpTab === 'installed'"
          class="mcp-tab-panel"
        >
          <div
            v-if="snapshot.mcpServers.length === 0"
            class="mcp-empty-state"
          >
            <Server :size="24" />
            <strong>{{ $tSource("尚未配置 MCP Server") }}</strong>
            <span>{{ $tSource("点击“新增 MCP”打开弹窗，或从市场选择一个条目作为起点。") }}</span>
          </div>
          <div
            v-else
            class="extension-card-list mcp-installed-list"
          >
            <article
              v-for="server in paginatedMcpServers"
              :key="server.serverId"
              class="extension-card mcp-installed-card"
            >
              <span class="settings-row-icon"><Server :size="18" /></span>
              <div class="extension-card-copy">
                <strong>{{ server.displayName }} <small>{{ $tSource(server.enabled ? '启用' : '禁用') }}</small></strong>
                <p>{{ server.serverId }} · {{ server.transport }} · {{ $tSource(connectionStateLabel(server)) }}</p>
                <small>{{ server.lastKnownTools.length }} tools · {{ $tSource(approvalStateLabel(server)) }}</small>
                <small v-if="server.lastError">{{ translatePublicError({ message: server.lastError }) }}</small>
              </div>
              <div class="settings-inline-actions mcp-card-actions">
                <CommonButton
                  size="compact"
                  variant="secondary"
                  @click="openEditMcpDialog(server)"
                >
                  <Pencil :size="13" />{{ $tSource("编辑") }}
                </CommonButton>
                <CommonButton
                  v-if="server.enabled"
                  size="compact"
                  variant="secondary"
                  @click="mutateMcp(server, 'disable')"
                >
                  {{ $tSource("禁用") }}
                </CommonButton>
                <CommonButton
                  v-else
                  size="compact"
                  variant="secondary"
                  @click="mutateMcp(server, 'enable')"
                >
                  {{ $tSource("启用") }}
                </CommonButton>
                <CommonButton
                  size="compact"
                  variant="ghost"
                  @click="mutateMcp(server, 'test')"
                >
                  {{ $tSource("测试") }}
                </CommonButton>
                <CommonButton
                  v-if="server.previousConfigAvailable"
                  size="compact"
                  variant="ghost"
                  @click="mutateMcp(server, 'rollback')"
                >
                  {{ $tSource("回滚") }}
                </CommonButton>
                <CommonButton
                  size="compact"
                  variant="danger"
                  @click="mutateMcp(server, 'delete')"
                >
                  <Trash2 :size="13" />{{ $tSource("删除") }}
                </CommonButton>
              </div>
            </article>
          </div>

          <CommonPagination
            :current-page="installedPage"
            :total-pages="installedTotalPages"
            :aria-label="$tSource('已安装 MCP 分页')"
            @change="goToInstalledPage"
          />

          <div
            id="setting-mcp-import"
            class="mcp-import-box"
          >
            <CommonTextarea
              v-model="importDocument"
              :rows="5"
              :placeholder="$tSource('粘贴 .mcp.json 或 Ncxmusic 导出文档')"
            />
            <div
              v-if="importPreview.length > 0"
              class="mcp-capabilities"
              aria-live="polite"
            >
              <strong>{{ $tSource("待导入配置预览（") }}{{ importPreview.length }}）</strong>
              <span
                v-for="server in importPreview"
                :key="server.serverId"
              >
                {{ server.displayName }} · {{ server.serverId }} · {{ server.transport }} {{ $tSource("· 默认禁用") }} </span>
            </div>
            <div class="settings-inline-actions">
              <CommonButton
                variant="secondary"
                :loading="busy"
                @click="importMcp(false)"
              >
                {{ $tSource("预览导入") }}
              </CommonButton>
              <CommonButton
                v-if="importPreview.length > 0"
                :loading="busy"
                @click="importMcp(true)"
              >
                {{ $tSource("确认导入") }} {{ importPreview.length }} {{ $tSource("项") }}
              </CommonButton>
            </div>
          </div>
        </div>

        <div
          v-else
          class="mcp-tab-panel"
        >
          <div class="mcp-market-toolbar">
            <CommonSearchInput
              v-model="marketSearchDraft"
              :placeholder="$tSource('搜索 MCP Server，例如 brave、github、postgres')"
              @search="submitMarketSearch"
              @clear="clearMarketSearch"
            />
            <CommonButton
              variant="primary"
              :loading="marketLoading"
              @click="submitMarketSearch"
            >
              {{ $tSource("搜索") }}
            </CommonButton>
            <CommonButton
              v-if="marketQuery"
              variant="ghost"
              :disabled="marketLoading"
              @click="clearMarketSearch"
            >
              {{ $tSource("推荐") }}
            </CommonButton>
          </div>

          <p class="mcp-market-caption">
            {{ $tSource(marketQuery ? `搜索 “${marketQuery}”` : '推荐 MCP Server') }} {{ $tSource("· 共") }} {{ marketTotalCount }} {{ $tSource("项") }}
          </p>

          <div
            v-if="marketLoading"
            class="extensions-empty"
          >
            {{ $tSource("正在读取 MCP Hub 中国精选服务…") }}
          </div>
          <div
            v-else-if="marketError"
            class="mcp-market-error"
          >
            <span>{{ translatePublicError({ message: marketError }) }}</span>
            <CommonButton
              size="compact"
              variant="secondary"
              @click="loadMcpMarket"
            >
              {{ $tSource("重试") }}
            </CommonButton>
          </div>
          <div
            v-else-if="marketServers.length === 0"
            class="extensions-empty"
          >
            {{ $tSource("没有找到匹配的 MCP Server。") }}
          </div>
          <div
            v-else
            class="mcp-market-list"
          >
            <article
              v-for="server in marketServers"
              :key="server.id"
              class="mcp-market-card"
            >
              <span class="mcp-market-icon">
                <img
                  v-if="server.iconUrl"
                  :src="server.iconUrl"
                  :alt="server.displayName"
                  loading="lazy"
                >
                <Globe2
                  v-else
                  :size="18"
                />
              </span>
              <div class="mcp-market-copy">
                <strong>
                  {{ server.displayName }}
                  <small v-if="server.verified"><ShieldCheck :size="12" />{{ $tSource("已验证") }}</small>
                  <small v-if="server.inactive">{{ $tSource("停用") }}</small>
                </strong>
                <p>{{ $tSource(server.description || '暂无介绍。') }}</p>
                <small>{{ server.qualifiedName }} · {{ formatUseCount(server.useCount) }} {{ $tSource("次使用 ·") }} {{ server.remote ? 'Remote' : 'Local' }}</small>
              </div>
              <div class="settings-inline-actions mcp-card-actions">
                <CommonButton
                  size="compact"
                  :variant="isInstalledServer(server) ? 'secondary' : 'primary'"
                  :loading="resolvingServerId === server.id"
                  :disabled="busy && resolvingServerId !== server.id"
                  @click="useMarketServer(server)"
                >
                  {{ $tSource(isInstalledServer(server) ? '已安装' : '用此创建') }}
                </CommonButton>
                <CommonButton
                  v-if="server.homepage"
                  size="compact"
                  variant="ghost"
                  @click="openMarketHomepage(server)"
                >
                  <ExternalLink :size="13" />{{ $tSource("主页") }}
                </CommonButton>
              </div>
            </article>
          </div>

          <CommonPagination
            :current-page="marketPage"
            :total-pages="marketTotalPages"
            :disabled="marketLoading"
            :aria-label="$tSource('MCP 市场分页')"
            @change="goToMarketPage"
          />
        </div>
      </div>
    </SettingsSection>

    <CommonDialog
      :visible="mcpDialogVisible"
      :title="mcpDialogTitle"
      :subtitle="mcpDialogSubtitle"
      width="640px"
      :close-on-overlay-click="!busy"
      :close-on-esc="!busy"
      @close="closeMcpDialog"
    >
      <form
        class="mcp-editor"
        @submit.prevent="saveMcp"
      >
        <label><span>Server ID</span><CommonInput
          v-model="editor.serverId"
          required
          pattern="[a-z][a-z0-9-]{1,62}"
          :disabled="isEditingMcp"
        /></label>
        <label><span>{{ $tSource("名称") }}</span><CommonInput
          v-model="editor.displayName"
          required
        /></label>
        <label><span>{{ $tSource("传输") }}</span><CommonSelect
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
          :placeholder="$tSource('每行一个参数；版本必须锁定')"
        /></label>
        <label v-if="editor.transport === 'stdio'"><span>CWD</span><CommonInput
          v-model="editor.cwd"
          :placeholder="$tSource('可选绝对目录')"
        /></label>
        <label v-else><span>URL</span><CommonInput
          v-model="editor.url"
          type="url"
          required
          placeholder="https://example.com/mcp"
        /></label>
        <label v-if="editor.transport === 'stdio'"><span>{{ $tSource("环境变量") }}</span><CommonTextarea
          v-model="editor.environment"
          :rows="3"
          :placeholder="$tSource('NAME=value；已有 Secret 不回显')"
        /></label>
        <label v-else><span>Headers</span><CommonTextarea
          v-model="editor.headers"
          :rows="3"
          :placeholder="$tSource('Authorization=Bearer …；已有 Secret 不回显')"
        /></label>
        <div class="mcp-editor-actions">
          <CommonSwitch
            v-model="editor.enabled"
            :label="$tSource('保存后启用')"
          />
        </div>
        <div
          v-if="selectedServer"
          class="mcp-capabilities"
        >
          <strong>{{ $tSource("实际工具（") }}{{ selectedServer.lastKnownTools.length }}）</strong>
          <span
            v-for="tool in selectedServer.lastKnownTools"
            :key="tool.name"
          >mcp.{{ selectedServer.serverId }}.{{ tool.name }}</span>
          <small v-if="selectedServer.lastError">{{ translatePublicError({ message: selectedServer.lastError }) }}</small>
        </div>
      </form>

      <template #actions>
        <CommonButton
          variant="secondary"
          :disabled="busy"
          @click="closeMcpDialog"
        >
          {{ $tSource("取消") }}
        </CommonButton>
        <CommonButton
          v-if="selectedServer"
          variant="secondary"
          :loading="busy"
          @click="mutateMcp(selectedServer, 'test')"
        >
          {{ $tSource("测试并读取工具") }}
        </CommonButton>
        <CommonButton
          variant="primary"
          :loading="busy"
          @click="saveMcp"
        >
          {{ $tSource("保存配置") }}
        </CommonButton>
      </template>
    </CommonDialog>

    <CommonDialog
      :visible="skillDialogVisible"
      :title="$tSource('新增 Skill')"
      :subtitle="$tSource('支持从 SkillHub 市场导入、Git 仓库导入，或选择本地代码包与 ZIP 压缩包。')"
      width="560px"
      :close-on-overlay-click="!busy"
      :close-on-esc="!busy"
      @close="closeSkillDialog"
    >
      <div class="skill-dialog-content">
        <div class="skill-dialog-section">
          <span class="skill-dialog-section-title">{{ $tSource("方式一：SkillHub 技能标识导入") }}</span>
          <div class="extensions-import-row">
            <CommonInput
              v-model="skillHubSlug"
              autocomplete="off"
              :placeholder="$tSource('例如 agent-phone-call')"
              :aria-label="$tSource('SkillHub 技能标识')"
            />
            <CommonButton
              variant="secondary"
              :loading="busy"
              @click="installSlugSkill"
            >
              {{ $tSource("从市场安装") }}
            </CommonButton>
          </div>
        </div>

        <div class="skill-dialog-section">
          <span class="skill-dialog-section-title">{{ $tSource("方式二：HTTPS Git 仓库导入") }}</span>
          <div class="extensions-import-row">
            <CommonInput
              v-model="gitUrl"
              type="url"
              autocomplete="off"
              placeholder="https://github.com/org/skill.git"
              aria-label="Skill HTTPS Git URL"
            />
            <CommonButton
              variant="secondary"
              :loading="busy"
              @click="installGitSkill"
            >
              {{ $tSource("导入 Git") }}
            </CommonButton>
          </div>
        </div>

        <div class="skill-dialog-section">
          <span class="skill-dialog-section-title">{{ $tSource("方式三：本地代码包导入") }}</span>
          <div class="skill-local-import-actions">
            <CommonButton
              variant="secondary"
              :loading="busy"
              @click="chooseSkill('folder')"
            >
              <PackagePlus :size="14" />{{ $tSource("选择文件夹") }}
            </CommonButton>
            <CommonButton
              variant="secondary"
              :loading="busy"
              @click="chooseSkill('zip')"
            >
              <Upload :size="14" />{{ $tSource("选择 ZIP 压缩包") }}
            </CommonButton>
          </div>
        </div>
      </div>

      <template #actions>
        <CommonButton
          variant="secondary"
          :disabled="busy"
          @click="closeSkillDialog"
        >
          {{ $tSource("关闭") }}
        </CommonButton>
      </template>
    </CommonDialog>

    <CommonAlertDialog
      :visible="Boolean(pendingConfirmation)"
      :title="$tSource(pendingConfirmation?.title ?? '确认扩展操作')"
      :description="pendingConfirmation?.description ?? ''"
      :confirm-text="$tSource(pendingConfirmation?.confirmText ?? '确认')"
      :type="pendingConfirmation?.type ?? 'warning'"
      @cancel="cancelConfirmation"
      @confirm="confirmPendingAction"
    />
  </div>
</template>
