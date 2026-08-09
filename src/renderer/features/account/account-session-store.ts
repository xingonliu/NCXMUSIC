import { readonly, ref, type Ref } from 'vue'

import type { AccountSessionSnapshot } from '../../../shared/schemas/account'

// ========= 变量 =========

/** 应用作用域账户公开快照。 */
const accountSnapshot = ref<AccountSessionSnapshot>()

/** 账户桥是否已经完成初始化。 */
let initialized = false

/** 账户状态订阅清理函数。 */
let unsubscribeAccount = (): void => {}

// ========= 函数 =========

/** 初始化账户公开快照及其后续订阅。 */
async function initializeAccountStore(): Promise<void> {
  if (initialized) return
  initialized = true
  unsubscribeAccount = window.ncx.account.onSnapshot((snapshot) => {
    accountSnapshot.value = snapshot
  })
  accountSnapshot.value = await window.ncx.account.snapshot()
}

/** 刷新账户公开快照。 */
async function refreshAccountStore(): Promise<AccountSessionSnapshot> {
  const snapshot = await window.ncx.account.snapshot()
  accountSnapshot.value = snapshot
  return snapshot
}

/** 释放账户公开快照订阅，仅供测试和应用退出使用。 */
export function disposeAccountSessionStore(): void {
  unsubscribeAccount()
  unsubscribeAccount = (): void => {}
  initialized = false
  accountSnapshot.value = undefined
}

/** 使用应用作用域账户公开快照。 */
export function useAccountSessionStore(): {
  snapshot: Readonly<Ref<AccountSessionSnapshot | undefined>>
  initialize: () => Promise<void>
  refresh: () => Promise<AccountSessionSnapshot>
} {
  return {
    snapshot: readonly(accountSnapshot),
    initialize: initializeAccountStore,
    refresh: refreshAccountStore
  }
}
