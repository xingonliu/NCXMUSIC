# Prompt 02：T-02 登录 Session 与凭据租约

执行通用协议，只完成 Phase 0 T-02；先确认 Prompt 01 Checkpoint 为 `pass`。

## 必读

- `NcxMusic-Technical-Spike-Plan.md` 的 T-02。
- `docs/architecture/NcxMusic-System-Architecture.md`。
- `docs/architecture/NcxMusic-Storage-Architecture.md`。
- API 报告中的 `ncm.register_anonimous`、`ncm.login_status`、`ncm.user_account`、`ncm.user_detail`、`ncm.logout` Endpoint `.md/.json`。

## 任务

用最小 Spike 验证 Electron 独立持久 Session 打开受限网易云官方网页登录、Main 捕获并验证 `MUSIC_U`、凭据不进入 Renderer/日志/数据库，并以可撤销的内存租约交给 Utility。验证游客 Session、重启恢复、失效 Cookie、退出和换号 generation；不在应用收集密码。

记录登录窗口导航白名单、Sandbox/Context Isolation、Cookie 生命周期和 Utility 崩溃后的租约回收。不得把原始 Cookie 写入 Checkpoint。

## 禁止与验收

不建设正式登录页面和账户业务，不扩大 API 调用。满足 T-02 通过条件；用脱敏证据证明 Renderer、日志和存储无 Cookie。输出 ADR、可重复验证脚本及 Checkpoint，然后停止。
