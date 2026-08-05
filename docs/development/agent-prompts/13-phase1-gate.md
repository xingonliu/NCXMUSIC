# Prompt 13：Phase 1 收口门禁

执行通用协议，只审计 Phase 1，不进入账户或 API。

核对 Prompt 10～12、Roadmap Phase 1 Gate、系统架构和 Design System。复跑 typecheck、lint、unit、contract、component、E2E、build 和当前平台 package；通过 CI 获取另一平台结果。

确认依赖边界自动生效、通用 IPC 不可用、业务示例无 Reka UI 直连和任意视觉常量、路由/WindowChrome/紧凑布局可运行、MessagePort 错误/取消/重载恢复有契约测试。清理重复组件和实验残留，但不新增业务。

生成 `13-phase1-gate.md` Checkpoint。只有达到 `UI/IPC Foundation` 才标记 `pass` 并解锁 Prompt 14，否则 `block`。
