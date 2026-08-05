# ADR-002：T-02 登录 Session 与凭据租约

- 状态：Accepted；真实账号验证由用户暂缓
- 日期：2026-08-05
- 功能映射：ACC-001～009；Phase 0 T-02
- 关联架构：A-001、A-002、A-005、D-012、D-105、D-108

## 背景

T-02 要验证网易云官方网页登录能否被隔离到独立持久 Session，Main 能否在不经过 Renderer、日志或业务存储的前提下识别 `MUSIC_U`，以及 Utility 能否只通过可撤销内存租约调用最小 Auth Adapter。API Audit 4.39.0 的登录状态、账户、详情和退出端点仍缺 AUTH_USER 样本，匿名注册又受风控限制，因此实现不能用模拟成功冒充真实登录。

## 文档与版本依据

2026-08-05 通过 Context7 查询了：

- Electron `/electron/electron`：`session.fromPartition`、Cookie 查询/移除/`flushStore()`、安全 BrowserWindow、权限拒绝、`setWindowOpenHandler`、`shell.openExternal` 和 Utility `parentPort/postMessage`。
- Netease Cloud Music API Enhanced `/neteasecloudmusicapienhanced/api-enhanced`：Cookie 参数调用模式；实际实现再以锁定 npm 包和冻结 API Audit 为准。
- Node.js 24 `/websites/nodejs_latest-v24_x_api`：用绝对 `package.json` 路径创建 `module.createRequire()`，使解包 Utility 能从 `app.asar` 确定解析 CommonJS Adapter。

依赖精确锁定为 `@neteasecloudmusicapienhanced/api@4.39.0`。实现只调用 `login_status`、`user_account`、`user_detail` 和 `logout`；`register_anonimous` 的可用性继续服从 API Audit 的 `rate_limited` 结论，不在 T-02 猜测或伪造游客 Cookie。

## 决策

1. 官方登录窗口固定使用 `persist:ncx-netease-auth`。窗口无 Preload，启用 `contextIsolation`、`sandbox`、`webSecurity`，禁用 Node Integration、WebView、非 HTTPS 导航和所有权限请求。
2. 顶层导航只允许 `music.163.com`、其音乐子域及登录所需的 `login/passport/reg.163.com`；其他可信 HTTPS 链接经校验后交给系统浏览器，其他协议直接拒绝。
3. Electron CookieStore 是唯一持久凭据来源。Main 查询隔离 Partition 的网易域 Cookie、结构校验 `MUSIC_U` 并 Flush；不在 JSON、SQLite、localStorage、safeStorage 文件或 Checkpoint 中复制明文 Cookie。
4. Main 先把完整 Cookie Header 作为一次性 Probe 交给 Utility。Utility 用锁定 Adapter 验证数字账户 ID 和用户详情，返回不含 Cookie 的结果；成功 Probe 仅保留 Cookie SHA-256 以约束随后 30 秒内的 Grant。
5. 最终租约绑定 `leaseId + accountId + accountGeneration + utilityGeneration + expiresAt`。Utility 用可清零 Buffer 持有秘密；退出、过期、换号、替换或进程退出时清零/回收。Utility 崩溃后 Main 立即丢弃元数据，重启后只能从 Main CookieStore 重新 Probe 和 Grant。
6. 退出时远端 `logout` 只是尽力执行，本地 CookieStore 清理和租约撤销是权威动作。切换账户立即递增 generation，再清 Session，使旧请求和旧写入失效。
7. 第三方 API 加载和调用期间临时静默 Utility Console；Main 对 Utility stdout/stderr 再做 Cookie Header、JSON Cookie、`MUSIC_U`、Authorization 和 Bearer 脱敏。
8. Renderer/Preload 不注册登录 Cookie 或租约 Channel。Phase 0 只提供可复现 Spike CLI，不建立正式登录页、账户 Store 或业务 API。

## 安全与回退结论

- Guest、结构损坏 Cookie、登录窗口关闭、退出、换号和 Utility 退出均有显式状态或自动化覆盖。
- 看似完整但被远端风控拒绝的 Cookie 归为 `remote-unavailable`，保留持久 Session 且不发租约；不能把临时风控误判为确定失效并删除用户会话。
- API Audit 已观测到 `-462` 风控挑战；匿名注册和远端 Cookie 失效的精确语义继续由 API Audit 给出。
- 用户在 2026-08-05 明确要求跳过真实账号登录测试，因此本 ADR 接受架构选择，但不宣称 AUTH_USER、重启恢复或远端退出已经通过。

## 后果

- 打包 Utility 位于 `app.asar.unpacked`，生产依赖位于 `app.asar`；Adapter 用 `createRequire(resources/app.asar/package.json)` 确定解析，避免解包整个依赖树。
- 当前自动化能证明隔离、状态机、租约绑定/回收和脱敏边界；Phase 0 最终 Gate 仍需一次用户授权的真实登录、重启恢复和退出/换号证据。
- 正式 Account Session UI、Pinia 状态、设置入口和账户数据空间留给 Phase 2，不在本 Spike 提前实现。
