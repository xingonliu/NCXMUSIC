import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  APP_CONFIG_SCHEMA_VERSION,
  AppConfigSchema,
  type AppConfig
} from '../shared/schemas/storage'

// ========= 变量 =========

/** 新安装时使用的安全应用配置。 */
const DEFAULT_APP_CONFIG: AppConfig = {
  schemaVersion: APP_CONFIG_SCHEMA_VERSION,
  theme: 'system',
  window: { width: 1200, height: 800, maximized: false },
  closeWindowBehavior: 'minimize',
  lastOpenedAccountId: 'guest:local'
}

// ========= 类 =========

/** Main 持有的应用配置唯一权威来源。 */
export class AppConfigStore {
  /** 应用配置文件路径。 */
  private readonly configPath: string

  /** 当前已校验配置。 */
  private config: AppConfig = DEFAULT_APP_CONFIG

  constructor(userDataPath: string) {
    this.configPath = join(userDataPath, 'ncx-config.json')
  }

  /** 从磁盘读取配置；损坏或旧版缺字段时使用 Schema 默认值。 */
  load(): AppConfig {
    try {
      /** 磁盘中的未知配置对象。 */
      const decoded = JSON.parse(readFileSync(this.configPath, 'utf8')) as unknown
      /** 兼容旧版缺少新增默认字段的配置。 */
      this.config = AppConfigSchema.parse(decoded)
    } catch {
      this.config = DEFAULT_APP_CONFIG
    }
    return { ...this.config, window: { ...this.config.window } }
  }

  /** 持久化主窗口关闭行为；`minimize` 为兼容旧配置的关闭到托盘值。 */
  setCloseWindowBehavior(closeWindowBehavior: 'minimize' | 'quit'): AppConfig {
    this.config = { ...this.config, closeWindowBehavior }
    this.persist()
    return { ...this.config, window: { ...this.config.window } }
  }

  /** 以同目录临时文件加原子重命名写入配置。 */
  private persist(): void {
    /** 配置文件所在目录。 */
    const directory = dirname(this.configPath)
    /** 同目录原子替换使用的临时路径。 */
    const temporaryPath = `${this.configPath}.tmp`
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporaryPath, `${JSON.stringify(this.config, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    })
    renameSync(temporaryPath, this.configPath)
  }
}
