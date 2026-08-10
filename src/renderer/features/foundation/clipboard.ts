import { showToast } from '../../design-system/use-toast'
import { t } from '../../i18n'

// ========= 函数 =========

/** 通过 Electron 窄桥写入纯文本，并统一成功或失败提示。 */
export async function copyText(
  text: string,
  successMessage = t('music.clipboard.succeeded')
): Promise<boolean> {
  try {
    await window.ncx.clipboard.writeText(text)
    showToast(successMessage, 'success')
    return true
  } catch {
    showToast(t('music.clipboard.failed'), 'danger')
    return false
  }
}
