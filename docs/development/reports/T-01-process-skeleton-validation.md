# T-01 工程与进程骨架验证报告

- 报告日期：2026-08-05
- 当前结果：Windows `pass`；macOS `pass`
- 实现提交：`589ab1a3311a4dbec7ccb02f8ba4f7d7cef36134`
- 双平台 CI：[Phase 0 run 30993162829](https://github.com/xingonliu/NCXMUSIC/actions/runs/30993162829)

## 环境

| 项目 | 值 |
| --- | --- |
| 主机 | Windows x64，OS Build 26200 |
| 本机外部 Node | 22.22.2（低于项目冻结版本，仅用于调用工具；所有命令明确记录 engine warning） |
| 项目冻结 Node | 24.18.0 |
| pnpm | 11.20.0 |
| Electron | 43.3.0 |
| Electron 内嵌运行时 | Node 24.18.1 / Chrome 150.0.7871.212 |
| pnpm lock SHA-256 | `E681496645A8E19D4E97234E3F550B3B2CD164B19CF6D06D375FE52E90A5D764` |
| Windows CI | Microsoft Windows Server 2025，`windows-2025-vs2026` |
| macOS CI | macOS 26.5.2（25F84），`macos-26-arm64` image `20260728.0273.1` |

## 实现范围

- 单包 Electron + Vue 3 + TypeScript 工程和精确版本/锁文件。
- Main、Preload、Renderer、Utility Process 构建入口。
- 受限 ContextBridge、固定控制面、版本化 MessagePort 数据面。
- Zod 4 严格 Hello、Ping、Cancel、Response、Snapshot Contract 和固定 Registry。
- Utility stdout/stderr、1/2/5 秒重启、5 分钟稳定窗口、连续失败停用、显式重试与退出清理。
- Windows/macOS CI 骨架，当前平台 NSIS 与两平台 packaged smoke 入口。
- ESLint、Vue/TypeScript typecheck、Vitest Contract/Unit、依赖边界和构建产物校验。

## 自动化结果

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | pass；Node 与 Vue 全进程检查无错误。 |
| `pnpm lint` | pass；ESLint 与依赖边界检查通过。 |
| `pnpm test` | pass；3 个文件、6 个测试。 |
| `pnpm build` | pass；固定生成 `out/main/index.js`、`out/main/utility.js`、Preload 和 Renderer。 |
| `pnpm smoke:dev` | pass；真实开发态完成 Hello、Ping、Cancel、Snapshot。 |
| `pnpm smoke:build` | pass；生产构建态完成相同链路。 |
| `pnpm smoke:packaged` | pass；`release/win-unpacked` 的 ASAR/解包路径完成相同链路。 |
| `pnpm package` | pass；生成 Windows x64 NSIS。 |
| GitHub Actions `verify (windows-latest)` | pass；Node 24.18.0 下完整矩阵通过。 |
| GitHub Actions `verify (macos-latest)` | pass；Node 24.18.0 下 build 与 packaged smoke 均通过。 |

Smoke 的六项断言均为 `true`：

```json
{
  "rendererHasNoNodeGlobals": true,
  "ready": true,
  "ping": true,
  "cancelDispatched": true,
  "cancelled": true,
  "snapshot": true
}
```

Supervisor 单元测试覆盖：stdout/stderr、1/2/5 秒三次重启、第四次失败停用、显式重试、稳定 5 分钟清零、应用关闭 kill 且不再拉起。Contract 测试覆盖合法请求、未知名称、未知字段、缺字段、握手、取消和快照。

## 打包产物

- Windows NSIS：`release/NcxMusic Setup 0.0.1.exe`
- SHA-256：`EC80D7C13CBE3C5407B913CAD6335706D68B2290BAC6CAB9393F999E74B1CA8C`
- 产物为本地验证输出，受 `.gitignore` 排除，不进入源码提交。

## 失败与修复记录

1. sandboxed Preload 初次构建外置 Zod，Renderer 无法握手；改为 Preload 内联 Zod后开发/构建 smoke 通过。
2. packaged Utility 初次从 `app.asar.unpacked` 加载共享 chunk 时无法跨 ASAR 找到外置 Zod，Supervisor 按 1/2/5 秒重启并停用；改为 Main/Utility Contract chunk 内联 Zod并解包完整 `out/main/**/*` 后通过。
3. 本机未启用 Corepack pnpm shim 时 electron-builder 无法解析 `pnpm list --json`；启用项目冻结的 pnpm 11.20.0 shim 后打包通过。

## 未验证项与解锁条件

- macOS 签名、公证及干净实体机器安装不在 T-01 范围内，保留到 Phase 8；本阶段 macOS arm64 CI 的 build 与 packaged smoke 已通过。
- T-01 不验证正式签名、公证和干净机器安装，这些属于 Phase 8；本阶段已验证当前平台未发布安装包与 unpacked packaged 运行路径。
- 用户并行加入的未跟踪目录 `dome/` 不属于 T-01，未读取后修改、未格式化、未暂存。
- Prompt 02 的解锁条件已满足：T-01 Checkpoint 可标记 `pass`。
