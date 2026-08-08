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

/** 按标准实体字段合并，后到的非空字段补齐已有实体。 */
function mergeEntity(current: StandardMusicEntity, incoming: StandardMusicEntity): StandardMusicEntity {
  if (current.kind !== incoming.kind || current.id !== incoming.id) return incoming
  return StandardMusicEntitySchema.parse({
    ...current,
    ...incoming,
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
}
