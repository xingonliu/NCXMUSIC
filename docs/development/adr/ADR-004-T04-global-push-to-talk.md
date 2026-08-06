# ADR-004：全局按住说话 InputHookHost

- 状态：Accepted；最小 Host、契约与按键匹配已落地，真实原生模块打包/签名与 macOS 权限仍待双平台验证
- 日期：2026-08-06
- 对应 Spike：T-04

## 背景

T-04 需要验证“按住 `Alt+Space` 聆听、松手结束”的全局快捷键方案。Electron `globalShortcut` 只能提供按下回调，不能作为按住说话的完整实现，因此必须引入可提供全局 keyup 的原生输入 Hook。

## 决策

1. **固定采用独立 InputHookHost。** Host 作为单独构建入口 `out/main/inputHook.js` 存在，只负责加载 `uiohook-napi`、匹配当前组合键并向 Main 汇报状态。
2. **跨进程契约只允许状态转换。** `input-hook` 契约只包含 `pressed`、`released`、`permission_denied`、`hook_failed` 和 `stopped`，不允许原始 keycode、鼠标事件或完整键盘流跨出 Host。
3. **快捷键匹配保持纯逻辑可测。** `ShortcutMatcher` 在无 Electron、无原生模块环境下验证组合键、重复 keydown、任一关键键释放和断连释放，避免把 Spike 结论绑定到本机权限状态。
4. **Host 启停必须显式清理。** 每次重新配置前先停止并解绑旧 `uIOhook` 监听，进程退出时再次调用停止逻辑，避免残留全局 Hook。
5. **失败不切换成 toggle 行为。** 加载失败或 macOS 权限错误映射为禁用全局按住说话，产品回退仅保留应用内麦克风按钮。

## 结果

- 当前实现提供 T-04 的最小可验证 Host 入口、严格 Zod 契约、构建产物检查和单元/契约测试。
- `uiohook-napi@1.5.5` 已纳入运行依赖并加入 `asarUnpack`，但本阶段不把本机开发加载等同于双平台签名/公证后的产品通过。
- 后续产品化需由 Main 增加 `VoiceShortcutCoordinator`，在启用语音快捷键时 fork Host，并把 Host 状态转换接到 Recorder/Audio Focus generation。

## 未关闭项

Windows/macOS 安装包内原生模块加载、Windows `Alt+Space` 冲突、macOS 辅助功能/Input Monitoring 权限、锁屏/睡眠/崩溃恢复和连续 200 次真实按下/松开仍需在打包产物上执行。
