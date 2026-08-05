# Prompt 20：Phase 3 搜索到播放 UI

执行通用协议，只完成第一个真实可用纵向闭环。

## 必读

- Player Domain 的 Vue SPA 集成章节。
- Design System 音乐组件、页面状态和 PageHeader。
- `ncm.search`、`ncm.cloudsearch`、搜索建议、歌曲详情与歌词 Endpoint 报告。
- 功能清单 MUS-002/003/013/014、PLY-001～020。

## 任务

实现根层唯一 AudioHost、Renderer Playback Adapter、只读 Pinia Snapshot、PlayerBar、QueueDrawer、TrackRow、MediaArtwork、最小搜索页/结果页、播放详情和歌词视图。搜索歌曲后可获得真实 URL，完成播放、暂停、上一首、下一首、seek、音量、模式、队列操作和歌词。

按钮和路由只发共享命令，不能直接维护第二套播放状态。PlayerBar 隐藏或路由切换不得卸载 AudioHost。

## 验收

游客搜索到播放 E2E、键盘/空状态/错误状态、VIP/付费标记和集合/单曲队列语义通过。输出 Checkpoint 后停止。
