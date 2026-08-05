# NcxMusic 系统架构基线

> 文档状态：Baseline 0.2（首版架构边界已冻结，技术 Spike 按门禁执行）
> 建立日期：2026-08-04
> 最后更新：2026-08-05
> 用途：记录跨进程拓扑、源码组织、依赖方向和架构决策；具体业务行为以 PRD 和各领域文档为准

## 1. 已确认的架构决策

| 编号 | 决策 | 状态 |
| --- | --- | --- |
| A-001 | Electron 采用 Main + Preload + Renderer + Utility Process 拓扑；内部通信使用受限 IPC/MessagePort，不建 localhost/SSE 服务。 | 已确认 |
| A-002 | 首版使用单仓库、单应用包、模块化单体；不预先拆多个 workspace package。 | 已确认 |
| A-003 | 使用 pnpm 管理单包依赖；electron-vite 负责开发与进程构建，electron-builder 负责 Windows/macOS 分发产物、签名和公证；不引入 Electron Forge。 | 已确认 |
| A-004 | Main 作为 ConnectionBroker 建立 Renderer/Preload 与 Utility Process 的版本化 MessagePort 数据通道；消息使用 Zod 严格 Schema、幂等命令和快照式重连。 | 已确认 |
| A-005 | 持久数据写入应用 `userData` 子目录并按网易云用户 ID 隔离；画像、记忆和聊天使用普通 SQLite/JSON，不做应用级整库加密；登录 Cookie 与 API Key 继续使用系统凭据保护。 | 已确认 |
| A-006 | Agent Runtime 完全手写并以 Turn/Tool 状态机运行；单会话同时只有一个 Active Turn，只读工具最多并行 4 个，有副作用工具串行；单 Turn 最多 12 轮工具循环和 24 个 Tool Call。 | 已确认 |
| A-007 | Policy Engine 使用正向能力注册和确定性纯函数分类；审批/选择通过状态机挂起和快照恢复，LLM 不参与权限判断。 | 已确认 |
| A-008 | Dynamic Skill 使用独立 Skill Host 子进程；MCP 使用官方 SDK 稳定 v1.x 的 `stdio` 与 Streamable HTTP，扩展经统一命名、审批、进程监督、原子更新与回滚管理。 | 已确认 |
| A-009 | 账户存储、SQLite FTS5 记忆检索、画像快照、基础资料、保留与删除边界由统一 Storage Architecture 管理。 | 已确认 |
| A-010 | 全局按住说话使用独立 InputHookHost 候选实现；Electron `globalShortcut` 只承担可用的组合键注册，不能替代 keyup。失败平台回退应用内麦克风按钮。 | 产品边界确认，Phase 0 验证 |
| A-011 | Shell 使用独立安全等级、授权工作区、保守语法分类、最小环境、输出上限和完整进程树监督；详细契约见 Shell Execution Baseline。 | 架构确认，Phase 0 验证 |
| A-012 | 播放器使用根层唯一 AudioHost、领域命令、generation 和播放快照；直接 HTTPS 与受控媒体代理、系统媒体中心集成进入 Phase 0 对比。 | 架构确认，Phase 0 验证 |

## 2. 运行时拓扑

```text
Renderer（Vue / Pinia / AudioHost）
             │
             │ 类型化、Schema 校验的 IPC / MessagePort
             ▼
Preload Bridge ↔ Electron Main ↔ Utility Process
                  │                 ├─ Agent Runtime
                  │                 ├─ Policy / Approval
                  │                 ├─ Music API Service
                  │                 ├─ MCP Manager / Skill Host Supervisor / Shell
                  │                 └─ Profile / Memory / Audit
                  └─ Window / Session / Credential / Supervisor
```

