# NcxMusic Phase 0 技术验证计划

> 文档状态：Execution Baseline 0.1
> 建立日期：2026-08-05
> 目标：在大规模页面开发前验证会造成架构返工的非 API 风险

## 1. 执行规则

每个 Spike 都必须产生最小可运行代码、自动化或可重复手工脚本、原始环境记录、结论 ADR 和明确的 `pass | fallback | block` 结果。只写“尝试成功”不能通过。

- Spike 代码可以先放在 `experiments/`，通过后提炼进正式模块；失败方案不得混入生产入口。
- Windows 与 macOS 都是首版平台，平台专属能力必须分别验证；只有一端通过不能标记整体完成。
- 所有版本、系统构建号、设备、账号状态和依赖哈希写入报告。
- API 审计仍按独立 Playbook 推进，本文件只定义与 API 报告相交的消费门禁。

## 2. T-01 工程与进程骨架

### 验证内容

- pnpm 单包、TypeScript、Vue 3、electron-vite、electron-builder 的开发与生产路径。
- Main、Preload、Renderer 和额外 Utility Process 构建入口；Utility 输出稳定路径可被 `utilityProcess.fork()` 启动。
- `contextIsolation: true`、Renderer 无 Node、受限 ContextBridge、MessagePort 握手和 Zod 契约。
- Utility Process stdout/stderr、正常退出、崩溃、重启和应用退出清理。

### 通过条件

- `pnpm dev/typecheck/lint/test/build/package` 的约定脚本全部存在；未实现阶段允许测试为空，但脚本不能缺失。
- 开发与打包产物中都能完成 Main ↔ Renderer ↔ Utility 的版本化 ping、取消和快照恢复。
- Renderer 无法访问 `require`、`process`、通用 `ipcRenderer` 或任意 IPC Channel。
- Utility 意外退出后，Main 按 1s、2s、5s 最多三次重启；稳定运行 5 分钟后清零失败窗口。连续失败则本次应用会话停用本地服务并提供显式“重试”，不循环拉起。

### 失败回退

若 electron-vite 多入口无法稳定输出 Utility，保留 electron-vite 负责 Main/Preload/Renderer，并为 Utility 增加同仓库的独立 Vite/Rollup 构建配置；不因此拆 workspace 或改建 localhost 服务。

## 3. T-02 登录 Session 与凭据租约

### 验证内容

- 隔离持久 Session 打开网易云官方网页，捕获完整 Cookie 集并识别 `MUSIC_U`。
- Cookie 只由 Main 读取和系统保护存储；Utility 通过内存租约调用 Adapter。
- 登录、游客、Cookie 失效、退出、换号和窗口关闭状态机。

### 通过条件

- Renderer、日志、崩溃报告、Tool 参数和 SQLite 都看不到 Cookie 值。
- 登录窗口仅允许网易云白名单导航；外部链接交给系统浏览器。
- 换号立即增加 account generation，使旧租约、旧请求和旧写操作失效。

API 字段和游客能力是否可用继续由 API Audit 给出，不在本 Spike 猜测。

## 4. T-03 播放媒体链路

### 候选顺序

1. Renderer `<audio>` 直接播放 Utility 返回的短期 HTTPS 音频 URL。
2. 若直接 URL 在 CORS、Range、取消或凭据隔离上失败，再验证受控 `ncxaudio://` 或等价代理。

### 通过条件

- MP3、AAC、FLAC 等 API 实际返回格式可以加载、播放、暂停、seek、取消和切歌。
- 正确处理 `Range`、206/416、过期 URL、网络中断、快速切歌和旧 generation 事件。
- 播放 URL 不持久化、不写日志；Cookie 不进入 Renderer。
- 快速连续切换 100 次不出现双音频、旧歌复活、监听器增长或未取消请求。
- Windows/macOS 后台、最小化、锁屏和系统睡眠恢复行为有记录。

若代理方案不能完整支持 Range/取消或增加不可接受的内存复制，首版使用通过验证的直接 HTTPS 路径，不为了隐藏短期签名 URL 自建不完整协议。

## 5. T-04 全局按住说话

### 已知约束

Electron `globalShortcut` 只提供按下回调，没有全局 keyup，因此不能单独实现“按住 `Alt+Space` 聆听、松手结束”。首版需要原生输入 Hook；应用内麦克风按钮不需要原生 Hook。

