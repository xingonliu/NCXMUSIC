# NcxMusic Agent 通用执行协议

你正在按冻结顺序开发 NcxMusic。先完整阅读本文件，再执行用户给出的当前阶段 Prompt。当前 Prompt 是唯一任务边界，不得顺手进入下一编号。

## 每次必读

1. `AGENTS.MD`。
2. `docs/development/NcxMusic-Development-Roadmap.md`。
3. `docs/product/NcxMusic-V1-Feature-Inventory.md`。
4. 当前 Prompt 指定的专题文档与 API Endpoint 报告。
5. 上一个任务的 `docs/development/checkpoints/*.md`；若不存在、为 `block` 或实际代码与记录不符，停止并报告。Prompt 01 是唯一例外，它没有前置 Checkpoint。

完整 PRD 只用于当前文档无法解释的行为冲突。不要主动把整个 `docs/api/reports` 加载进上下文；只读取当前 Prompt 指定的聚合报告、Endpoint `.md/.json` 和脱敏样本。

当前冻结 API 审计根目录为：

```text
docs/api/reports/4.39.0/RUN-2026-08-04-P0-PROVISIONAL/
```

Prompt 中提到的 Endpoint 报告均位于该目录的 `endpoints/`，脱敏样本位于 `samples-redacted/`。若未来审计版本变化，必须先更新开发契约和本 Prompt Pack，不能静默混用两个报告版本。

## 开始前

- 按 `AGENTS.MD` 检查工作树、当前分支和远端同步状态，保护已有改动。
- 阅读现有实现和测试，不假设前一 Agent 已正确完成。
- 把当前任务映射到功能编号、Roadmap Phase 和前置 Gate。
- 涉及库、框架、SDK、API 或 CLI 时，先用 Context7 获取当前官方文档并记录所依据的版本；无法获取时改查官方一手文档，不凭记忆写版本敏感代码。
- 若前置 API/技术 Gate 未满足，不用 Mock 冒充完成；只可按文档规定的 fallback 实施。

## 实施规则

- 只实现当前 Prompt；不要提前批量建页面、Tool、Adapter 或“以后可能用到”的抽象。
- 遵守 Main、Preload、Renderer、Utility、Domain、Infrastructure 的依赖方向。
- 跨进程先定义共享 Schema、错误、取消和恢复语义，再实现两端。
- 副作用先定义权限动作、幂等键和失败终态；UI 不读取上游原始 API 字段。
- 不用 `any`、通用 IPC、Renderer Node 权限、localhost/SSE 或全局单例绕过架构。
- 不覆盖、回滚或提交与当前任务无关的用户改动。
- 临时 Spike 可放 `experiments/`；通过后提炼正式实现，失败方案不得留在生产入口。

## 验证与完成

执行与风险相称的 typecheck、lint、unit、contract、integration、E2E、build 或 packaged smoke。不能运行的双平台验证必须写明环境、原因和后续执行入口，不得假报通过。

创建与当前 Prompt 同名的 Checkpoint，至少记录：

- `status: pass | fallback | block`；
- 完成的功能编号与范围；
- 依赖、运行时、系统版本和关键哈希；
- 修改文件和关键架构结论；
- 执行过的命令及真实结果；
- 未验证项、回退、风险和下一任务解锁条件；
- 提交哈希。

完成代码、文档同步和 `git diff --check` 后，按 `AGENTS.MD` 只提交本任务文件并推送。最终回复只报告结果、验证、Checkpoint、提交和任何阻塞，然后停止，不进入下一 Prompt。
