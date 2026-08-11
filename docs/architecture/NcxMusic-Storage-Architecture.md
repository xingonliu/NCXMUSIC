# NcxMusic 本地存储与账户数据架构

> 文档状态：Baseline 0.1
> 建立日期：2026-08-04
> 最后更新：2026-08-10
> 关联决策：A-005、D-012、D-105、D-108、D-305、D-307、D-308、D-309、D-605

## 1. 基本原则

1. NcxMusic 是本地优先应用，不建设账户数据同步服务，不上传原始数据库或账户目录。
2. 画像、聊天、摘要和 Working Memory 不做应用级整库加密，以普通 SQLite/JSON 保存。
3. 能登录账号、调用付费模型或启动外部服务的凭据必须使用持久 Session 或系统 `safeStorage` 保护。
4. 登录用户的数据按网易云用户 ID 隔离；游客、全局设置、Skill/MCP 与可丢弃缓存使用不同空间。
5. Main、Utility Process 和 Renderer 各自只有明确的数据所有权，禁止多个进程竞争写入同一数据库。

## 2. 根目录

持久业务数据放在：

```text
path.join(app.getPath('userData'), 'ncx-data')
```

不直接写入裸 `appData`，也不在 `userData` 根目录创建通用名 `databases`。`userData` 已包含应用名；再使用 `ncx-data` 子目录可以避开 Chromium 的 Cache、GPUCache、Local Storage 等内部目录。

大型且可重新生成的封面、临时媒体和网络缓存放入应用 Cache 路径，不放进可能被云备份的持久用户数据目录。日志使用 Electron Logs 路径并执行滚动与脱敏。

## 3. 目录布局

```text
<userData>/ncx-data/
├─ settings/
│  ├─ app.json
│  └─ providers.json              # 只含配置与 credentialRef
├─ credentials/
│  ├─ index.json                  # 非秘密元数据
│  └─ blobs/                      # safeStorage 密文
├─ accounts/
│  ├─ netease/
│  │  └─ <numeric-user-id>/
│  │     ├─ account.json          # 可重建的账户显示快照
│  │     ├─ account.sqlite        # 对话、块、摘要、FTS5 索引、Action Journal 与结构化画像
│  │     ├─ profile.json          # 启动快速读取的画像快照
│  │     └─ working-memory.json   # 当前工作记忆快照
│  └─ guest/
│     └─ local/
│        ├─ account.sqlite
│        └─ working-memory.json
├─ skills/
│  └─ <skill-name>/
├─ mcp/
│  ├─ servers.json                # Secret 只放 credentialRef
│  └─ state/
└─ migrations/
   └─ state.json

<cache>/NcxMusic/
├─ artwork/
├─ api/
└─ media-temp/
```

`<numeric-user-id>` 必须先通过数字 ID Schema 校验，不能把接口返回的用户名或任意字符串直接作为路径。

## 4. 数据所有权

### Main

- 解析并创建所有根目录。
- 持有应用设置中的窗口、启动和当前账户指针。
- 持有网易云登录 Session、Cookie Store、safeStorage 密文和 Credential Lease。
- 执行账户空间切换、显式删除和退出清理的协调。
- 不打开聊天、画像或音乐缓存数据库。

### Utility Process

- 当前时刻只打开一个账户空间的 `account.sqlite`。
- 写入聊天块、摘要、Working Memory、画像、Agent 审计和账户相关音乐缓存。
- 使用原子替换写入 `profile.json` 与 `working-memory.json` 快照。
- 通过 Main 发放的内存租约获取 Cookie/API Key；不能把明文写回磁盘。

### Renderer

- 不直接访问文件系统、SQLite、Cookie Store 或 safeStorage。
- 只通过类型化 Gateway 获取 DTO 和状态快照。
- Pinia/localStorage 不能成为账户数据或凭据的权威来源；只允许保存无敏感性的短期 UI 状态。

## 5. 账户空间生命周期

```text
guest/local
   └─ login success → close guest store → open netease/<userId>

netease/<userId>
   ├─ logout → close store → revoke credential lease → guest/local
   ├─ switch account → close store → increment accountGeneration → open target
   └─ delete local data → validate accountId/generation → close store → delete exact account directory → reopen empty store
```

- 退出登录默认保留 `netease/<userId>`，再次登录同一 ID 时恢复画像、记忆和聊天。
- 游客数据不自动并入正式账号，避免将错误身份下的会话写入用户长期记忆。
- 切换账号会递增 `accountGeneration`；旧账号的迟到请求、后台画像任务和写入必须拒绝。
- 删除账号本地数据必须展示准确目录内的数据类别与不可恢复提示，并先校验当前 accountId/generation、关闭数据库和取消账户任务；该操作不撤销 Main 持有的登录 Cookie。
- 删除账户空间不等于删除网易云账号、歌单或云端数据。

## 6. SQLite 与文件快照

- 每个账户使用单一 `account.sqlite`，避免多个数据库之间的事务和迁移不一致。
- 当前账户 SQLite Schema v3 包含 `action_journal`、`playback_snapshot`、`account_preferences` 与 `agent_conversation_snapshot`；偏好值通过 JSON Schema 和 20KB 上限校验。
- SQLite 由 Utility Process 单写者持有，开启 WAL、外键和 Busy Timeout；Main 与 Renderer 不并发打开。
- Schema 使用递增 Migration Version。升级前创建可恢复备份或事务检查点，失败时停止写入并提示修复，不能以空库覆盖旧库。
- 当前 Agent 对话快照在消息、工具、审批或选择状态变化后短防抖写入 `agent_conversation_snapshot`，并在账号切换或退出前刷新；10 分钟无输入只关闭会话块和触发摘要，不延迟当前记录落库。
- 对话、消息块、摘要和画像结构化数据写入 SQLite；首版使用 SQLite FTS5 索引会话块摘要、可检索正文、关键词和必要原文，不创建本地向量索引，也不依赖云端 Embedding。
- `MemoryRetriever` 是检索实现边界。首版实现先按账户、时间、实体与内容类型过滤，再组合 FTS 相关性、摘要重要性和新鲜度排序；未来增加混合检索时只能通过 Schema Migration 和新后端实现扩展，不能改变上层 `memory_search` Tool 契约。
- `profile.json` 与 `working-memory.json` 是快速启动快照，不是唯一事实来源；采用临时文件写入、Flush 和同目录原子替换，损坏时从 SQLite 重建。
- 可重建的 API/封面缓存不进入账户备份，清理缓存不能删除画像或聊天。

