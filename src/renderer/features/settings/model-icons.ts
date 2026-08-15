// ========= 接口与类型 =========

/** 图标预设项配置。 */
export interface ModelIconPreset {
  /** 唯一标识，格式通常为 `{prefix}:{name}`。 */
  readonly id: string
  /** 展示名称。 */
  readonly name: string
  /** 分类：品牌厂商或通用概念。 */
  readonly category: 'brand' | 'generic'
}

// ========= 变量与常量 =========

/** 内存中的 SVG 源码缓存，避免重复网络请求。 */
const iconSvgCache = new Map<string, string>()

/** 常用 AI 厂商与通用概念图标预设列表。 */
export const MODEL_ICON_PRESETS: readonly ModelIconPreset[] = [
  // 品牌与模型
  { id: 'simple-icons:openai', name: 'OpenAI / ChatGPT', category: 'brand' },
  { id: 'simple-icons:anthropic', name: 'Anthropic / Claude', category: 'brand' },
  { id: 'simple-icons:googlegemini', name: 'Google Gemini', category: 'brand' },
  { id: 'simple-icons:deepseek', name: 'DeepSeek 深度求索', category: 'brand' },
  { id: 'simple-icons:ollama', name: 'Ollama 本地模型', category: 'brand' },
  { id: 'simple-icons:meta', name: 'Meta / LLaMA', category: 'brand' },
  { id: 'simple-icons:mistral', name: 'Mistral AI', category: 'brand' },
  { id: 'simple-icons:alibabacloud', name: '通义千问 / Qwen', category: 'brand' },
  { id: 'simple-icons:groq', name: 'Groq', category: 'brand' },
  { id: 'simple-icons:microsoft', name: 'Microsoft Azure', category: 'brand' },
  { id: 'simple-icons:bytedance', name: '豆包 / ByteDance', category: 'brand' },
  { id: 'simple-icons:tencentqq', name: '腾讯混元 / Tencent', category: 'brand' },

  // 通用模型与能力概念
  { id: 'lucide:sparkles', name: '智能闪烁 (Sparkles)', category: 'generic' },
  { id: 'lucide:bot', name: '机器人 (Bot)', category: 'generic' },
  { id: 'lucide:brain', name: '大脑神经网络 (Brain)', category: 'generic' },
  { id: 'lucide:cpu', name: '芯片算力 (CPU)', category: 'generic' },
  { id: 'lucide:zap', name: '极速推理 (Zap)', category: 'generic' },
  { id: 'lucide:terminal', name: '命令行交互 (Terminal)', category: 'generic' },
  { id: 'lucide:code', name: '代码编程 (Code)', category: 'generic' },
  { id: 'lucide:server', name: '私有服务器 (Server)', category: 'generic' },
  { id: 'lucide:cloud', name: '云端集群 (Cloud)', category: 'generic' },
  { id: 'lucide:shield-check', name: '安全护栏 (Shield)', category: 'generic' },
  { id: 'lucide:wand-2', name: '魔杖创作 (Wand)', category: 'generic' },
  { id: 'lucide:message-square', name: '智能对话 (Chat)', category: 'generic' }
] as const

