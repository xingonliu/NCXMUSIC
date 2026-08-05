# Prompt 17：Phase 2 收口门禁

执行通用协议，只审计 Phase 2。

核对 Prompt 14～16、Roadmap Phase 2 Gate 和 API-A。复跑游客启动、官方登录、重启恢复、失效 Cookie、退出、换号、迁移、账户删除、实体合并及取消竞态 E2E/Integration。

确认 Renderer、日志、SQLite、Checkpoint 和 Tool 尚无 Cookie/API Key；原始 API 字段没有泄漏到页面；换号后旧 generation 无法写入。API-A 缺少关键契约时必须 `block`，不得用临时字段猜测。

生成 `17-phase2-gate.md`。达到 `Account & Data Ready` 后才解锁 Prompt 18。
