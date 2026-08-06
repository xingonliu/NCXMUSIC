# ADR-005：Shell 执行器与进程监督

- 状态：Accepted；T-05 Shell 策略、输出上限、脱敏、取消/超时和进程树回收已落地
- 日期：2026-08-06
- 对应 Spike：T-05

## 背景

T-05 要验证 Shell Tool 能否在不暴露通用终端能力的前提下，提供确定性策略分类、授权工作区边界、最小环境、输出上限和完整子进程树监督。若进程树不能可靠回收，首版 Shell Tool 必须保持关闭。

## 决策

1. **Shell 执行器只运行在 Utility Process。** Renderer 和 Preload 不新增 Shell Bridge；请求只能通过 `shell.execute` 严格契约进入 Utility，且当前默认 S1 无审批时返回 `rejected`。
2. **安全等级不扩大硬能力边界。** S1～S4 只影响自动执行还是审批；工作区逃逸、设备路径、凭据字面量、编码命令和根目录删除目标始终 `deny`。
3. **Windows 使用真实 PowerShell Parser AST。** 自动执行前由 Parser 摘要 CommandAst，并把复合语法、脚本块、变量展开、管道、重定向和动态节点降级到审批；编码命令等启动参数硬拒绝。
4. **macOS 采用 `zsh -n` 加保守 tokenizer。** `zsh -n` 只证明语法有效，自动执行仍必须命中 NcxMusic 模板；命令替换、变量展开、管道、重定向、后台执行和未知模板进入审批。
5. **授权工作区是文件边界源。** `workspaceId` 只引用注册工作区；`cwd` 和路径参数必须相对工作区，真实路径解析用于防 symlink/junction 逃逸。
6. **输出处理统一。** 流式输出、最终结果和模型结果都先脱敏；stdout/stderr 每通道最多保留 1 MiB，模型可见结果最多 64 KiB。
7. **进程树监督按平台实现。** Windows 取消/超时使用 `taskkill /pid /t`，2 秒后升级 `/f`；macOS 使用 detached 进程组并对负 PID 发 `SIGTERM`/`SIGKILL`。

## 结果

- `pnpm t05:spike` 串联类型检查、Shell 单元/契约测试和 Windows PowerShell AST smoke。
- CI 质量矩阵新增 `pnpm t05:spike`，后续在 Windows 与 macOS 双平台持续验证。
- `shell.execute` 能力已接入 `UtilityRuntimeServer` 的能力声明、请求处理、取消和 shutdown 清理。
- Shell Tool 尚未在 Agent UI 中开放；产品化需要 Policy/Approval Coordinator 显式提供审批上下文。

## 未关闭项

macOS 签名/公证后的外部命令环境、真实长期输出背压压力、以及 Agent ApprovalCard/ToolExecutionCard 的用户可见集成留到 Phase 5/7 产品化阶段。T-05 的进程监督和确定性安全基础设施结论为 `pass`。
