# T-02 登录 Session 与凭据租约验证报告

- 执行日期：2026-08-05
- 当前结论：`partial`；自动化与 macOS 打包边界通过，真实账号矩阵未执行
- 基线提交：`50885c6`
- API 依赖：`@neteasecloudmusicapienhanced/api@4.39.0`
- 依赖锁哈希（SHA-256）：`343c100f93990c42f2dee45023a76b13629c5efe201a376b8c0500ed44757537`

## 验证环境

| 项目 | 值 |
| --- | --- |
| 本地系统 | macOS 26.5.2（Build 25F84），x86_64 |
| Node.js | 22.22.0 |
| pnpm | 11.20.0 |
| Electron | 43.3.0 |
| electron-vite | 5.0.0 |
| API 包 | 4.39.0 |

本机默认终端不是仓库冻结版本，因此本次验证通过临时、显式的 Node 22.22.0 与 pnpm 11.20.0 执行，没有放宽 `engines` 或修改用户全局运行时。

## 实现范围

- 独立持久 Session、无 Preload 的官方登录窗口、HTTPS 网易白名单、外链系统浏览器和权限/WebView/下载全拒绝。
- `logged_out`、打开窗口、等待 Cookie、验证、已登录、失效、验证失败和取消状态机。
- Main-only Cookie 查询、结构校验、Flush 和精确清理；Cookie Store 是唯一持久权威来源。
- 一次性 Probe、数字账户 ID 与用户详情确认、五分钟可撤销 Utility 内存租约。
- `accountGeneration`、Utility generation、lease ID 和到期时间联合绑定。
- Utility 重启、退出、换号、过期和应用退出回收；上游异常不误删持久 Cookie。
- 第三方 Console 静默、Main 二次脱敏、Renderer/Preload 构建标记扫描和脱敏证据扫描。
- `t02:spike` 可复现 CLI；证据只写入 Git 已排除的 `.artifacts/t02/evidence`。

## 本地自动化结果

| 门禁 | 结果 |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass；Architecture boundaries OK |
| `pnpm test` | pass；10 files / 58 tests |
| `pnpm build` | pass；ASAR Adapter 与 Renderer/Preload 产物门禁通过 |
| `pnpm smoke:build` | pass；T-01 握手、取消、崩溃恢复和重载快照无回归 |
| `pnpm smoke:packaged` | pass；macOS x64 解包应用正常启动并完成 T-01 Smoke |
| `pnpm t02:verify-boundaries` | pass；构建与证据未发现凭据泄漏 |
| T-02 guest / invalid，build | pass |
| T-02 guest / invalid / expired，packaged | pass |

单元与契约测试覆盖严格 Schema、未知字段拒绝、登录状态转换、导航策略、Cookie 域边界、完整 Header 组装、结构失效清理、Probe/Grant 绑定、租约回收、Utility 代际隔离、上游挑战保留和日志脱敏。

## 打包与失效凭据观测

macOS 解包应用中的 `expired` 场景实际加载了 ASAR 内的 4.39.0 Adapter，并通过私有父子进程通道完成远端探测。当前返回可明确归一化为 `invalid`；应用清理隔离 Session、递增账户 generation，且没有发放租约。

Guest、结构失效和失效外形测试都使用独立 `--user-data-dir` Profile。输出与落盘证据只包含结果、计数、哈希化账户标识和状态，不包含 Cookie 值。

## 双平台 CI

当前质量工作流已增加 Windows/macOS 的构建边界扫描及 T-02 guest/invalid build Spike。该结果需在本实现提交推送后记录；在 CI 完成前不宣称另一平台已通过。

## 未执行的真实账号矩阵

以下操作需要用户只在网易云官方窗口中完成，本次没有读取浏览器现有登录态，也没有要求用户提供账号、密码或 Cookie：

- 捕获并远端验证真实 `MUSIC_U`。
- 应用重启后从同一持久 Partition 恢复真实账户。
- 对真实账户执行远端退出并验证本地权威清理。
- 使用第二个真实账户完成换号，并证明旧账户请求和租约无法复活。

可在用户准备好后依次执行：

```bash
pnpm t02:spike -- --scenario interactive --target packaged --profile primary
pnpm t02:spike -- --scenario restore --target packaged --profile primary
pnpm t02:spike -- --scenario logout --target packaged --profile primary
```

双账号换号需要单独测试 Profile 和第二个真实账号。上述矩阵完成前，本报告保持 `partial`。

## 关联决策

见 [ADR-002：登录 Session 与凭据租约](../adr/ADR-002-T02-login-session.md)。
