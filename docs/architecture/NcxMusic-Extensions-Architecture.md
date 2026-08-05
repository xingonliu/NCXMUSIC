# NcxMusic Dynamic Skill 与 MCP 扩展架构

> 文档状态：Baseline 0.1
> 建立日期：2026-08-05
> 关联决策：A-008、D-501～D-506、D-507～D-511

## 1. 范围与原则

本架构只覆盖 Dynamic Skill 和外部 MCP Server。内置音乐 Tool、Shell Executor 与 NeteaseCloudMusicApiEnhanced Capability Catalog 仍由各自领域管理。

1. 扩展能力必须先进入正向注册表，未注册工具不可见、不可调用。
2. 安装、启用、更新、执行和删除是不同生命周期动作，不能用一次安装审批永久代替后续策略判断。
3. 第三方声明、MCP Tool Annotations 和 Skill Frontmatter 都是不可信输入，只能用于展示和初步校验。
4. 第三方进程不能取得网易云 Cookie、模型 API Key、账户数据库句柄或 Main/Renderer 的通用 IPC 能力。
5. 首版不建设 Skill 市场，不自动更新扩展，不支持运行时安装 npm/pnpm 依赖或原生 Node 模块。

## 2. 运行时拓扑

```text
Agent Runtime / Tool Registry
             │
             ▼
Extension Gateway（Utility Process）
├─ SkillManager
│  ├─ ManifestValidator
│  ├─ InstallStager
│  └─ SkillHostSupervisor ── typed RPC ── Skill Host 子进程（每个活动 Skill）
└─ McpManager
   ├─ ServerRegistry
   ├─ TransportFactory
   ├─ ToolNamespaceMapper
   └─ LifecycleSupervisor
       ├─ stdio 子进程
       └─ Streamable HTTP Client
```

- Utility Process 管理扩展注册、审批、状态和 Tool Result，但不直接 `import()` 第三方 Skill JavaScript。
- Skill Host 在独立子进程内执行 `dynamic import()`，按 Skill 隔离崩溃、模块缓存和运行状态。
- MCP `stdio` Server 是独立子进程；Streamable HTTP 只通过 SDK Client 建立远程会话。
- 所有扩展结果回到 Agent 前再次经过输出 Schema、大小限制、脱敏和错误归一化。

进程隔离主要提供故障与凭据隔离，不宣传为绝对安全沙箱。第三方 JavaScript 仍属于用户选择运行的本地代码；安装/启用界面必须明确披露。若锁定的 Electron/Node 运行时提供经验证的稳定权限机制，可作为纵深防御使用，但不能替代审批和最小凭据边界。

## 3. Dynamic Skill 包结构

安装后的权威位置：

```text
<userData>/ncx-data/skills/<skill-name>/
├─ SKILL.md
├─ index.js                 # 可选；Prompt-only Skill 可以没有
├─ assets/                  # 可选
├─ vendor/                  # 可选；随包附带的纯 JavaScript 依赖
└─ .ncx-skill.json          # NcxMusic 生成的来源、哈希与启用状态
```

`SKILL.md` YAML Frontmatter 至少支持：

```yaml
name: example-skill
version: 1.0.0
description: 示例技能
entry: ./index.js
tools:
  - name: example_action
    description: 执行示例动作
```

约束：

- `name` 使用稳定的小写 slug，并与目录名一致；不能包含路径分隔符或相对路径片段。
- `entry` 必须解析在当前 Skill 根目录内；符号链接、junction 和路径逃逸必须拒绝。
- Frontmatter、Prompt 正文、工具名称、Schema 和资源大小均设置上限。
- Tool 的风险声明只作为安装卡片说明，不直接获得免审资格。
- Prompt-only Skill 只参与按需 Prompt 注入，不注册 JavaScript Tool。

## 4. 来源与安装

首版支持：

1. 用户直接编辑 AppData Skill 目录。
2. 从本地文件夹或 ZIP 导入。
3. 从 HTTPS Git 仓库安装，并记录解析后的 commit。

