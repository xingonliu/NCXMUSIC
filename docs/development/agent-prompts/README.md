# NcxMusic 全开发周期 Agent Prompt Pack

> 使用方式：从 `01` 开始，严格按编号把对应文件完整交给开发 Agent。不要一次发送多份，不要跳过 Gate。
> 唯一开发顺序：`docs/development/NcxMusic-Development-Roadmap.md`
> 唯一功能范围：`docs/product/NcxMusic-V1-Feature-Inventory.md`

## 使用规则

1. 第一次使用时，让 Agent 先执行 `00-common-execution-protocol.md`，此后每份阶段提示词也会要求重新读取它。
2. 一个提示词只对应一个可验收任务。Agent 完成、测试、提交、推送并写入 Checkpoint 后，才发送下一份。
3. 阶段结果为 `block` 时停止，不得继续。结果为 `fallback` 时，必须确认回退符合已有产品约束后才能继续。
4. 不把整个 PRD 或全部 API 报告塞进上下文；提示词会指定当前任务需要的专题文档和 Endpoint 报告。
5. 页面 Section 的具体组合在开发对应页面的提示词中决定并记录，不再提前统一写死。

## 顺序目录

| 编号 | Prompt | 结果 |
| ---: | --- | --- |
| 00 | [通用执行协议](./00-common-execution-protocol.md) | 所有任务共同约束 |
| 01 | [T-01 工程与进程骨架](./01-t01-process-skeleton.md) | 最小 Electron 多进程工程 |
| 02 | [T-02 登录 Session 与凭据租约](./02-t02-login-session.md) | 登录安全链路 Spike |
| 03 | [T-03 播放媒体链路](./03-t03-playback-media.md) | 可打包媒体链路 Spike |
| 04 | [T-04 全局按住说话](./04-t04-push-to-talk.md) | 双平台输入 Hook 结论 |
| 05 | [T-05 Shell 进程监督](./05-t05-shell-supervision.md) | 完整进程树回收结论 |
| 06 | [T-06 WindowChrome 与材质](./06-t06-window-chrome.md) | 双平台窗口框架结论 |
| 07 | [T-07 系统媒体集成](./07-t07-system-media.md) | 系统媒体键统一命令链路 |
| 08 | [T-08 Provider 与 ASR](./08-t08-provider-asr.md) | 三协议与 ASR 探测结论 |
| 09 | [Phase 0 Gate](./09-phase0-gate.md) | Foundation Ready |
| 10 | [Phase 1 工程质量基线](./10-phase1-engineering-foundation.md) | 质量、Contract、Migration 基础 |
| 11 | [Phase 1 Design System](./11-phase1-design-system.md) | Token 与通用组件 |
| 12 | [Phase 1 AppShell](./12-phase1-app-shell.md) | 路由、导航、WindowChrome 骨架 |
| 13 | [Phase 1 Gate](./13-phase1-gate.md) | UI/IPC Foundation |
| 14 | [Phase 2 账户与会话](./14-phase2-account-session.md) | 游客、登录、退出与换号 |
| 15 | [Phase 2 存储](./15-phase2-storage.md) | 账户隔离持久化 |
| 16 | [Phase 2 Music Service](./16-phase2-music-service.md) | API-A 标准实体服务 |
| 17 | [Phase 2 Gate](./17-phase2-gate.md) | Account & Data Ready |
| 18 | [Phase 3 播放领域](./18-phase3-player-domain.md) | 队列与播放状态纯逻辑 |
| 19 | [Phase 3 媒体与音质](./19-phase3-media-quality.md) | URL、音质和竞态处理 |
| 20 | [Phase 3 播放与搜索 UI](./20-phase3-player-search-ui.md) | 搜索到播放纵向链路 |
| 21 | [Phase 3 恢复与错误](./21-phase3-persistence-errors.md) | 快照、失败跳歌和回归 |
| 22 | [Phase 3 Gate](./22-phase3-gate.md) | Player Alpha |
| 23 | [Phase 4 歌单与我喜欢](./23-phase4-playlist-liked.md) | 首批完整音乐页面 |
| 24 | [Phase 4 专辑与歌手](./24-phase4-album-artist.md) | 专辑、歌手及推荐 |
| 25 | [Phase 4 发现页](./25-phase4-discovery.md) | Section 化发现体验 |
| 26 | [Phase 4 个人信息与设置](./26-phase4-profile-settings.md) | 账户资料和当前阶段设置 |
| 27 | [Phase 4 播放详情、歌词与菜单](./27-phase4-playback-lyrics-context.md) | 完整音乐客户端交互 |
| 28 | [Phase 4 Gate](./28-phase4-gate.md) | Music Client Alpha |
| 29 | [Phase 5 Provider 与引导](./29-phase5-provider-onboarding.md) | BYOK 模型配置闭环 |
| 30 | [Phase 5 Agent Runtime](./30-phase5-agent-runtime.md) | 手写单会话 Runtime |
| 31 | [Phase 5 Tools 与实体解析](./31-phase5-tools-entity.md) | 搜索播放与消歧闭环 |
| 32 | [Phase 5 权限与交互卡](./32-phase5-policy-cards.md) | 确定性审批和选择 |
| 33 | [Phase 5 全能力工具](./33-phase5-capability-tools.md) | 写操作与低频 API Gateway |
| 34 | [Phase 5 Gate](./34-phase5-gate.md) | Agent Alpha |
| 35 | [Phase 6 会话记忆](./35-phase6-memory.md) | 分块、摘要和 FTS5 |
| 36 | [Phase 6 音乐人格画像](./36-phase6-profile.md) | 初始化、更新和用户控制 |
| 37 | [Phase 6 个性化推荐](./37-phase6-recommendation.md) | 小云推荐能力 |
| 38 | [Phase 6 Gate](./38-phase6-gate.md) | Personalization Alpha |
| 39 | [Phase 7 语音](./39-phase7-voice.md) | 按住说话与云端 ASR |
| 40 | [Phase 7 Shell](./40-phase7-shell.md) | PowerShell/zsh Tool |
| 41 | [Phase 7 Dynamic Skill](./41-phase7-skill.md) | Skill 安装与隔离 Host |
| 42 | [Phase 7 MCP](./42-phase7-mcp.md) | stdio/Streamable HTTP Client |
| 43 | [Phase 7 Gate](./43-phase7-gate.md) | Extension Beta |
| 44 | [Phase 8 打包签名](./44-phase8-packaging.md) | 双平台安装包 |
| 45 | [Phase 8 质量硬化](./45-phase8-quality.md) | 性能、稳定性、无障碍 |
| 46 | [Phase 8 合规与数据](./46-phase8-compliance.md) | 隐私、迁移、许可证 |
| 47 | [Phase 8 发布候选](./47-phase8-release.md) | V1 Release Candidate |

## Checkpoint 约定

每个任务完成后，Agent 必须创建：

```text
docs/development/checkpoints/<Prompt 文件名去掉 .md>.md
```

Gate Prompt 负责核对前一阶段全部 Checkpoint。Checkpoint 是事实记录，不得用“基本完成”“大致可用”等模糊状态。
