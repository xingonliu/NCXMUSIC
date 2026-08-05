# Prompt 39：Phase 7 语音输入

执行通用协议，只产品化按住说话与云端 ASR，不做 TTS。

## 必读

- `docs/architecture/NcxMusic-Voice-Input.md`。
- Agent Runtime、IPC Protocol、Player Domain Audio Focus。
- 功能清单 VOC-001～012、SET-006。

## 任务

产品化 T-04 InputHookHost、默认/可改 `Alt+Space`、应用内麦克风、内存录音、麦克风权限、固定降音、松手关闭声波浮窗和当前 Provider ASR。识别文本进入新的 Agent Turn；识别中/成功/失败用轻提示，审批/选择只通知用户打开小云。

原始录音只驻内存，识别/失败/超时/取消后释放；不支持时上传前提示。实现快捷键冲突、权限拒绝和 Hook 故障 fallback。

## 验收

keydown/keyup、降音恢复、新播放意图、冲突、权限、取消、隐私释放、ASR 不支持和打包 E2E 通过。不存在 TTS。输出 Checkpoint 后停止。
