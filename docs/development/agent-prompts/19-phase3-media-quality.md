# Prompt 19：Phase 3 媒体解析、音质与竞态

执行通用协议；确认 API-B 可消费。只实现 TrackResolver 与正式媒体适配。

## 必读

- Player Domain 的 URL、音质、试听和媒体协议章节。
- `ncm.song_detail`、`ncm.song_url_v1`、`ncm.song_url`、`ncm.lyric`、`ncm.lyric_new`、`ncm.check_music`、`ncm.album_privilege` Endpoint 报告和相关脱敏样本。
- 功能清单 PLY-016～018、MUS-013/014。

## 任务

实现自动最高可用、九档显式音质、常规回退链、特殊格式显式选择、实际 `actualLevel`、试听片段和权限字段映射。实现 URL 重新解析、过期处理、快速切歌 generation、播放中换音质并尽量保持最新进度/意图。

封面实现五档语义尺寸和统一 URL Builder。VIP/付费只形成标准权益字段，不由 UI 标记推断可播性。

## 验收

用报告契约和受控集成样本验证普通/游客/VIP事实、逐曲降级、无 URL、过期、试听和旧请求回写。输出 Checkpoint 后停止。