首版不提供公共市场、排行榜、自动推荐安装或后台静默下载。远程内容先进入应用生成的 staging 目录；校验完成并取得授权前，不能执行脚本、导入模块或安装依赖。

新发现、导入或下载的 Skill 默认 `disabled`：

- 小云发起安装或启用时使用 ApprovalCard，按钮固定为“批准”“拒绝”。
- 用户在设置页主动导入、启用、更新或卸载时，使用普通 Dialog/AlertDialog，而不是伪装成 Agent 审批。
- 手工复制到 AppData 目录只代表“发现”，不代表允许执行 JavaScript 或注入 Prompt；用户必须显式启用。

安装记录至少包含来源类型、来源地址、本地导入路径摘要、Git commit、声明版本、内容 SHA-256、安装时间、启用状态和上一版本引用。第三方包默认显示“未签名”，首版不自建签名机构或信任商店。

## 5. JavaScript 与依赖边界

- 第三方入口只在对应 Skill Host 中通过动态 `import()` 加载。
- Skill Host 使用明确的工作目录和最小环境变量；不继承 Main/Utility Process 的凭据租约和无关环境变量。
- Skill Host 只获得版本化 RPC：注册 Tool、接收已校验输入、返回结构化结果、报告进度和响应取消。
- 首版不在用户设备上运行 `npm install`、`pnpm install`、`postinstall`、`prepare` 或其他 lifecycle script。
- 不支持 `.node` 原生模块、平台二进制依赖、Git/File 依赖和下载后编译。
- Skill 如需依赖，必须把可审计的纯 JavaScript ESM 随包放入自身目录；所有文件计入内容哈希。
- Dynamic import 失败、Schema 不匹配、重复工具名或进程崩溃只停用该 Skill，不能拖垮 Agent Runtime 或播放器。

第三方 Skill Tool 默认作为外部扩展动作进入 PolicyGateway。Skill 自报的只读、幂等或低风险标签不能直接放行；只有调用 NcxMusic 已注册的类型化音乐/Shell Capability 时，才由对应 M/S 规则重新分类。无法映射到已知能力的自定义 JavaScript Tool 首版逐次请求 ApprovalCard。

## 6. Skill 更新、回滚与卸载

- 不后台检查或自动安装更新；用户或小云显式发起时才检查。
- 新版本下载到 staging，重新校验完整包和内容哈希；小云发起更新必须审批，用户直接操作使用普通确认。
- 确认后停止旧 Skill Host，原子切换目录和注册表；保留一个上一版本用于回滚。
- 更新失败继续使用旧版本，不能留下半安装状态或混合文件。
- 卸载先停用并撤销 Tool Registry，再移动到应用内 `.trash`；保留 7 天供恢复，期满后删除。
- 回滚与恢复后按目标版本重新校验，不能复用已经变化的工具注册快照。

## 7. MCP 传输范围

首版基于官方 `@modelcontextprotocol/sdk` 稳定 v1.x，精确版本在开发初始化时锁入 pnpm lockfile。2026-08-05 规划时以官方 v1.29 文档验证以下客户端传输：

- `StdioClientTransport`：本地 MCP Server，由 NcxMusic 启动和监督子进程。
- `StreamableHTTPClientTransport`：远程 MCP Server，支持 SDK 的协议协商、会话和认证适配。

首版不实现旧 HTTP+SSE Transport，不做自动回退，也不提供对应配置类型或导入迁移。SDK v2 alpha 不进入首版生产依赖。

## 8. MCP 配置与安装审批

MCP Server 配置至少包含：

```text
serverId
displayName
transport            // stdio | streamable_http
command/args/cwd      // stdio
url                   // streamable_http
credentialRefs
enabled
source
resolvedVersion/hash
lastKnownCapabilities
lastKnownTools
```

