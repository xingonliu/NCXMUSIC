import type { AccountSessionSnapshot } from '../schemas/account'

// ========= 变量 =========

/** Main/Preload 账户控制通道集合。 */
export const ACCOUNT_CHANNELS = {
  snapshot: 'ncx:account-snapshot',
  login: 'ncx:account-login',
  logout: 'ncx:account-logout',
  switchAccount: 'ncx:account-switch',
  status: 'ncx:account-status'
} as const

// ========= 类型 =========

/** Renderer 侧账户桥，只暴露安全账户状态与显式登录动作。 */
export interface AccountBridge {
  snapshot(): Promise<AccountSessionSnapshot>
  login(): Promise<AccountSessionSnapshot>
  logout(): Promise<AccountSessionSnapshot>
  switchAccount(): Promise<AccountSessionSnapshot>
  onSnapshot(listener: (snapshot: AccountSessionSnapshot) => void): () => void
}
