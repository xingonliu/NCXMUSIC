# NcxMusic 全局按住说话与语音输入架构

> 文档状态：Baseline 0.1
> 建立日期：2026-08-05
> 适用平台：Windows、macOS
> 关联决策：C-015、C-069～C-075、C-152、D-401～D-407、D-727

## 1. 决策

全局按住说话固定采用 `uiohook-napi` + 独立 InputHookHost：

- `uiohook-napi` 的全局 `keydown` 触发开始收音。
- `keyup` 触发结束收音；配置组合键中的任一关键键提前松开都视为释放。
- Electron `globalShortcut` 只用于组合键注册和冲突检测，因为它只有按下回调，不能提供松开事件。
- 用户拒绝平台权限、组合键被占用或 Hook 本次运行失败时，禁用全局按住说话并保留小云输入区的按住麦克风按钮。
- 不提供“按一次开始、再按一次停止”的静默替代行为。

Phase 0 只验证该方案的原生模块打包、签名、权限、冲突和稳定性，不再比较其他 Hook 库。

## 2. 运行时拓扑

```text
InputHookHost（uiohook-napi）
  └─ 仅匹配当前快捷键，输出 pressed/released
                 │ 最小化控制消息
                 ▼
Electron Main / VoiceShortcutCoordinator
  ├─ 快捷键注册与冲突状态
  ├─ 平台权限与 Hook 生命周期
  └─ VoiceSession generation
                 │ 受限 IPC
                 ▼
Voice Overlay / Recorder
  ├─ MediaDevices + MediaRecorder
  ├─ 声波与“聆听中”
  └─ Audio Focus 降音
                 │ 松手后音频 Blob（内存）
                 ▼
Utility Process / Cloud ASR Adapter
  └─ 识别文本 → Agent Turn
```

InputHookHost 不持有麦克风、模型凭据、网易云 Cookie、Agent 上下文或 Renderer IPC。它只接收规范化快捷键配置，并只上报匹配后的状态转换。

## 3. InputHookHost

InputHookHost 在独立进程中加载 `uiohook-napi` 原生模块，隔离 Hook 崩溃和事件循环。启动顺序：

1. Main 校验快捷键设置并尝试使用 `globalShortcut.register()` 注册，失败则保留旧绑定并显示冲突。
2. 注册成功后启动 InputHookHost，设置 `keydown`、`keyup` 监听，再调用 `uIOhook.start()`。
3. Host 本地匹配当前组合键，只把 `pressed`、`released`、`permission_denied`、`hook_failed` 和 `stopped` 发给 Main。
4. 关闭功能、改键、应用退出或 Host 重启前调用 `uIOhook.stop()` 并移除监听。

禁止把通用 `input`、鼠标移动或全部键盘事件转发到 Main、Renderer、Utility Process、Agent、日志或遥测。Host 不调用 `keyTap`、`keyToggle` 等输入模拟 API。

## 4. 状态机

```text
idle
  └─ chord keydown → starting
       ├─ recorder ready → listening
       └─ failure → idle + error toast

listening
  ├─ chord keyup → stopping → transcribing
  ├─ hook disconnected → stopping → failed
  ├─ system suspend/lock → stopping → cancelled
  └─ explicit cancel → stopping → cancelled

transcribing
  ├─ ASR success → Agent Turn
  ├─ ASR unsupported → unsupported
  └─ network/provider failure → failed
```

- 第一次有效 `keydown` 创建新的 `voiceSessionId` 和 generation；自动重复 keydown 必须忽略。
- `Alt+Space` 中 Space 或 Alt 任一关键键松开都结束当前 Session，防止修饰键先松导致录音悬挂。
- 迟到的 keyup、旧 Host 事件和旧录音回调必须携带 generation；不匹配当前 Session 时忽略。
- Host 崩溃、连接断开、系统挂起或权限被撤销时，Main 必须立即让 Recorder 停止，不等待新的 keyup。
- 声波组件只显示 `listening`；进入 `transcribing` 前关闭悬浮组件并改用轻提示。

## 5. 录音与音乐焦点

- keydown 后显示位于主工作区底部附近的 Voice Overlay，并开始 MediaRecorder。
- 聆听期间把音乐实际输出增益临时降到原值约 20%，不修改用户保存的音量。
- keyup 后先请求 Recorder 完成当前音频块，再关闭 Overlay；UI 视觉上的“松手关闭”不能通过直接销毁尚未完成的 Recorder 丢失尾部音频。
- 只有歌曲、播放意图和 Audio Focus generation 未变化时才恢复原输出；期间用户暂停、切歌或改音量后不覆盖新状态。
- 原始录音和音频 Blob 只存在内存中，ASR 成功、失败、取消或超时后立即释放，不写入聊天、SQLite、缓存或日志。

## 6. 平台行为

### Windows

- 验证 `Alt+Space` 与系统窗口菜单及其他应用注册的冲突。注册失败时不抢占、不绕过系统行为，保留旧快捷键并提示用户改键。
- 验证最小化、失焦、锁屏、快速用户切换和应用退出时 Hook 与 Recorder 都能停止。
- 原生模块必须随 electron-builder 产物正确解包和加载，不能从 `asar` 内直接执行无法加载的二进制。

### macOS

- `uIOhook.start()` 遇到 `UIOHOOK_ERROR_AXAPI_DISABLED` 时映射为明确的辅助功能权限状态，并提供前往系统设置的说明。
- 输入监控/辅助功能权限被拒绝或撤销时，全局按住说话不可用，但应用内按住麦克风仍可使用麦克风自身权限流程。
- 验证签名、公证、应用升级后权限身份、睡眠/唤醒和多桌面状态。

权限文案必须说明应用只匹配用户配置的组合键，不保存或发送其他按键；但不能虚假宣称操作系统 Hook 本身看不到其他输入事件。

## 7. 快捷键修改

- 设置页录制新组合键时不经过 Agent Tool，由用户直接操作。
- 保存前先注册新组合键并重新配置 Host；只有两步都成功才替换旧绑定。
- 失败时保留旧绑定和运行中的 Host，不进入“设置显示新值、实际仍监听旧值”的分裂状态。
- 改键期间如果正在录音，先按取消终态安全结束当前 Session，再切换绑定。

## 8. 验收要求

- Windows/macOS 打包产物连续 200 次按下/松开无丢失 release、重复启动或悬挂录音。
- Space 先松、Alt 先松、自动重复、快速连按和长按均只有一个开始和一个结束事件。
- Host 崩溃、系统锁屏/挂起、应用退出、权限撤销和快捷键切换都会停止当前录音。
- 其他键盘和鼠标事件不跨出 InputHookHost，不进入日志、Agent 或遥测。
- 松手后 Overlay 立即退出视觉状态，但 Recorder 尾部音频完整且只驻留内存。
- 当前模型不支持 ASR 时不启动录音上传，并显示已确认提示。
- 应用内按住麦克风不依赖 `uiohook-napi` 或全局快捷键权限，始终作为回退入口。
