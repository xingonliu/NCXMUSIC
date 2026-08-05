# Prompt 40：Phase 7 Shell Tool

执行通用协议；只有 T-05 为 `pass` 才实施，否则保持关闭并将本任务标记 `block`。

## 必读

- `docs/architecture/NcxMusic-Shell-Execution.md`。
- Agent Runtime、IPC Protocol。
- 功能清单 EXT-001～006、SEC-007、SET-004。

## 任务

产品化 PowerShell/zsh Executor、Shell Tool Schema、授权工作区、最小环境、受控 PATH、流式 stdout/stderr、每通道 1 MiB内存上限、模型结果 64 KiB、脱敏、超时/取消和完整进程树回收。

实现 PowerShell AST、zsh 保守模板、命令/路径/作用域纯函数分类和 S1～S4；独立 CommandSafetyControl，不能新增第三个权限按钮。凭据不进环境，模型不能传任意 cwd/env。

## 验收

动作矩阵、路径逃逸、符号链接、危险命令、输出洪水、孙进程、拒绝零执行和退出零孤儿进程测试通过。输出 Checkpoint 后停止。
