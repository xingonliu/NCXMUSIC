# ADR-008：T-08 Provider 与 ASR 协议策略

- 状态：Accepted；先以协议夹具验证三类 Provider 的流式文本、Tool Call、错误归一化、取消与 ASR 支持探测边界
- 日期：2026-08-08
- 对应 Spike：T-08

## 背景

T-08 要在 Agent 主闭环产品化之前确认 Provider 适配不会造成 Runtime 返工。目标协议包括 OpenAI Compatible、Anthropic Messages 和 Gemini generateContent。它们的流式增量、Tool Call 表达、错误结构和取消行为并不一致，因此 Runtime 不能直接依赖某一家 SDK 的对象形态。

语音输入的 ASR 还有额外约束：首版只能复用当前 Provider Profile，不能因为当前 Profile 不支持语音识别就自动切换到另一个供应商。中转站也可能只实现 OpenAI Compatible 的文本子集，所以 ASR 能力必须以实际协议探测结果为准，而不是以品牌名推断。

## 决策

1. **新增纯 TypeScript Provider 协议夹具。** `src/infrastructure/provider/provider-protocol.ts` 负责构造三类协议的文本流式请求，并把文本增量、Tool Call 增量和完成事件归一为 Runtime 可消费事件。
2. **错误先归一再进入 Runtime 策略。** Provider 的 HTTP 状态、错误体、网络异常和 AbortSignal 统一映射为 `auth`、`quota`、`rate-limit`、`request`、`unsupported`、`content-policy`、`cancelled`、`timeout`、`server`、`network` 和 `unknown`，并先做脱敏。
3. **取消走 AbortSignal。** 协议层不伪造完成事件；取消时抛出稳定 `cancelled` 错误，由 TurnCoordinator 后续统一清理流、Tool Call、审批和选择。
4. **ASR 缓存以 Profile 指纹为边界。** 协议、模型、Base URL、Headers 和凭据指纹任一变化都会产生新的 ASR 能力缓存键。Headers 只进入内存哈希，不保留明文。
5. **ASR 未知能力先探测再上传用户录音。** 首次未知时使用内存哨兵音频按当前协议探测；探测为 `unsupported` 后写入缓存并返回固定文案，不上传用户原始录音，不切换 Provider Profile。
6. **用户录音只在内存中参与请求。** `transcribeWithProviderProfile()` 接收 `Uint8Array`，请求结束后在 `finally` 中清零输入缓冲；当前实现不写文件、不落 SQLite、不进入日志。

## 结果

- 新增 `src/infrastructure/provider/provider-protocol.ts`，覆盖三类 Provider 的请求构造、流式解析、错误归一化、取消和 ASR 支持缓存。
- 新增 `tests/unit/provider-protocol.test.ts`，使用 fake HTTP client 验证文本流、Tool Call、错误脱敏、取消、ASR unsupported 缓存、Profile 切换失效和内存音频清零。
- 新增 `scripts/run-provider-asr-spike.mjs`，串行执行目标类型检查与专项 Vitest。
- `pnpm t08` 暂未写入 `package.json`，因为当前工作树已有范围外未提交的 T-07 package 变更；T-08 可通过 `node scripts/run-provider-asr-spike.mjs` 复现。

## 未关闭项

1. 真实 OpenAI Compatible 中转站、Anthropic 与 Gemini 凭据矩阵仍需接入后验证实际错误文案和 ASR 探测响应。
2. Anthropic Messages 的音频输入能力以实际 Provider 返回为准；若目标模型确认不支持，产品层应展示本 ADR 的固定 unsupported 文案并保留应用内按住麦克风入口。
3. Provider Profile 的凭据指纹应由后续 Credential Vault 生成，不在 Renderer、日志或持久化明文保存。
4. 后续 Agent Runtime 接入时，需要把本夹具输出接到 TurnCoordinator、Tool Call 汇聚器和 Provider 超时重试策略。
