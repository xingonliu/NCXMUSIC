# Prompt 30：Phase 5 手写 Agent Runtime

执行通用协议，只实现 Runtime、Provider 流和小云基础会话，不接业务 Tool。

## 必读

- `docs/architecture/NcxMusic-Agent-Runtime.md` 全文。
- `docs/architecture/NcxMusic-IPC-Protocol.md`。
- 功能清单 AGT-001～012、APP-006。

## 任务

在 Utility 实现手写单连续会话 Runtime、单 Active Turn、Provider 归一化流、取消、新消息替换、状态机、12 轮/24 Tool Call/10 分钟限额、上下文 70% 压缩入口、错误和重试。Renderer 实现小云一级路由、消息列表、Composer、停止和流式展示；不建立侧边栏和内部 SSE。

实现 MessagePort 事件 sequence、重连 Snapshot、Renderer 重载恢复和应用退出中止记录。此阶段只允许一个内置无副作用诊断 Tool 用于验证循环，不接音乐/文件系统。

## 验收

流式、停止、新消息打断、断线重连、Utility 崩溃、模型超时五次上限和 Prompt 容量测试通过。输出 Checkpoint 后停止。
