import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_SQLITE_SCHEMA_VERSION,
  AppConfigSchema,
  type AppConfig
} from '../../src/shared/schemas/storage'
import {
  normalizeMigrations,
  runSqliteMigrations,
  type SQLiteMigration,
  type SQLiteMigrationDatabase
} from '../../src/infrastructure/persistence/migration-runner'

// ─────────────────────────────────────────────────────────────────────────────
// 测试夹具区
// ─────────────────────────────────────────────────────────────────────────────

/** 内存 SQLite 迁移数据库夹具，模拟 user_version、事务与备份调用。 */
class MemoryMigrationDatabase implements SQLiteMigrationDatabase {
  /** 当前模拟 user_version。 */
  private userVersion: number

  /** 已记录的执行事件。 */
  readonly events: string[] = []

  /** 已创建的备份目标版本。 */
  readonly backups: number[] = []

  constructor(userVersion = 0) {
    this.userVersion = userVersion
  }

  /** 读取当前模拟 user_version。 */
  async getUserVersion(): Promise<number> {
    return this.userVersion
  }

  /** 写入当前模拟 user_version。 */
  async setUserVersion(version: number): Promise<void> {
    this.userVersion = version
    this.events.push(`version:${version}`)
  }

  /** 在内存事务中运行迁移。 */
  async runInTransaction(work: () => Promise<void>): Promise<void> {
    this.events.push('begin')
    await work()
    this.events.push('commit')
  }

  /** 记录升级前备份目标版本。 */
  async createBackup(targetVersion: number): Promise<void> {
    this.backups.push(targetVersion)
  }
}

/** 构造会记录执行顺序的迁移。 */
function migration(version: number): SQLiteMigration {
  return {
    version,
    description: `apply schema ${version}`,
    up: (database) => {
      ;(database as MemoryMigrationDatabase).events.push(`up:${version}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试区
// ─────────────────────────────────────────────────────────────────────────────

describe('SQLite migration runner', () => {
  it('按版本顺序执行待迁移项并推进 user_version', async () => {
    const database = new MemoryMigrationDatabase()
    const result = await runSqliteMigrations(database, [
      migration(2),
      migration(1)
    ])

    expect(result).toEqual({
      fromVersion: 0,
      toVersion: 2,
      appliedVersions: [1, 2]
    })
    expect(database.backups).toEqual([2])
    expect(database.events).toEqual(['begin', 'up:1', 'version:1', 'up:2', 'version:2', 'commit'])
  })

  it('已达到目标版本时不创建备份且不执行事务', async () => {
    const database = new MemoryMigrationDatabase(ACCOUNT_SQLITE_SCHEMA_VERSION)
    const result = await runSqliteMigrations(database, [migration(ACCOUNT_SQLITE_SCHEMA_VERSION)])

    expect(result).toEqual({
      fromVersion: ACCOUNT_SQLITE_SCHEMA_VERSION,
      toVersion: ACCOUNT_SQLITE_SCHEMA_VERSION,
      appliedVersions: []
    })
    expect(database.backups).toEqual([])
    expect(database.events).toEqual([])
  })

  it('拒绝重复迁移版本', () => {
    expect(() => normalizeMigrations([migration(1), migration(1)])).toThrow(/Duplicate/u)
  })
})

describe('storage config schemas', () => {
  it('接受不含秘密和数据库路径的应用配置', () => {
    const config: AppConfig = AppConfigSchema.parse({
      schemaVersion: 1,
      theme: 'system',
      window: {
        width: 1280,
        height: 800,
        maximized: false
      },
      lastOpenedAccountId: 'guest:local'
    })

    expect(config.lastOpenedAccountId).toBe('guest:local')
  })

  it('拒绝任意账户路径和未知字段进入配置文件', () => {
    expect(
      AppConfigSchema.safeParse({
        schemaVersion: 1,
        theme: 'dark',
        window: {
          width: 1280,
          height: 800,
          maximized: false
        },
        lastOpenedAccountId: '../escape',
        cookie: 'MUSIC_U=secret'
      }).success
    ).toBe(false)
  })
})
