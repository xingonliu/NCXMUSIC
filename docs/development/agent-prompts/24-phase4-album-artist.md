# Prompt 24：Phase 4 专辑与歌手

执行通用协议，只开发专辑、歌手和推荐歌手能力。

## 必读

- Design System、Context Menu Matrix、Player Domain。
- 功能清单 MUS-005/006、APP-007/010。
- `ncm.album`、`ncm.album_detail`、`ncm.album_privilege`、`ncm.artists`、`ncm.artist_detail`、`ncm.artist_songs`、`ncm.artist_album`、`ncm.simi_artist` 等 Endpoint 报告。

## 任务

先记录各页面 Section 装配，再实现专辑详情、歌手详情、热门歌曲、专辑列表、相似/推荐歌手、统一二级 PageHeader、播放全部、收藏和歌曲上下文操作。复用标准实体、TrackList、EntityCard/Hero 和 MediaArtwork，不复制页面私有视觉组件。

## 验收

分页、缓存、空/错误状态、长列表、游客差异、集合播放和返回回退 E2E 通过；页面不读取原始字段。输出 Checkpoint 后停止。
