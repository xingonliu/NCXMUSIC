# Prompt 35：Phase 6 会话分块与长期记忆

执行通用协议，只实现会话历史、Working Memory 和检索。

## 必读

- Agent Runtime 的事件、持久化和上下文章节。
- Storage Architecture。
- 功能清单 MEM-001～006、AGT-011、DAT-011～013。
- PRD 中会话分块、摘要、FTS5、保留与删除条目；定向读取。

## 任务

实现用户 10 分钟无消息结束会话块、SQLite 持久化、每块摘要、当前块 Working Memory、账户内 FTS5 全文检索和 Context Selector。Prompt 只装载当前任务需要的高价值摘要/原文，不默认全历史。

实现损坏重建、退出登录保留、按账号删除、换号隔离和模型摘要失败恢复。此阶段不引入向量模型或 Provider Embedding。

## 验收

分块边界、摘要重试、FTS 排序、账户隔离、上下文预算、删除和重启恢复测试通过。输出 Checkpoint 后停止。
