# 启动开屏与 Runtime 门禁

正式 Renderer 启动时，`index.html` 先以静态 HTML 显示居中应用 Logo。开屏背景读取 Renderer 已持久化的 `system / light / dark` 主题；系统模式继续跟随 `prefers-color-scheme`，浅色使用白色，深色使用深灰色。

Vue 业务应用不会与开屏同时挂载。`main.ts` 必须先通过 Preload 的 `runtime.waitUntilReady()` 等待 Utility MessagePort 完成 `system.hello` 握手，门禁通过后才调用 `createApp().mount()`。单个十秒等待切片超时只用于重新观察下一代 Utility 自动重启，不得把超时当作 ready，也不得提前放行业务页面。

Runtime Smoke 查询保留原有直接挂载行为，由探针自身验证首次崩溃、自动重启、重载重连和协议请求。
