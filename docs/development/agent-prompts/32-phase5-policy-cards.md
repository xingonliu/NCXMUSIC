# Prompt 32：Phase 5 权限、工具卡、审批卡与选择卡

执行通用协议，只实现确定性 PolicyGateway 和三类 Agent 交互组件。

## 必读

- Agent Runtime 的 Tool、审批和取消章节。
- IPC Protocol 的流式、SelectionCard、恢复和幂等章节。
- Design System Agent 组件。
- 功能清单 TOL-007～011、SEC-001～011、SET-004。

## 任务

实现 MusicSafetyControl M1～M4、CommandSafetyControl S1～S4、纯函数 allow/ask/deny、Approval Coordinator 和底层零执行挂起。实现 ToolExecutionCard、ApprovalCard（批准/拒绝、5 分钟、单次 Tool Call）和 SelectionCard（2～5 项、单/多选、10 分钟、无副作用）。

实现导航/最小化保留、Renderer 重载恢复、新消息替换、拒绝/过期/取消不同结果。LLM 不接收安全等级，也不能决定是否放行。

## 验收

每级权限动作矩阵、审批前零副作用、批准幂等、拒绝后结构化结果、选择只返回答案及恢复 E2E 通过。输出 Checkpoint 后停止。
