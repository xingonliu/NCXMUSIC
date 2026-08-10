import { readonly, ref, type Ref } from 'vue'

import type { ProtocolError } from '../../../shared/schemas/runtime'
import { showToast } from '../../design-system/use-toast'
import { t } from '../../i18n'
import { useAccountSessionStore } from '../account/account-session-store'
import { mutateMusic } from './music-actions'

// ========= 类型 =========

/** 每日签到的应用级状态。 */
export type DailySigninState = 'idle' | 'signing' | 'succeeded' | 'already-signed' | 'failed'

// ========= 变量 =========

/** 两个签到入口共享的签到状态。 */
const signinState = ref<DailySigninState>('idle')

/** 最近一次签到结果文案。 */
const signinMessage = ref<string>('')

// ========= 函数 =========

/** 将标准协议错误映射为签到专属、可区分的产品文案。 */
function signinErrorMessage(error: ProtocolError): string {
  if (error.code === 'AUTH_REQUIRED') return t('music.signin.loginExpired')
  if (error.code === 'ALREADY_COMPLETED') return t('music.signin.alreadyCompleted')
  if (error.code === 'UTILITY_UNAVAILABLE' || error.code === 'SERVICE_UNAVAILABLE') {
    return t('music.signin.serviceUnavailable')
  }
  return error.message || t('music.signin.rejected')
}

/** 执行一次不可透明重试的每日签到。 */
async function signin(): Promise<DailySigninState> {
  if (signinState.value === 'signing') return signinState.value
  /** 当前账户公开快照。 */
  const account = useAccountSessionStore().snapshot.value
  if (!account?.canMutateMusic) {
    signinState.value = 'failed'
    signinMessage.value = account?.state === 'authenticated'
      ? t('music.signin.preparing')
      : t('music.signin.loginRequired')
    showToast(signinMessage.value, 'warning')
    return signinState.value
  }

  signinState.value = 'signing'
  signinMessage.value = t('music.signin.signing')
  /** 唯一一次签到写请求；失败后不会自动重试。 */
  const result = await mutateMusic({ operation: 'dailySignin' })
  if (result.ok) {
    signinState.value = 'succeeded'
    signinMessage.value = t('music.signin.succeeded')
    showToast(signinMessage.value, 'success')
    return signinState.value
  }

  signinMessage.value = signinErrorMessage(result.error)
  signinState.value = result.error.code === 'ALREADY_COMPLETED' ? 'already-signed' : 'failed'
  showToast(
    signinMessage.value,
    result.error.code === 'ALREADY_COMPLETED' ? 'info' : 'danger'
  )
  return signinState.value
}

/** 返回个人资料页与发现页共享的签到控制器。 */
export function useDailySignin(): {
  state: Readonly<Ref<DailySigninState>>
  message: Readonly<Ref<string>>
  signin: () => Promise<DailySigninState>
} {
  return {
    state: readonly(signinState),
    message: readonly(signinMessage),
    signin
  }
}
