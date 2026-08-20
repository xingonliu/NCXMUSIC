// ========= 类型 =========

/** 设置页支持的稳定标签。 */
export type SettingsTab =
  | 'general'
  | 'music'
  | 'appearance'
  | 'models'
  | 'agent'
  | 'mcp'
  | 'skill'
  | 'voice'
  | 'security'
  | 'data'

/** 单个设置标签的展示元数据。 */
export interface SettingsNavigationItem {
  /** 稳定标签值。 */
  readonly value: SettingsTab
  /** 侧栏与页面标题。 */
  readonly label: string
  /** 页面标题下方的简短说明。 */
  readonly description: string
}

/** 设置侧栏中的一个导航分组。 */
export interface SettingsNavigationGroup {
  /** 分组标题。 */
  readonly label: string
  /** 分组内按展示顺序排列的标签。 */
  readonly items: readonly SettingsNavigationItem[]
}

/** 可由侧栏搜索定位的设置项。 */
export interface SettingsSearchItem {
  /** 所属设置标签。 */
  readonly tab: SettingsTab
  /** 搜索结果标题。 */
  readonly title: string
  /** 搜索结果辅助说明。 */
  readonly description: string
  /** 页面内可滚动定位的元素 ID。 */
  readonly targetId: string
  /** 不直接展示的中文或英文检索别名。 */
  readonly keywords: readonly string[]
}

// ========= 变量 =========

/** 未指定或非法标签时使用的默认设置页。 */
export const DEFAULT_SETTINGS_TAB: SettingsTab = 'general'

/** 设置侧栏分组；Agent 分组顺序是产品信息架构的一部分。 */
export const SETTINGS_NAVIGATION_GROUPS: readonly SettingsNavigationGroup[] = [
  {
    label: '偏好',
    items: [
      { value: 'general', label: '常规', description: '调整应用窗口与后台运行行为。' },
      { value: 'music', label: '音乐', description: '管理播放音质与歌词显示偏好。' },
      { value: 'appearance', label: '外观', description: '选择适合当前环境的应用主题。' }
    ]
  },
  {
    label: 'Agent',
    items: [
      { value: 'models', label: '模型', description: '配置 Agent 使用的模型服务与默认 Profile。' },
      { value: 'agent', label: '小云', description: '管理音乐人格画像、偏好结论与记忆入口。' },
      { value: 'mcp', label: 'MCP', description: '配置、测试并批准 Agent 可连接的 MCP Server。' },
      { value: 'skill', label: 'Skill', description: '安装、启用和维护 Agent Skill。' },
      { value: 'voice', label: '语音', description: '管理按住说话、麦克风权限与语音识别。' }
    ]
  },
  {
    label: '系统',
    items: [
      { value: 'security', label: '安全', description: '控制 Agent 操作等级、Shell Tool 与工作区授权。' },
      { value: 'data', label: '数据', description: '查看并清理当前账户的本地数据和缓存。' }
    ]
  }
]

/** 供标题、路由校验和搜索结果查找使用的扁平标签列表。 */
export const SETTINGS_NAVIGATION_ITEMS: readonly SettingsNavigationItem[] =
  SETTINGS_NAVIGATION_GROUPS.flatMap((group) => group.items)

