# Prompt 43：Phase 7 收口门禁

执行通用协议，只审计 Extension Beta。

核对 Prompt 39～42、Voice/Shell/Extensions 架构与全部 VOC/EXT/相关 SEC。复跑双平台语音、ASR fallback、录音释放、Shell 分类/回收、Skill 安装/Host/回滚、MCP 两 Transport/逐次审批/配置变化和应用退出零孤儿进程。

确认无 TTS、无本地 ASR、无 Skill 市场/在线依赖、无旧 MCP SSE、无 MCP Tool 免审、无 Secret 导出。硬门禁或进程回收失败必须 `block`。

生成 `43-phase7-gate.md` Checkpoint。达到 `Extension Beta` 才解锁 Prompt 44。
