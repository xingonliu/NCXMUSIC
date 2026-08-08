// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** Migration runner 依赖的最小 SQLite 能力接口。 */
export interface SQLiteMigrationDatabase {
  /** 读取 PRAGMA user_version 或等价 schema version。 */
  getUserVersion(): Promise<number>
  /** 写入 PRAGMA user_version 或等价 schema version。 */
  setUserVersion(version: number): Promise<void>
  /** 在单个事务中运行迁移，失败时由适配器负责回滚。 */
  runInTransaction(work: () => Promise<void>): Promise<void>
  /** 可选：升级前创建可恢复备份或 checkpoint。 */
  createBackup?(targetVersion: number): Promise<void>
}

/** 单个账户 SQLite 迁移定义。 */
export interface SQLiteMigration {
  /** 迁移目标版本，必须为正整数且不可重复。 */
  version: number
  /** 人类可读的迁移说明。 */
  description: string
  /** 迁移执行体，只允许写入当前数据库连接。 */
  up(database: SQLiteMigrationDatabase): Promise<void> | void
}

/** Migration runner 执行结果。 */
export interface MigrationRunResult {
  /** 执行前数据库版本。 */
  fromVersion: number
  /** 执行后数据库版本。 */
  toVersion: number
  /** 本次实际应用的迁移版本列表。 */
  appliedVersions: number[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 校验迁移列表并按版本升序返回副本。 */
export function normalizeMigrations(migrations: readonly SQLiteMigration[]): SQLiteMigration[] {
  /** 已登记的迁移版本集合。 */
  const seenVersions = new Set<number>()
  /** 排序后的迁移定义副本。 */
  const sortedMigrations = [...migrations].sort((left, right) => left.version - right.version)

  for (const migration of sortedMigrations) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(`SQLite migration version must be a positive integer: ${migration.version}`)
    }
    if (!migration.description.trim()) {
      throw new Error(`SQLite migration ${migration.version} requires a description`)
    }
    if (seenVersions.has(migration.version)) {
      throw new Error(`Duplicate SQLite migration version: ${migration.version}`)
    }
    seenVersions.add(migration.version)
  }

  return sortedMigrations
}

/** 执行待应用的 SQLite migrations，并在每步成功后推进 user_version。 */
export async function runSqliteMigrations(
  database: SQLiteMigrationDatabase,
  migrations: readonly SQLiteMigration[],
  targetVersion?: number
): Promise<MigrationRunResult> {
  /** 排序且校验后的迁移定义。 */
  const sortedMigrations = normalizeMigrations(migrations)
  /** 当前数据库版本。 */
  const fromVersion = await database.getUserVersion()
  /** 迁移目标版本，默认使用最大迁移版本。 */
  const resolvedTargetVersion = targetVersion ?? sortedMigrations.at(-1)?.version ?? fromVersion

  if (!Number.isInteger(fromVersion) || fromVersion < 0) {
    throw new Error(`SQLite user_version is invalid: ${fromVersion}`)
  }
  if (!Number.isInteger(resolvedTargetVersion) || resolvedTargetVersion < 0) {
    throw new Error(`SQLite target version is invalid: ${resolvedTargetVersion}`)
  }
  if (fromVersion > resolvedTargetVersion) {
    throw new Error(`SQLite schema version ${fromVersion} is newer than target ${resolvedTargetVersion}`)
  }

  /** 本次需要执行的迁移。 */
  const pendingMigrations = sortedMigrations.filter(
    (migration) => migration.version > fromVersion && migration.version <= resolvedTargetVersion
  )
  /** 本次实际应用的版本列表。 */
  const appliedVersions: number[] = []

  if (pendingMigrations.length === 0) {
    return { fromVersion, toVersion: fromVersion, appliedVersions }
  }

  await database.createBackup?.(resolvedTargetVersion)
  await database.runInTransaction(async () => {
    for (const migration of pendingMigrations) {
      await migration.up(database)
      await database.setUserVersion(migration.version)
      appliedVersions.push(migration.version)
    }
  })

  return {
    fromVersion,
    toVersion: appliedVersions.at(-1) ?? fromVersion,
    appliedVersions
  }
}
