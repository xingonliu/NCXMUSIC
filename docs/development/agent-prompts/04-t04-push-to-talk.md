# Prompt 04：T-04 全局按住说话

执行通用协议，只完成 Phase 0 T-04。

## 必读

- 技术验证计划 T-04。
- `docs/architecture/NcxMusic-Voice-Input.md`。
- `docs/architecture/NcxMusic-System-Architecture.md`。

## 任务

验证 `uiohook-napi` 独立 InputHookHost 的 keydown/keyup、默认 `Alt+Space`、任一按键松开即结束、快捷键冲突、应用失焦和退出清理。Windows 验证 PowerToys/系统冲突；macOS 验证辅助功能/Input Monitoring、麦克风权限、签名与打包加载。

Host 只能输出匹配快捷键的 pressed/released，不记录其他按键。实现应用内按住麦克风的明确 fallback；不要接 ASR 或正式语音 UI。

## 验收

双平台分别给出 `pass` 或文档允许的 fallback，不能用 `globalShortcut` 冒充 keyup。输出原生模块版本/ABI/打包证据、权限矩阵、ADR 和 Checkpoint，然后停止。
