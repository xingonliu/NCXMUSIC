# Prompt 02 Checkpoint：T-02 登录 Session 与凭据租约

- `status: partial (user-deferred AUTH_USER evidence)`
- 日期：2026-08-05
- 功能编号：ACC-001～009 的 Phase 0 登录/凭据边界
- Roadmap：Phase 0 T-02
- 前置 Gate：Prompt 01 `pass`

## 完成范围

- 建立 `persist:ncx-netease-auth`、安全官方登录窗口、导航/外链/权限策略和 Main-only CookieStore。
- 建立一次性 Probe、4.39.0 最小 Auth Adapter、绑定账户与双 generation 的五分钟内存租约、退出/换号/过期/进程退出回收。
- 建立 Guest、结构失效、窗口关闭、登录、退出、换号和 Utility 恢复状态机；Renderer/Preload 不含凭据控制面。
- 建立第三方输出静默、Utility 日志二次脱敏、构建扫描、脱敏证据扫描、可复现 packaged Spike 和 19 项测试。
- 生成 ADR-002 与 T-02 验证报告。

## 已验证结果

- Windows 本地 typecheck、lint、19 tests、build、build/packaged smoke 和 Auth boundary scan 全部通过。
- Windows packaged Guest 与结构失效 Cookie 场景通过；打包 Utility 能从 ASAR 内精确加载 4.39.0 Adapter。
- Utility 退出后 Main 立即回收租约元数据，旧 generation 控制面被拒绝；换号立即递增 account generation。
- Renderer bundle、sandboxed Preload、日志输出和脱敏证据不含 Cookie 值；项目仍未引入 SQLite。

## 暂缓与风险

- 用户明确要求跳过真实账号登录测试；AUTH_USER 捕获、真实重启恢复、远端退出和第二账户换号未验证，不能写成 `pass`。
- 4.39.0 对失效外形 Cookie 返回 `-462` 风控，匿名注册在冻结 Audit 中为 `rate_limited`；实现不猜测这两类能力。
- 用户未跟踪目录 `dome/` 不属于本任务，未修改、未暂存。

## 后续执行约束

用户要求继续 03～08，因此后续 Prompt 可继续做与真实登录无关的 Phase 0 Spike；这是对顺序执行的显式例外，不把本 Checkpoint 改写为 `pass`。Phase 0 最终 Gate 仍被 T-02 AUTH_USER 证据阻塞，直至补跑验证报告中的 interactive/restore/logout/switch 矩阵。
