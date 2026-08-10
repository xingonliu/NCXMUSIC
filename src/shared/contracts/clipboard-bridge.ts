// ========= 变量 =========

/** 纯文本剪贴板写入的最大字符数。 */
export const MAX_CLIPBOARD_TEXT_LENGTH = 20_000

/** Main/Preload 剪贴板窄桥通道。 */
export const CLIPBOARD_CHANNELS = {
  writeText: 'ncx:clipboard-write-text'
} as const

// ========= 类型 =========

/** Renderer 可用的只写纯文本剪贴板桥。 */
export interface ClipboardBridge {
  /** 将通过长度和类型校验的纯文本写入系统剪贴板。 */
  writeText(text: string): Promise<void>
}
