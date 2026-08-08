# T-08 Provider 与 ASR 协议验证报告

- 执行日期：2026-08-08
- 当前结论：`provisional-pass`；三类 Provider 协议夹具、错误归一化、取消语义和 ASR 能力缓存边界已自动化验证，真实 Provider 凭据矩阵仍待后续接入
- 基线提交：`ad6b46a` 起，本任务完成提交
- 关联架构：`docs/architecture/NcxMusic-Agent-Runtime.md`、`docs/architecture/NcxMusic-Voice-Input.md`
- 关联决策：`docs/development/adr/ADR-008-T08-provider-asr-protocol.md`

## 验证环境

| 项目 | 值 |
| --- | --- |
| 本地系统 | macOS 26.5.2 (25F84) |
| Node.js | 22.22.2 |
| pnpm | 11.20.0 |
| 执行时间 | 2026-08-08 18:12:00 CST |

## 实现范围

- `src/infrastructure/provider/provider-protocol.ts`：新增 Provider 协议夹具，覆盖 OpenAI Compatible、Anthropic Messages、Gemini generateContent 的请求构造、流式事件归一、Tool Call 增量、错误归一化、AbortSignal 取消和 ASR 支持缓存。
- `tests/unit/provider-protocol.test.ts`：新增 8 条专项测试，覆盖三类协议的文本流和 Tool Call、错误脱敏、取消、ASR unsupported 缓存、Profile 切换缓存失效、支持态复用和用户音频缓冲清零。
- `scripts/run-provider-asr-spike.mjs`：新增 T-08 可重复验证脚本，串行执行目标类型检查与专项 Vitest。

## 本地自动化结果

| 门禁 | 结果 |
| --- | --- |
| `node scripts/run-provider-asr-spike.mjs` | pass；目标类型检查通过，`tests/unit/provider-protocol.test.ts` 8 条通过 |
| `pnpm exec eslint src/infrastructure/provider/provider-protocol.ts tests/unit/provider-protocol.test.ts scripts/run-provider-asr-spike.mjs` | pass |
| `pnpm typecheck` | pass |

## 已验证的 T-08 条件

| 通过条件 | 状态 | 证据 |
| --- | --- | --- |
| OpenAI Compatible 文本流式 | pass（夹具层） | 构造 `/chat/completions` 流式请求，解析 `content`、`tool_calls` 和 `[DONE]` |
| Anthropic Messages 文本流式 | pass（夹具层） | 构造 `/messages` 流式请求，解析 `text_delta`、`tool_use` 和 `input_json_delta` |
| Gemini generateContent 文本流式 | pass（夹具层） | 构造 `:streamGenerateContent?alt=sse` 请求，解析 `text`、`functionCall` 和 `finishReason` |
| Tool Call 归一化 | pass | 三类协议统一输出 `tool-call-delta`，参数保留 JSON 片段供 Runtime 后续聚合 |
| 错误归一化 | pass | HTTP 状态、Provider error body、网络异常和取消映射为稳定错误码，并通过脱敏函数裁剪展示消息 |
| 取消语义 | pass | 已取消的 AbortSignal 产生稳定 `cancelled` 错误，不伪造 completed 事件 |
| ASR 能力探测缓存 | pass | 协议、模型、Base URL、Headers 和凭据指纹变化都会改变缓存键 |
| ASR 不支持回退 | pass | cached unsupported 时不再发请求；首次探测 unsupported 后返回固定文案，不自动切换 Provider |
| 原始音频内存生命周期 | pass（代码层） | ASR 转写函数只接收 `Uint8Array`，请求结束后在 `finally` 中清零输入缓冲 |

## 尚未验证的 T-08 条件

1. 真实 OpenAI Compatible 中转站对 `/audio/transcriptions`、文本流和 Tool Call 的实际兼容程度。
2. Anthropic Messages 目标模型是否接受音频内容块；若返回不支持，应沿当前 unsupported 缓存和固定文案终止上传。
3. Gemini generateContent 目标模型对 `inlineData` 音频转写的真实响应、错误码和取消时延。
4. Windows 与 macOS 真实网络、代理、中断、长流 idle timeout 和用户主动停止的端到端行为。

## 已知非 T-08 阻塞

- 当前工作树已有未提交 T-07 相关改动；为避免提交范围外文件，T-08 专项脚本未写入 `package.json` scripts，也未更新现有 CI workflow。
- 全量 `pnpm lint` 和 `pnpm test` 仍可能受范围外问题影响，T-08 本次以专项类型检查和专项 Vitest 作为 Spike 证据。

## 结论

T-08 在协议夹具层达到 `provisional-pass`：Provider Runtime 可以基于统一事件、错误和取消语义继续产品化；ASR 已具备“只复用当前 Profile、先探测、缓存支持状态、不支持即停止上传且不自动换供应商”的明确回退。真实 Provider 凭据矩阵完成前，不应把 ASR 标记为全量跨供应商 `pass`。
