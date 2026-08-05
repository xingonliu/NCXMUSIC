# Prompt 01：T-01 工程与进程骨架

执行 `00-common-execution-protocol.md`。本次只完成 Phase 0 T-01。

## 必读

- `docs/development/NcxMusic-Technical-Spike-Plan.md` 的执行规则、T-01 和 Phase 0 Gate。
- `docs/architecture/NcxMusic-System-Architecture.md`。
- `docs/architecture/NcxMusic-IPC-Protocol.md`。

## 任务

初始化 pnpm 单包 Electron + Vue 3 + TypeScript 工程，冻结经官方文档核对的 Node、pnpm、Electron、electron-vite、electron-builder、Vue、TypeScript 和 Zod 精确版本。建立 Main、Preload、Renderer、Utility Process 构建入口以及文档规定的源码边界。

完成受限 ContextBridge、版本化 MessagePort 握手、ping、取消、快照请求和 Utility Supervisor 最小闭环。Utility 必须在开发与打包产物使用稳定路径启动，支持 stdout/stderr、正常退出、1/2/5 秒有界重启、连续失败停用和应用退出清理。

建立 `dev/typecheck/lint/test/build/package` 脚本、最小契约测试、依赖边界检查和 Windows/macOS CI 骨架。

## 禁止

不接网易云 API，不实现登录、播放器、小云、数据库、UI 组件、Shell、语音或业务页面；不拆 workspace，不建立 localhost 服务，不暴露通用 `ipcRenderer`。

## 验收

严格满足 T-01 通过条件。开发构建与打包构建均完成 Renderer → Main → Utility 的版本化 ping、取消和快照恢复；Renderer 无 `require/process`。生成 T-01 ADR/验证报告和 `01-t01-process-skeleton.md` Checkpoint，然后停止。
