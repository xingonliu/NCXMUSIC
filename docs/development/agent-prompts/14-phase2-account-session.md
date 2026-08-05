# Prompt 14：Phase 2 账户与会话

执行通用协议；确认 Phase 1 Gate 和 API-A 可消费。只实现账户会话，不实现音乐页面。

## 必读

- 系统架构、存储架构、IPC Protocol。
- 功能清单 ACC-001～009、SET-001。
- 冻结 API 审计根目录下的 `00-RUN-MANIFEST.md`、`02-coverage-summary.md`。
- `ncm.register_anonimous`、`ncm.login_status`、`ncm.user_account`、`ncm.user_detail`、`ncm.logout` Endpoint 报告。

## 任务

把 T-02 提炼为正式 Credential Vault、隔离 Session、受限官方网页登录、Cookie 验证和内存租约。实现游客启动、重启恢复、会话过期、重新登录、退出、换号 generation 与旧请求取消。实现游客底部账户行和上下文登录入口；个人信息保持不可用。

Renderer 只接收归一化 AccountSnapshot，不接触 Cookie 或原始响应。所有状态变化通过类型化 Contract。

## 验收

游客、正式登录、失效 Cookie、重启、退出、换号 E2E 通过；旧 generation 写入被拒绝；日志/数据库/Renderer 无 Secret。输出 Checkpoint 后停止。
