# Prompt 01 Checkpoint：T-01 工程与进程骨架

- `status: pass`
- 日期：2026-08-05
- 功能编号：PLT-001～010、DAT-014 的 Phase 0 工程/进程基础
- Roadmap：Phase 0 T-01
- 前置 Gate：无（Prompt 01 例外）

## 完成范围

- 初始化 pnpm 单包 Electron + Vue 3 + TypeScript 工程，冻结 Node、pnpm、Electron、electron-vite、electron-builder、Vue、TypeScript、Vite、Zod、Vitest 和 ESLint 精确版本及锁文件。
- 建立 Main、Preload、Renderer、Utility Process 正式构建入口；Utility 固定输出 `out/main/utility.js`，打包后从 `app.asar.unpacked/out/main/utility.js` 启动。
- 建立受限 ContextBridge、固定控制面、版本化 MessagePort、Zod 4 严格 Contract Registry、Hello、Ping、Cancel、Response 和 Snapshot 恢复。
- 建立 Utility stdout/stderr、有界 1/2/5 秒重启、稳定 5 分钟清零、连续失败停用、显式重试和退出清理。
- 建立 `dev/typecheck/lint/test/build/package/release` 脚本、依赖边界检查、构建产物检查、Contract/Unit 测试和 Windows/macOS CI。
- 生成 ADR-001 和 T-01 验证报告；没有接入网易云 API、登录、播放器、小云、数据库、Shell、语音或业务页面。

## 依赖、运行时、系统与哈希

- 项目 Node：24.18.0；pnpm：11.20.0。
- Electron：43.3.0（内嵌 Node 24.18.1 / Chrome 150.0.7871.212）。
- electron-vite：5.0.0；electron-builder：26.15.3；Vue：3.5.41；TypeScript：5.9.3；Vite：7.3.6；Zod：4.4.3。
- 本地 Windows：x64，OS Build 26200。
- CI Windows：Microsoft Windows Server 2025，`windows-2025-vs2026`。
- CI macOS：macOS 26.5.2（25F84），arm64，image `20260728.0273.1`。
- `pnpm-lock.yaml` SHA-256：`E681496645A8E19D4E97234E3F550B3B2CD164B19CF6D06D375FE52E90A5D764`。
- Windows NSIS SHA-256：`EC80D7C13CBE3C5407B913CAD6335706D68B2290BAC6CAB9393F999E74B1CA8C`。
- 实现提交：`589ab1a3311a4dbec7ccb02f8ba4f7d7cef36134`。
- 双平台 CI：[run 30993162829](https://github.com/xingonliu/NCXMUSIC/actions/runs/30993162829)，Windows/macOS Jobs 均为 `success`。

## 修改文件与架构结论

- 工程与工具：`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、Node/TypeScript/ESLint/Vite/electron-builder 配置、`phase0.yml`。
- 正式源码：`src/main`、`src/preload`、`src/renderer`、`src/utility`、`src/shared`。
- 测试与脚本：`tests/contract`、`tests/unit`、依赖边界、构建校验和三种 Electron smoke。
- 文档：ADR-001、T-01 验证报告、本 Checkpoint。
- 关键结论：Main 只负责连接和监督；Preload 不暴露原始 IPC/Port；Renderer 无 Node；正常数据面由 Preload ↔ Utility 直连；Zod 在沙箱 Preload 和解包 Utility 侧自包含；所有 Utility 重连使用新 `connectionId` 和 generation。

## 执行命令与真实结果

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass；Dependency boundaries `pass` |
| `pnpm test` | pass；3 files / 6 tests |
| `pnpm build` | pass；Build artifact contract `pass` |
| `pnpm smoke:dev` | pass；六项运行时断言全为 `true` |
| `pnpm smoke:build` | pass；六项运行时断言全为 `true` |
| `pnpm smoke:packaged` | pass；Windows 本地、Windows CI、macOS CI 均通过 |
| `pnpm package` | pass；生成 `NcxMusic Setup 0.0.1.exe` |
| `git diff --check` | pass |

## 未验证项、回退与风险

- 正式 Windows 代码签名、macOS 签名/公证、Gatekeeper 和干净机器安装属于 Phase 8，不冒充已完成。
- 本机外部 Node 为 22.22.2，低于项目冻结版本；Windows/macOS CI 已在 Node 24.18.0 下完整通过，覆盖该环境差异。
- electron-vite 多入口稳定，未触发独立 Vite/Rollup fallback。
- 用户未跟踪目录 `dome/` 不属于本任务，未暂存、未提交。

## 下一任务解锁条件

T-01 为 `pass`，Prompt 02（T-02 登录 Session 与凭据租约）已解锁。进入 Prompt 02 前仍须重新检查 Git/远端状态并核对本 Checkpoint 与实际代码一致。
