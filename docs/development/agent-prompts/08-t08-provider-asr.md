# Prompt 08：T-08 Provider 与 ASR 协议

执行通用协议，只完成 Phase 0 T-08。

## 必读

- 技术验证计划 T-08。
- `docs/architecture/NcxMusic-Agent-Runtime.md` 的 Provider、流式、取消和重试约束。
- `docs/architecture/NcxMusic-Voice-Input.md` 的 ASR 与录音边界。
- 功能清单 LLM-001～009、VOC-006～012。

## 任务

用最小 Provider Harness 验证 OpenAI Chat Completions Compatible、Anthropic Messages、Gemini `generateContent` 的认证、文本流、取消、错误归一化和 Tool Call 基本差异。验证 Models Endpoint 可用时枚举、不可用时手填模型 ID。

只复用当前 Provider Profile 探测 ASR；模型不支持时在上传前返回冻结提示，不切换供应商。使用无隐私测试音频，验证音频请求形态和超时释放；不实现聊天 UI、正式 Runtime 或录音浮窗。

## 验收

三协议至少各有一个可重复的适配结论；ASR 给出 capability probe 与 fallback。Secret 不进日志/报告。输出协议差异表、ADR、Harness 和 Checkpoint，然后停止。
