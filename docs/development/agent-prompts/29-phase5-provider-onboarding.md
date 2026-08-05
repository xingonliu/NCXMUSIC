# Prompt 29：Phase 5 Provider 配置与首次引导

执行通用协议，只实现模型配置、能力验证和首次引导。

## 必读

- `docs/architecture/NcxMusic-Agent-Runtime.md`。
- Design System 的 Agent/表单/反馈组件边界。
- 功能清单 APP-011、LLM-001～009、SET-002。
- PRD 中首次引导、Provider Profile 和模型超时的已确认条目；只定向检索相关章节。

## 任务

将 T-08 Harness 提炼为 OpenAI Compatible、Anthropic Messages、Gemini Provider Adapter。实现 Profile 新增、编辑、验证、切换、删除、厂商预设、自定义 Base URL/Header、Models Endpoint 枚举和手填模型 ID；Secret 只进 Credential Vault。

实现首次引导：品牌与能力、Agent 动画占位、网易云登录/跳过、数据安全、模型配置/跳过、完成。未配置模型进入小云页时显示明确空状态和设置入口。

## 验收

三协议认证/文本流/取消/错误/Tool Call 探测和仅超时最多五次重试有测试；预设不写死模型清单。引导可中断和恢复且不强迫登录/模型。输出 Checkpoint 后停止。
