import { config } from '@vue/test-utils'

import { translateSourceText } from '../src/renderer/i18n'

// ========= 配置 =========

/** 让直接挂载单文件组件的测试获得与应用入口一致的全局源文案翻译器。 */
config.global.mocks['$tSource'] = translateSourceText
