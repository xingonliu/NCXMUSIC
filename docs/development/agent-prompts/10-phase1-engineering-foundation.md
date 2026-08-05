# Prompt 10：Phase 1 工程质量基线

执行通用协议；确认 Phase 0 Gate 为 `pass`。本次只完成 Phase 1A 工程与 Contract 基础。

## 必读

- Roadmap Phase 1、跨阶段强制约束和测试分层。
- `docs/architecture/NcxMusic-System-Architecture.md`。
- `docs/architecture/NcxMusic-IPC-Protocol.md`。
- `docs/architecture/NcxMusic-Storage-Architecture.md`。

## 任务

将通过的 Spike 提炼为正式工程结构。配置严格 TypeScript、ESLint、Stylelint、Vitest、Vue Test Utils、Playwright、覆盖率和依赖边界检查。建立 Contract Registry、领域 ID、稳定 Result/Error、时间工具、日志脱敏、SQLite Migration Runner、配置 Schema 版本和测试夹具基础。

为 Main/Preload/Renderer/Utility 的组合根建立最小正式入口；实验代码不能成为运行时依赖。完善 CI 的 typecheck、lint、unit、contract、build。

## 禁止与验收

不开发 Design System、账户、音乐或页面。所有跨进程 DTO 可结构化克隆并通过 Zod；非法依赖由自动检查失败。测试数据库可创建、迁移、回滚测试 Schema。输出 Checkpoint 后停止。