基础资料表只接受已经通过 API 字段审计的明确返回值，并保存 `sourceApi` 与 `updatedAt`。称呼、性别、年龄等字段缺失、冲突或无法判断时写为 `unknown`/`null`，存储层不接受模型推断值冒充 API 事实。

画像变化基线保存上次成功画像对应的喜欢歌曲 ID 集合、自建歌单去重歌曲 ID 集合、快照版本和生成时间。新画像成功前不覆盖旧基线；失败或取消后仍能用同一旧基线重新计算差异。

## 7. 加密与凭据策略

### 普通业务数据

画像、聊天、摘要、基础信息和 Working Memory 不使用 SQLCipher、独立账户密钥或字段级 AES 加密，依靠当前操作系统用户目录权限。这样保留普通 SQLite 的可维护性、调试能力和后续全文检索能力。

不使用写死在应用中的“通用加密密钥”。公开客户端中硬编码的密钥可以被任何人提取，只会造成混淆，不能形成真实安全边界。

### 网易云 Cookie

- 官方登录窗口使用 `persist:ncx-netease-auth` 独立 Session Partition。
- Main 通过 Session Cookie API 查询网易云允许域名下的 Cookie，并在登录完成时 Flush Cookie Store。
- Cookie Store 是权威持久来源，不额外复制一份明文 `MUSIC_U`。
- Main 向 Utility Process 发放绑定 `accountId + accountGeneration` 的内存 Cookie Lease；退出、过期或换号立即撤销。

### 模型与 MCP 凭据

- API Key、MCP Token 和必要的 Secret 使用 `safeStorage.encryptString()` 生成密文 Buffer，再写入 `credentials/blobs`。
- 普通配置只保存 `credentialRef`，不保存密文路径之外的可逆信息。
- Main 在 `app.ready` 后检查 `safeStorage.isEncryptionAvailable()`。
- Windows/macOS 如果系统加密暂不可用，不允许明文持久化；用户可以选择仅在当前应用会话使用，并获得明确提示。

## 8. 云模型数据边界

“本地保存”不等于“模型请求永不出本机”。当用户选择云端 Provider 时：

- NcxMusic 不上传 `account.sqlite`、完整画像文件、歌单缓存目录或 Credential。
- Context Builder 只选择完成当前请求所需的对话、画像摘要、记忆片段和实体引用，并组成模型请求。
- 模型配置页、首次画像提示和隐私说明必须展示 Provider、发送数据类别和可能的 Token 费用。
- 完整本地歌单与聚合特征的具体发送边界仍由 A-009/D-306 决定。
- 选择本地模型时，上述模型上下文可以不离开设备，但 MCP、Skill 或 Shell 自己进行的网络访问仍按各自权限披露。

## 9. 保留、导出与删除

- 退出登录只退出身份，不自动删除账户数据。
- 用户可以查看每个账户空间的最后使用时间、数据库大小、画像版本和聊天数量。
- 导出必须默认排除 Cookie、API Key、MCP Secret、原始日志和临时缓存。
- “清理缓存”与“删除账户本地数据”是两个独立操作，名称和影响范围不能混淆。
- `account.data` Runtime 能力只接受当前 accountId/generation；缓存清理仅处理 `artwork`、`api`、`media-temp` 三个冻结目录，账户删除仅处理解析后的单一账户目录。
- 画像、聊天正文、会话块、摘要、Working Memory 和基础资料不自动过期；退出登录不触发删除，只有用户显式删除对应账户空间时清除。
- Action Journal 按账户保留最近 30 天或 10,000 条语义事件，任一上限到达即在事务中删除最旧记录；高频播放进度不得写入该表。该滚动清理不能连带删除聊天、摘要或画像数据。
- 调试日志和临时缓存使用各自的短期滚动策略，不能依赖用户手动清理，也不能复用 Action Journal 的业务保留规则。

## 10. 验收要求

- 两个网易云 ID 登录、退出和切换后，画像、聊天、缓存和迟到请求不能串号。
- 游客会话不能读取正式账户记忆，正式账户也不能自动吸收游客记忆。
- Renderer 无法通过 DevTools 或公开 Preload API 取得 Cookie、API Key、数据库路径或文件内容。
- Cookie/API Key 不出现在日志、Prompt、Tool 参数、错误详情、崩溃报告或 Git 文件中。
- safeStorage 不可用时不会创建明文 Secret 文件。
- 删除账户空间、清理缓存、退出登录和卸载场景分别测试，确保范围与文案一致。
- SQLite FTS5 只能召回当前账户数据，并能按时间、实体与内容类型过滤；关闭网络后仍可完成全文检索。
- 画像更新失败不会覆盖上次成功快照；最终集合相同、自建歌单间移动和批量导入场景得到冻结的变化分数。
- Action Journal 超过 30 天或 10,000 条时只清理最旧语义事件，聊天、摘要、画像和当前播放状态保持不变。