冻结实现为独立 `InputHookHost` 加 `uiohook-napi`，不再比较其他 Hook 库。它只接收当前配置组合键并向 Main 上报 `pressed | released`，其他键盘/鼠标事件不跨进程、不写日志。Hook 只在语音快捷键启用时运行，停止功能或退出应用时必须调用 `uIOhook.stop()` 并卸载。

### 通过条件

- Windows/macOS 打包、签名和公证后的安装包都能加载原生模块。
- Windows 验证 `Alt+Space` 与系统窗口菜单、Electron 注册及按键重复的冲突；macOS 验证辅助功能/Input Monitoring 权限请求、拒绝、后续开启和撤销。
- 连续 200 次按下/松开无丢失 release；失焦、切屏、锁屏和进程崩溃不会让录音永久保持开启。
- Hook 不抑制无关按键，不把原始按键流交给 Renderer、Agent、日志或遥测；空闲 CPU 和内存满足发布性能预算。

### 权限与运行时回退

用户拒绝 macOS 辅助功能/Input Monitoring 权限、组合键注册冲突或 Hook 运行时不可用时，该平台本次会话禁用全局按住说话并解释原因，只保留小云输入区按住麦克风按钮；不能把行为静默改成“按一次开始、再按一次结束”。如果是打包、ABI 或签名问题，应修复选定方案而不是自动换库。

## 6. T-05 Shell 进程监督

按照 `NcxMusic-Shell-Execution.md` 实现最小执行器，重点验证：

- PowerShell AST 与 zsh 保守模板分类能阻止复合语法和路径逃逸。
- Windows 子进程树、macOS 进程组可以在取消、超时和应用退出时完整回收。
- 1 MiB/通道内存上限、64 KiB 模型结果、流式背压和脱敏一致生效。
- 打包后最小环境仍能运行白名单命令、构建和测试模板。

进程树不能可靠回收时，首版 Shell Tool 默认关闭且不可启用，直到监督实现通过。

## 7. T-06 WindowChrome 与视觉材质

- macOS 原生交通灯位置、全屏隐藏/显现和导航安全区。
- Windows 自绘按钮的最小化、最大化/还原、关闭设置、drag/no-drag、`Win+Z` 和贴边。
- Liquid Glass 在亮暗主题、降低透明度、GPU 禁用、高对比度和 100%～200% 缩放下的降级。

验收矩阵以 `NcxMusic-Window-Chrome.md` 为准。Windows 不以实现自绘 Snap Layout Hover 面板作为通过条件。

## 8. T-07 系统媒体集成

验证 Chromium Media Session、Windows SMTC 和 macOS Now Playing/系统媒体键与唯一 AudioHost 的实际集成：

- 元数据、封面、播放状态和进度同步。
- 系统播放/暂停/上一首/下一首进入同一 PlaybackCommand 管道。
- 锁屏、蓝牙耳机和媒体键不会绕过队列 revision 或创建第二播放状态源。

若 Web Media Session 在某平台不能满足，先记录平台适配 ADR，再选择最小原生桥；不得在 PlayerBar 内增加第二套播放器逻辑。

## 9. T-08 Provider 与 ASR 协议

对 OpenAI Compatible、Anthropic Messages、Gemini generateContent 分别建立文本流式、Tool Call、错误归一化和取消夹具。ASR 只复用当前 Provider Profile：

- 能力无法静态确定时首次按供应商协议探测，缓存 `supported | unsupported`。
- 切换协议、模型、Base URL、Headers 或凭据后使缓存失效。
- 不支持时使用已确认文案并停止录音上传，不自动换供应商。
- 原始音频只在内存中保留到请求结束。

中转站可能只实现协议子集，因此“OpenAI Compatible”不能按品牌名推断 ASR；必须以实际请求结果为准。

## 10. Phase 0 退出门禁

以下全部满足后才能把工程标记为 Foundation Ready：

- T-01、T-02、T-03、T-05、T-06 为 `pass`；它们失败会造成进程、安全或播放器主干返工。
- T-04、T-07、T-08 至少为 `pass` 或已有符合产品约束的明确 fallback。
- API Audit 提供首个可消费的登录、核心实体、搜索、播放 URL 与歌词契约快照；完整低频 API 审计可以继续并行。
- 所有结论都有 ADR、可复现步骤和双平台结果，不把实验临时代码当作正式架构。
