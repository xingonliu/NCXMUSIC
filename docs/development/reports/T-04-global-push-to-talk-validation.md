# T-04 全局按住说话验证报告

- 执行日期：2026-08-06
- 当前结论：`fallback`；InputHookHost 最小实现、契约、构建产物和 Windows 目录打包通过，macOS 权限/签名与真实 200 次按压仍待验证
- 基线提交：本任务完成提交
- 原生 Hook 方案：`uiohook-napi` + 独立 `InputHookHost`

## 实现范围

- `src/shared/contracts/input-hook.ts`：严格 Zod 契约，限制配置、状态报告与可识别按键集合。
- `src/input-hook/shortcut-matcher.ts`：纯逻辑组合键匹配，支持重复 keydown 去重、任一关键键释放、Host 断连安全释放。
- `src/input-hook/index.ts`：独立 Host 入口，动态加载 `uiohook-napi`，只监听 `keydown`/`keyup`，退出和重配时停止并卸载 Hook。
- `electron.vite.config.ts`：新增 `inputHook` 构建入口，输出到 `out/main/inputHook.js`。
- `scripts/verify-build.mjs`：新增 InputHookHost 构建产物门禁，确认存在父进程通道和原生 Hook 加载点，禁止鼠标事件监听进入产物。

## 本地自动化结果

| 门禁 | 结果 |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass；Architecture boundaries OK |
| `pnpm test` | pass；17 files / 193 tests，新增 InputHook 单元与契约测试 |
| `pnpm build` | pass；新增 `out/main/inputHook.js` 产物检查 |
| `pnpm package:dir` | pass；electron-builder 重建 `uiohook-napi` 并生成 Windows unpacked 产物 |

## 已验证的 T-04 条件

| 通过条件 | 状态 | 证据 |
| --- | --- | --- |
| Electron `globalShortcut` 不单独承担 keyup | pass | 架构决策保持独立 InputHookHost；实现未使用 toggle 替代 |
| 不转发原始按键流 | pass | Report 契约拒绝 `keycode` 等额外字段，Host 只 post 状态 |
| 自动重复 keydown 不重复开始 | pass | `ShortcutMatcher` 单元测试覆盖长按重复 |
| 任一关键键释放结束 | pass | `AltLeft` 或 `Space` 任一 keyup 触发 `released` |
| Hook 断连不会悬挂录音状态 | pass（逻辑层） | `disconnect` 转换为活动 Session 的 `released` |
| 构建产物含独立 Host 入口 | pass（构建后验证） | `verify-build` 检查 `out/main/inputHook.js` |
| Windows 目录打包含原生依赖重建 | pass（Windows 本机） | `electron-builder --dir` 显示 `uiohook-napi` rebuild finished |

## 尚未验证的 T-04 条件

1. Windows 安装包签名后的真实启动加载，以及 macOS 打包、签名、公证后的 `uiohook-napi` 原生模块加载。
2. Windows `Alt+Space` 与系统窗口菜单、其他应用注册和 Electron `globalShortcut.register()` 冲突。
3. macOS 辅助功能/Input Monitoring 权限请求、拒绝、后续开启和撤销。
4. 连续 200 次真实按下/松开、失焦、切屏、锁屏、睡眠恢复和 Host 崩溃。
5. 空闲 CPU/内存预算。

## 关联决策

见 [ADR-004：全局按住说话 InputHookHost](../adr/ADR-004-T04-global-push-to-talk.md)。
