import {
  StandardMusicEntitySchema,
  type MusicEntitySource,
  type StandardMusicEntity
} from '../../shared/schemas/music'

// ========= 类型 =========

/** 实体池内部键。 */
type EntityPoolKey = `${StandardMusicEntity['kind']}:${string}`

/** 实体池快照。 */
export interface EntityPoolSnapshot {
  /** 当前池内的全部标准实体。 */
  entities: StandardMusicEntity[]
}

/** 实体字段递归合并时使用的普通对象。 */
type EntityRecord = Record<string, unknown>

// ========= 函数 =========

/** 构造实体池稳定键。 */
function entityKey(entity: StandardMusicEntity): EntityPoolKey {
  return `${entity.kind}:${entity.id}`
}

/** 合并来源数组并按 API/观测时间去重。 */
function mergeSources(
  current: MusicEntitySource[],
  incoming: MusicEntitySource[]
): MusicEntitySource[] {
  const merged = new Map<string, MusicEntitySource>()
  for (const source of [...current, ...incoming]) {
    merged.set(`${source.api}:${source.observedAt}`, source)
  }
  return [...merged.values()].sort((a, b) => a.api.localeCompare(b.api) || a.observedAt.localeCompare(b.observedAt))
}

/** 判断未知值是否为可递归合并的普通对象。 */
function isRecord(value: unknown): value is EntityRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 合并带稳定 id 的对象数组，并保留当前对象中的丰富字段。 */
function mergeIdentifiedArray(current: unknown[], incoming: unknown[]): unknown[] | undefined {
  if (!current.every(isRecord) || !incoming.every(isRecord)) return undefined
  if (![...current, ...incoming].every((item) => typeof item['id'] === 'string')) return undefined

  const merged = new Map<string, EntityRecord>()
  for (const item of current) merged.set(item['id'] as string, item)
  for (const item of incoming) {
    const id = item['id'] as string
    const existing = merged.get(id)
    merged.set(id, existing ? mergeRecord(existing, item) : item)
  }
  return [...merged.values()]
}

/** 合并标准字段值；空数组和空对象不能覆盖已有非空数据。 */
function mergeValue(current: unknown, incoming: unknown): unknown {
  if (incoming === undefined || incoming === null || incoming === '') return current
  if (Array.isArray(incoming)) {
    if (incoming.length === 0) return Array.isArray(current) && current.length > 0 ? current : incoming
    if (!Array.isArray(current) || current.length === 0) return incoming
    const identified = mergeIdentifiedArray(current, incoming)
    if (identified) return identified
    return [...new Set([...current, ...incoming])]
  }
  if (isRecord(incoming)) {
    if (!isRecord(current)) return incoming
    return mergeRecord(current, incoming)
  }
  return incoming
}

/** 递归合并两个实体对象。 */
function mergeRecord(current: EntityRecord, incoming: EntityRecord): EntityRecord {
  const merged: EntityRecord = { ...current }
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = mergeValue(current[key], value)
  }
  return merged
}

/** 按标准实体字段合并，后到的非空字段补齐已有实体。 */
function mergeEntity(current: StandardMusicEntity, incoming: StandardMusicEntity): StandardMusicEntity {
  if (current.kind !== incoming.kind || current.id !== incoming.id) return incoming
  /** 新鲜实体优先覆盖标量，较旧实体只用于补齐缺失字段。 */
  const incomingIsFresh = incoming.updatedAt >= current.updatedAt
  /** 按字段新鲜度策略合并后的普通对象。 */
  const merged = incomingIsFresh
    ? mergeRecord(current as unknown as EntityRecord, incoming as unknown as EntityRecord)
    : mergeRecord(incoming as unknown as EntityRecord, current as unknown as EntityRecord)
  if (current.kind === 'song' && incoming.kind === 'song') {
    merged['access'] = {
      badges: [...new Set([...current.access.badges, ...incoming.access.badges])],
      playableKnown: current.access.playableKnown || incoming.access.playableKnown
    }
  }
  return StandardMusicEntitySchema.parse({
    ...merged,
    sources: mergeSources(current.sources, incoming.sources),
    updatedAt: incoming.updatedAt >= current.updatedAt ? incoming.updatedAt : current.updatedAt
  })
}

// ========= 类 =========

/** 标准实体池，统一保存歌曲、歌手、专辑、歌单和用户 DTO。 */
export class StandardEntityPool {
  /** 当前实体索引。 */
  private readonly entities = new Map<EntityPoolKey, StandardMusicEntity>()

  /** 插入或合并一个标准实体。 */
  upsert(entity: StandardMusicEntity): StandardMusicEntity {
    const parsed = StandardMusicEntitySchema.parse(entity)
    const key = entityKey(parsed)
    const current = this.entities.get(key)
    const next = current ? mergeEntity(current, parsed) : parsed
    this.entities.set(key, next)
    return next
  }

  /** 批量插入或合并标准实体。 */
  upsertMany(entities: StandardMusicEntity[]): StandardMusicEntity[] {
    return entities.map((entity) => this.upsert(entity))
  }

  /** 按实体类型和 ID 读取实体。 */
  get(kind: StandardMusicEntity['kind'], id: string): StandardMusicEntity | undefined {
    return this.entities.get(`${kind}:${id}` as EntityPoolKey)
  }

  /** 导出当前实体池快照。 */
  snapshot(): EntityPoolSnapshot {
    return {
      entities: [...this.entities.values()]
    }
  }

  /** 清空当前账户实体，防止账户专属字段跨账户混用。 */
  clear(): void {
    this.entities.clear()
  }
}
