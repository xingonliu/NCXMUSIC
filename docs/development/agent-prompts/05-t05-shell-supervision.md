# Prompt 05：T-05 Shell 进程监督

执行通用协议，只完成 Phase 0 T-05。

## 必读

- 技术验证计划 T-05。
- `docs/architecture/NcxMusic-Shell-Execution.md`。
- `docs/architecture/NcxMusic-System-Architecture.md`。

## 任务

用最小 Executor 验证 Windows PowerShell 和 macOS zsh 的启动、stdout/stderr 流、超时、用户取消、应用退出及完整子孙进程树回收。Windows 使用文档冻结的 PowerShell 参数；macOS 使用 `/bin/zsh -f`。验证路径/工作区约束、最小环境、输出上限和凭据不进入子进程。

本任务只验证监督与回收，不实现完整 S1～S4 分类器和 Agent Tool。

## 验收

正常、错误、超时、取消、孙进程、输出洪水和退出场景均有证据。任一平台不能可靠回收完整进程树时必须标记 `block`，并按产品结论保持 Shell Tool 关闭。输出 ADR、验证脚本和 Checkpoint，然后停止。
