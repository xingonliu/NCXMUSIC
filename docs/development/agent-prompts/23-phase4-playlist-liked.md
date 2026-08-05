# Prompt 23：Phase 4 歌单与我喜欢

执行通用协议；只开发歌单相关页面和操作。

## 必读

- Design System、Context Menu Matrix、Player Domain。
- 功能清单 APP-002～005/010、MUS-004/007～009。
- `ncm.playlist_detail`、`ncm.playlist_track_all`、`ncm.user_playlist`、`ncm.likelist`、喜欢/收藏/歌单管理相关 Endpoint 报告。

## 任务

先在 Checkpoint 记录本任务页面的 Section 清单、顺序、尺寸和条件，再实现我喜欢、歌单详情、次导航自建/收藏分组、查看全部、Loading/Empty/Error/Ready 和长列表虚拟化。

接入播放全部、从点击项集合播放、单曲插播、喜欢、收藏、自建歌单增删改和歌曲增删排序。所有写操作使用类型化用例、权限元数据、幂等键和真实 API 契约；用户直接危险操作使用普通 AlertDialog。

## 验收

游客隐藏次导航；登录态、分页、缓存、权益和失败来自 Adapter。队列语义、右键操作和键盘状态一致。输出 Checkpoint 后停止。