- Secret 只保存为 Credential Vault 引用，不写入配置、Prompt、卡片或日志。
- `stdio` 环境变量使用显式 allowlist 构造，不继承完整进程环境。
- 小云发起安装时必须展示 Server 来源、Transport、命令或 URL、参数、工作目录、环境变量名称、声明能力和可能启动的进程；批准前零写入、零启动、零连接。
- 安装批准只授权保存并按这份不可变配置启动 Server。命令、参数、URL、工作目录、凭据引用或已启用工具范围变化后必须重新批准。
- 用户在设置页直接新增配置时使用普通确认；这不绕过后续 MCP Tool Call 审批。

首次连接后通过 SDK 读取真实 capabilities 与 tools，并与安装声明比较。新增、消失或 Schema 变化的工具更新为待确认状态，不能因为 Server 自报 `readOnlyHint` 或 `destructiveHint` 就自动启用或免审。

## 9. MCP Tool 命名与权限

内部唯一名称固定为：

```text
mcp.<serverId>.<toolName>
```

- 内置 Tool 名称是保留命名空间，外部 MCP Server 永远不能覆盖。
- 两个 Server 暴露相同 `toolName` 时仍通过 `serverId` 区分。
- 原始名称与 Server 名称保留在 ToolExecutionCard 中，便于用户理解来源。
- Server ID 或工具名变化视为新能力，不能继承旧注册和审批状态。

官方 SDK 的 Tool Annotations 只视为不可信提示。首版所有外部 MCP Tool Call 都逐次展示 ApprovalCard，不受 M1~M4 或 S1~S4 的免审等级影响，也不新增第三个全局安全按钮。安装审批、进程启动授权和单次 Tool Call 审批是三个不同概念。

## 10. MCP 生命周期

### stdio

- 已启用 Server 在首次测试连接或首次调用时按需启动，不随应用启动批量拉起。
- 安装批准后，使用未变化的已确认配置进行正常启动或重连不重复弹安装审批。
- 没有进行中请求、订阅或待处理任务时，空闲 10 分钟关闭。
- 非用户主动关闭的崩溃采用短退避最多自动重启 3 次；仍失败后进入 `failed_disabled`，等待用户手动重试。
- 禁用、更新、删除、应用退出或账号边界要求关闭时，显式调用 SDK Client/Transport `close()`，随后确认子进程退出并清理未决请求。

### Streamable HTTP

- 只在测试连接或实际使用时建立会话。
- 禁用、删除、应用退出、凭据撤销或账户切换时显式关闭 Client/Transport 和未决请求。
- 网络恢复可以重新建立连接，但不能自动重放已经提交的 Tool Call。

## 11. MCP 更新、删除与回滚

- 不自动更新 Server 包、远程地址或配置。
- 小云发起安装、更新和删除都使用 ApprovalCard；用户在设置页主动操作使用普通确认或不可逆 AlertDialog。
- 更新先保留旧配置，验证新配置能完成 initialize/tools list 后再原子切换；失败时恢复旧配置。
- 删除只移除 NcxMusic 内的配置、凭据引用和可安全识别的应用缓存，不删除 Server 在外部目录、远程服务或第三方系统中创建的数据。
- `stdio` 包版本或可执行入口必须解析为稳定版本/哈希；不能把始终指向 `latest` 的命令当作已锁定安装。

## 12. 验收要求

- 手工放入、文件夹/ZIP 导入和 HTTPS Git 安装都先进入禁用状态，批准前不执行任何 JavaScript。
- Skill 路径逃逸、符号链接逃逸、原生模块、依赖安装脚本和工具重名被确定性拒绝。
- 一个 Skill Host 崩溃只影响自身；Utility Process、播放器和其他 Skill 保持运行。
- `stdio` 与 Streamable HTTP 均能完成 initialize、工具发现、单次审批、调用、取消和关闭；旧 SSE 配置不能创建或导入。
- MCP Tool Annotations 无法改变 NcxMusic 的审批结果；每次 Tool Call 都绑定新的 ApprovalCard。
- 内置工具、两个同名 MCP 工具和 Skill 工具同时存在时，内部名称唯一且调用来源可见。
- MCP 配置变化后必须重新批准；相同配置的正常重连不重复请求安装审批。
- 更新失败可回到上一版本/配置；卸载不会误删扩展在 NcxMusic 数据目录之外创建的数据。
