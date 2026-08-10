// ========= 变量 =========

/** Main/Preload 退出前状态刷新通道。 */
export const LIFECYCLE_CHANNELS = {
  flushRequest: 'ncx:lifecycle-flush-request',
  flushAck: 'ncx:lifecycle-flush-ack'
} as const

// ========= 类型 =========

/** Renderer 收到的退出前刷新请求。 */
export interface LifecycleFlushRequest {
  /** 本次刷新请求的唯一 ID。 */
  requestId: string
}

/** Renderer 可用的应用生命周期桥。 */
export interface LifecycleBridge {
  /** 注册退出前异步刷新处理器，并返回取消注册函数。 */
  onFlushRequest(handler: () => Promise<void>): () => void
}
