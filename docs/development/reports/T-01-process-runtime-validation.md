# T-01 工程与进程骨架验证报告

- 执行日期：2026-08-05
- 当前结论：`candidate`（Windows 本地通过，等待同提交 Windows/macOS CI 结果）
- 基线提交：`44e0f84`
- 依赖锁哈希（SHA-256）：`c17f71508a8b403a82e7f9484c1367113b91b5ccef80b6a496528b05a82d8f89`

## 验证环境

| 项目 | 值 |
| --- | --- |
| 本地系统 | Windows 11 专业版 10.0.26200（Build 26200） |
| Node.js | 22.22.2 |
| pnpm | 11.20.0 |
| Electron | 43.3.0 |
| electron-vite | 5.0.0 |
| electron-builder | 26.15.3 |
| Vue | 3.5.41 |
| Zod | 4.4.3 |

## 自动化覆盖

| 门禁 | 覆盖内容 | Windows 本地 |
| --- | --- | --- |
| `pnpm typecheck` | Main、Preload、Renderer、Utility 与共享契约类型 | pass |
| `pnpm lint` | ESLint、Stylelint、进程边界规则 | pass |
| `pnpm test` | 严格 Schema、握手、取消、快照、旧连接失效、监督器退避/停用/重试 | pass |
| `pnpm test:e2e` | Playwright 配置可执行；T-01 进程验证由 Electron Smoke 承担 | pass |
| `pnpm smoke:dev` | 开发服务中的完整进程链路与 Renderer 重载 | pass |
| `pnpm smoke:build` | 生产构建产物中的完整进程链路与 Renderer 重载 | pass |
| `pnpm smoke:packaged` | electron-builder 解包应用中的完整进程链路与 Renderer 重载 | pass |

Smoke 必须同时证明 Renderer 没有 `require`/`process`、版本化握手成功、故障注入后 Utility 至少重启一次、ping 成功、取消生效、Renderer 重载后生成新 `connectionId`，并从同一 Utility 世代恢复快照。任一断言失败时进程以非零状态退出。

## 双平台 CI

`.github/workflows/quality.yml` 在 `windows-latest` 和 `macos-latest` 上运行安装、类型检查、Lint、单元/契约测试以及三种 Electron Smoke。它不以“编译成功”作为平台通过条件。最终 `pass | block` 结论以实现提交触发的两个矩阵 Job 为准，并在通过后回填本报告。

## 关联决策

见 [ADR-001：Electron 进程骨架与运行时连接](../adr/ADR-001-T01-process-runtime.md)。
