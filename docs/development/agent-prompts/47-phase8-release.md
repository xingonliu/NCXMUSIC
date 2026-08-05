# Prompt 47：NcxMusic V1 发布候选门禁

执行通用协议。这是最终审计与发布候选生成任务，禁止新增范围。

## 必读

- 完整功能清单、最终开发顺序。
- Phase 0～8 全部 Checkpoint 与 ADR。
- API Audit 聚合报告、所有架构和 Design System 基线。

## 任务

建立 201 个功能编号到实现、测试和文档的最终追踪矩阵；逐项标记 `passed | fallback | blocked`，不得用文件存在代替行为验证。复跑 Unit、Contract、Component、Integration、E2E、build、双平台 packaged smoke、秘密扫描和依赖/许可证检查。

核对明确不做：Linux、TTS、本地 ASR、支付、完整 MV/播客/电台页、多会话、Agent 侧边栏、Skill 市场、MCP 旧 SSE、向量记忆、应用内更新器均不存在。

生成 Release Notes、Known Issues、安装包哈希、版本 Tag 候选和最终 `47-phase8-release.md`。只有两个平台均可安装、核心路径无阻断、所有 fallback 符合冻结约束时标记 `V1 Release Candidate/pass`。不要创建公开 Release 或 Tag，除非用户另行明确授权；提交推送后停止。
