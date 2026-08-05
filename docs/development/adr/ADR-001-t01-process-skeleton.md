# ADR-001：T-01 Electron 多进程工程与通信骨架

- 状态：Accepted（等待双平台 CI 复核）
- 日期：2026-08-05
- 功能映射：PLT-001～010、DAT-014；Phase 0 T-01
- 关联架构：A-001、A-002、A-003、A-004

## 背景

T-01 必须在页面和业务开发前验证单包 Electron 工程、Main/Preload/Renderer/Utility Process 拓扑、受限跨进程协议、Utility 稳定构建路径和有界监督。Renderer 不能获得 Node、通用 IPC 或任意通道，开发构建和打包构建必须走同一份版本化 Contract。

## 文档与版本依据

2026-08-05 通过 Context7 查询了以下官方文档：

- Electron `/electron/electron`：`MessageChannelMain`、`webContents.postMessage`、`utilityProcess.fork/postMessage/kill/exit`、`senderFrame` 和安全 `webPreferences`。
- electron-vite `/websites/electron-vite`：单包 Main/Preload/Renderer 自定义入口、额外 Utility 入口和稳定输出。
- electron-builder `/electron-userland/electron-builder`：`files`、`asar/asarUnpack`、NSIS、DMG/ZIP 和当前平台未发布构建。
- Node.js 官方 Releases：Node 24 是当前 LTS，2026-06-23 发布的 `24.18.0` 是任务执行时最新 LTS。

冻结版本：

| 工具 | 版本 | 选择结论 |
| --- | ---: | --- |
| Node.js | 24.18.0 | 当前 LTS；`.node-version`、`.nvmrc`、`engines` 和 CI 一致。 |
| pnpm | 11.20.0 | `packageManager` 精确冻结，锁文件使用 v11。 |
| Electron | 43.3.0 | 当前稳定版；内嵌 Node 24.18.1、Chrome 150.0.7871.212。 |
| electron-vite | 5.0.0 | 当前稳定版。 |
| electron-builder | 26.15.3 | 当前稳定版。 |
| Vue | 3.5.41 | 当前稳定版。 |
| TypeScript | 5.9.3 | TypeScript 7.0.2 已发布，但当前 `typescript-eslint` 的 peer 上限为 `<6.1.0`；采用最新兼容 5.x，避免无支持组合。 |
| Vite | 7.3.6 | Vite 8.2.0 已发布，但 electron-vite 5 的 peer 范围最高为 Vite 7。 |
| Zod | 4.4.3 | 使用 Zod 4 `strictObject` 构建唯一运行时 Contract。 |
| Vitest / ESLint | 4.1.10 / 10.8.0 | 当前测试与静态检查基线。 |

## 决策

1. 保留一个根 `package.json`，不拆内部包。`pnpm-workspace.yaml` 只承载 pnpm 11 构建脚本白名单和供应链策略，`packages` 仅包含根包 `.`。
2. electron-vite 的 Main 构建包含 `index` 与 `utility` 两个入口，Utility 固定输出 `out/main/utility.js`。Main 在开发/普通构建从 `__dirname` 启动；打包后从 `resources/app.asar.unpacked/out/main/utility.js` 启动。
3. `out/main/**/*` 一并解包，避免 Utility 与 Rollup 共享 chunk 跨 ASAR 边界。Main/Utility 的 Contract chunk 和 sandboxed Preload 均内联 Zod，避免解包进程或沙箱 Preload 动态解析 `node_modules`。
4. Main 的 ConnectionBroker 校验主窗口与 `senderFrame`，为每次连接生成新的 `connectionId`，再把 MessageChannel 两端分别转移给 Preload 与 Utility。Main 不转发数据面业务消息。
5. Preload 仅暴露 `waitUntilReady/ping/cancel/snapshot/retryUtility/onStatus`，不暴露 `ipcRenderer`、原始 MessagePort 或通用 `send/invoke`。
6. Contract Registry 只登记 `system.ping` 和 `system.snapshot`。消息使用 Zod 4 严格对象、协议版本 1、UUID、请求终态和结构化错误；取消使用独立 CancelEnvelope。
7. Utility Supervisor 的意外退出重启间隔固定为 1/2/5 秒，最多三次；稳定 5 分钟重置失败窗口；连续失败进入 `disabled`，只能显式重试。应用退出清理计时器、端口和 Utility Process。
8. 构建 smoke 通过隐藏 BrowserWindow 运行真实 Renderer 代码，并用 `page-title-updated` 把脱敏结果返回 Main；不建立生产 localhost/SSE 服务。electron-vite 的开发服务器只用于 HMR，不参与应用内部通信。

## 安全结论

- BrowserWindow 固定 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`、`webSecurity: true`。
- Renderer 运行时确认没有 `require`/`process`；静态边界检查阻止 Renderer 导入 Main、Preload、Utility 和敏感 Infrastructure。
- Contract 使用 allowlist；未知名称、未知字段、错误版本和错误 Payload 拒绝。
- 错误与 Utility 输出经过长度限制和敏感键脱敏；当前骨架不包含 Cookie、API Key、数据库、Shell 或网易云 API。

## 后果

- Utility 共享 Contract chunk 会比外置 Zod 大约增加 149 KiB，但换来沙箱与 ASAR 下确定的启动路径。
- 本阶段只提供进程诊断页，不建设 Design System、播放器、登录或业务页面。
- macOS 的同一链路由 `phase0.yml` 在 `macos-latest` 运行；没有该证据前不把 T-01 Checkpoint 标为 `pass`。
