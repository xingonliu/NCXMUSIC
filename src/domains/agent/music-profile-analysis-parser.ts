import { z } from 'zod'

import {
  MusicProfileAnalysisSchema,
  type MusicProfileAnalysis
} from '../../shared/schemas/personalization'

// ========= 函数 =========

/** 从模型原始输出中剥离思考链并鲁棒提取最外层 JSON 对象文本。 */
function extractJsonObjectText(value: string): string {
  /** 剥离思考链与首尾空白后的清理文本。 */
  const cleaned = value.trim()
    .replace(/<think>[\s\S]*?<\/think>/giu, '')
    .replace(/<think>[\s\S]*$/giu, '')
    .trim()

  /** 优先尝试匹配 Markdown JSON 代码块。 */
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/giu
  /** 当前 Markdown 代码块匹配结果。 */
  let match: RegExpExecArray | null
  while ((match = codeBlockRegex.exec(cleaned)) !== null) {
    /** 当前代码块正文。 */
    const blockContent = match[1]?.trim()
    if (blockContent && blockContent.startsWith('{') && blockContent.endsWith('}')) {
      return blockContent
    }
  }

  /** 首个大括号位置。 */
  const firstBraceIndex = cleaned.indexOf('{')
  if (firstBraceIndex < 0) {
    throw new Error('模型没有返回有效画像 JSON。')
  }

  /** 当前大括号嵌套深度。 */
  let depth = 0
  /** 是否位于字符串字面量内。 */
  let inString = false
  /** 当前字符是否已被转义。 */
  let isEscaped = false
  /** 识别到的 JSON 起始位置。 */
  let start = -1
  /** 识别到的 JSON 结束位置。 */
  let end = -1

  for (let index = firstBraceIndex; index < cleaned.length; index += 1) {
    /** 当前扫描字符。 */
    const char = cleaned[index]

    if (inString) {
      if (char === '\\' && !isEscaped) {
        isEscaped = true
      } else {
        if (char === '"' && !isEscaped) {
          inString = false
        }
        isEscaped = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }

  if (start >= 0 && end > start && depth === 0) {
    return cleaned.slice(start, end + 1)
  }

  /** 备选：从首个大括号到末尾大括号。 */
  const lastBraceIndex = cleaned.lastIndexOf('}')
  if (lastBraceIndex > firstBraceIndex) {
    return cleaned.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  throw new Error('模型没有返回有效画像 JSON。')
}

/** 从模型文本提取并严格校验音乐画像 JSON。 */
export function parseMusicProfileAnalysis(value: string): MusicProfileAnalysis {
  try {
    /** 提取出的 JSON 对象文本。 */
    const jsonText = extractJsonObjectText(value)
    /** JSON 解码后的未知输入。 */
    const decoded = JSON.parse(jsonText) as unknown
    return MusicProfileAnalysisSchema.parse(decoded)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `模型画像格式校验未通过：${error.issues.map((issue) => issue.message).join('；')}`,
        { cause: error }
      )
    }
    if (error instanceof SyntaxError) {
      throw new Error('模型返回的内容无法解析为有效 JSON。', { cause: error })
    }
    if (error instanceof Error) {
      throw error
    }
    throw new Error('模型没有返回有效画像 JSON。', { cause: error })
  }
}
