// ========= 类型 =========

/** Renderer 启动门禁需要的最小依赖。 */
export interface RendererStartupOptions {
  /** Smoke 探针是否绕过产品开屏门禁，保留原有重启验证语义。 */
  readonly bypassRuntimeGate: boolean
  /** 等待 Preload 与 Utility 完成 hello 握手。 */
  readonly waitUntilRuntimeReady: (timeoutMs: number) => Promise<boolean>
  /** Runtime 可用后挂载 Vue 业务应用。 */
  readonly mountApplication: () => void
}

// ========= 变量 =========

/** 单次等待切片，超时后继续等待后续 Utility 自动重启代次。 */
export const RUNTIME_READY_WAIT_SLICE_MS = 10_000

// ========= 函数 =========

/** 持续等待 Runtime 真正完成协议握手，禁止把启动超时误当成可放行业务页面。 */
export async function waitForRuntimeReadiness(
  waitUntilRuntimeReady: RendererStartupOptions['waitUntilRuntimeReady']
): Promise<void> {
  /** 当前等待切片是否已经观察到 Runtime ready。 */
  let ready = false
  while (!ready) {
    ready = await waitUntilRuntimeReady(RUNTIME_READY_WAIT_SLICE_MS)
  }
}

/** 在 Runtime 门禁通过后才挂载业务组件，确保页面 onMounted 不会提前请求。 */
export async function startRendererApplication(options: RendererStartupOptions): Promise<void> {
  if (!options.bypassRuntimeGate) {
    await waitForRuntimeReadiness(options.waitUntilRuntimeReady)
  }
  options.mountApplication()
}
