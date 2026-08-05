# ADR-002：登录 Session 与凭据租约

- 状态：Accepted；真实账号首次登录与同 Profile 重启恢复已验证，远端退出和第二账号换号仍待完成
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

## 未关闭项

真实账号的官方登录与同 Profile 重启恢复已在隔离 Profile 中完成一次性验证；远端退出和第二账号换号仍必须由用户在官方页面内完成。自动化假 Cookie 不能替代这些证据；在完整矩阵完成前，T-02 保持 `partial`，不能标记为 `pass`。
