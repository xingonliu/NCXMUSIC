# Prompt 18：Phase 3 播放领域与队列

执行通用协议，只实现纯 TypeScript 播放领域，不接 UI 和真实媒体。

## 必读

- `docs/architecture/NcxMusic-Player-Domain.md`。
- 系统架构、IPC Protocol。
- 功能清单 PLY-001～015。

## 任务

实现 QueueController、PlaybackEngine 状态机、PlaybackCoordinator 命令入口和领域事件。完整覆盖单曲插入并立即播放、集合替换、上一首、列表/单曲循环、可见队列 Shuffle、拖动、删除当前项、清空、不可播放轮次和 generation 竞态。

领域层不能导入 Electron、Vue、DOM、Pinia、HTTP 或数据库。所有命令返回结构化结果，索引和当前项保持不变量。

## 验收

按 Player Domain 测试矩阵建立高覆盖单元/属性测试，特别验证快速命令、末项删除、单项循环、Shuffle 后拖动和全队列失败。输出 Checkpoint 后停止。
