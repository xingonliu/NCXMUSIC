import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// ========= 变量 =========

/** 应用侧栏源码。 */
const appShellSource = readFileSync(
  join(process.cwd(), 'src/renderer/design-system/patterns/AppShell.vue'),
  'utf8'
)

/** 个人信息页源码。 */
const profilePageSource = readFileSync(
  join(process.cwd(), 'src/renderer/features/profile/ProfilePage.vue'),
  'utf8'
)

/** 设置页源码。 */
const settingsPageSource = readFileSync(
  join(process.cwd(), 'src/renderer/features/settings/SettingsPage.vue'),
  'utf8'
)

// ========= 测试区 =========

describe('account navigation UI contract', () => {
  it('允许游客从侧栏进入个人信息页', () => {
    expect(appShellSource).toContain(':to="{ name: appAccountNavigationItem.routeName }"')
    expect(appShellSource).not.toContain('ncx-nav-item--disabled')
  })

  it('将账户会话操作放在个人信息页并从设置页移除账户标签', () => {
    expect(profilePageSource).toContain('登录账户')
    expect(profilePageSource).toContain("runAccountAction('login')")
    expect(profilePageSource).toContain("runAccountAction('switch')")
    expect(profilePageSource).toContain('logoutDialogVisible = true')
    expect(settingsPageSource).not.toContain("{ label: '账户', value: 'account' }")
    expect(settingsPageSource).not.toContain('runAccountAction')
  })
})
