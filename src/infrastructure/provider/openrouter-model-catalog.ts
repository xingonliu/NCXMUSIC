import { z } from 'zod'

import {
  ProviderModelCatalogSchema,
  type ProviderCatalogModel,
  type ProviderCatalogVendor,
  type ProviderModelCatalog
} from '../../shared/schemas/provider-profile'

// ========= 类型 =========

/** 可替换的 Fetch 签名，供 Main 进程调用与单元测试注入。 */
export type ModelCatalogFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

/** 尚未排序的供应商聚合状态。 */
interface MutableVendor {
  /** 归一化供应商 ID。 */
  id: string
  /** 供应商展示名。 */
  name: string
  /** 供应商旗下模型。 */
  models: ProviderCatalogModel[]
}

// ========= 变量 =========

/** OpenRouter OpenAI 兼容服务根地址。 */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1' as const

/** OpenRouter 模型列表地址。 */
const OPENROUTER_MODELS_URL = `${OPENROUTER_BASE_URL}/models`

/** OpenRouter 模型计数地址。 */
const OPENROUTER_MODELS_COUNT_URL = `${OPENROUTER_MODELS_URL}/count`

/** 单次 OpenRouter 目录请求的最大等待时间。 */
const OPENROUTER_REQUEST_TIMEOUT_MS = 15_000

/** 防止异常分页链接造成无限请求的页数上限。 */
const OPENROUTER_MAX_PAGE_COUNT = 20

/** 供应商名称排序器。 */
const vendorNameCollator = new Intl.Collator('en', { sensitivity: 'base' })

/** 用户指定的置顶供应商顺序及展示名。 */
const priorityVendors = new Map<string, { name: string; rank: number }>([
  ['openai', { name: 'ChatGPT', rank: 0 }],
  ['anthropic', { name: 'Claude', rank: 1 }],
  ['deepseek', { name: 'DeepSeek', rank: 2 }],
  ['z-ai', { name: 'GLM', rank: 3 }],
  ['google', { name: 'Gemini', rank: 4 }],
  ['x-ai', { name: 'Grok', rank: 5 }],
  ['moonshotai', { name: 'Kimi', rank: 6 }],
  ['minimax', { name: 'MiniMax', rank: 7 }],
  ['qwen', { name: 'Qwen', rank: 8 }],
  ['bytedance-seed', { name: 'Seed', rank: 9 }]
])

/** OpenRouter 模型条目的最小可信结构。 */
const OpenRouterModelSchema = z.object({
  id: z.string().trim().min(3).max(200),
  name: z.string().trim().min(1).max(200),
  created: z.number().int().nonnegative()
})

/** OpenRouter 模型列表响应的最小可信结构。 */
const OpenRouterModelsResponseSchema = z.object({
  data: z.array(OpenRouterModelSchema),
  total_count: z.number().int().nonnegative().optional(),
  links: z.object({ next: z.string().nullable().optional() }).optional()
})

/** OpenRouter 模型计数响应结构。 */
const OpenRouterModelsCountResponseSchema = z.object({
  data: z.object({ count: z.number().int().nonnegative() })
})

// ========= 函数 =========

/** 拉取、校验并归并 OpenRouter 最新模型目录。 */
export async function fetchOpenRouterModelCatalog(
  fetchImpl: ModelCatalogFetch = fetch
): Promise<ProviderModelCatalog> {
  /** 与模型分页并行请求的权威计数。 */
  const countPromise = requestCatalogJson(fetchImpl, OPENROUTER_MODELS_COUNT_URL)
    .then((value) => OpenRouterModelsCountResponseSchema.parse(value).data.count)
  /** 已拉取并按 ID 去重的模型条目。 */
  const modelsById = new Map<string, z.infer<typeof OpenRouterModelSchema>>()
  /** 当前待请求的 OpenRouter 模型页地址。 */
  let nextUrl: string | undefined = OPENROUTER_MODELS_URL
  /** 已请求的模型分页数。 */
  let pageCount = 0

  while (nextUrl) {
    if (pageCount >= OPENROUTER_MAX_PAGE_COUNT) {
      throw new Error('OpenRouter 模型目录分页超过安全上限。')
    }
    /** 当前页经过结构校验的响应。 */
    const page = OpenRouterModelsResponseSchema.parse(
      await requestCatalogJson(fetchImpl, nextUrl)
    )
    for (const model of page.data) modelsById.set(model.id, model)
    nextUrl = normalizeNextModelsUrl(page.links?.next)
    pageCount += 1
  }

  /** `/models/count` 返回的当前目录模型数。 */
  const modelCount = await countPromise
  /** 已按供应商归并并排序的目录。 */
  const vendors = buildCatalogVendors([...modelsById.values()])
  return ProviderModelCatalogSchema.parse({
    source: 'openrouter',
    baseUrl: OPENROUTER_BASE_URL,
    modelCount,
    fetchedAt: Date.now(),
    vendors
  })
}

