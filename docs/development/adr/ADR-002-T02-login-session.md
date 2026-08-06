# ADR-002：登录 Session 与凭据租约

- 状态：Accepted；真实账号登录、同 Profile 重启恢复与远端退出已验证，第二账号换号作为后续增强
- 日期：2026-08-05
- 对应 Spike：T-02

## 背景

T-02 要验证网易云官方网页登录能否隔离在独立持久 Session 中，Main 能否在不经过 Renderer、日志或业务存储的前提下识别 `MUSIC_U`，以及 Utility Process 能否通过可撤销的短期内存租约调用最小 Auth Adapter。T-01 已提供受监督 Utility Process，但没有账户、Cookie 或凭据控制面。

## 决策

1. 官方登录窗口固定使用 `persist:ncx-netease-auth`。窗口无 Preload，启用 `contextIsolation`、`sandbox` 和 `webSecurity`，关闭 Node Integration、WebView、下载、非 HTTPS 导航及全部权限请求。
2. 顶层导航只允许网易云登录所需 Host。其他可信 HTTPS 链接交给系统浏览器，伪装子域、HTTP、文件和外部协议直接拒绝。
3. Electron Cookie Store 是网页 Cookie 的唯一持久来源。Main 查询隔离 Session、结构校验 `MUSIC_U` 并 Flush；不向 JSON、SQLite、LocalStorage 或 `safeStorage` 复制一份 Cookie。
4. 凭据控制使用 Utility Process 的私有父子进程通道，不注册 Renderer IPC 或 Preload API。所有命令与事件都经过严格 Zod Schema；Utility 返回值不含 Cookie 字段。
5. Main 先发送一次性 Probe。Utility 使用精确锁定的 `@neteasecloudmusicapienhanced/api@4.39.0` 验证稳定数字账户 ID 和用户详情；只有 30 秒内匹配同一 Cookie 指纹、账户和 `accountGeneration` 的 Grant 才能建立租约。
6. 租约最长五分钟，绑定 `leaseId + accountId + accountGeneration + utilityGeneration + expiresAt`。退出、换号、过期、替换、Utility 退出和应用退出都会撤销租约；Utility 用可清零 Buffer 持有活动秘密。
7. 明确的账户缺失结果才清理持久 Session。风控挑战、网络故障、非 200 异常形态或用户详情无法确认统一归为 `remote-unavailable`，保留 Cookie 且不发放租约，避免把临时上游故障误判为退出登录。
8. 打包后的 Utility 从 `app.asar/package.json` 建立确定的 `createRequire()`，而 Utility 入口继续位于 `app.asar.unpacked`。构建门禁同时扫描 Renderer/Preload 产物，禁止出现 Cookie 或租约控制面标记。

## 结果

- 登录窗口、Cookie Store、账户 generation 与 Utility generation 形成明确的安全边界。
- Renderer、Preload、Tool、Prompt 和普通业务 IPC 无法取得 Cookie 或租约控制命令。
- 第三方 API 调用期间屏蔽其 Console，Main 对 Utility stdout/stderr 再执行统一脱敏。
- Phase 0 只提供可复现 Spike CLI，不提前建设正式账户页面、Pinia Account Store、SQLite 账户空间或完整 Music Service。

## 已知例外

T-03 播放媒体链路验证需要真实 Cookie 调用 `song_url_v1`，但 vitest 和纯 Node 脚本无法访问 Electron 的 Cookie Store。为此建立了**显式、受审计的开发期例外**：

### `.env.t03.local`

- **目的**：T-03 Spike 首次运行时，Main 从 Cookie Store 读取 Cookie 并写入 `.env.t03.local`，此后纯 Node 工具（vitest / CLI）可通过 `process.env` 读取。
- **触发条件**：`NCX_T03_SPIKE=1` 环境变量必须设置，否则 `CredentialEnvWriter` 直接拒绝写入。
- **git 排除**：`.gitignore` 的 `.env.*` 规则已覆盖；`verify-auth-boundaries.mjs` 主动检查该文件是否被 `git ls-files` 跟踪，跟踪即报 violation。
- **生命周期**：文件在 Spike 结束时执行 `pnpm t03:purge` 删除。验证账号应在网易云端退出登录。
- **代码位置**：`src/main/t03-spike/credential-env-writer.ts` 是整个代码库中唯一将 Cookie 写入磁盘的位置，有文件头内联警告。
- **不与决策 #3 冲突**：该例外仅作用于开发期验证，不修改 `CookieSessionRepository` 的数据流，不影响任何持久存储路径（SQLite/JSON/LocalStorage），且永远不被 Renderer、Preload 或 Utility 读取。

### 门禁

1. `verify-auth-boundaries.mjs` 检查 `.env.t03.local` 未进入 git，检查 T-03 证据不含 env 变量名，检查 scripts/ 无硬编码凭据。
2. `CredentialEnvWriter` 在 `NCX_T03_SPIKE !== '1'` 时拒绝写入。
3. 写入文件使用 `0o600` 权限，并包含多个 `# ⚠️` 内联警告。
4. T-03 达到 `pass` 后本例外应在清理阶段移除。

## 未关闭项

真实账号的官方登录、同 Profile 重启恢复与远端退出已在隔离 Profile 中完成一次性验证，T-02 达到 `pass`。第二账号换号仍必须由用户在官方页面内完成，作为后续增强；自动化假 Cookie 不能替代真实账号证据。