/** 常用内置高频图标离线嵌入 SVG（确保离线与初次加载毫秒级就绪）。 */
const EMBEDDED_ICONS: Record<string, string> = {
  'simple-icons:openai': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 8.79a4.485 4.485 0 0 1 2.365-1.995V12.4a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 8.79zm16.597 3.855l-5.833-3.387L15.119 8.1a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.674 8.105v-5.659a.79.79 0 0 0-.409-.692zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 10.12V7.788a.075.075 0 0 1 .033-.061l4.84-2.796a4.5 4.5 0 0 1 6.669 4.69zM8.307 10.741l2.02-1.164a.07.07 0 0 1 .07 0l4.83 2.786a4.485 4.485 0 0 1-2.365 1.995V8.718a.766.766 0 0 0-.388-.677zm.979-1.525l3.464-2 3.464 2v4l-3.464 2-3.464-2z"/></svg>',
  'simple-icons:anthropic': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="m13.827 2.603l6.772 17.784h-3.414l-1.424-3.77H8.225l-1.41 3.77H3.401L10.173 2.6zm-1.83 3.96l-2.617 7.025h5.21z"/></svg>',
  'simple-icons:googlegemini': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M11.04 20.478a5.166 5.166 0 0 0 1.92-1.92a5.166 5.166 0 0 0 1.92 1.92a5.166 5.166 0 0 0-1.92 1.92a5.166 5.166 0 0 0-1.92-1.92zm1.2-8.478c0-3.314-2.686-6-6-6c3.314 0 6-2.686 6-6c0 3.314 2.686 6 6 6c-3.314 0-6 2.686-6 6zm-7.2 4.8a4.8 4.8 0 0 0 4.8-4.8a4.8 4.8 0 0 0-4.8-4.8a4.8 4.8 0 0 0-4.8 4.8a4.8 4.8 0 0 0 4.8 4.8z"/></svg>',
  'simple-icons:deepseek': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10S17.523 2 12 2zm1 14.93V18h-2v-1.07A6.002 6.002 0 0 1 6.07 13H5v-2h1.07A6.002 6.002 0 0 1 11 6.07V5h2v1.07A6.002 6.002 0 0 1 17.93 11H19v2h-1.07A6.002 6.002 0 0 1 13 16.93zm-1-3.43a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3z"/></svg>',
  'simple-icons:ollama': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M12 2a4 4 0 0 0-4 4v1.2A6 6 0 0 0 4 13v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a6 6 0 0 0-4-5.8V6a4 4 0 0 0-4-4zm-2 5a1 1 0 1 1 0-2a1 1 0 0 1 0 2zm4 0a1 1 0 1 1 0-2a1 1 0 0 1 0 2zm-4 7a1.5 1.5 0 1 1 0-3a1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3a1.5 1.5 0 0 1 0 3z"/></svg>',
  'lucide:bot': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  'lucide:sparkles': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
  'lucide:brain': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.002 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>',
  'lucide:cpu': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
  'lucide:zap': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  'lucide:terminal': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
  'lucide:code': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  'lucide:server': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  'lucide:cloud': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  'lucide:shield-check': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
  'lucide:wand-2': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>',
  'lucide:message-square': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
}

// 预先填充嵌入缓存
for (const [key, svg] of Object.entries(EMBEDDED_ICONS)) {
  iconSvgCache.set(key, svg)
}

// ========= 函数 =========

/**
 * 提取模型名称的前两个字符作为文字头像，若为空则默认返回 'AI'。
 * 能够安全处理中英文及多字节 Unicode 字符。
 */
export function getModelInitials(name: string): string {
  /** 清理首尾空白后的展示名。 */
  const trimmed = (name || '').trim()
  if (!trimmed) return 'AI'
  /** 字符数组。 */
  const chars = Array.from(trimmed)
  return chars.slice(0, 2).join('')
}

/**
 * 从 Iconify / YesIcon API 异步获取 SVG 源码，并自动缓存。
 */
export async function fetchIconSvg(iconId: string): Promise<string> {
  /** 去除空白后的标准图标 ID。 */
  const cleanId = (iconId || '').trim()
  if (!cleanId) return ''

  if (iconSvgCache.has(cleanId)) {
    return iconSvgCache.get(cleanId) ?? ''
  }

  // 格式化为 API 路径：prefix/name
  const parts = cleanId.split(':')
  if (parts.length !== 2) return ''
  const prefix = parts[0]
  const name = parts[1]
  if (!prefix || !name) return ''

  const url = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`

  try {
    const response = await fetch(url)
    if (!response.ok) return ''
    const text = await response.text()
    if (text.includes('<svg')) {
      iconSvgCache.set(cleanId, text)
      return text
    }
  } catch {
    // 弱网或离线静默失败
  }

  return ''
}

/**
 * 在 YesIcon / Iconify 图标库中进行在线搜索，返回图标 ID 数组。
 */
export async function searchYesIcons(query: string, limit = 32): Promise<string[]> {
  /** 检索关键词。 */
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  const url = `https://api.iconify.design/search?query=${encodeURIComponent(trimmed)}&limit=${limit}`

  try {
    const response = await fetch(url)
    if (!response.ok) return []
    const data = await response.json() as { icons?: string[] }
    return Array.isArray(data.icons) ? data.icons : []
  } catch {
    return []
  }
}
