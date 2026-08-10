import type { EntityPoolSnapshot } from '../music/entity-pool'
import type { StandardMusicEntity } from '../../shared/schemas/music'

// ========= 类型 =========

/** 实体解析输入。 */
export interface EntityResolveInput {
  /** 所需实体类型。 */
  readonly kind: StandardMusicEntity['kind']
  /** 用户或模型提供的语义名称。 */
  readonly reference: string
  /** 当前页面或播放器的稳定实体 ID。 */
  readonly currentEntityId?: string
}

/** 实体解析结果。 */
export type EntityResolveResult =
  | { readonly status: 'resolved'; readonly entity: StandardMusicEntity; readonly confidence: number }
  | { readonly status: 'needs_selection'; readonly candidates: StandardMusicEntity[]; readonly reason: string }
  | { readonly status: 'not_found'; readonly reason: string }

/** 带评分的实体候选。 */
interface ScoredEntity {
  /** 标准实体。 */
  readonly entity: StandardMusicEntity
  /** 确定性匹配分。 */
  readonly score: number
}

// ========= 变量 =========

/** 第一候选无需消歧的最小领先差。 */
const CLEAR_LEAD_MARGIN = 0.18

// ========= 类 =========

/** 从统一实体池解析语义引用；接近候选返回 SelectionCard 所需结果。 */
export class EntityResolver {
  constructor(private readonly snapshot: () => EntityPoolSnapshot) {}

  /** 解析 current、稳定 ID 或自然语言名称。 */
  resolve(input: EntityResolveInput): EntityResolveResult {
    /** 当前类型的实体池候选。 */
    const candidates = this.snapshot().entities.filter((entity) => entity.kind === input.kind)
    /** 归一化后的引用文本。 */
    const reference = normalizeText(input.reference)
    if (reference === 'current' || reference === '当前') {
      /** 当前上下文实体。 */
      const current = candidates.find((entity) => entity.id === input.currentEntityId)
      return current
        ? { status: 'resolved', entity: current, confidence: 1 }
        : { status: 'not_found', reason: '当前上下文中没有可用实体。' }
    }
    /** 稳定 ID 精确命中的实体。 */
    const byId = candidates.find((entity) => entity.id === input.reference)
    if (byId) return { status: 'resolved', entity: byId, confidence: 1 }

    /** 按名称与上下文进行确定性评分。 */
    const scored: ScoredEntity[] = candidates
      .map((entity) => ({ entity, score: scoreEntity(entity, reference, input.currentEntityId) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.entity.id.localeCompare(right.entity.id))
    /** 第一候选。 */
    const first = scored[0]
    if (!first) return { status: 'not_found', reason: `没有找到“${input.reference}”。` }
    /** 第二候选。 */
    const second = scored[1]
    if (!second || first.score - second.score >= CLEAR_LEAD_MARGIN) {
      return { status: 'resolved', entity: first.entity, confidence: first.score }
    }
    return {
      status: 'needs_selection',
      candidates: scored.slice(0, 5).map((candidate) => candidate.entity),
      reason: '多个候选的匹配度接近，需要用户选择。'
    }
  }
}

// ========= 函数 =========

/** 标准实体统一读取展示名称。 */
function entityName(entity: StandardMusicEntity): string {
  return 'name' in entity ? entity.name : ''
}

/** 计算名称、包含关系与当前上下文加权分。 */
function scoreEntity(entity: StandardMusicEntity, reference: string, currentEntityId?: string): number {
  /** 标准化实体名。 */
  const name = normalizeText(entityName(entity))
  if (!name || !reference) return 0
  /** 名称基础匹配分。 */
  let score = name === reference ? 1 : name.includes(reference) || reference.includes(name) ? 0.72 : 0
  if (entity.id === currentEntityId) score += 0.12
  return Math.min(score, 1)
}

/** 去除空白与标点并转小写，保证中英文名称可稳定比较。 */
function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}