- Main 只拥有窗口、登录 Session、凭据、应用生命周期、全局快捷键和 Utility Process 监督能力，不承载 Agent 主循环或音乐业务。
- Preload 只暴露按用例命名的最小化方法和订阅函数，不暴露完整 `ipcRenderer`、Node.js 或通用任意通道。
- Renderer 持有 Vue UI、Pinia 读模型和唯一 HTMLAudioElement / PlaybackCoordinator，不获取 Cookie、Shell、文件系统或 NeteaseCloudMusicApiEnhanced 实例。
- Renderer 是单页面应用，业务页面全部通过 Vue Router 切换；二级路由由统一 PageHeader 提供返回动作，无有效应用内历史时使用路由声明的稳定父级回退，不通过重载或新建窗口模拟导航。
- Utility Process 直接引入 NeteaseCloudMusicApiEnhanced 作为本地依赖，并承载 Agent、确定性权限、MCP、Skill、Shell 与业务存储。
- Agent 播放命令通过 PlayerCommandGateway 送到 Renderer 根层常驻处理器，并等待真实执行回执；不调用 Vue/Pinia 函数。

跨进程消息信封、握手、流式顺序、错误、取消和重连规则见 `docs/architecture/NcxMusic-IPC-Protocol.md`。

本地目录、账户空间、数据所有权、凭据租约、保留与删除规则见 `docs/architecture/NcxMusic-Storage-Architecture.md`。

Agent Turn、Tool 调度、限制、审批挂起、取消和事件快照规则见 `docs/architecture/NcxMusic-Agent-Runtime.md`。

Dynamic Skill 包、独立 Host、MCP Transport、工具命名、生命周期和回滚规则见 `docs/architecture/NcxMusic-Extensions-Architecture.md`。

## 3. 源码组织

```text
src/
├─ main/                    # Electron Main 组合根与平台能力
├─ preload/                 # contextBridge 与受限 IPC 适配
├─ renderer/                # Vue SPA、Pinia、AudioHost、Design System
├─ utility/                 # Utility Process 组合根与任务监督
├─ domains/
│  ├─ player/               # 播放状态、队列、命令与纯算法
│  ├─ music/                # 歌曲/歌单用例、统一实体与 Service Port
│  ├─ agent/                # 主循环、Tool 协调与上下文规则
│  ├─ security/             # 动作分类、策略函数与审批状态机
│  ├─ memory/               # 会话块、摘要、Working Memory
│  └─ profile/              # 基础信息、画像与变化计分
├─ shared/
│  ├─ contracts/            # 跨进程 DTO、命令、事件与快照
│  ├─ schemas/              # 运行时 Schema 与协议版本
│  └─ errors/               # 稳定错误码和裁剪后错误
└─ infrastructure/
   ├─ electron/             # IPC、MessagePort、Window、Session 适配
   ├─ netease/              # NeteaseCloudMusicApiEnhanced Adapter
   ├─ persistence/          # SQLite、文件快照、迁移与仓储实现
   ├─ credentials/          # 平台 Credential Vault 适配
   ├─ extensions/           # Dynamic Skill Host、MCP Client 与扩展生命周期
   ├─ media/                # HTMLAudioElement / Media Session 副作用适配
   └─ shell/                # PowerShell / zsh 执行适配

tools/
└─ api-lab/                 # API First 脚本、脱敏样本与字段分析，不打进生产包
```

首版只保留一个根 `package.json` 和锁文件。目录数量不决定安装体积；生产打包体积由实际包含的运行时代码、依赖、Chromium/Electron、资源和源码映射决定。

## 4. 强制依赖方向

1. `domains/**` 不导入 Electron、Vue、Pinia、DOM、SQLite Driver、HTTP Client 或 NeteaseCloudMusicApiEnhanced；领域层只描述实体、用例、Port 和纯规则。
2. `shared/**` 不导入任何进程入口或基础设施；跨进程数据必须可结构化克隆，不传函数、DOM 对象、数据库句柄或原始敏感凭据。
3. `renderer/**` 不导入 `main/**`、`utility/**`、`infrastructure/netease`、`infrastructure/credentials`、`infrastructure/persistence` 或 `infrastructure/shell`。
   `reka-ui` 只能由 `renderer/design-system/primitives/reka/**` 导入；页面、Feature 和领域组件只能使用 NcxMusic Design System 的公开组件入口，第三方 Props、Emits 和类型不得泄漏到业务层。
