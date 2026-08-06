# T-05 Shell 进程监督验证报告

- 执行日期：2026-08-06
- 当前结论：`pass`；Shell 契约、PowerShell AST / zsh 保守分类、工作区边界、输出上限、脱敏、取消/超时/退出回收和构建产物均已通过自动化验证
- 基线提交：本任务完成提交
- 关联架构：`docs/architecture/NcxMusic-Shell-Execution.md`

## 验证环境

| 项目 | 值 |
| --- | --- |
| 本地系统 | Windows 11 Pro 10.0.26200 |
| Node.js | 22.22.2 |
| pnpm | 11.20.0 |
| Electron | 43.3.0 |
| electron-vite | 5.0.0 |

## 实现范围

- `src/shared/schemas/shell.ts`：定义 `ExecuteShellInput`、`ExecuteShellResult`、安全等级、策略动作、风险标签、1 MiB/通道输出上限和 64 KiB 模型结果上限。
- `src/infrastructure/shell/workspace-registry.ts`：授权工作区解析、相对 `cwd` 校验、路径参数防逃逸、设备路径拒绝，并使用真实路径解析处理 symlink/junction 祖先。
- `src/infrastructure/shell/policy-classifier.ts`：Windows 使用 PowerShell Parser AST 摘要，macOS 使用 `zsh -n` + 保守 tokenizer；S1～S4 只决定 `allow | ask`，不能绕过硬边界 `deny`。
- `src/infrastructure/shell/output-buffer.ts`：流式输出和最终结果使用同一脱敏器，每通道保留最多 1 MiB，模型结果超过 64 KiB 时保留头 16 KiB 和尾 48 KiB。
- `src/infrastructure/shell/process-supervisor.ts`：Windows 使用 `taskkill /pid /t`，2 秒后追加 `/f`；macOS 使用独立进程组并对负 PID 发送 `SIGTERM`/`SIGKILL`。
- `src/infrastructure/shell/executor.ts`：Shell 命令经策略分类、审批上下文、固定 Shell 参数、最小环境和受监督子进程统一执行。
- `src/utility/runtime-server.ts` / `src/utility/index.ts`：新增 `shell.execute` 能力声明、请求处理、取消转发和 Utility 退出清理。
- `scripts/run-shell-spike.mjs` / `package.json` / `.github/workflows/quality.yml`：新增 `pnpm t05:spike` 并接入双平台质量矩阵。

## 本地自动化结果

| 门禁 | 结果 |
| --- | --- |
| `pnpm t05:spike` | pass；typecheck、Shell 专用单元/契约测试 30 条、Windows PowerShell AST smoke |
| `pnpm lint` | pass；Architecture boundaries OK |
| `pnpm test` | pass；22 files / 219 tests |
| `pnpm build` | pass；构建产物契约通过 |
| `pnpm package:dir` | pass；Windows unpacked 目录产物生成成功 |

## 已验证的 T-05 条件

| 通过条件 | 状态 | 证据 |
| --- | --- | --- |
| PowerShell AST 阻止复合/动态自动执行 | pass | AST 含复合/动态语法进入 `ask`；编码命令和凭据字面量硬 `deny`；真实 Parser smoke 通过 |
| zsh 保守模板分类 | pass | 命令替换、变量展开、管道、重定向、后台执行均进入 `ask`，模板外命令不自动执行 |
| 路径与工作区边界 | pass | 相对 `cwd`、路径参数、设备路径、绝对路径、根目录删除目标均覆盖 |
| S1～S4 安全等级 | pass | S1 全审批；S2 只读；S3 构建/测试和工作区写入；S4 安装/发布/删除仍受硬边界约束 |
| 输出上限和脱敏 | pass | stdout/stderr 每通道 1 MiB，模型结果 64 KiB；流式、结果和日志共用脱敏器 |
| 流式背压 | pass | 输出 sink 可异步，单通道 pause/resume 避免无限读取 |
| 取消、超时和退出回收 | pass | Windows `taskkill /t` + `/f`；macOS 进程组 SIGTERM/SIGKILL；Utility shutdown 取消所有活动命令 |
| Renderer 隔离 | pass | `shell.execute` 只在 Runtime 契约内登记，Preload 不新增 Shell Bridge 方法，Renderer 不获得 Node/FileSystem/Shell 入口 |
| 打包后白名单命令和构建测试模板 | pass | `pnpm build` 与 `pnpm package:dir` 均通过；CI 将继续在 Windows/macOS 跑 `pnpm t05:spike` |

## 当前边界

1. T-05 结论覆盖 Shell 监督与策略基础设施，不代表 Agent UI 已接入 ApprovalCard 或 Shell Tool 已对用户开放。
2. `shell.execute` 在 Utility 内部可用，但当前 S1 默认使所有命令无审批时返回 `rejected`；产品化阶段必须由 Agent Policy/Approval Coordinator 显式传入审批上下文。
3. macOS 本地真实进程组行为由单元测试模拟并将由 CI 矩阵运行；签名/公证后的外部工具可用性仍归发布硬化阶段验证。

## 关联决策

见 [ADR-005：Shell 执行器与进程监督](../adr/ADR-005-T05-shell-process-supervision.md)。