/** 请求 OpenRouter JSON，并将网络与 HTTP 错误收敛成稳定错误。 */
async function requestCatalogJson(
  fetchImpl: ModelCatalogFetch,
  url: string
): Promise<unknown> {
  /** 当前目录请求响应。 */
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(OPENROUTER_REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new Error(`OpenRouter 模型目录请求失败（HTTP ${response.status}）。`)
  }
  return response.json() as Promise<unknown>
}

/** 仅允许继续访问 OpenRouter 自身的模型列表分页。 */
function normalizeNextModelsUrl(next: string | null | undefined): string | undefined {
  if (!next) return undefined
  /** 解析为绝对地址的下一页 URL。 */
  const resolved = new URL(next, OPENROUTER_BASE_URL)
  if (resolved.origin !== 'https://openrouter.ai' || resolved.pathname !== '/api/v1/models') {
    throw new Error('OpenRouter 返回了不受信任的模型分页地址。')
  }
  return resolved.toString()
}

/** 将逐模型响应归并为供应商列表，并保证模型由新到旧。 */
function buildCatalogVendors(
  models: z.infer<typeof OpenRouterModelSchema>[]
): ProviderCatalogVendor[] {
  /** 以规范供应商 ID 为键的可变聚合表。 */
  const vendorsById = new Map<string, MutableVendor>()
  for (const model of models) {
    /** 从模型 ID 提取并去掉 OpenRouter `~` 别名前缀的供应商 ID。 */
    const vendorId = normalizeVendorId(model.id)
    if (!vendorId) continue
    /** 供应商已有聚合项或本次创建的新聚合项。 */
    const vendor = vendorsById.get(vendorId) ?? {
      id: vendorId,
      name: resolveVendorName(vendorId, model.name),
      models: []
    }
    vendor.models.push({ id: model.id, name: resolveModelName(model.name), created: model.created })
    vendorsById.set(vendorId, vendor)
  }

  return [...vendorsById.values()]
    .map((vendor) => {
      /** 当前供应商的用户指定置顶信息。 */
      const priority = priorityVendors.get(vendor.id)
      /** 由新到旧且 ID 稳定兜底排序后的模型。 */
      const sortedModels = vendor.models.sort((left, right) =>
        right.created - left.created || vendorNameCollator.compare(left.name, right.name)
      )
      return {
        id: vendor.id,
        name: priority?.name ?? vendor.name,
        ...(priority ? { priorityRank: priority.rank } : {}),
        models: sortedModels
      }
    })
    .sort((left, right) => {
      /** 未置顶供应商使用无穷大参与第一排序键。 */
      const leftRank = left.priorityRank ?? Number.POSITIVE_INFINITY
      /** 未置顶供应商使用无穷大参与第一排序键。 */
      const rightRank = right.priorityRank ?? Number.POSITIVE_INFINITY
      return leftRank - rightRank || vendorNameCollator.compare(left.name, right.name)
    })
}

/** 从 `vendor/model` ID 中提取供应商，并将目录别名并入真实供应商。 */
function normalizeVendorId(modelId: string): string | undefined {
  /** 模型 ID 斜杠前的原始供应商段。 */
  const rawVendorId = modelId.split('/', 1)[0]?.trim().toLowerCase()
  return rawVendorId?.replace(/^~/u, '') || undefined
}

/** 解析供应商显示名；置顶供应商由固定产品文案覆盖。 */
function resolveVendorName(vendorId: string, modelName: string): string {
  /** 用户指定的置顶供应商展示信息。 */
  const priority = priorityVendors.get(vendorId)
  if (priority) return priority.name
  /** OpenRouter 通常放在冒号前的厂商名。 */
  const explicitPrefix = modelName.includes(':') ? modelName.split(':', 1)[0]?.trim() : undefined
  if (explicitPrefix) return explicitPrefix
  return vendorId
    .split(/[-_]/u)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

/** 去掉 OpenRouter 模型名中重复的供应商前缀。 */
function resolveModelName(modelName: string): string {
  /** 冒号后的模型短名称。 */
  const shortName = modelName.includes(':') ? modelName.split(':').slice(1).join(':').trim() : ''
  return shortName || modelName
}
