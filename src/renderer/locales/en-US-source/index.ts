import { enUSAgentSourceMessages } from './agent'
import { enUSCoreSourceMessages } from './core'
import { enUSDesignSystemSourceMessages } from './design-system'
import { enUSMusicSourceMessages } from './music'
import { enUSProfileSourceMessages } from './profile'
import { enUSSettingsSourceMessages } from './settings'

// ========= 变量 =========

/** 旧界面硬编码文案到英语的集中兼容目录。 */
export const enUSSourceMessages: Readonly<Record<string, string>> = {
  ...enUSAgentSourceMessages,
  ...enUSCoreSourceMessages,
  ...enUSDesignSystemSourceMessages,
  ...enUSProfileSourceMessages,
  ...enUSSettingsSourceMessages,
  ...enUSMusicSourceMessages
}
