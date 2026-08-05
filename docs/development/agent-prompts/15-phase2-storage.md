# Prompt 15：Phase 2 存储与账户空间

执行通用协议，只实现正式持久化与生命周期。

## 必读

- `docs/architecture/NcxMusic-Storage-Architecture.md`。
- 系统架构和 IPC Protocol。
- 功能清单 DAT-008～014、ACC-008/009、SET-010。

## 任务

实现 `userData/ncx-data`、账户 ID 隔离空间、SQLite Migration、普通配置/JSON 原子快照、Cache、Action Journal 基础和播放快照仓储接口。区分 Main、Utility、Renderer 所有权；模型/MCP Secret 使用 `safeStorage`，普通业务数据不做整库加密。

实现退出保留、显式按账号删除、换号关闭旧句柄、损坏检测与可恢复备份策略。Working Memory、画像和聊天表可以只建立经架构确认的迁移骨架，不实现业务逻辑。

## 验收

迁移、幂等重跑、损坏、原子写、并发句柄、换号和删除测试通过；Secret 不落普通数据库。设置页只接通当前阶段的存储/隐私能力。输出 Checkpoint 后停止。
