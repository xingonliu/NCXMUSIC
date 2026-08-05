# Prompt 03：T-03 播放媒体链路

执行通用协议，只完成 Phase 0 T-03；先确认 T-02 Checkpoint 可继续。

## 必读

- 技术验证计划 T-03。
- `docs/architecture/NcxMusic-Player-Domain.md`。
- `docs/architecture/NcxMusic-System-Architecture.md`。
- API 报告中的 `ncm.song_detail`、`ncm.song_url_v1`、`ncm.lyric`、`ncm.lyric_new`、`ncm.check_music`、`ncm.album_privilege`。

## 任务

以最小播放器 Spike 验证根层唯一 `HTMLAudioElement`、URL 获取、播放/暂停/seek、路由切换和 PlayerBar 卸载后继续播放。按 T-03 候选顺序验证 HTTPS、受控自定义协议和必要回退，重点验证 CSP、Range、过期 URL、试听片段、特殊音质格式、打包环境和快速切歌竞态。

不要实现完整队列或正式 UI。记录可用链路、失败链路、平台/媒体格式矩阵和最终选择。

## 验收

开发与打包构建至少能稳定播放已审计样本；旧异步结果不能覆盖新曲；Cookie/URL 不进入不安全日志。输出 ADR、验证报告、最小自动化或可重复手工脚本及 Checkpoint，然后停止。
