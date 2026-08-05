# T-02 登录 Session 与凭据租约验证报告

- 报告日期：2026-08-05
- 当前结果：自动化与 Windows 打包边界 `pass`；AUTH_USER 交互验证 `not-run (user-deferred)`
- 依赖：`@neteasecloudmusicapienhanced/api@4.39.0`
- API Audit：`RUN-2026-08-04-P0-PROVISIONAL`

## 实现范围

- 独立持久 Session Partition 和无 Preload 的官方登录窗口。
- HTTPS 网易白名单、外链系统浏览器、安全 WebPreferences、权限/WebView 全拒绝。
- Main-only CookieStore 查询、结构校验、Flush 和精确清理。
- Utility 一次性 Probe、数字账户 ID 识别、用户详情确认和五分钟可撤销内存租约。
- `accountGeneration`、Utility generation、lease ID 和到期时间联合绑定。
- 退出、换号、窗口关闭、结构失效 Cookie、Utility 退出和重启重建状态机。
- 第三方 Console 静默、Main 二次脱敏、Renderer/Preload 构建标记扫描和脱敏证据扫描。
- `t02:spike` 可复现 CLI；证据只写入被 Git 排除的 `.artifacts/t02/evidence`，不记录 Cookie 值。

## 本地环境

| 项目 | 值 |
| --- | --- |
| 主机 | Windows x64，OS Build 26200 |
| 本机外部 Node | 22.22.2（低于项目冻结版本，命令有明确 engine warning） |
| 项目冻结 Node / pnpm | 24.18.0 / 11.20.0 |
| Electron | 43.3.0（内嵌 Node 24.18.1） |
| API 包 | 4.39.0，精确锁文件 |

## 自动化结果

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass；Dependency boundaries `pass` |
| `pnpm test` | pass；6 files / 19 tests |
| `pnpm build` | pass；ASAR Adapter 解析契约与 Renderer/Preload 凭据标记检查通过 |
| `pnpm smoke:build` | pass；T-01 运行链路无回归 |
| `pnpm smoke:packaged` | pass；Windows packaged Utility 启动正常 |
| `pnpm t02:verify-boundaries` | pass；Renderer、Preload 与脱敏证据未发现凭据控制面/值 |
| `pnpm t02:spike -- --scenario guest --target packaged --profile repro-guest-20260805` | pass；无用户凭据、无租约 |
| `pnpm t02:spike -- --scenario invalid --target packaged --profile repro-invalid-20260805` | pass；结构损坏 Cookie 进入 expired 并清理、无租约 |

单元与 Contract 覆盖：

- 首次登录、登录窗口关闭、换号、过期、退出的状态转换和 generation 递增。
- Cookie 域边界、完整隔离 Cookie Header 组装、Guest/结构失效判定和 Store 清理。
- Probe 必须先成功且秘密/账户/generation 完全一致才接受 Grant。
- Logout 后 Buffer 租约撤销；Utility generation 退出后 Main 拒绝旧控制面。
- 第三方库尝试输出或抛出响应详情时不进入 Utility stdout。
- 白名单拒绝 HTTP、伪装子域、`file:`、`mailto:`，外部只允许 HTTPS 交给系统浏览器。

## API 与失效 Cookie 观测

锁定包的无账户/失效外形调用在 2026-08-05 返回 `-462` 风控挑战，而冻结 Audit 的部分样本曾返回 code 200 + null account。实现将这种响应报告为 `remote-unavailable`，不发放租约，也不在无法区分“失效”和“临时风控”时删除持久 Session。

`register_anonimous` 在冻结 Audit 中为 `rate_limited`，所以 Guest Spike 只验证“无用户凭据的隔离 Session”状态；ACC-004 的匿名 API 能力保持未解锁。

## 未执行的真实账号矩阵

官方登录窗口已成功打开两次；用户未完成登录并关闭窗口，随后明确要求跳过该测试。因此以下项没有证据，不能标记为通过：

- 捕获并远端验证真实 `MUSIC_U`。
- 应用重启后从同一持久 Partition 恢复真实账户。
- 对真实账户执行远端 logout，再验证本地权威清理。
- 用第二个真实账户完成换号，并证明旧账户请求/写入无法复活。

没有尝试读取 Chrome、其他应用或系统浏览器的登录态，也没有要求用户发送账号、密码或 Cookie。后续可在用户授权时运行：

```powershell
pnpm package:dir
pnpm t02:spike -- --scenario interactive --target packaged --profile primary
pnpm t02:spike -- --scenario restore --target packaged --profile primary
```

退出与换号是破坏该测试 profile 登录态的场景，应在恢复验证之后执行。

## 结论

实现已关闭代码层面的进程、安全、导航、脱敏和可撤销租约风险，但真实 AUTH_USER 路径由用户暂缓。本报告不把自动化假 Cookie 当作登录成功；Phase 0 最终 Gate 必须保留 T-02 AUTH_USER 未关闭项。
