# NcxMusic

NcxMusic 是一个基于 Electron、Vue 3 和 TypeScript 的 Agent 原生音乐客户端。本仓库当前已完成 Phase 3 搜索到播放纵向闭环，后续业务功能仍按 [最终开发顺序](docs/development/NcxMusic-Development-Roadmap.md) 分阶段实现。

## 环境

- Node.js 22.22.x
- pnpm 11.20.0
- Windows 或 macOS（V1 不承诺 Linux 支持）

```powershell
pnpm install --frozen-lockfile
pnpm electron:install
pnpm dev
```

## 标准命令

| 命令 | 用途 |
| --- | --- |
| `pnpm electron:install` | 按当前平台和架构下载 Electron 运行时（二进制不再由 Electron 43 的安装脚本下载） |
| `pnpm dev` | 启动 Main、Preload、Renderer 与 Utility Process 开发环境 |
| `pnpm typecheck` | 检查 Node/Electron 与 Vue 两套 TypeScript 入口 |
| `pnpm lint` | 检查代码、样式和架构依赖边界 |
| `pnpm test` | 运行单元、契约和架构测试 |
| `pnpm test:e2e` | 运行 Playwright 端到端测试 |
| `pnpm build` | 生成 `out/` 生产构建 |
| `pnpm package` | 为当前平台生成未发布安装包 |

## 源码结构

```text
src/
├─ main/             Electron Main 组合根与平台生命周期
├─ preload/          最小化 contextBridge
├─ renderer/         Vue SPA、Pinia、Router 与 Design System
├─ utility/          Agent、Music Service 等本地运行时组合根
├─ input-hook/       全局按住说话的独立 Host 边界
├─ domains/          纯领域规则与 Port
├─ shared/           跨进程契约、Schema 与安全错误
└─ infrastructure/   Electron、存储、网易云及外部能力适配

tests/
├─ unit/
├─ contract/
├─ component/
├─ integration/
├─ e2e/
└─ architecture/
```

当前初始化只建立可运行骨架、依赖方向和质量门禁，不代表 Phase 0 技术 Spike 已全部通过。产品、设计和架构约束以 `docs/` 下的非 API 基线文档为准；`docs/api/` 与 `scripts/api-audit/` 保持独立，不参与本次工程初始化。
