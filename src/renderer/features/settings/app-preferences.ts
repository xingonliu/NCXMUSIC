import { readonly, ref, type Ref } from 'vue'

import { AppThemeSchema, type AppTheme } from '../../../shared/schemas/storage'

// ========= 类型 =========

/** Phase 4 可由 Renderer 安全持久化的界面偏好。 */
export interface AppPreferences {
  /** 应用主题模式。 */
  theme: AppTheme
  /** 是否展示歌词翻译。 */
  showLyricTranslation: boolean
  /** 关闭主窗口时驻留托盘或退出应用；`minimize` 为兼容旧配置的驻留值。 */
  closeWindowBehavior: 'minimize' | 'quit'
}

// ========= 变量 =========

/** 偏好本地存储键。 */
const PREFERENCES_STORAGE_KEY = 'ncx.app-preferences.v1'

/** 默认界面偏好。 */
const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'system',
  showLyricTranslation: true,
  closeWindowBehavior: 'minimize'
}

/** 应用作用域偏好状态。 */
const preferences = ref<AppPreferences>(readPreferences())

// ========= 函数 =========

/** 从本地存储读取并校验界面偏好。 */
function readPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<AppPreferences>
    const theme = AppThemeSchema.safeParse(parsed.theme)
    return {
      theme: theme.success ? theme.data : DEFAULT_PREFERENCES.theme,
      showLyricTranslation: typeof parsed.showLyricTranslation === 'boolean'
        ? parsed.showLyricTranslation
        : DEFAULT_PREFERENCES.showLyricTranslation,
      closeWindowBehavior: parsed.closeWindowBehavior === 'quit' ? 'quit' : 'minimize'
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/** 把当前主题同步到文档根节点。 */
function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset['theme'] = theme
}

/** 持久化并发布完整偏好。 */
function savePreferences(next: AppPreferences): void {
  preferences.value = next
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
  applyTheme(next.theme)
}

/** 更新主题模式。 */
function setTheme(theme: AppTheme): void {
  savePreferences({ ...preferences.value, theme })
}

/** 使用账户 SQLite 权威值同步主题展示镜像。 */
function hydrateTheme(theme: AppTheme): void {
  savePreferences({ ...preferences.value, theme })
}

/** 更新歌词翻译显示偏好。 */
function setShowLyricTranslation(showLyricTranslation: boolean): void {
  savePreferences({ ...preferences.value, showLyricTranslation })
}

/** 使用账户 SQLite 权威值同步歌词翻译展示镜像。 */
function hydrateShowLyricTranslation(showLyricTranslation: boolean): void {
  savePreferences({ ...preferences.value, showLyricTranslation })
}

/** 更新关闭窗口行为偏好。 */
function setCloseWindowBehavior(closeWindowBehavior: 'minimize' | 'quit'): void {
  savePreferences({ ...preferences.value, closeWindowBehavior })
}

/** 使用 Main 权威值同步 Renderer 展示镜像，不向 Main 反向写入。 */
function hydrateCloseWindowBehavior(closeWindowBehavior: 'minimize' | 'quit'): void {
  savePreferences({ ...preferences.value, closeWindowBehavior })
}

/** 清理可重建的 Renderer 缓存。 */
function clearRendererCache(): void {
  const preservedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY)
  localStorage.clear()
  sessionStorage.clear()
  if (preservedPreferences) localStorage.setItem(PREFERENCES_STORAGE_KEY, preservedPreferences)
}

applyTheme(preferences.value.theme)

/** 使用应用界面偏好。 */
export function useAppPreferences(): {
  preferences: Readonly<Ref<AppPreferences>>
  setTheme: (theme: AppTheme) => void
  hydrateTheme: (theme: AppTheme) => void
  setShowLyricTranslation: (value: boolean) => void
  hydrateShowLyricTranslation: (value: boolean) => void
  setCloseWindowBehavior: (value: 'minimize' | 'quit') => void
  hydrateCloseWindowBehavior: (value: 'minimize' | 'quit') => void
  clearRendererCache: () => void
} {
  return {
    preferences: readonly(preferences),
    setTheme,
    hydrateTheme,
    setShowLyricTranslation,
    hydrateShowLyricTranslation,
    setCloseWindowBehavior,
    hydrateCloseWindowBehavior,
    clearRendererCache
  }
}
