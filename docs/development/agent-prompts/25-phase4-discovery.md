# Prompt 25：Phase 4 发现页

执行通用协议，只开发发现页，不引入小云画像逻辑。

## 必读

- Design System 的 Section Contract。
- 功能清单 MUS-001、APP-009/010。
- `ncm.homepage_block_page`、personalized、recommend、toplist、top_playlist、top_artists 等已审计 Endpoint 报告。

## 任务

基于当前已可用内容先在 Checkpoint 确定发现页 Section 清单、顺序、尺寸、条件和数据源，再通过 Section Registry 实现。每个 Section 独立加载、失败、刷新和隐藏；单块失败不能阻断页面。

支持平台推荐、最近播放、榜单/歌单/歌手等被选中的候选内容，以及当前可见歌曲的“播放全部”。为未来“小云为你推荐”保留条件注册能力，但本任务不实现空壳、不调用模型、不生成画像。

## 验收

游客/登录、缓存/离线、部分失败、紧凑窗口和集合播放 E2E 通过。输出 Checkpoint 后停止。