4. `preload/**` 只导入 `shared/contracts`、`shared/schemas` 和最小 Electron API，不编写业务流程。
5. `main/**` 不执行 Agent 主循环、音乐 API 用例或数据分析；它只组装平台级 Adapter 和进程通道。
6. `utility/**` 不导入 Vue、Pinia、DOM 或 Renderer 实现；播放控制只能通过共享 `PlayerCommand` 契约进入 Renderer。
7. `infrastructure/**` 实现领域 Port，由各进程组合根注入；领域层不反向依赖具体 Adapter。

以 ESLint `no-restricted-imports`、路径边界测试和 CI 架构检查强制上述规则，不仅依赖代码评审约定。

## 5. 组合根

- `main/bootstrap` 创建窗口、Session、Credential Vault、快捷键、IPC Gateway 和 Utility Supervisor。
- `utility/bootstrap` 创建 Music Service、Agent Runtime、Policy Engine、MCP/Skill/Shell Manager 和持久化 Adapter。
- `renderer/bootstrap` 创建 Vue App、Pinia、AudioHost、PlayerCommandBridge 和只读快照订阅。
- `preload/index` 只完成通道包装、参数 Schema 校验和回调事件裁剪。

组合根之外禁止随意读取全局单例。需要全局寿命的对象由组合根创建一次，再显式注入使用方。

## 6. 开发、构建与分发工具链

- 根目录只保留一个 `package.json`、一份 `pnpm-lock.yaml` 和一组统一脚本，不为进程入口建立独立 package。
- `electron-vite` 负责开发服务器、Renderer HMR、Main/Preload 热重载和生产构建。Main 构建配置增加 Utility Process 独立入口，并输出稳定文件名供 `utilityProcess.fork()` 启动。
- `electron-builder` 只消费构建完成的产物：Windows 首选 NSIS，macOS 输出 DMG 与 ZIP；签名证书、公证凭据和发布令牌只从 CI Secret 或本机安全环境注入。
- 首版不引入 updater，不实现应用内检查更新、自动下载或安装。`electron-builder` 只负责生成 Windows/macOS 安装与归档产物；关于页展示当前版本和开源仓库入口，用户自行获取新版本。
- 不同时引入 Electron Forge。Forge 与 electron-vite/electron-builder 在构建、打包和发布编排上职责重叠，会增加两套配置之间的漂移风险。
- Electron、Node.js、pnpm、electron-vite 和 electron-builder 的精确版本在技术验证阶段共同冻结，并由锁文件和 CI 运行时文件约束；架构文档不写死未经验证的版本号。

标准脚本语义冻结为：

```text
pnpm dev          # 启动 Main、Preload、Renderer 与 Utility Process 开发环境
pnpm typecheck    # 全进程 TypeScript 检查
pnpm lint         # 代码规范与依赖边界检查
pnpm test         # 单元与契约测试
pnpm build        # 只生成生产构建目录
pnpm package      # 生成当前平台未发布安装包
pnpm release      # 仅供受保护 CI 发布，不作为本地常规命令
```

## 7. 未来拆分 workspace 的触发条件

只在至少出现一项明确需求时拆分内部 package：

- 某模块需要独立发布、独立版本或被第二个应用复用。
- 需要可独立缓存的构建/测试单元，且能显著改善 CI 时间。
- 依赖或运行时目标真正冲突，无法在单包内通过进程构建入口解决。
- 安全或供应链边界要求独立审计、签名或发布。

代码行数、目录数量或“看起来更专业”不是拆包理由。

## 8. 剩余技术验证

这里不再包含需要继续访谈的架构取舍，只包含以代码和双平台产物验证的实现风险：

1. A-010：各 Provider 的 ASR 调用适配、InputHookHost、原生模块打包与平台权限。
2. A-011：PowerShell AST、zsh 保守分类、路径边界和完整进程树回收。
3. A-012：播放 URL、Range/Seek、媒体键、系统媒体中心与双平台音频生命周期。
4. electron-vite 多入口、Utility Process 打包路径和依赖精确版本。

验证步骤、通过条件和回退路径统一以 `docs/development/NcxMusic-Technical-Spike-Plan.md` 为准，不在本文件继续引入产品待确认项。
