import { describe, expect, it, vi } from 'vitest'

import {
  fetchOpenRouterModelCatalog,
  type ModelCatalogFetch
} from '../../src/infrastructure/provider/openrouter-model-catalog'

// ========= 函数 =========

/** 创建带 JSON 正文的测试响应。 */
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

// ========= 测试 =========

describe('OpenRouter model catalog', () => {
  it('从逐模型数据归并供应商、合并别名并将模型由新到旧排序', async () => {
    /** 按请求 URL 返回模型页和计数的 Fetch 替身。 */
    const fetchMock = vi.fn<ModelCatalogFetch>(async (input) => {
      /** 当前请求地址。 */
      const url = String(input)
      if (url.endsWith('/models/count')) return jsonResponse({ data: { count: 5 } })
      return jsonResponse({
        data: [
          { id: 'qwen/qwen-old', name: 'Qwen: Qwen Old', created: 100 },
          { id: 'openai/gpt-new', name: 'OpenAI: GPT New', created: 300 },
          { id: '~openai/gpt-latest', name: 'OpenAI GPT Latest', created: 400 },
          { id: 'qwen/qwen-new', name: 'Qwen: Qwen New', created: 200 },
          { id: 'cohere/command-r', name: 'Cohere: Command R', created: 150 }
        ],
        links: { next: null }
      })
    })

    /** 被测目录聚合结果。 */
    const catalog = await fetchOpenRouterModelCatalog(fetchMock)
    expect(catalog.modelCount).toBe(5)
    expect(catalog.baseUrl).toBe('https://openrouter.ai/api/v1')
    expect(catalog.vendors.map((vendor) => vendor.name)).toEqual(['ChatGPT', 'Qwen', 'Cohere'])
    expect(catalog.vendors[0]?.models.map((model) => model.id)).toEqual([
      '~openai/gpt-latest',
      'openai/gpt-new'
    ])
    expect(catalog.vendors[1]?.models.map((model) => model.id)).toEqual([
      'qwen/qwen-new',
      'qwen/qwen-old'
    ])
  })

  it('拒绝跟随非 OpenRouter 的模型分页地址', async () => {
    /** 返回恶意下一页地址的 Fetch 替身。 */
    const fetchMock = vi.fn<ModelCatalogFetch>(async (input) => {
      if (String(input).endsWith('/models/count')) return jsonResponse({ data: { count: 1 } })
      return jsonResponse({
        data: [{ id: 'openai/gpt', name: 'OpenAI: GPT', created: 1 }],
        links: { next: 'https://example.com/models?page=2' }
      })
    })

    await expect(fetchOpenRouterModelCatalog(fetchMock)).rejects.toThrow('不受信任')
  })

  it('将 fetch 网络异常归一为稳定目录错误，并消费并发计数请求拒绝', async () => {
    /** 模拟 OpenRouter 连接被中途重置的 Fetch 替身。 */
    const fetchMock = vi.fn<ModelCatalogFetch>(async () => {
      throw new TypeError('fetch failed')
    })

    await expect(fetchOpenRouterModelCatalog(fetchMock)).rejects.toThrow('暂时无法连接')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('将目录请求超时归一为稳定超时错误', async () => {
    /** 模拟 AbortSignal.timeout 触发的 Fetch 替身。 */
    const fetchMock = vi.fn<ModelCatalogFetch>(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })

    await expect(fetchOpenRouterModelCatalog(fetchMock)).rejects.toThrow('请求超时')
  })
})