/** 设置搜索索引；只包含用户可以在界面中找到或操作的现有能力。 */
export const SETTINGS_SEARCH_ITEMS: readonly SettingsSearchItem[] = [
  { tab: 'general', title: '关闭窗口', description: '设置关闭到托盘或直接退出应用。', targetId: 'setting-close-window', keywords: ['托盘', '退出', '后台', 'close'] },
  { tab: 'general', title: '界面语言', description: '在简体中文与英语之间切换应用界面。', targetId: 'setting-language', keywords: ['语言', '英语', '中文', 'language', 'english', 'locale'] },
  { tab: 'music', title: '播放音质', description: '选择自动、无损或其他播放音质。', targetId: 'setting-playback-quality', keywords: ['音频', '无损', 'hires', 'quality'] },
  { tab: 'music', title: '歌词翻译', description: '控制普通歌词和沉浸歌词中的翻译行。', targetId: 'setting-lyric-translation', keywords: ['翻译', '歌词', 'translation'] },
  { tab: 'appearance', title: '主题', description: '选择跟随系统、浅色或深色外观。', targetId: 'setting-theme', keywords: ['颜色', '浅色', '深色', 'dark', 'light'] },
  { tab: 'appearance', title: '当前歌词位置', description: '选择沉浸歌词焦点靠上、居中或靠下。', targetId: 'setting-lyric-alignment', keywords: ['歌词', '对齐', '位置', '焦点'] },
  { tab: 'appearance', title: '歌词动效', description: '选择完整、轻柔或简洁歌词动效。', targetId: 'setting-lyric-motion', keywords: ['歌词', '动画', '弹簧', '模糊', '缩放'] },
  { tab: 'appearance', title: '歌词字号', description: '选择紧凑、标准、大号或超大号沉浸歌词。', targetId: 'setting-lyric-font-size', keywords: ['歌词', '字体', '字号', '大小', '超大号'] },
  { tab: 'appearance', title: '歌词字重', description: '选择从细到超粗体的歌词粗细。', targetId: 'setting-lyric-font-weight', keywords: ['歌词', '字体', '字重', '粗体', '粗细'] },
  { tab: 'appearance', title: '已唱歌词', description: '选择是否隐藏已经演唱完毕的歌词。', targetId: 'setting-hide-passed-lyrics', keywords: ['歌词', '隐藏', '已唱', '历史'] },
  { tab: 'models', title: 'Provider Profiles', description: '添加、编辑、验证或设为默认模型配置。', targetId: 'setting-provider-profiles', keywords: ['模型', '供应商', 'profile', 'provider'] },
  { tab: 'models', title: '模型凭据与服务地址', description: '配置 Base URL、API Key、模型 ID 和 Headers。', targetId: 'setting-provider-editor', keywords: ['api key', 'base url', 'model id', 'header', '密钥'] },
  { tab: 'agent', title: '音乐人格画像', description: '生成、暂停、恢复或重新分析音乐画像。', targetId: 'setting-agent-profile', keywords: ['小云', '画像', '个性化', '人格'] },
  { tab: 'agent', title: '偏好结论', description: '查看、隐藏并纠正画像推断。', targetId: 'setting-agent-insights', keywords: ['纠正', '结论', '置信度', '偏好'] },
  { tab: 'agent', title: '你的补充与修正', description: '主动补充音乐偏好或移除已有修正。', targetId: 'setting-agent-overrides', keywords: ['补充', '修正', '偏好'] },
  { tab: 'agent', title: '记忆与账户数据', description: '进入当前账户的数据与记忆管理。', targetId: 'setting-agent-data', keywords: ['记忆', '账户', '缓存', '数据'] },
  { tab: 'agent', title: '删除画像', description: '删除当前账户画像与中间证据。', targetId: 'setting-agent-delete-profile', keywords: ['删除', '清除', '画像'] },
  { tab: 'mcp', title: 'MCP Server', description: '新建、编辑、测试、启停或删除 MCP Server。', targetId: 'setting-mcp-servers', keywords: ['server', '服务器', '连接', '工具'] },
  { tab: 'mcp', title: 'MCP 配置导入与导出', description: '预览导入或复制不包含 Secret 的配置。', targetId: 'setting-mcp-import', keywords: ['json', '导入', '导出', '配置'] },
  { tab: 'skill', title: '安装 Skill', description: '从文件夹、ZIP 或 HTTPS Git 安装 Skill。', targetId: 'setting-skill-install', keywords: ['插件', 'git', 'zip', '文件夹', '导入'] },
  { tab: 'skill', title: 'Skill 生命周期', description: '启用、禁用、更新、回滚或卸载 Skill。', targetId: 'setting-skill-list', keywords: ['更新', '回滚', '卸载', '扫描'] },
  { tab: 'voice', title: '默认使用', description: '设置首选语音识别后端（本地、大模型或当前对话模型）。', targetId: 'setting-voice-source', keywords: ['语音', '默认', '来源', 'source', 'asr'] },
  { tab: 'voice', title: '麦克风快捷键', description: '设置全局麦克风按住说话快捷键。', targetId: 'setting-voice-shortcut', keywords: ['快捷键', '麦克风', '按住说话', 'alt space', 'shortcut'] },
  { tab: 'voice', title: '麦克风权限', description: '查看状态并打开系统麦克风权限。', targetId: 'setting-microphone', keywords: ['权限', '录音', 'microphone'] },
  { tab: 'voice', title: '使用流式识别', description: '设置本地语音识别是否启用流式结果。', targetId: 'setting-local-streaming', keywords: ['流式', '本地', 'streaming'] },
  { tab: 'voice', title: '模型内存', description: '设置本地模型常驻或按需释放内存。', targetId: 'setting-local-load-mode', keywords: ['内存', '常驻', '按需', 'memory'] },
  { tab: 'voice', title: '大模型 ASR', description: '配置独立云端大模型语音识别服务与凭据。', targetId: 'setting-cloud-protocol', keywords: ['大模型', 'openai', 'transcription', 'api key', '云端'] },
  { tab: 'security', title: '音乐安全', description: '设置小云音乐操作的审批等级。', targetId: 'setting-music-safety', keywords: ['审批', 'm1', 'm2', 'm3', 'm4'] },
  { tab: 'security', title: '命令安全', description: '设置 Shell 命令操作的审批等级。', targetId: 'setting-command-safety', keywords: ['审批', 's1', 's2', 's3', 's4'] },
  { tab: 'security', title: 'Shell Tool', description: '启用或关闭 Agent 的 Shell Tool。', targetId: 'setting-shell-tool', keywords: ['终端', '命令', 'shell'] },
  { tab: 'security', title: '授权工作区', description: '管理 Shell 可以访问的本地目录。', targetId: 'setting-shell-workspaces', keywords: ['目录', '路径', 'cwd', '授权'] },
  { tab: 'data', title: '账户数据', description: '查看统计或删除当前账户本地数据。', targetId: 'setting-account-data', keywords: ['数据库', '聊天', '记忆', 'journal', '删除'] },
  { tab: 'data', title: '可重建缓存', description: '查看并清理可重新生成的缓存。', targetId: 'setting-rebuildable-cache', keywords: ['缓存', 'cache', '清理'] }
]

// ========= 函数 =========

/** 把未知路由值收敛为合法设置标签。 */
export function normalizeSettingsTab(value: unknown): SettingsTab {
  if (typeof value !== 'string') return DEFAULT_SETTINGS_TAB
  /** 兼容旧版合并的扩展标签，默认打开 MCP。 */
  const normalizedValue = value === 'extensions' ? 'mcp' : value
  /** 与路由值匹配的设置标签。 */
  const matchedItem = SETTINGS_NAVIGATION_ITEMS.find((item) => item.value === normalizedValue)
  return matchedItem?.value ?? DEFAULT_SETTINGS_TAB
}

/** 返回指定标签的页面展示元数据。 */
export function getSettingsNavigationItem(tab: SettingsTab): SettingsNavigationItem {
  return SETTINGS_NAVIGATION_ITEMS.find((item) => item.value === tab)
    ?? SETTINGS_NAVIGATION_ITEMS[0]!
}
